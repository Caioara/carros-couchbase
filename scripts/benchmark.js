const couchbase = require("couchbase");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const CONFIG = {
  inserts: parseInt(process.env.BENCH_INSERTS || "1000", 10),
  reads: parseInt(process.env.BENCH_READS || "1000", 10),
  updates: parseInt(process.env.BENCH_UPDATES || "500", 10),
  deletes: parseInt(process.env.BENCH_DELETES || "500", 10),
  concurrency: parseInt(process.env.BENCH_CONCURRENCY || "50", 10)
};

function nowMs() {
  const [sec, nanosec] = process.hrtime();
  return sec * 1000 + nanosec / 1e6;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

async function runWithConcurrency(items, worker, concurrency) {
  let index = 0;
  const results = [];

  async function runner() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current]);
    }
  }

  const runners = Array.from({ length: concurrency }, () => runner());
  await Promise.all(runners);
  return results;
}

function summarize(latencies, totalMs) {
  const sorted = [...latencies].sort((a, b) => a - b);
  const count = latencies.length;
  const sum = latencies.reduce((acc, value) => acc + value, 0);
  const avg = count > 0 ? sum / count : 0;

  return {
    count,
    totalMs,
    throughputOps: totalMs > 0 ? (count / totalMs) * 1000 : 0,
    avgMs: avg,
    p50Ms: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95),
    p99Ms: percentile(sorted, 99)
  };
}

function buildCarPayload(index) {
  return {
    type: "car",
    plate: `ZZZ-${String(index).padStart(4, "0")}`,
    model: "Bench",
    brand: "Benchmark",
    year: 2020,
    color: "Cinza",
    createdAt: new Date().toISOString()
  };
}

async function main() {
  const connStr = process.env.CB_CONNSTR;
  const username = process.env.CB_USERNAME;
  const password = process.env.CB_PASSWORD;
  const bucketName = process.env.CB_BUCKET;

  if (!connStr || !username || !password || !bucketName) {
    throw new Error("Variaveis de ambiente do Couchbase nao configuradas.");
  }

  const cluster = await couchbase.connect(connStr, { username, password });
  const bucket = cluster.bucket(bucketName);
  const collection = bucket.defaultCollection();

  const ids = Array.from({ length: CONFIG.inserts }, (_, i) => `bench::${Date.now()}::${i}`);

  const insertLatencies = [];
  const insertStart = nowMs();
  await runWithConcurrency(ids, async (id, idx = 0) => {
    const start = nowMs();
    await collection.upsert(id, buildCarPayload(idx));
    insertLatencies.push(nowMs() - start);
  }, CONFIG.concurrency);
  const insertTotal = nowMs() - insertStart;

  const readIds = ids.slice(0, CONFIG.reads);
  const readLatencies = [];
  const readStart = nowMs();
  await runWithConcurrency(readIds, async (id) => {
    const start = nowMs();
    await collection.get(id);
    readLatencies.push(nowMs() - start);
  }, CONFIG.concurrency);
  const readTotal = nowMs() - readStart;

  const updateIds = ids.slice(0, CONFIG.updates);
  const updateLatencies = [];
  const updateStart = nowMs();
  await runWithConcurrency(updateIds, async (id) => {
    const start = nowMs();
    await collection.upsert(id, { ...buildCarPayload(1), updatedAt: new Date().toISOString() });
    updateLatencies.push(nowMs() - start);
  }, CONFIG.concurrency);
  const updateTotal = nowMs() - updateStart;

  const deleteIds = ids.slice(0, CONFIG.deletes);
  const deleteLatencies = [];
  const deleteStart = nowMs();
  await runWithConcurrency(deleteIds, async (id) => {
    const start = nowMs();
    await collection.remove(id);
    deleteLatencies.push(nowMs() - start);
  }, CONFIG.concurrency);
  const deleteTotal = nowMs() - deleteStart;

  const payloadSize = Buffer.from(JSON.stringify(buildCarPayload(1))).length;

  const results = {
    timestamp: new Date().toISOString(),
    config: CONFIG,
    storage: {
      averageDocumentBytes: payloadSize,
      totalInsertedBytes: payloadSize * CONFIG.inserts
    },
    performance: {
      insert: summarize(insertLatencies, insertTotal),
      read: summarize(readLatencies, readTotal),
      update: summarize(updateLatencies, updateTotal),
      delete: summarize(deleteLatencies, deleteTotal)
    }
  };

  const outputPath = path.join(__dirname, "..", "data", "results.json");
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

  console.log("Benchmark concluido. Resultados em data/results.json");
  await cluster.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

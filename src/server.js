const path = require("path");
const express = require("express");
const couchbase = require("couchbase");
const dotenv = require("dotenv");
const { initCouchbase } = require("./couchbase");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

function validateCar(payload) {
  const errors = [];

  if (!payload.plate || typeof payload.plate !== "string") {
    errors.push("placa");
  }
  if (!payload.model || typeof payload.model !== "string") {
    errors.push("modelo");
  }
  if (!payload.brand || typeof payload.brand !== "string") {
    errors.push("marca");
  }
  if (typeof payload.year !== "number") {
    errors.push("ano");
  }
  if (!payload.color || typeof payload.color !== "string") {
    errors.push("cor");
  }

  return errors;
}

app.get("/api/cars", async (req, res) => {
  try {
    const { cluster } = await initCouchbase();
    const bucketName = process.env.CB_BUCKET;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);

    const countQuery = `SELECT COUNT(1) AS total FROM \`${bucketName}\` c WHERE c.type = $1`;
    const listQuery = `SELECT META(c).id AS id, c.* FROM \`${bucketName}\` c WHERE c.type = $1 ORDER BY c.createdAt DESC LIMIT $2 OFFSET $3`;

    const [countResult, listResult] = await Promise.all([
      cluster.query(countQuery, { parameters: ["car"] }),
      cluster.query(listQuery, { parameters: ["car", limit, offset] })
    ]);

    res.json({
      items: listResult.rows,
      total: countResult.rows[0]?.total || 0,
      limit,
      offset
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/cars/:id", async (req, res) => {
  try {
    const { collection } = await initCouchbase();
    const result = await collection.get(req.params.id);

    res.json({ id: req.params.id, ...result.content });
  } catch (error) {
    if (error instanceof couchbase.DocumentNotFoundError) {
      return res.status(404).json({ error: "Carro nao encontrado." });
    }

    res.status(500).json({ error: error.message });
  }
});

app.post("/api/cars", async (req, res) => {
  try {
    const errors = validateCar(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: "Campos invalidos.", fields: errors });
    }

    const { collection } = await initCouchbase();
    const carId = `car::${Date.now()}`;

    const doc = {
      type: "car",
      plate: req.body.plate,
      model: req.body.model,
      brand: req.body.brand,
      year: req.body.year,
      color: req.body.color,
      createdAt: new Date().toISOString()
    };

    await collection.insert(carId, doc);
    res.status(201).json({ id: carId, ...doc });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/cars/:id", async (req, res) => {
  try {
    const errors = validateCar(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: "Campos invalidos.", fields: errors });
    }

    const { collection } = await initCouchbase();
    const carId = req.params.id;

    const doc = {
      type: "car",
      plate: req.body.plate,
      model: req.body.model,
      brand: req.body.brand,
      year: req.body.year,
      color: req.body.color,
      updatedAt: new Date().toISOString()
    };

    await collection.upsert(carId, doc);
    res.json({ id: carId, ...doc });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/cars/:id", async (req, res) => {
  try {
    const { collection } = await initCouchbase();
    await collection.remove(req.params.id);

    res.json({ ok: true });
  } catch (error) {
    if (error instanceof couchbase.DocumentNotFoundError) {
      return res.status(404).json({ error: "Carro nao encontrado." });
    }

    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});

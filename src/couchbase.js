const couchbase = require("couchbase");

let cluster;
let bucket;
let collection;

async function initCouchbase() {
  if (cluster) {
    return { cluster, bucket, collection };
  }

  const connStr = process.env.CB_CONNSTR;
  const username = process.env.CB_USERNAME;
  const password = process.env.CB_PASSWORD;
  const bucketName = process.env.CB_BUCKET;

  if (!connStr || !username || !password || !bucketName) {
    throw new Error("Variaveis de ambiente do Couchbase nao configuradas.");
  }

  cluster = await couchbase.connect(connStr, {
    username,
    password
  });

  bucket = cluster.bucket(bucketName);
  collection = bucket.defaultCollection();

  return { cluster, bucket, collection };
}

module.exports = {
  initCouchbase
};

const fs = require('fs').promises;
const path = require('path');
const mongoose = require('mongoose');

const DB_PATH = path.join(__dirname, 'db.json');
const MONGODB_URI = String(process.env.MONGODB_URI || '').trim();
const USE_MONGO_DB = Boolean(MONGODB_URI);

let mongoConnectPromise = null;
let MongoDbState = null;

if (USE_MONGO_DB) {
  const dbStateSchema = new mongoose.Schema(
    {
      key: { type: String, required: true, unique: true },
      data: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    { timestamps: true, collection: 'db_state' }
  );
  MongoDbState = mongoose.models.DbState || mongoose.model('DbState', dbStateSchema);
}

// A simple mutex/queue to prevent concurrent writes
let writeQueue = Promise.resolve();

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const connectMongo = async () => {
  if (!USE_MONGO_DB) return;
  if (mongoose.connection.readyState === 1) return;

  if (!mongoConnectPromise) {
    mongoConnectPromise = mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    }).then(() => {
      console.log('Using MongoDB as the database backend.');
    }).catch((error) => {
      mongoConnectPromise = null;
      throw error;
    });
  }

  await mongoConnectPromise;
};

async function getDb() {
  if (USE_MONGO_DB) {
    await connectMongo();
    const doc = await MongoDbState.findOne({ key: 'singleton' }).lean();
    if (!doc) {
      await MongoDbState.create({ key: 'singleton', data: {} });
      return {};
    }
    return doc.data || {};
  }

  try {
    const data = await fs.readFile(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {}; // Handle missing file
    }
    throw error;
  }
}

async function writeDb(data) {
  if (USE_MONGO_DB) {
    await connectMongo();
    await MongoDbState.updateOne(
      { key: 'singleton' },
      { $set: { data: data || {} } },
      { upsert: true }
    );
    return;
  }

  writeQueue = writeQueue.then(async () => {
    const serialized = JSON.stringify(data, null, 2);
    const tempPath = `${DB_PATH}.tmp`;

    try {
      await fs.writeFile(tempPath, serialized, 'utf8');

      // On Windows/OneDrive the rename can intermittently fail with EPERM/EBUSY.
      let renamed = false;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          await fs.rename(tempPath, DB_PATH);
          renamed = true;
          break;
        } catch (renameError) {
          if (!['EPERM', 'EACCES', 'EBUSY'].includes(renameError.code || '')) {
            throw renameError;
          }
          await delay(40 * (attempt + 1));
        }
      }

      if (!renamed) {
        await fs.writeFile(DB_PATH, serialized, 'utf8');
        try {
          await fs.unlink(tempPath);
        } catch {
          // Ignore temp cleanup failures.
        }
      }
    } catch (error) {
      console.error('Database write error:', error);
      throw error;
    }
  });
  return writeQueue;
}

module.exports = { getDb, writeDb };

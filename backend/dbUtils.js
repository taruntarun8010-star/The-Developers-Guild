const fs = require('fs').promises;
const path = require('path');

const DB_PATH = path.join(__dirname, 'db.json');

// A simple mutex/queue to prevent concurrent writes
let writeQueue = Promise.resolve();

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getDb() {
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

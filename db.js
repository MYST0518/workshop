const r2 = require('./r2');

const DB_FILENAME = 'songs_database.json';

// In-memory store
let db = { songs: {} };

async function loadDB() {
  try {
    const raw = await r2.getTextFromR2(DB_FILENAME);
    if (raw) {
      db = JSON.parse(raw);
      console.log('Successfully loaded DB from R2. Total songs:', Object.keys(db.songs).length);
    } else {
      console.log('No DB found on R2, starting fresh.');
      db = { songs: {} };
    }
  } catch (err) {
    console.error('DB load error, initializing empty:', err.message);
    db = { songs: {} };
  }
}

async function saveDB() {
  try {
    await r2.uploadTextToR2(JSON.stringify(db, null, 2), DB_FILENAME);
  } catch (err) {
    console.error('Failed to save DB to R2:', err);
  }
}

const store = {
  async init() {
    await loadDB();
  },

  addSong(song) {
    db.songs[song.id] = {
      ...song,
      created_at: new Date().toISOString()
    };
    // Trigger async save
    saveDB().catch(console.error);
  },

  getSong(id) {
    return db.songs[id] || null;
  },

  getAllSongs() {
    return Object.values(db.songs).sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    );
  }
};

module.exports = store;

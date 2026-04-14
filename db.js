const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'songs.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load existing data or initialize
function loadDB() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('DB load error, reinitializing:', err.message);
  }
  return { songs: {} };
}

function saveDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// In-memory store
let db = loadDB();

const store = {
  addSong(song) {
    db.songs[song.id] = {
      ...song,
      created_at: new Date().toISOString()
    };
    saveDB(db);
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

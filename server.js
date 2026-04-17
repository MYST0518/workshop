require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { nanoid } = require('nanoid');
const store = require('./db');
const r2 = require('./r2');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration: Use memory storage to upload directly to R2
const storage = multer.memoryStorage();

const ALLOWED_MIMES = [
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave',
  'audio/x-wav', 'audio/mp4', 'audio/m4a', 'audio/x-m4a',
  'audio/aac', 'audio/ogg', 'audio/flac', 'audio/webm',
  'audio/aiff', 'audio/x-aiff'
];

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('対応していないファイル形式です。MP3, WAV, M4A, AAC, OGG, FLAC, WebM に対応しています。'));
    }
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// =====================
// API Routes
// =====================

// Upload a song
app.post('/api/upload', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'ファイルが選択されていません' });
    }

    const id = nanoid(8);
    const title = req.body.title || path.parse(req.file.originalname).name;
    const ext = path.extname(req.file.originalname);
    const fileName = `${Date.now()}-${id}${ext}`;

    // Upload to Cloudflare R2
    await r2.uploadToR2(req.file.buffer, fileName, req.file.mimetype);

    store.addSong({
      id,
      title,
      original_name: req.file.originalname,
      file_path: fileName,
      mime_type: req.file.mimetype,
      file_size: req.file.size
    });

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const playUrl = `${baseUrl}/play/${id}`;

    res.json({
      success: true,
      id,
      title,
      url: playUrl,
      fileSize: req.file.size
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'アップロードに失敗しました' });
  }
});

// Get song info
app.get('/api/song/:id', (req, res) => {
  const song = store.getSong(req.params.id);
  if (!song) {
    return res.status(404).json({ error: '曲が見つかりません' });
  }
  res.json({
    id: song.id,
    title: song.title,
    mimeType: song.mime_type,
    createdAt: song.created_at
  });
});

// Stream audio file with Range support from R2
app.get('/api/audio/:id', async (req, res) => {
  try {
    const song = store.getSong(req.params.id);
    if (!song) {
      return res.status(404).json({ error: '曲が見つかりません' });
    }

    const range = req.headers.range;
    let response;
    
    try {
      response = await r2.getFromR2(song.file_path, range);
    } catch (err) {
      // If the range is invalid, fallback to getting the whole file
      if (err.name === 'InvalidRange' || err.$metadata?.httpStatusCode === 416) {
        response = await r2.getFromR2(song.file_path);
      } else {
        throw err;
      }
    }

    const headers = {
      'Accept-Ranges': 'bytes',
      'Content-Type': song.mime_type || response.ContentType || 'audio/mpeg',
      'Content-Length': response.ContentLength
    };

    // If R2 returns a partial content (206) it includes ContentRange.
    // If not, we just return 200 OK.
    if (range && response.ContentRange) {
      headers['Content-Range'] = response.ContentRange;
      res.writeHead(206, headers);
    } else {
      res.writeHead(200, headers);
    }

    response.Body.pipe(res);
  } catch (err) {
    console.error('Streaming error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'ファイルの読み込みに失敗しました' });
    }
  }
});

// Download audio file from R2
app.get('/api/download/:id', async (req, res) => {
  try {
    const song = store.getSong(req.params.id);
    if (!song) {
      return res.status(404).json({ error: '曲が見つかりません' });
    }

    const response = await r2.getFromR2(song.file_path);
    
    res.writeHead(200, {
      'Content-Disposition': `attachment; filename="${encodeURIComponent(song.original_name)}"`,
      'Content-Type': song.mime_type,
      'Content-Length': song.file_size
    });
    
    response.Body.pipe(res);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).json({ error: 'ダウンロードに失敗しました' });
  }
});

// Serve play page
app.get('/play/:id', (req, res) => {
  const song = store.getSong(req.params.id);
  if (!song) {
    return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
  }
  res.sendFile(path.join(__dirname, 'public', 'play.html'));
});

// Multer error handler
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'ファイルサイズが50MBを超えています' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

// Init DB and Start server
store.init().then(() => {
  app.listen(PORT, () => {
    console.log(`🎵 Music Gift Station running at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

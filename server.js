const http = require('http');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

// Load environment variables from .env if present
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
  envLines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valParts] = trimmed.split('=');
      if (key) {
        process.env[key.trim()] = valParts.join('=').trim();
      }
    }
  });
}

const PORT = process.env.PORT || 8085;
const PUBLIC_DIR = __dirname;

// Construct MongoDB Atlas URI
let rawMongoUri = process.env.MONGODB_URI || 'mongodb+srv://<db_username>:CQt4OnYcmkFdHgAF@cluster0.niree25.mongodb.net/muhunt_db?retryWrites=true&w=majority&appName=Cluster0';
const dbUsername = process.env.DB_USERNAME || process.env.MONGODB_USER || '';

if (rawMongoUri.includes('<db_username>') && dbUsername) {
  rawMongoUri = rawMongoUri.replace('<db_username>', encodeURIComponent(dbUsername));
}

let db = null;
let huntersCollection = null;
const memoryFallbackHunters = [];

// Initialize MongoDB Connection
async function initMongo() {
  if (rawMongoUri.includes('<db_username>')) {
    console.warn(`[MongoDB Warning] Connection URI contains placeholder '<db_username>'. Update DB_USERNAME in .env or set MONGODB_URI directly with your Atlas username.`);
    return;
  }

  try {
    const client = new MongoClient(rawMongoUri, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    db = client.db();
    huntersCollection = db.collection('hunters');
    console.log(`[MongoDB Atlas] Successfully connected to database: "${db.databaseName}"`);
  } catch (err) {
    console.warn(`[MongoDB Atlas Warning] Could not connect to Atlas cluster. Operating with local fallback. (${err.message})`);
  }
}

initMongo();

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'text/javascript; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json'
};

const server = http.createServer(async (req, res) => {
  let reqPath = req.url.split('?')[0];

  // API Endpoint: POST /api/hunters (Submit Name & Save with Timestamp to MongoDB)
  if (req.method === 'POST' && reqPath === '/api/hunters') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 1e6) req.destroy(); // 1MB payload safeguard
    });

    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const rawName = payload.name;

        if (!rawName || typeof rawName !== 'string' || !rawName.trim()) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Valid name string is required' }));
        }

        const sanitizedName = rawName.trim().slice(0, 32);
        const sanitizedId = typeof payload.hunterId === 'string' ? payload.hunterId.slice(0, 16) : 'µ-0000';
        const sanitizedTitle = typeof payload.title === 'string' ? payload.title.slice(0, 32) : 'QUANTUM HUNTER';

        const now = new Date();
        const hunterRecord = {
          name: sanitizedName,
          hunterId: sanitizedId,
          title: sanitizedTitle,
          stats: payload.stats || {},
          timestamp: now, // BSON ISODate timestamp
          createdAt: now.toISOString(),
          formattedTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          formattedDate: now.toLocaleDateString()
        };

        let savedToMongo = false;
        if (huntersCollection) {
          try {
            await huntersCollection.insertOne(hunterRecord);
            savedToMongo = true;
            console.log(`[MongoDB Atlas] Inserted record: "${sanitizedName}" at ${now.toISOString()}`);
          } catch (dbErr) {
            console.error('[MongoDB Atlas Error] Insert failed:', dbErr.message);
          }
        }

        if (!savedToMongo) {
          memoryFallbackHunters.unshift(hunterRecord);
          if (memoryFallbackHunters.length > 20) memoryFallbackHunters.pop();
        }

        res.writeHead(201, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          success: true,
          savedToMongo: savedToMongo,
          data: {
            name: hunterRecord.name,
            hunterId: hunterRecord.hunterId,
            timestamp: hunterRecord.createdAt,
            formattedTime: hunterRecord.formattedTime
          }
        }));
      } catch (parseErr) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // API Endpoint: GET /api/hunters (Fetch Recent Hunters with Timestamps from MongoDB)
  if (req.method === 'GET' && reqPath === '/api/hunters') {
    try {
      let list = [];
      if (huntersCollection) {
        try {
          const docs = await huntersCollection.find({})
            .sort({ timestamp: -1 })
            .limit(10)
            .toArray();
          list = docs.map(doc => ({
            name: doc.name,
            hunterId: doc.hunterId,
            title: doc.title,
            timestamp: doc.timestamp || doc.createdAt,
            formattedTime: doc.formattedTime || ''
          }));
        } catch (dbErr) {
          console.error('[MongoDB Atlas Error] Query failed:', dbErr.message);
        }
      }

      if (list.length === 0 && memoryFallbackHunters.length > 0) {
        list = memoryFallbackHunters.map(doc => ({
          name: doc.name,
          hunterId: doc.hunterId,
          title: doc.title,
          timestamp: doc.createdAt,
          formattedTime: doc.formattedTime || ''
        }));
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ hunters: list }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Failed to fetch hunters' }));
    }
  }

  // Static File Serving
  if (reqPath === '/') reqPath = '/index.html';
  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Access Denied');
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server Error');
      }
    } else {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`μhunt server running at http://127.0.0.1:${PORT}/`);
});

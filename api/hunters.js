const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://aravindak087_db_user:CQt4OnYcmkFdHgAF@cluster0.niree25.mongodb.net/muhunt_db?retryWrites=true&w=majority&appName=Cluster0';

let cachedDb = null;
let cachedCollection = null;

async function connectToDatabase() {
  if (cachedDb && cachedCollection) {
    return { db: cachedDb, collection: cachedCollection };
  }

  const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  const db = client.db();
  const collection = db.collection('hunters');

  cachedDb = db;
  cachedCollection = collection;
  return { db, collection };
}

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // GET /api/hunters
  if (req.method === 'GET') {
    try {
      const { collection } = await connectToDatabase();
      const docs = await collection.find({})
        .sort({ timestamp: -1 })
        .limit(10)
        .toArray();

      const hunters = docs.map(doc => ({
        name: doc.name,
        hunterId: doc.hunterId,
        title: doc.title,
        timestamp: doc.timestamp || doc.createdAt,
        formattedTime: doc.formattedTime || ''
      }));

      return res.status(200).json({ hunters });
    } catch (err) {
      return res.status(200).json({ hunters: [] });
    }
  }

  // POST /api/hunters
  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const rawName = body.name;

      if (!rawName || typeof rawName !== 'string' || !rawName.trim()) {
        return res.status(400).json({ error: 'Valid name string is required' });
      }

      const sanitizedName = rawName.trim().slice(0, 32);
      const sanitizedId = typeof body.hunterId === 'string' ? body.hunterId.slice(0, 16) : 'µ-0000';
      const sanitizedTitle = typeof body.title === 'string' ? body.title.slice(0, 32) : 'QUANTUM HUNTER';

      const now = new Date();
      const hunterRecord = {
        name: sanitizedName,
        hunterId: sanitizedId,
        title: sanitizedTitle,
        stats: body.stats || {},
        timestamp: now,
        createdAt: now.toISOString(),
        formattedTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        formattedDate: now.toLocaleDateString()
      };

      const { collection } = await connectToDatabase();
      await collection.insertOne(hunterRecord);

      return res.status(201).json({
        success: true,
        savedToMongo: true,
        data: {
          name: hunterRecord.name,
          hunterId: hunterRecord.hunterId,
          timestamp: hunterRecord.createdAt,
          formattedTime: hunterRecord.formattedTime
        }
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to insert document into MongoDB' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

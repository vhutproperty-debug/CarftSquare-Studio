const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const uri = envContent.match(/^MONGODB_URI=(.+)$/m)[1].trim();
const dbName = envContent.match(/^DB_NAME=(.+)$/m)?.[1]?.trim() || 'brushandbloom';

MongoClient.connect(uri).then(async (client) => {
  const result = await client.db(dbName).collection('services').updateOne(
    { slug: 'rental-interiors' },
    { $set: { name: 'Rental Furnishing', updatedAt: new Date().toISOString() } },
  );
  console.log('Updated:', result.modifiedCount);
  await client.close();
}).catch((error) => {
  console.error(error.message);
  process.exit(1);
});

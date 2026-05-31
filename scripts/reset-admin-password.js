const { MongoClient } = require('mongodb');
const { randomBytes, scryptSync } = require('crypto');
const fs = require('fs');
const path = require('path');

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const uriMatch = envContent.match(/^MONGODB_URI=(.+)$/m);
const uri = uriMatch?.[1]?.trim();

if (!uri) {
  console.error('MONGODB_URI not found in .env.local');
  process.exit(1);
}

const email = process.argv[2] || 'vhutproperty@gmail.com';
const password = process.argv[3] || 'Aarush12345';

MongoClient.connect(uri).then(async (client) => {
  const db = client.db('brushandbloom');
  const result = await db.collection('admins').updateOne(
    { email, role: 'admin' },
    { $set: { passwordHash: hashPassword(password), updatedAt: new Date().toISOString() } },
  );
  console.log(`Password reset for ${email}: ${result.modifiedCount ? 'success' : 'no admin found'}`);
  await client.close();
}).catch((error) => {
  console.error(error.message);
  process.exit(1);
});

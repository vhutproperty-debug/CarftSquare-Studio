const { MongoClient } = require('mongodb');
const path = require('path');
const { loadEnvLocal } = require('./lib/load-env-local.cjs');

async function loadPasswordModule() {
  return import('../lib/auth/password.ts');
}

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error('Usage: node scripts/reset-admin-password.js <email> <new-password>');
  process.exit(1);
}

if (password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

const envPath = path.join(__dirname, '..', '.env.local');
loadEnvLocal({ cwd: path.join(__dirname, '..'), files: ['.env.local'] });

const uri = process.env.MONGODB_URI || process.env.MONGO_URL;
if (!uri) {
  console.error('MONGODB_URI not found in .env.local');
  process.exit(1);
}

MongoClient.connect(uri).then(async (client) => {
  const { hashPassword } = await loadPasswordModule();
  const dbName = process.env.DB_NAME || 'brushandbloom';
  const db = client.db(dbName);
  const result = await db.collection('admins').updateOne(
    { email: email.trim().toLowerCase(), role: { $in: ['admin', 'super_admin'] } },
    { $set: { passwordHash: hashPassword(password), updatedAt: new Date().toISOString() } },
  );
  console.log(`Password reset for ${email}: ${result.modifiedCount ? 'success' : 'no admin found'}`);
  await client.close();
}).catch((error) => {
  console.error(error.message);
  process.exit(1);
});

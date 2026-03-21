/**
 * One-time migration script:
 * 1. Creates the user account on Atlas
 * 2. Migrates all trades from local MongoDB to Atlas
 *
 * Run with: node scripts/migrate.js
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Trade = require('../models/Trade');

const LOCAL_URI = 'mongodb://localhost:27017/market_tracker';
const ATLAS_URI = process.env.MONGO_URI;

const USERNAME = 'sivanp27540@gmail.com';
const PASSWORD = 'REDACTED_PASSWORD';

async function migrate() {
  console.log('Connecting to local MongoDB...');
  const localConn = await mongoose.createConnection(LOCAL_URI).asPromise();
  const LocalTrade = localConn.model('Trade', Trade.schema);

  console.log('Fetching trades from local...');
  const trades = await LocalTrade.find({}).lean();
  console.log(`Found ${trades.length} trades.`);

  console.log('Connecting to Atlas...');
  const atlasConn = await mongoose.createConnection(ATLAS_URI).asPromise();
  const AtlasUser = atlasConn.model('User', User.schema);
  const AtlasTrade = atlasConn.model('Trade', Trade.schema);

  // Create user
  console.log('Creating user on Atlas...');
  const existing = await AtlasUser.findOne({ username: USERNAME });
  if (existing) {
    console.log('User already exists, skipping creation.');
  } else {
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(PASSWORD, salt);
    await AtlasUser.create({ username: USERNAME, password: hashed });
    console.log('User created.');
  }

  // Migrate trades
  if (trades.length > 0) {
    console.log('Migrating trades to Atlas...');
    // Remove _id so Atlas generates new ones (avoids conflicts)
    const cleanTrades = trades.map(({ _id, __v, ...rest }) => rest);
    await AtlasTrade.insertMany(cleanTrades, { ordered: false });
    console.log(`Migrated ${trades.length} trades successfully.`);
  } else {
    console.log('No trades to migrate.');
  }

  await localConn.close();
  await atlasConn.close();
  console.log('Done!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});

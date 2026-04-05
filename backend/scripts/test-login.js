require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const User = require('../models/User');

async function test() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    console.error('Error: ADMIN_USERNAME and ADMIN_PASSWORD environment variables are required.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({ username });
  if (!user) { console.log('USER NOT FOUND'); process.exit(1); }
  console.log('User found:', user.username);
  const match = await user.comparePassword(password);
  console.log('Password match:', match);
  await mongoose.disconnect();
  process.exit(0);
}

test().catch(err => { console.error(err.message); process.exit(1); });

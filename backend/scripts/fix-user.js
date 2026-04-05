require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const User = require('../models/User');

async function fix() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    console.error('Error: ADMIN_USERNAME and ADMIN_PASSWORD environment variables are required.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  await User.deleteMany({});
  await User.create({ username, password });
  console.log('User recreated correctly.');
  await mongoose.disconnect();
  process.exit(0);
}

fix().catch(err => { console.error(err.message); process.exit(1); });

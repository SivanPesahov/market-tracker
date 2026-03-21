require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const User = require('../models/User');

async function fix() {
  await mongoose.connect(process.env.MONGO_URI);
  await User.deleteMany({});
  await User.create({ username: 'sivanp27540@gmail.com', password: 'REDACTED_PASSWORD' });
  console.log('User recreated correctly.');
  await mongoose.disconnect();
  process.exit(0);
}

fix().catch(err => { console.error(err.message); process.exit(1); });

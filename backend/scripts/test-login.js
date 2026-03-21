require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const User = require('../models/User');

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({ username: 'sivanp27540@gmail.com' });
  if (!user) { console.log('USER NOT FOUND'); process.exit(1); }
  console.log('User found:', user.username);
  const match = await user.comparePassword('REDACTED_PASSWORD');
  console.log('Password match:', match);
  await mongoose.disconnect();
  process.exit(0);
}

test().catch(err => { console.error(err.message); process.exit(1); });

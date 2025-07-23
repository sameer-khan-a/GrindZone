import mongoose from 'mongoose';
import dotenv from 'dotenv';

import User from './models/User.js';
import Tournament from './models/Tournament.js';
import Match from './models/Match.js';
import Squad from './models/Squad.js';
import Payment from './models/Payment.js';
import FriendRequest from './models/FriendRequest.js';
import SquadJoinRequest from './models/SquadJoinRequests.js';

dotenv.config();

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(async () => {
  console.log('✅ MongoDB connected, inserting sample data...');

  // Clear existing data
  await User.deleteMany({});
  await Tournament.deleteMany({});
  await Match.deleteMany({});
  await Squad.deleteMany({});
  await Payment.deleteMany({});
  await FriendRequest.deleteMany({});
  await SquadJoinRequest.deleteMany({});

  // Insert users
  const users = await User.insertMany([
    { username: 'Sameer', email: 'sameer@example.com', password: '123456' },
    { username: 'Ankith', email: 'ankith@example.com', password: '123456' }
  ]);

  // Insert tournaments
  const tournaments = await Tournament.insertMany([
    { name: 'Summer Slam', game: 'Valorant', date: new Date(), participants: 10 },
    { name: 'Winter Clash', game: 'CS:GO', date: new Date(), participants: 8 }
  ]);

  // Insert matches
  const matches = await Match.insertMany([
    {
      teamA: 'Alpha',
      teamB: 'Bravo',
      date: new Date(),
      score: '13-10',
      result: 'Win',         // ✅ Enum: 'Win' or 'Loss'
      opponent: 'Bravo',
      winner: 'Alpha'
    },
    {
      teamA: 'X',
      teamB: 'Y',
      date: new Date(),
      score: '11-13',
      result: 'Loss',
      opponent: 'Y',
      winner: 'Y'
    }
  ]);

  // Insert squads
  const squads = await Squad.insertMany([
    {
      name: 'NightWolves',
      members: [
        { userId: users[0]._id, role: 'leader' }
      ],
      createdBy: users[0]._id,
      tier: 'gold',
      tag: 'NW'
    },
    {
      name: 'FireDragons',
      members: [
        { userId: users[1]._id, role: 'leader' }
      ],
      createdBy: users[1]._id,
      tier: 'silver',
      tag: 'FD'
    }
  ]);

  // Insert payments
await Payment.insertMany([
  {
    userId: users[0]._id,
    amount: 299,
    status: 'paid',
    date: new Date(),
    tournament: tournaments[0]._id,
    team: squads[0]._id
  },
  {
    userId: users[1]._id,
    amount: 499,
    status: 'pending',
    date: new Date(),
    tournament: tournaments[1]._id,
    team: squads[1]._id
  }
]);


  // Insert friend requests
await FriendRequest.insertMany([
  { sender: users[0]._id, receiver: users[1]._id, status: 'pending' },
  { sender: users[1]._id, receiver: users[0]._id, status: 'accepted' }
]);

  // Insert squad join requests
await SquadJoinRequest.insertMany([
  { userId: users[0]._id, squadId: squads[1]._id, status: 'pending' },
  { userId: users[1]._id, squadId: squads[0]._id, status: 'accepted' }
]);

  console.log('✅ Sample data inserted!');
  process.exit();
}).catch(err => {
  console.error('❌ Error inserting sample data:', err);
  process.exit(1);
});

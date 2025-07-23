import mongoose from 'mongoose';

const MemberSchema = new mongoose.Schema({
  username: String,
  role: String,
  joined: Date,
  status: {
    type: String,
    enum: ['Online', 'Offline', 'In Game'],
    default: 'Offline',
  },
});

const SquadSchema = new mongoose.Schema({
  name: { type: String, required: true },
  tag: { type: String, required: true },
  tier: { type: String, required: true },
  logo: { type: String },
  members: { type: [MemberSchema], default: [] },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
}, { timestamps: true });

const Squad = mongoose.model('Squad', SquadSchema);

export default Squad;

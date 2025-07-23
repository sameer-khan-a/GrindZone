import mongoose from 'mongoose';

const MatchSchema = new mongoose.Schema({
  opponent: { type: String, required: true },
  date: { type: Date, required: true },
  result: { type: String, enum: ['Win', 'Loss', 'Draw'], required: true },
  score: { type: String, required: true },
}, { timestamps: true });

const Match = mongoose.model('Match', MatchSchema);

export default Match;

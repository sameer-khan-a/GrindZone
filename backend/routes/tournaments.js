import express from 'express';
import mongoose from 'mongoose';
import Tournament from '../models/Tournament.js';

const router = express.Router();

const computeStatus = (dateString) => {
  if (!dateString) return 'Upcoming';
  const now = new Date();
  const tournamentDate = new Date(dateString);
  if (isNaN(tournamentDate.getTime())) return 'Upcoming';

  const regStart = new Date(tournamentDate);
  regStart.setDate(tournamentDate.getDate() - 3);
  const end = new Date(tournamentDate);
  end.setDate(tournamentDate.getDate() + 1);

  if (now < regStart) return 'Upcoming';
  if (now >= regStart && now < tournamentDate) return 'Registration';
  if (now >= tournamentDate && now < end) return 'Ongoing';
  return 'Completed';
};

const attachComputedStatus = (tournament) => {
  if (!tournament) return tournament;
  // tournament might be a Mongoose doc or plain object — ensure plain object
  const t = (tournament.toObject ? tournament.toObject() : { ...tournament });
  t.status = t.status || computeStatus(t.date);
  return t;
};

// Get all tournaments
router.get('/', async (req, res) => {
  try {
    const tournaments = await Tournament.find();
    // attach computed status for each
    const normalized = tournaments.map(attachComputedStatus);
    res.json(normalized);
  } catch (err) {
    console.error('[tournaments] GET / error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Get tournament by ID (robust)
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  console.log('[tournaments] GET /:id called with', id);

  try {
    let tournament = null;

    // Try as Mongo ObjectId
    if (mongoose.Types.ObjectId.isValid(id)) {
      tournament = await Tournament.findById(id).lean();
      console.log('[tournaments] findById result:', !!tournament);
    } else {
      console.log('[tournaments] Not a valid ObjectId, skipping findById');
    }

    // Fallback: try custom id field
    if (!tournament) {
      tournament = await Tournament.findOne({ id }).lean();
      console.log('[tournaments] findOne({id}) result:', !!tournament);
    }

    if (!tournament) {
      console.warn(`[tournaments] Tournament not found for id=${id}`);
      return res.status(404).json({ message: 'Tournament not found' });
    }

    // attach computed status if missing
    const result = { ...tournament, status: tournament.status || computeStatus(tournament.date) };
    return res.json(result);
  } catch (err) {
    console.error('[tournaments] GET /:id error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Create new tournament
router.post('/', async (req, res) => {
  try {
    const tournament = new Tournament(req.body);
    const newTournament = await tournament.save();
    const result = attachComputedStatus(newTournament);
    res.status(201).json(result);
  } catch (err) {
    console.error('[tournaments] POST / error:', err);
    res.status(400).json({ message: err.message });
  }
});

// Update tournament
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    let updatedTournament = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      updatedTournament = await Tournament.findByIdAndUpdate(id, req.body, { new: true });
    }

    if (!updatedTournament) {
      updatedTournament = await Tournament.findOneAndUpdate({ id }, req.body, { new: true });
    }

    if (!updatedTournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    const result = attachComputedStatus(updatedTournament);
    res.json(result);
  } catch (err) {
    console.error('[tournaments] PUT /:id error:', err);
    res.status(400).json({ message: err.message });
  }
});

// Delete tournament
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    let deletedTournament = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      deletedTournament = await Tournament.findByIdAndDelete(id);
    }

    if (!deletedTournament) {
      deletedTournament = await Tournament.findOneAndDelete({ id });
    }

    if (!deletedTournament) {
      return res.status(404).json({ message: 'Tournament not found' });
    }

    res.json({ message: 'Tournament deleted' });
  } catch (err) {
    console.error('[tournaments] DELETE /:id error:', err);
    res.status(500).json({ message: err.message });
  }
});

export default router;

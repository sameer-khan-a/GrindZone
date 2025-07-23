import express from 'express';
import Match from '../models/Match.js';

const router = express.Router();

// Get all matches
router.get('/', async (req, res) => {
  try {
    const matches = await Match.find().sort({ date: -1 });
    res.json(matches);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get match by ID
router.get('/:id', async (req, res) => {
  try {
    const match = await Match.findById(req.params.id);
    if (!match) return res.status(404).json({ message: 'Match not found' });
    res.json(match);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create a new match
router.post('/', async (req, res) => {
  const match = new Match(req.body);
  try {
    const newMatch = await match.save();
    res.status(201).json(newMatch);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update a match
router.put('/:id', async (req, res) => {
  try {
    const updatedMatch = await Match.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedMatch) return res.status(404).json({ message: 'Match not found' });
    res.json(updatedMatch);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete a match
router.delete('/:id', async (req, res) => {
  try {
    const deletedMatch = await Match.findByIdAndDelete(req.params.id);
    if (!deletedMatch) return res.status(404).json({ message: 'Match not found' });
    res.json({ message: 'Match deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;

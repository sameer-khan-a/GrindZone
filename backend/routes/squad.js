import express from 'express';
import Squad from '../models/Squad.js';

const router = express.Router();

// Get all squads
router.get('/', async (req, res) => {
  try {
    const squads = await Squad.find();
    res.json(squads);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get squad by ID
router.get('/:id', async (req, res) => {
  try {
    const squad = await Squad.findById(req.params.id);
    if (!squad) return res.status(404).json({ message: 'Squad not found' });
    res.json(squad);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create a new squad
router.post('/', async (req, res) => {
  const squad = new Squad(req.body);
  try {
    const newSquad = await squad.save();
    res.status(201).json(newSquad);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update squad
router.put('/:id', async (req, res) => {
  try {
    const updatedSquad = await Squad.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedSquad) return res.status(404).json({ message: 'Squad not found' });
    res.json(updatedSquad);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete squad
router.delete('/:id', async (req, res) => {
  try {
    const deletedSquad = await Squad.findByIdAndDelete(req.params.id);
    if (!deletedSquad) return res.status(404).json({ message: 'Squad not found' });
    res.json({ message: 'Squad deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;

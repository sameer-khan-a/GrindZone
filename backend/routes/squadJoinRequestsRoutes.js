// routes/squadJoinRequestRoutes.js

import express from "express";
import SquadJoinRequest from "../models/SquadJoinRequests.js";

const router = express.Router();

// 🔹 Create a new join request
router.post("/", async (req, res) => {
  try {
    const { userId, squadId, message } = req.body;

    const existingRequest = await SquadJoinRequest.findOne({ userId, squadId });
    if (existingRequest) {
      return res.status(400).json({ error: "Request already exists" });
    }

    const request = new SquadJoinRequest({ userId, squadId, message });
    await request.save();

    res.status(201).json(request);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

// 🔹 Get requests for a squad (for admin review)
router.get("/squad/:squadId", async (req, res) => {
  try {
    const requests = await SquadJoinRequest.find({ squadId: req.params.squadId })
      .populate("userId", "username email")
      .sort({ createdAt: -1 });

    res.status(200).json(requests);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

// 🔹 Get user’s sent requests
router.get("/user/:userId", async (req, res) => {
  try {
    const requests = await SquadJoinRequest.find({ userId: req.params.userId })
      .populate("squadId", "name tag tier")
      .sort({ createdAt: -1 });

    res.status(200).json(requests);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

// 🔹 Update request status (accept or reject)
router.put("/:requestId", async (req, res) => {
  try {
    const { status } = req.body;
    if (!["accepted", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const updated = await SquadJoinRequest.findByIdAndUpdate(
      req.params.requestId,
      { status },
      { new: true }
    );

    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

export default router;

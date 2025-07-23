// routes/friendRequestRoutes.js

import express from "express";
import FriendRequest from "../models/FriendRequest.js";
import User from "../models/User.js"; // Optional, for populating usernames

const router = express.Router();

// 🔹 Send a new friend request
router.post("/", async (req, res) => {
  try {
    const { sender, receiver } = req.body;

    const existing = await FriendRequest.findOne({ sender, receiver });
    if (existing) {
      return res.status(400).json({ error: "Friend request already sent" });
    }

    const newRequest = new FriendRequest({ sender, receiver });
    await newRequest.save();
    res.status(201).json(newRequest);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Get friend requests received by user
router.get("/received/:userId", async (req, res) => {
  try {
    const requests = await FriendRequest.find({ receiver: req.params.userId, status: "pending" })
      .populate("sender", "username avatarUrl");
    res.status(200).json(requests);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Get friend requests sent by user
router.get("/sent/:userId", async (req, res) => {
  try {
    const requests = await FriendRequest.find({ sender: req.params.userId })
      .populate("receiver", "username avatarUrl");
    res.status(200).json(requests);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// 🔹 Accept/Reject a friend request
router.put("/:requestId", async (req, res) => {
  try {
    const { status } = req.body;
    if (!["accepted", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const updated = await FriendRequest.findByIdAndUpdate(
      req.params.requestId,
      { status },
      { new: true }
    );
    res.status(200).json(updated);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;

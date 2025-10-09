// backend/routes/squads.js
import express from "express";
import mongoose from "mongoose";
import Squad from "../models/Squad.js";

const router = express.Router();

/**
 * GET /api/squads
 * - If ?sort=top returns ranked leaderboard (wins -> win%).
 * - Supports filters: game, region, tier, q (search name/tag)
 * - Supports pagination: limit, skip
 * - If no query params, returns all squads (backwards compatible)
 */
router.get("/", async (req, res) => {
  try {
    const { game, region, tier, q } = req.query;
    const sortMode = String(req.query.sort || "").toLowerCase();
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || "100"), 10)));
    const skip = Math.max(0, parseInt(String(req.query.skip || "0"), 10));

    // Build match object
    const match = {};
    if (game && String(game) !== "all") match.game = String(game);
    if (region && String(region) !== "all") match.region = String(region);
    if (tier && String(tier) !== "all") match.tier = String(tier);
    if (q) {
      const regex = new RegExp(String(q), "i");
      match.$or = [{ name: regex }, { tag: regex }];
    }

    // If user asked for top ranking, use aggregation pipeline to compute win% and sort
    if (sortMode === "top") {
      const pipeline = [
        { $match: match },
        // Ensure wins/losses are numeric (if stored as strings)
        {
          $addFields: {
            winsNum: { $toInt: { $ifNull: ["$wins", 0] } },
            lossesNum: { $toInt: { $ifNull: ["$losses", 0] } }
          }
        },
        {
          $addFields: {
            gamesPlayed: { $add: ["$winsNum", "$lossesNum"] },
            winPct: {
              $cond: [
                { $gt: [{ $add: ["$winsNum", "$lossesNum"] }, 0] },
                { $multiply: [{ $divide: ["$winsNum", { $max: [{ $add: ["$winsNum", "$lossesNum"] }, 1] }] }, 100] },
                0
              ]
            }
          }
        },
        { $sort: { winsNum: -1, winPct: -1, name: 1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $project: {
            _id: 1,
            name: 1,
            tag: 1,
            logo: 1,
            wins: "$winsNum",
            losses: "$lossesNum",
            winPercentage: { $concat: [{ $toString: { $round: ["$winPct", 1] } }, "%"] },
            tier: 1,
            region: 1,
            game: 1,
            createdAt: 1
          }
        }
      ];

      const results = await Squad.aggregate(pipeline).allowDiskUse(true).exec();
      // attach rank number (skip-aware)
      const ranked = results.map((r, idx) => ({ ...r, rank: skip + idx + 1 }));
      return res.json(ranked);
    }

    // Non-leaderboard flows: sort/new/name or no sort
    let query = Squad.find(match).select("-__v");
    if (sortMode === "new") query = query.sort({ createdAt: -1 });
    else if (sortMode === "name") query = query.sort({ name: 1 });
    // apply skip/limit for pagination
    query = query.skip(skip).limit(limit);

    const squads = await query.lean();
    return res.json(squads);
  } catch (err) {
    console.error("squads list error:", err);
    return res.status(500).json({ message: "Server error", detail: String(err) });
  }
});

/* Keep your existing CRUD endpoints below (get by id, post, put, delete) */

// Get squad by ID
router.get("/:id", async (req, res) => {
  try {
    const squad = await Squad.findById(req.params.id);
    if (!squad) return res.status(404).json({ message: "Squad not found" });
    res.json(squad);
  } catch (err) {
    console.error("squad get error:", err);
    res.status(500).json({ message: err.message });
  }
});

// Create a new squad
router.post("/", async (req, res) => {
  try {
    const squad = new Squad(req.body);
    const newSquad = await squad.save();
    res.status(201).json(newSquad);
  } catch (err) {
    console.error("squad create error:", err);
    res.status(400).json({ message: err.message });
  }
});

// Update squad
router.put("/:id", async (req, res) => {
  try {
    const updatedSquad = await Squad.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updatedSquad) return res.status(404).json({ message: "Squad not found" });
    res.json(updatedSquad);
  } catch (err) {
    console.error("squad update error:", err);
    res.status(400).json({ message: err.message });
  }
});

// Delete squad
router.delete("/:id", async (req, res) => {
  try {
    const deletedSquad = await Squad.findByIdAndDelete(req.params.id);
    if (!deletedSquad) return res.status(404).json({ message: "Squad not found" });
    res.json({ message: "Squad deleted" });
  } catch (err) {
    console.error("squad delete error:", err);
    res.status(500).json({ message: err.message });
  }
});

export default router;

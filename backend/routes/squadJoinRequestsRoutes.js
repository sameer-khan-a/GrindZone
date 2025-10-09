// backend/routes/squadJoinRequestsRoutes.js
import express from "express";
import mongoose from "mongoose";
import SquadJoinRequest from "../models/SquadJoinRequests.js";
import User from "../models/User.js";
import { requireAuth, requireRole } from "../middleware/index.js";

const router = express.Router();

// Helper: validate ObjectId
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(String(id));

// helper: normalize possible shapes into a string id
function normalizeToId(x) {
  if (x === undefined || x === null) return null;
  if (typeof x === "string") return x;
  if (typeof x === "object") {
    if (x._id) return String(x._id);
    if (x.id) return String(x.id);
    if (x.userId) return String(x.userId);
  }
  try { return String(x); } catch { return null; }
}
router.get("/me", requireAuth(), async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    const userId = String(req.user._id);
    if (!isValidObjectId(userId)) {
      console.warn("[squad-requests/me] invalid req.user._id:", req.user._id);
      return res.status(400).json({ error: "Invalid user id" });
    }

    console.debug("[squad-requests/me] fetching for userId=", userId);

    const requests = await SquadJoinRequest.find({ userId: new mongoose.Types.ObjectId(userId) })
      .populate("squadId", "name tag tier")
      .populate("invitedBy", "username email")
      .sort({ createdAt: -1 })
      .lean();

    // normalize to friendly shape
    const out = requests.map(r => ({
      _id: r._id,
      userId: r.userId,
      squad: r.squadId,
      invitedBy: r.invitedBy,
      status: r.status,
      message: r.message,
      createdAt: r.createdAt
    }));

    console.debug("[squad-requests/me] found", out.length);
    return res.json(out);
  } catch (err) {
    console.error("[squad-requests/me] error:", err);
    return res.status(500).json({ error: "Server Error" });
  }
});
/**
 * POST /api/squad-requests
 * body: { userId | targetId | invitedUser, squadId, message }
 * Requires authentication (who creates it is req.user)
 */
router.post("/", requireAuth(), async (req, res) => {
  try {
    const rawUserId = req.body.userId ?? req.body.targetId ?? req.body.invitedUser;
    const rawSquadId = req.body.squadId ?? req.body.squad;

    const userId = normalizeToId(rawUserId);
    const squadId = normalizeToId(rawSquadId);

    if (!userId || !squadId) {
      return res.status(400).json({ error: "userId and squadId required" });
    }
    if (!isValidObjectId(userId) || !isValidObjectId(squadId)) {
      return res.status(400).json({ error: "Invalid IDs" });
    }

    // Prevent inviter from inviting themselves accidentally
    const inviterId = String(req.user._id);
    if (inviterId === String(userId)) {
      return res.status(400).json({ error: "Cannot invite yourself" });
    }

    // Verify target user exists
    const target = await User.findById(userId).select("username email").lean();
    if (!target) return res.status(404).json({ error: "Target user not found" });

    // DEBUG logging (remove or lower in production)
    console.debug("[squad-requests] create: inviter=", inviterId, "target=", userId, "squad=", squadId);

    // create doc with explicit ObjectId fields
    const doc = new SquadJoinRequest({
      userId: new mongoose.Types.ObjectId(userId),
      squadId: new mongoose.Types.ObjectId(squadId),
      message: req.body.message ?? "",
      invitedBy: new mongoose.Types.ObjectId(inviterId),
      status: "invited",
    });

    await doc.save();

    const out = await SquadJoinRequest.findById(doc._id).populate("userId", "username email").lean();
    res.status(201).json(out);
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ error: "Request already exists" });
    console.error("squad-request create error (hardened):", err);
    res.status(500).json({ error: "Server Error" });
  }
});

/**
 * GET /api/squad-requests/squad/:squadId
 * Returns join/invite requests for a squad. Protect this in production.
 */
router.get("/squad/:squadId", requireAuth(), async (req, res) => {
  try {
    const { squadId } = req.params;
    if (!isValidObjectId(squadId)) return res.status(400).json({ error: "Invalid squadId" });

    const requests = await SquadJoinRequest.find({ squadId })
      .populate("userId", "username email")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json(requests);
  } catch (err) {
    console.error("squad-requests list error:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

/**
 * GET /api/squad-requests/user/:userId
 * Returns requests a user has sent / been invited to.
 */
router.get("/user/:userId", requireAuth(), async (req, res) => {
  try {
    const { userId } = req.params;
    if (!isValidObjectId(userId)) return res.status(400).json({ error: "Invalid userId" });

    const requests = await SquadJoinRequest.find({ userId })
      .populate("squadId", "name tag tier")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json(requests);
  } catch (err) {
    console.error("squad-requests user list error:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

/**
 * PUT /api/squad-requests/:requestId
 * Update request status (accept/reject). Only squad admins / owners should do this.
 */
router.put("/:requestId", requireAuth(), async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status } = req.body;
    if (!isValidObjectId(requestId)) return res.status(400).json({ error: "Invalid requestId" });
    if (!["accepted", "rejected", "pending", "invited"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    // TODO: Add authorization check here: is req.user allowed to accept/reject for this squad?
    const updated = await SquadJoinRequest.findByIdAndUpdate(
      requestId,
      { status },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) return res.status(404).json({ error: "Request not found" });
    res.status(200).json(updated);
  } catch (err) {
    console.error("squad-requests update error:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

export default router;

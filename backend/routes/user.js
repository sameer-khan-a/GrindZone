// backend/routes/user.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";
import SquadJoinRequest from "../models/SquadJoinRequests.js";
import { requireAuth /*, requireRole */ } from "../middleware/index.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

/** Helper: map common mongo errors */
function mapMongoError(err) {
  if (!err) return null;
  if (err.code === 11000) {
    const key = Object.keys(err.keyValue || {})[0];
    return { status: 409, message: `${key} already in use` };
  }
  return null;
}

function normalizeCandidate(v) {
  if (!v) return null;
  if (typeof v === "string") return v.trim();
  if (typeof v === "object") return String(v._id ?? v.id ?? v);
  return String(v);
}

/**
 * GET /api/users
 * - If ?excludeSquadId=<id> is provided, excludes users who are already invited/requested for that squad
 * - Otherwise returns all users (without password).
 *
 * Note: returns `{ users, debug }` (debug useful during development).
 */
router.get("/", async (req, res) => {
  try {
    const raw = req.query.excludeSquadId;
    let normalized = normalizeCandidate(raw);
    if (typeof normalized === "string") {
      const found = normalized.match(/[0-9a-fA-F]{24}/);
      if (found) normalized = found[0];
    }

    // collect invited *target* ids only (never invitedBy)
    const invitedIds = [];

    if (normalized && mongoose.Types.ObjectId.isValid(normalized)) {
      try {
        const squadOid = new mongoose.Types.ObjectId(normalized);
        // fetch docs with both fields so we can compare
        const invitedDocs = await SquadJoinRequest.find({ squadId: squadOid }).select(
          "userId invitedBy"
        ).lean();

        for (const d of invitedDocs) {
          if (!d || !d.userId) continue;

          // normalize userId to string
          let uid;
          if (typeof d.userId === "string") uid = d.userId;
          else if (typeof d.userId === "object") uid = String(d.userId._id ?? d.userId);
          else uid = String(d.userId);

          // normalize invitedBy
          let inviter = null;
          if (d.invitedBy) {
            inviter = (typeof d.invitedBy === "string")
              ? d.invitedBy
              : String(d.invitedBy._id ?? d.invitedBy);
          }

          // skip if somehow userId equals invitedBy (bogus invite where inviter==target)
          if (inviter && uid === inviter) {
            console.warn(
              "[users] skipping invite where userId === invitedBy (bogus):",
              uid,
              "squad:",
              normalized
            );
            continue;
          }

          invitedIds.push(uid);
        }
      } catch (errInv) {
        console.error("[users] invited fetch error:", errInv);
        // continue — invitedIds stays whatever we have
      }
    } else {
      if (typeof raw !== "undefined") {
        console.warn("[users] excludeSquadId invalid/empty:", JSON.stringify(raw));
      }
    }

    // uniq invitedIds
    const invitedSet = new Set(invitedIds.map((id) => String(id)));

    // DB-level query (fast)
    const query = invitedSet.size ? { _id: { $nin: Array.from(invitedSet) } } : {};
    let users = [];
    try {
      users = await User.find(query).select("-password -__v").lean();
    } catch (errUsers) {
      console.error("[users] DB read error, falling back to full list:", errUsers);
      users = await User.find().select("-password -__v").lean().catch(() => []);
    }

    // extra defensive JS-side filter
    const finalUsers = Array.isArray(users)
      ? users.filter((u) => {
          const uid = String(u._id ?? u.id ?? "");
          return uid && !invitedSet.has(uid);
        })
      : [];

    // return list (note: we wrap in { users } to allow debugging fields)
    return res.json({ users: finalUsers, debug: { invitedIds: Array.from(invitedSet) } });
  } catch (err) {
    console.error("[users] unhandled error:", err);
    return res.status(500).json({ users: [], debug: { invitedIds: [], error: String(err) } });
  }
});

/**
 * GET /api/users/me
 * Returns the currently authenticated user. Requires requireAuth middleware.
 */
router.get("/me", requireAuth(), async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password -__v").lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    console.error("[users] me error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * PUT /api/users/me
 * Update authenticated user's profile (safe fields only)
 */
router.put("/me", requireAuth(), async (req, res) => {
  try {
    const id = req.user && req.user._id ? req.user._id : null;
    if (!id) return res.status(401).json({ message: "Not authenticated" });

    const updates = { ...req.body };

    // Disallow certain direct updates here:
    if (updates.password) delete updates.password;
    if (updates._id) delete updates._id;
    if (updates.__v) delete updates.__v;

    // Normalize common fields
    if (typeof updates.username === "string") updates.username = updates.username.trim();
    if (typeof updates.email === "string") updates.email = updates.email.trim().toLowerCase();

    // Example allowed fields: username, email, bio, avatarUrl, tier (adjust to your schema)
    const allowed = ["username", "email", "bio", "avatarUrl", "tier", "name"];
    const payload = {};
    for (const k of allowed) {
      if (typeof updates[k] !== "undefined") payload[k] = updates[k];
    }

    const updated = await User.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
      context: "query",
    }).select("-password -__v").lean();

    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json(updated);
  } catch (err) {
    const mongoErr = mapMongoError(err);
    if (mongoErr) return res.status(mongoErr.status).json({ message: mongoErr.message });

    if (err && err.name === "ValidationError") {
      const messages = Object.values(err.errors || {}).map((e) => e.message);
      return res.status(400).json({ message: messages.join(", ") });
    }
    console.error("[users] update /me error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * PUT /api/users/me/password
 * Change password for the authenticated user.
 * Body: { currentPassword, newPassword }
 * - Normal users must provide currentPassword.
 * - Admins (req.user.role === 'admin') can change without currentPassword.
 */
router.put("/me/password", requireAuth(), async (req, res) => {
  try {
    const id = req.user && req.user._id ? req.user._id : null;
    if (!id) return res.status(401).json({ message: "Not authenticated" });

    const { currentPassword, newPassword } = req.body || {};
    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
      return res.status(400).json({ message: "newPassword must be at least 8 characters" });
    }

    const isAdmin = req.user && req.user.role === "admin";

    const user = await User.findById(id).select("+password").exec();
    if (!user) return res.status(404).json({ message: "User not found" });

    if (!isAdmin) {
      if (!currentPassword) return res.status(400).json({ message: "currentPassword required" });
      const ok = await bcrypt.compare(String(currentPassword), user.password);
      if (!ok) return res.status(401).json({ message: "Current password incorrect" });
    }

    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(String(newPassword), salt);
    await user.save();

    res.json({ message: "Password updated" });
  } catch (err) {
    console.error("[users] change password error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * (Optional) Admin route to reset another user's password:
 * PUT /api/users/:id/password
 * Protect with requireAuth() + requireRole('admin') in production.
 */
router.put("/:id/password", /* requireAuth(), requireRole('admin'), */ async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body || {};
    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
      return res.status(400).json({ message: "newPassword must be at least 8 characters" });
    }
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid user id" });

    const user = await User.findById(id).select("+password");
    if (!user) return res.status(404).json({ message: "User not found" });

    const salt = await bcrypt.genSalt(12);
    user.password = await bcrypt.hash(String(newPassword), salt);
    await user.save();

    res.json({ message: "Password updated for user" });
  } catch (err) {
    console.error("[users] admin change password error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /api/users/:id
 * Returns a single user (no password).
 * Keep AFTER /me — otherwise "me" will be interpreted as :id
 */
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }
    const user = await User.findById(req.params.id).select("-password -__v").lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    console.error("[users] get error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * POST /api/users
 * Signup: create account, hash password, auto-login (set httpOnly cookie), return safe user.
 */
router.post("/", async (req, res) => {
  try {
    const { username, email, password } = req.body || {};

    if (!username || !email || !password) {
      return res.status(400).json({ message: "username, email and password required" });
    }
    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ message: "password must be at least 8 characters" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const salt = await bcrypt.genSalt(12);
    const hashed = await bcrypt.hash(password, salt);

    const user = new User({
      username: String(username).trim(),
      email: normalizedEmail,
      password: hashed,
    });

    const newUser = await user.save();

    // Create JWT and set cookie (auto-login)
    const payload = { sub: newUser._id, username: newUser.username };
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

    res.cookie("token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60,
    });

    const result = newUser.toObject();
    delete result.password;

    res.status(201).json({ user: result, accessToken });
  } catch (err) {
    const mongoErr = mapMongoError(err);
    if (mongoErr) return res.status(mongoErr.status).json({ message: mongoErr.message });

    if (err && err.name === "ValidationError") {
      const messages = Object.values(err.errors || {}).map((e) => e.message);
      return res.status(400).json({ message: messages.join(", ") });
    }
    console.error("[users] signup error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * PUT /api/users/:id
 * Update user (disallow direct password changes here).
 * Optionally protect with requireAuth and owner/admin check.
 */
router.put("/:id", /* requireAuth(), */ async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const updates = { ...req.body };
    if (updates.password) delete updates.password; // require a dedicated password-change endpoint

    // normalize email/username if provided
    if (typeof updates.username === "string") updates.username = updates.username.trim();
    if (typeof updates.email === "string") updates.email = updates.email.trim().toLowerCase();

    const updated = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
      context: "query",
    }).select("-password -__v");

    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json(updated);
  } catch (err) {
    const mongoErr = mapMongoError(err);
    if (mongoErr) return res.status(mongoErr.status).json({ message: mongoErr.message });
    console.error("[users] update error:", err);
    res.status(400).json({ message: err.message || "Invalid request" });
  }
});

/**
 * DELETE /api/users/:id
 * Optionally protect with requireAuth() and requireRole('admin') or owner check.
 */
router.delete("/:id", /* requireAuth(), requireRole('admin'), */ async (req, res) => {
  try {
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User deleted" });
  } catch (err) {
    console.error("[users] delete error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;

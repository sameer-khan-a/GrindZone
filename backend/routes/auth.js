// routes/auth.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

/**
 * POST /api/auth/login
 * Body: { identifier, password }  // identifier = username OR email
 * Backwards-compatible: { email, password } will also work
 */
router.post("/login", async (req, res) => {
  try {
    const { identifier, email, password } = req.body || {};
    const idRaw = (identifier || email || "").toString().trim();

    if (!idRaw || !password) {
      return res.status(400).json({ message: "email/username and password required" });
    }

    // Normalize email if it looks like an email (case-insensitive)
    const isEmail = idRaw.includes("@");
    const maybeEmail = isEmail ? idRaw.toLowerCase() : idRaw;

    // Query: match by email (lowercased) OR username (exact)
    const user = await User.findOne({
      $or: [{ email: isEmail ? maybeEmail : undefined }, { username: idRaw }],
    })
      .select("+password")
      .exec();

    if (!user) {
      console.info(`[auth] login fail - user not found: ${idRaw}`);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      console.info(`[auth] login fail - bad password for: ${idRaw}`);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const payload = { sub: user._id, username: user.username };
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

    res.cookie("token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60,
    });

    const userSafe = {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    };

    res.json({ user: userSafe, accessToken });
  } catch (err) {
    console.error("[auth] login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/logout", (req, res) => {
  res.clearCookie("token", { httpOnly: true, sameSite: "lax" });
  res.json({ message: "Logged out" });
});

export default router;

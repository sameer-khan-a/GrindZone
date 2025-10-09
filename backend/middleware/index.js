// middleware/index.js
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import User from "../models/User.js";

/**
 * Async wrapper to avoid repetitive try/catch in routes.
 * Usage: router.get("/", asyncHandler(async (req, res) => { ... }));
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Read token from cookie (httpOnly) or Bearer header.
 * Returns null if not present.
 */
export function getTokenFromReq(req) {
  // prefer cookie (safer from XSS), fallback to Authorization header
  if (req?.cookies?.token) return req.cookies.token;
  const auth = req.headers?.authorization || req.headers?.Authorization;
  if (auth && typeof auth === "string" && auth.startsWith("Bearer ")) {
    return auth.split(" ")[1];
  }
  return null;
}

/**
 * attachUser middleware:
 * - If token present and valid, attach `req.user` (db object without password).
 * - If no token or invalid, silently continue (use requireAuth to enforce).
 */
export const attachUser = async (req, res, next) => {
  try {
    const token = getTokenFromReq(req);
    if (!token) return next();

    const secret = process.env.JWT_SECRET || "dev-secret";
    const payload = jwt.verify(token, secret);
    if (!payload?.sub) return next();

    const user = await User.findById(payload.sub).select("-password -__v");
    if (!user) return next();

    req.user = user;
    return next();
  } catch (err) {
    // Token invalid/expired — don't crash the request pipeline here.
    return next();
  }
};

/**
 * requireAuth:
 * - Use after attachUser (or alone). If user present -> next(), else 401.
 * - Optionally pass `opts` to control error message or roles in the future.
 */
export const requireAuth = (opts = {}) => (req, res, next) => {
  if (req.user) return next();
  return res.status(401).json({ message: opts.message || "Authentication required" });
};

/**
 * Simple role guard factory (optional):
 * requireRole('admin') -> checks req.user.role === 'admin'
 * (Assumes your user model has role; if not, ignore or adapt)
 */
export const requireRole = (role) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Authentication required" });
  if (req.user.role !== role) return res.status(403).json({ message: "Forbidden" });
  return next();
};

/**
 * Rate limiters
 * - `loginLimiter`: stricter for login attempts
 * - `signupLimiter`: mild for signup to avoid spam
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 6, // allow 6 attempts per window per IP
  message: { message: "Too many login attempts. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { message: "Too many accounts created from this IP. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Central error handler (place at end of middleware stack)
 * Usage: app.use(errorHandler);
 */
export function errorHandler(err, req, res, next) {
  // Don't leak internal details in production
  const isProd = process.env.NODE_ENV === "production";

  // Handle common mongoose duplicate key error nicely
  if (err && err.code === 11000) {
    const key = Object.keys(err.keyValue || {})[0];
    return res.status(409).json({ message: `${key} already in use` });
  }

  // Validation errors (mongoose)
  if (err && err.name === "ValidationError") {
    const messages = Object.values(err.errors || {}).map((e) => e.message);
    return res.status(400).json({ message: messages.join(", ") });
  }

  // JWT errors
  if (err && err.name === "JsonWebTokenError") {
    return res.status(401).json({ message: "Invalid token" });
  }
  if (err && err.name === "TokenExpiredError") {
    return res.status(401).json({ message: "Token expired" });
  }

  // Fallback
  console.error(err);
  res.status(err.status || 500).json({ message: isProd ? "Server error" : err.message || "Server error" });
}

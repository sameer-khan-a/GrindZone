// app.js
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import helmet from "helmet";
import cookieParser from "cookie-parser";

// Route imports (keep your existing routes)
import tournamentsRouter from "./routes/tournaments.js";
import paymentsRouter from "./routes/payments.js";
import friendRequestRouter from "./routes/friendRequestRoutes.js";
import matchRouter from "./routes/match.js";
import squadRouter from "./routes/squad.js";
import squadJoinRequestsRouter from "./routes/squadJoinRequestsRoutes.js";
import userRouter from "./routes/user.js";

// Auth + users routers we added earlier
import authRouter from "./routes/auth.js";
import usersRouter from "./routes/user.js"; // optional: if you prefer the new users router

// Middleware helpers we added
import {
  attachUser,
  errorHandler,
  loginLimiter,
  signupLimiter,
} from "./middleware/index.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// --- Basic security & parsing
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// CORS: allow your frontend to send cookies. Set FRONTEND_ORIGIN in .env
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:8080";
app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
  })
);

// Trust proxy if behind a reverse proxy (set TRUST_PROXY=true in production behind nginx/Cloudflare)
if (process.env.TRUST_PROXY === "1" || process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

// Attach user if token present (reads cookie or Authorization header)
app.use(attachUser);

// --- Health / root
app.get("/", (req, res) => {
  res.send("🎮 Backend server is running");
});

app.get("/_health", (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// --- API Routes
// Keep your existing mounts
app.use("/api/tournaments", tournamentsRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/friends", friendRequestRouter);
app.use("/api/matches", matchRouter);
app.use("/api/squads", squadRouter);
app.use("/api/squad-requests", squadJoinRequestsRouter);
app.use("/api/users", userRouter);

// Mount the auth router we added (login/logout/refresh)
app.use("/api/auth", authRouter);

// Optional: if you want to use the users router I refactored earlier, uncomment:
// app.use("/api/users", usersRouter);

// --- Error handler (last)
app.use(errorHandler);

// --- Mongo + Server Start
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://Sameer:suEQVSbWs6dTVNV4@cluster0.ujcjg.mongodb.net/GrindZone?retryWrites=true&w=majority&appName=Cluster0";

async function start() {
  try {
    mongoose.set("strictQuery", true);
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // print exact DB name mongoose is using and whether MONGO_URI is present
    const dbName = mongoose.connection.db && mongoose.connection.db.databaseName;
    console.log("✅ MongoDB connected. databaseName=", dbName || "(unknown)");
    console.log("MONGO_URI present in env:", !!process.env.MONGO_URI);

    const server = app.listen(port, () => {
      console.log(`🚀 Server is running on port: ${port}`);
    });

    // graceful shutdown handlers
    const shutdown = (signal) => {
      console.log(`Received ${signal}. Closing server...`);
      server.close(() => {
        mongoose.connection.close(false, () => {
          console.log("Mongo connection closed. Exiting.");
          process.exit(0);
        });
      });

      // force exit after 10s
      setTimeout(() => {
        console.error("Forcing shutdown.");
        process.exit(1);
      }, 10_000).unref();
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (err) {
    console.error("❌ Failed to start:", err);
    process.exit(1);
  }
}

start();

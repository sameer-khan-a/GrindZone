import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Route imports
import tournamentsRouter from './routes/tournaments.js';
import paymentsRouter from './routes/payments.js';
import friendRequestRouter from './routes/friendRequestRoutes.js';
import matchRouter from './routes/match.js';
import squadRouter from './routes/squad.js';
import squadJoinRequestsRouter from './routes/squadJoinRequestsRoutes.js';
import userRouter from './routes/user.js';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const mongoURI =
  process.env.MONGO_URI ||
  "mongodb+srv://Sameer:suEQVSbWs6dTVNV4@cluster0.ujcjg.mongodb.net/GrindZone?retryWrites=true&w=majority&appName=Cluster0";
mongoose
  .connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    // print exact DB name mongoose is using and whether MONGO_URI is present
    const dbName = mongoose.connection.db && mongoose.connection.db.databaseName;
    console.log('✅ MongoDB connected. databaseName=', dbName || '(unknown)');
    console.log('MONGO_URI present in env:', !!process.env.MONGO_URI);
    // do NOT print the URI itself (avoid leaking secrets)
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
  });
// Default Route
app.get('/', (req, res) => {
  res.send('🎮 Backend server is running');
});

// API Routes
app.use('/api/tournaments', tournamentsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/friends', friendRequestRouter);
app.use('/api/matches', matchRouter);
app.use('/api/squads', squadRouter);
app.use('/api/squad-requests', squadJoinRequestsRouter);
app.use('/api/users', userRouter);

// Start Server
app.listen(port, () => {
  console.log(`🚀 Server is running on port: ${port}`);
});

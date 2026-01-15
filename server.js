import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

// 1. Connection Buffer: Vercel ke liye connection handle karna
let cachedDb = null;

const connectDB = async () => {
  if (cachedDb) return cachedDb; // Agar pehle se connect hai toh wahi use karo
  
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing in Environment Variables");
  }

  try {
    const db = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // 5 second mein timeout ho jaye agar connect na ho
    });
    cachedDb = db;
    return db;
  } catch (err) {
    console.error("MongoDB Connection Error:", err);
    throw err;
  }
};

// 2. Models (Avoid Overwrite Error)
const AttendanceSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  email: { type: String, required: true },
  status: String,
  checkinTime: { type: Date, default: Date.now },
}, { timestamps: true });

const Attendance = mongoose.models.Attendance || mongoose.model('Attendance', AttendanceSchema);

// --- ROUTES ---

app.get('/status/:userId', async (req, res) => {
  try {
    await connectDB();
    const record = await Attendance.findOne({ userId: req.params.userId }).sort({ createdAt: -1 });
    if (!record) return res.json({ isCheckedIn: false });
    res.json({ ...record._doc, isCheckedIn: record.status === "CheckedIn" });
  } catch (err) {
    res.status(500).json({ error: "Database Error", details: err.message });
  }
});

app.get('/history/:userId', async (req, res) => {
  try {
    await connectDB();
    const history = await Attendance.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: "History Fetch Error", details: err.message });
  }
});

app.post('/checkin', async (req, res) => {
  try {
    await connectDB();
    const newRecord = new Attendance(req.body);
    await newRecord.save();
    res.status(201).json(newRecord);
  } catch (err) {
    res.status(500).json({ error: "Checkin Error", details: err.message });
  }
});

// Zaroori: Vercel ke liye export default
export default app;
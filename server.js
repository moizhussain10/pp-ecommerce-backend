import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// Database Connection Helper (Serverless Friendly)
let cachedDb = null;

const connectDB = async () => {
  if (cachedDb && mongoose.connection.readyState === 1) return cachedDb;

  // IMPORTANT: Make sure your Vercel Env Variable is named exactly MONGO_URI
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is not defined in environment variables");

  try {
    const db = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    cachedDb = db;
    console.log("MongoDB Connected");
    return db;
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    throw error;
  }
};

// --- Model Definition ---
const attendanceSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  checkinTime: { type: Date, required: true },
  checkoutTime: { type: Date },
  status: { type: String, required: true },
  checkinId: { type: String, required: true, unique: true },
  punctualityStatus: { type: String },
  halfDayStatus: { type: String },
  duration: { type: Number }
});

// Avoid "OverwriteModelError" in Vercel
const Attendance = mongoose.models.Attendance || mongoose.model("Attendance", attendanceSchema);

// --- Middleware ---
app.use(express.json());
app.use(cors({
  origin: ["https://pp-ecommerce-frontend.vercel.app", "http://localhost:5173"],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

// --- Routes ---

// Status Check Route
app.get("/api/status/:userId", async (req, res) => {
  try {
    await connectDB();
    const { userId } = req.params;
    const activeCheckin = await Attendance.findOne({ userId, status: "CheckedIn" });

    if (activeCheckin) {
      return res.status(200).json({
        isCheckedIn: true,
        checkinTime: activeCheckin.checkinTime,
        checkinId: activeCheckin.checkinId
      });
    }
    res.status(200).json({ isCheckedIn: false });
  } catch (error) {
    res.status(500).json({ message: "Status check failed", error: error.message });
  }
});

// History Route
app.get("/api/history/:userId", async (req, res) => {
  try {
    await connectDB();
    const history = await Attendance.find({ userId: req.params.userId, status: "CheckedOut" })
      .sort({ checkinTime: -1 }).limit(30);
    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ message: "History failed", error: error.message });
  }
});

// Check-in Route
app.post("/api/checkin", async (req, res) => {
  try {
    await connectDB();
    const { userId, timestamp, checkinId, punctualityStatus, halfDayStatus } = req.body;
    
    const existing = await Attendance.findOne({ userId, status: "CheckedIn" });
    if (existing) return res.status(409).json({ message: "Already checked in" });

    const newRecord = new Attendance({
      userId, checkinTime: new Date(timestamp), status: "CheckedIn", checkinId, punctualityStatus, halfDayStatus
    });
    await newRecord.save();
    res.status(201).json(newRecord);
  } catch (error) {
    res.status(500).json({ message: "Checkin failed", error: error.message });
  }
});

// Root Route
app.get("/", (req, res) => res.json({ status: "Backend Running" }));

export default app;
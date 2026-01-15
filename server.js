// backend/server.js - Minimal Test Version

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

app.use(express.json());

// CORS Configuration
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = [
      'https://pp-ecommerce-frontend.vercel.app',
      'http://localhost:5173',
      'http://localhost:3000'
    ];
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors());

// Root Route (No DB, No Model)
app.get("/", (req, res) => {
  res.json({ 
    message: "Backend is alive! 🚀",
    status: "active",
    timestamp: new Date().toISOString(),
    env: {
      hasMongoUri: !!MONGO_URI,
      nodeVersion: process.version
    }
  });
});

// Test endpoint
app.get("/api/test", (req, res) => {
  res.json({ 
    message: "API working",
    timestamp: new Date().toISOString()
  });
});

// Database Connection Helper
let isConnected = false;
let Attendance = null;

const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }

  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    
    isConnected = true;
    
    // Define Attendance model inline
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
    
    // Check if model already exists
    Attendance = mongoose.models.Attendance || mongoose.model("Attendance", attendanceSchema);
    
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB error:", error.message);
    throw error;
  }
};

// Utility Function
const calculateDuration = (checkinTime, checkoutTime) => {
  if (checkinTime && checkoutTime) {
    const durationMs = new Date(checkoutTime).getTime() - new Date(checkinTime).getTime();
    return durationMs > 0 ? durationMs : 0;
  }
  return null;
};

// 1. CHECK-IN Endpoint
app.post("/api/checkin", async (req, res) => {
  try {
    await connectDB();
    
    const { userId, timestamp, checkinId, punctualityStatus, halfDayStatus } = req.body;

    if (!userId || !timestamp || !checkinId || !punctualityStatus || !halfDayStatus) {
      return res.status(400).json({ 
        message: "Missing required fields" 
      });
    }

    const existingCheckin = await Attendance.findOne({
      userId,
      status: "CheckedIn"
    });

    if (existingCheckin) {
      return res.status(409).json({ 
        message: "User already checked in" 
      });
    }

    const newCheckin = new Attendance({
      userId,
      checkinTime: new Date(timestamp),
      status: "CheckedIn",
      checkinId,
      punctualityStatus,
      halfDayStatus
    });

    await newCheckin.save();
    
    return res.status(201).json({
      message: "Checkin successful",
      record: newCheckin
    });
  } catch (error) {
    console.error("Checkin error:", error.message);
    return res.status(500).json({ 
      message: "Checkin failed",
      error: error.message 
    });
  }
});

// 2. CHECK-OUT Endpoint
app.post("/api/checkout", async (req, res) => {
  try {
    await connectDB();
    
    const { userId, timestamp, checkinId } = req.body;

    if (!userId || !timestamp || !checkinId) {
      return res.status(400).json({
        message: "Missing required fields"
      });
    }

    const record = await Attendance.findOne({
      userId,
      status: "CheckedIn",
      checkinId
    });

    if (!record) {
      return res.status(404).json({
        message: "No active checkin found"
      });
    }

    const checkoutTime = new Date(timestamp);
    const durationMs = calculateDuration(record.checkinTime, checkoutTime);

    record.checkoutTime = checkoutTime;
    record.status = "CheckedOut";
    record.duration = durationMs;

    await record.save();

    res.status(200).json({ 
      message: "Checkout successful", 
      record: record 
    });
  } catch (error) {
    console.error("Checkout error:", error.message);
    res.status(500).json({ 
      message: "Checkout failed",
      error: error.message 
    });
  }
});

// 3. Status Check Endpoint
app.get("/api/status/:userId", async (req, res) => {
  try {
    await connectDB();
    
    const { userId } = req.params;
    
    const activeCheckin = await Attendance.findOne({
      userId,
      status: "CheckedIn"
    });

    if (activeCheckin) {
      return res.status(200).json({
        isCheckedIn: true,
        checkinTime: activeCheckin.checkinTime,
        checkinId: activeCheckin.checkinId
      });
    } else {
      return res.status(200).json({ isCheckedIn: false });
    }
  } catch (error) {
    console.error("Status error:", error.message);
    res.status(500).json({ 
      message: "Status check failed", 
      error: error.message 
    });
  }
});

// 4. GET HISTORY Endpoint
app.get("/api/history/:userId", async (req, res) => {
  try {
    await connectDB();
    
    const { userId } = req.params;
    
    const historyRecords = await Attendance.find({
      userId,
      status: "CheckedOut"
    })
    .sort({ checkinTime: -1 })
    .limit(30);

    const formattedHistory = historyRecords.map((record) => ({
      checkinTime: record.checkinTime,
      checkoutTime: record.checkoutTime,
      duration: record.duration,
      punctualityStatus: record.punctualityStatus || "N/A",
      halfDayStatus: record.halfDayStatus || "N/A"
    }));

    res.status(200).json(formattedHistory);
  } catch (error) {
    console.error("History error:", error.message);
    res.status(500).json({ 
      message: "History fetch failed",
      error: error.message 
    });
  }
});

// Export for Vercel (MUST be default export)
export default app;
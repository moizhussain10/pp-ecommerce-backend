// backend/server.js

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import Attendance from "./models/Attendance.js";

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
      callback(null, true); // Temporarily allow all
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors());

// Root Route
app.get("/", (req, res) => {
  res.json({ 
    message: "PP Ecommerce Backend API is running! 🚀",
    status: "active",
    endpoints: {
      checkin: "/api/checkin",
      checkout: "/api/checkout",
      status: "/api/status/:userId",
      history: "/api/history/:userId"
    }
  });
});

// Database Connection
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// Utility Function
const calculateDuration = (checkinTime, checkoutTime) => {
  if (checkinTime && checkoutTime) {
    const durationMs = new Date(checkoutTime).getTime() - new Date(checkinTime).getTime();
    return durationMs > 0 ? durationMs : 0;
  }
  return null;
};

// === API ENDPOINTS ===

// 1. CHECK-IN Endpoint
app.post("/api/checkin", async (req, res) => {
  console.log("RECEIVED PAYLOAD:", req.body);

  const { userId, timestamp, checkinId, punctualityStatus, halfDayStatus } = req.body;

  if (!userId || !timestamp || !checkinId || !punctualityStatus || !halfDayStatus) {
    console.error("Missing fields:", req.body);
    return res.status(400).json({ 
      message: "Missing required fields in checkin data." 
    });
  }

  try {
    // Check if user already has an open checkin
    const existingCheckin = await Attendance.findOne({
      userId,
      status: "CheckedIn"
    });

    if (existingCheckin) {
      return res.status(409).json({ 
        message: "User already has an active check-in session." 
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
      message: "Checkin recorded successfully.",
      record: newCheckin
    });
  } catch (error) {
    console.error("Checkin Error:", error);
    return res.status(500).json({ 
      message: "Failed to record checkin",
      error: error.message 
    });
  }
});

// 2. CHECK-OUT Endpoint
app.post("/api/checkout", async (req, res) => {
  const { userId, timestamp, checkinId } = req.body;

  if (!userId || !timestamp || !checkinId) {
    return res.status(400).json({
      message: "Missing required fields: userId, timestamp, checkinId"
    });
  }

  try {
    const record = await Attendance.findOne({
      userId,
      status: "CheckedIn",
      checkinId
    });

    if (!record) {
      return res.status(404).json({
        message: "No active checkin session found for this user/checkinId."
      });
    }

    const checkoutTime = new Date(timestamp);
    const durationMs = calculateDuration(record.checkinTime, checkoutTime);

    record.checkoutTime = checkoutTime;
    record.status = "CheckedOut";
    record.duration = durationMs;

    await record.save();

    res.status(200).json({ 
      message: "Checkout recorded", 
      record: record 
    });
  } catch (error) {
    console.error("Checkout Error:", error);
    res.status(500).json({ 
      message: "Failed to record checkout",
      error: error.message 
    });
  }
});

// 3. Status Check Endpoint
app.get("/api/status/:userId", async (req, res) => {
  const { userId } = req.params;
  
  console.log('Status check for userId:', userId);
  
  try {
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
    console.error("Status check error:", error);
    res.status(500).json({ 
      message: "Failed to get status", 
      error: error.message 
    });
  }
});

// 4. GET HISTORY Endpoint
app.get("/api/history/:userId", async (req, res) => {
  const { userId } = req.params;
  
  console.log('History check for userId:', userId);
  
  try {
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
    console.error("History Fetch Error:", error);
    res.status(500).json({ 
      message: "Failed to fetch user history",
      error: error.message 
    });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// NOTE: Absentee check feature commented out 
// Implement karne ke liye User model aur proper time range logic chahiye
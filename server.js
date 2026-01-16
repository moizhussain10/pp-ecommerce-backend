// backend/server.js - With Admin Routes

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

// Root Route
app.get("/", (req, res) => {
  res.json({ 
    message: "PP Ecommerce Backend API 🚀",
    status: "active",
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
    
    // Attendance Model
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
    
    Attendance = mongoose.models.Attendance || mongoose.model("Attendance", attendanceSchema);
    
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB error:", error.message);
    throw error;
  }
};

// Utility Functions
const calculateDuration = (checkinTime, checkoutTime) => {
  if (checkinTime && checkoutTime) {
    const durationMs = new Date(checkoutTime).getTime() - new Date(checkinTime).getTime();
    return durationMs > 0 ? durationMs : 0;
  }
  return null;
};

// ======== ADMIN ROUTES ========

// Get All Attendance Records (Admin)
app.get("/api/admin/attendance", async (req, res) => {
  try {
    await connectDB();
    
    const { status, startDate, endDate, userId } = req.query;
    
    let query = {};
    
    // Filter by status
    if (status) {
      query.status = status;
    }
    
    // Filter by userId
    if (userId) {
      query.userId = userId;
    }
    
    // Filter by date range
    if (startDate && endDate) {
      query.checkinTime = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    const records = await Attendance.find(query)
      .sort({ checkinTime: -1 })
      .limit(500);
    
    res.status(200).json({
      success: true,
      count: records.length,
      data: records
    });
  } catch (error) {
    console.error("Admin attendance fetch error:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch attendance records",
      error: error.message 
    });
  }
});

// Get All Unique Users (Admin)
app.get("/api/admin/users", async (req, res) => {
  try {
    await connectDB();
    
    const users = await Attendance.distinct("userId");
    
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error("Admin users fetch error:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch users",
      error: error.message 
    });
  }
});

// Get Summary Statistics (Admin)
app.get("/api/admin/stats", async (req, res) => {
  try {
    await connectDB();
    
    const { startDate, endDate } = req.query;
    
    let query = {};
    if (startDate && endDate) {
      query.checkinTime = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    const totalRecords = await Attendance.countDocuments(query);
    const checkedInCount = await Attendance.countDocuments({ ...query, status: "CheckedIn" });
    const checkedOutCount = await Attendance.countDocuments({ ...query, status: "CheckedOut" });
    const lateCount = await Attendance.countDocuments({ ...query, punctualityStatus: "Late" });
    const halfDayCount = await Attendance.countDocuments({ ...query, halfDayStatus: "HalfDay" });
    
    res.status(200).json({
      success: true,
      data: {
        total: totalRecords,
        checkedIn: checkedInCount,
        checkedOut: checkedOutCount,
        late: lateCount,
        halfDay: halfDayCount
      }
    });
  } catch (error) {
    console.error("Admin stats fetch error:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch statistics",
      error: error.message 
    });
  }
});

// Delete Attendance Record (Admin)
app.delete("/api/admin/attendance/:id", async (req, res) => {
  try {
    await connectDB();
    
    const { id } = req.params;
    const deleted = await Attendance.findByIdAndDelete(id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Record not found"
      });
    }
    
    res.status(200).json({
      success: true,
      message: "Record deleted successfully"
    });
  } catch (error) {
    console.error("Admin delete error:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to delete record",
      error: error.message 
    });
  }
});

// ======== USER ROUTES ========

// Check-in
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

// Check-out
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

// Status Check
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

// Get History
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

// Export for Vercel
export default app;
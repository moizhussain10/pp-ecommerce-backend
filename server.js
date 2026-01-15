import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();
const app = express();

app.use(express.json());
app.use(cors());

// 1. MongoDB Connection
const mongoURI = process.env.MONGO_URI; 
mongoose.connect(mongoURI)
  .then(() => console.log("MongoDB Connected... ✅"))
  .catch(err => console.log("MongoDB Connection Error: ❌", err));

// 2. Updated Schema (Email field ke sath)
const AttendanceSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  email: { type: String, required: true }, // Admin ke liye email save hogi
  status: String,
  checkinTime: { type: Date, default: null },
  checkoutTime: { type: Date, default: null },
  punctualityStatus: { type: String, default: "---" },
  halfDayStatus: { type: String, default: "FullDay" }
}, { timestamps: true });

const Attendance = mongoose.model("Attendance", AttendanceSchema, "attendances");

// 3. GET: Real Data from MongoDB (No Mocking)
app.get('/api/admin/attendance', async (req, res) => {
  try {
    const records = await Attendance.find().sort({ createdAt: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: "DB Fetch Error", details: err.message });
  }
});

// 4. POST: Check-in logic with Email
app.post("/api/checkin", async (req, res) => {
  try {
    const { userId, email, status, punctualityStatus, halfDayStatus } = req.body;

    const newAttendance = new Attendance({
      userId,
      email, // Frontend se user ki email aayegi
      status: status || "CheckedIn",
      checkinTime: new Date(),
      punctualityStatus: punctualityStatus || "Not Late",
      halfDayStatus: halfDayStatus || "FullDay"
    });

    const savedRecord = await newAttendance.save();
    res.status(201).json({ message: "Check-in successful", data: savedRecord });
  } catch (err) {
    res.status(500).json({ error: "Check-in failed", details: err.message });
  }
});

// 5. POST: Check-out logic
app.post("/api/checkout", async (req, res) => {
  try {
    const { userId } = req.body;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const record = await Attendance.findOneAndUpdate(
      { userId, checkinTime: { $gte: today }, checkoutTime: null },
      { checkoutTime: new Date(), status: "CheckedOut" },
      { new: true }
    );

    if (!record) return res.status(404).json({ message: "No active check-in found for today" });
    res.json({ message: "Checked out successfully", data: record });
  } catch (err) {
    res.status(500).json({ error: "Checkout failed" });
  }
});

export default app;
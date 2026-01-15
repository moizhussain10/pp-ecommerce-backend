import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

// Database connection ko function mein rakhein
const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) return;
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB Connected");
  } catch (err) {
    console.error("MongoDB Connection Error:", err);
    throw err; // Ye throw karna zaroori hai taake 500 error ka pata chale
  }
};

// 2. Schema aur Model (Ensure model isn't re-compiled)
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
    await connectDB(); // Har request par check karein
    const record = await Attendance.findOne({ userId: req.params.userId }).sort({ createdAt: -1 });
    // Dashboard ko 'isCheckedIn' property chahiye hoti hai
    if (!record) return res.json({ isCheckedIn: false }); 
    res.json({ ...record._doc, isCheckedIn: record.status === "CheckedIn" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/history/:userId', async (req, res) => {
  try {
    await connectDB();
    const history = await Attendance.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/checkin', async (req, res) => {
  try {
    await connectDB();
    const newRecord = new Attendance(req.body);
    await newRecord.save();
    res.status(201).json(newRecord);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default app;
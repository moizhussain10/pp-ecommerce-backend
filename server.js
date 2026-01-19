import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();
const app = express();

// Database Connection Helper
let cachedDb = null;
const connectDB = async () => {
  if (cachedDb && mongoose.connection.readyState === 1) return cachedDb;
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in Vercel Settings!");
  try {
    const db = await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    cachedDb = db;
    return db;
  } catch (error) {
    console.error("DB Error:", error.message);
    throw error;
  }
};

// Schema & Model
const attendanceSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  email: { type: String, default: "no-email@provided.com" },
  checkinTime: { type: Date, required: true },
  checkoutTime: { type: Date, default: null },
  status: { type: String, required: true },
  checkinId: { type: String, required: true, unique: true },
  punctualityStatus: { type: String, default: "N/A" },
  halfDayStatus: { type: String, default: "FullDay" },
  duration: { type: Number, default: null }
});

const Attendance = mongoose.models.Attendance || mongoose.model("Attendance", attendanceSchema);

// Middleware
app.use(express.json());
app.use(cors({
  origin: ["https://pp-ecommerce-frontend.vercel.app", "http://localhost:5173"],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

// --- API ROUTES ---

app.get("/api/status/:userId", async (req, res) => {
  try {
    await connectDB();
    const { userId } = req.params; // Frontend se aane wali ID

    // Check karein ke kya is user ka koi active 'CheckedIn' record hai
    const activeStatus = await Attendance.findOne({ 
      userId: userId, 
      status: "CheckedIn" 
    });

    if (activeStatus) {
      res.json({ 
        isCheckedIn: true, 
        checkinTime: activeStatus.checkinTime,
        checkinId: activeStatus.checkinId,
        punctualityStatus: activeStatus.punctualityStatus
      });
    } else {
      res.json({ isCheckedIn: false });
    }
  } catch (error) {
    console.error("Status Route Error:", error);
    res.status(500).json({ error: "Server Error", details: error.message });
  }
});

app.get("/api/admin/attendance", async (req, res) => {
  try {
    await connectDB();
    
    // Grouping logic: Har user ka sirf latest record uthao
    const latestAttendance = await Attendance.aggregate([
      { $sort: { checkinTime: -1 } },
      {
        $group: {
          _id: "$userId",
          email: { $first: "$email" },
          status: { $first: "$status" },
          checkinTime: { $first: "$checkinTime" },
          checkoutTime: { $first: "$checkoutTime" },
          punctualityStatus: { $first: "$punctualityStatus" },
          userId: { $first: "$userId" }
        }
      },
      { $sort: { status: 1 } } // Online (CheckedIn) wale upar ayenge
    ]);
      
    res.json(latestAttendance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.get("/api/admin/user-details/:email", async (req, res) => {
  try {
    await connectDB();
    const history = await Attendance.find({ email: req.params.email })
      .sort({ checkinTime: -1 }); // Naya data pehle
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.post("/api/checkin", async (req, res) => {
  try {
    await connectDB();
    const { userId, email, checkinTime, status, punctualityStatus, checkinId } = req.body;

    // 1. Aaj ki date ki range set karein (Server Timezone ke mutabiq)
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    console.log(`Checking for existing record: User ${userId} between ${startOfDay} and ${endOfDay}`);

    // 2. Database mein dhoondo agar is user ne aaj check-in kiya hai
    const existingRecord = await Attendance.findOne({
      userId: userId,
      checkinTime: { 
        $gte: startOfDay, 
        $lte: endOfDay 
      }
    });

    if (existingRecord) {
      console.log("Duplicate entry blocked for user:", userId);
      return res.status(400).json({ 
        message: "Aap aaj ka check-in pehle hi kar chuke hain." 
      });
    }

    // 3. Naya record save karein
    const newEntry = new Attendance({
      userId,
      email,
      checkinTime: new Date(checkinTime), // Ensure it's a Date object
      status,
      punctualityStatus,
      checkinId
    });

    await newEntry.save();
    console.log("Check-in successful for:", email);
    res.status(200).json({ message: "Check-in Successful" });

  } catch (error) {
    console.error("CRITICAL ERROR IN CHECKIN:", error.message);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

app.post("/api/checkout", async (req, res) => {
  try {
    await connectDB();
    const record = await Attendance.findOne({ userId: req.body.userId, checkinId: req.body.checkinId, status: "CheckedIn" });
    if (!record) return res.status(404).json({ message: "No active session found" });

    const checkoutTime = new Date(req.body.timestamp);
    record.checkoutTime = checkoutTime;
    record.status = "CheckedOut";
    record.duration = checkoutTime.getTime() - record.checkinTime.getTime();
    await record.save();
    res.json({ message: "Checked out!", record });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/history/:userId", async (req, res) => {
  try {
    await connectDB();
    const { userId } = req.params;

    const history = await Attendance.find({ userId: userId })
      .sort({ checkinTime: -1 });

    res.json(history);
  } catch (error) {
    console.error("History Route Error:", error);
    res.status(500).json({ error: "Server Error", details: error.message });
  }
});

export default app;
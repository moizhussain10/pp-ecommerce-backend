// backend/server.js

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import Attendance from "./models/Attendance.js";

// Environment variables load karna
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

app.use(express.json());

// CORS - Multiple methods
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = [
      'https://pp-ecommerce-frontend.vercel.app',
      'http://localhost:5173',
      'http://localhost:3000'
    ];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Preflight requests ke liye
app.options('*', cors());
// === Database Connection ===
mongoose
  .connect(MONGO_URI)
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// === Utility Function ===
// Duration calculation ko thoda robust banate hain
const calculateDuration = (checkinTime, checkoutTime) => {
  if (checkinTime && checkoutTime) {
    // dono Date objects hone chahiye
    const durationMs =
      new Date(checkoutTime).getTime() - new Date(checkinTime).getTime();
    return durationMs > 0 ? durationMs : 0;
  }
  return null; // Agar checkout nahi hua ya time missing hai
};

// backend/server.js -> runMarkAbsenteesCheck function

const runMarkAbsenteesCheck = async () => {
    // ... (Time range calculation) ...

    console.log(`DIAGNOSTIC 1: Starting check. Range OK.`); 

    try {
        // 2. Saare Active Users ki IDs fetch karein
        const allUsers = await User.find({ isActive: true }).select('userId'); 
        const userIds = allUsers.map(user => user.userId); 
        
        console.log(`DIAGNOSTIC 2: Total Users Found: ${userIds.length}`); // Agar yeh 0 hai, toh masla Users collection mein hai.

        if (userIds.length === 0) {
            return { message: "No active users found." };
        }

        // 3. Dekhein ke kaunse users ne check-in kiya
        const attendedRecords = await Attendance.find({
            checkinTime: { $gte: shiftStartTime, $lte: shiftEndTime }
        });

        const attendedUserIds = new Set(attendedRecords.map(rec => rec.userId));
        
        // 4. Absent users ki list tayyar karein
        const absentUserIds = userIds.filter(id => !attendedUserIds.has(id));
        
        console.log(`DIAGNOSTIC 3: Users absent: ${absentUserIds.length}`); // Agar yeh 0 hai, toh koi aur ghalti hai.

        if (absentUserIds.length > 0) {
            
            // Duplicate checks:
            const existingAbsences = await Attendance.find({
                checkinId: { $in: absentRecords.map(r => r.checkinId) }
            });
            
            // Yahan hum pehle Absent Records bana lete hain taake checkinId mil jaye
            const absentRecords = absentUserIds.map(userId => ({
                userId,
                status: 'Absent',
                checkinTime: shiftStartTime, 
                checkinId: `${userId}_ABSENT_${shiftStartTime.toISOString().split('T')[0]}`,
            }));

            // Filter new absences
            const newAbsenceRecords = absentRecords.filter(
                r => !existingAbsences.some(e => e.checkinId === r.checkinId)
            );
            
            console.log(`DIAGNOSTIC 4: New unique absences to insert: ${newAbsenceRecords.length}`); // Agar yeh 0 hai, toh duplicate check problem hai.

            if (newAbsenceRecords.length > 0) {
                await Attendance.insertMany(newAbsenceRecords, { ordered: false });
                console.log(`DIAGNOSTIC 5: Insert successful!`); // Agar yeh print nahi hua, toh insertMany fail hua.
                
                return { 
                    message: `Successfully marked ${newAbsenceRecords.length} users as Absent.`,
                    absentCount: newAbsenceRecords.length 
                };
            } else {
                return { message: "All absentees already marked for this cycle." };
            }
        } else {
            return { message: "No absentees found for the checked shift cycle." };
        }

    } catch (error) {
        console.error("ABSENTEE CHECK FAILED. ERROR:", error); // Agar yeh chala, toh koi serious server ghalti hai.
        return { message: "Server error during absentee check.", error: error.message };
    }
};


// --- EXPRESS ROUTE TO TRIGGER ABSENTEE CHECK (No change) ---

app.get('/api/mark-absent', async (req, res) => {
    const result = await runMarkAbsenteesCheck();
    
    if (result.error) {
        return res.status(500).json(result);
    }
    res.json(result);
}); 

app.get("/api/status/:userId", async (req, res) => {
  const { userId } = req.params;
  
  console.log('Status check for userId:', userId); // Debug log
  
  try {
    const activeCheckin = await Attendance.findOne({
      userId,
      status: "CheckedIn",
    });

    if (activeCheckin) {
      return res.status(200).json({
        isCheckedIn: true,
        checkinTime: activeCheckin.checkinTime,
        checkinId: activeCheckin.checkinId,
      });
    } else {
      return res.status(200).json({ isCheckedIn: false });
    }
  } catch (error) {
    console.error("Status check error:", error); // Better logging
    res.status(500).json({ 
      message: "Failed to get status", 
      error: error.message // Error message frontend ko bhejo
    });
  }
});

// === API Endpoints ===

// 1. CHECK-IN Endpoint
// ... (Check-in logic same rahega) ...
app.post("/api/checkin", async (req, res) => {
  // 🔴 Yeh line yahan daal kar check karein
  console.log("RECEIVED PAYLOAD:", req.body);

  const { userId, timestamp, checkinId, punctualityStatus, halfDayStatus } =
    req.body;

  if (
    !userId ||
    !timestamp ||
    !checkinId ||
    !punctualityStatus ||
    !halfDayStatus
  ) {
    console.error("Missing fields:", req.body);
    return res
      .status(400)
      .json({ message: "Missing required fields in checkin data." });
  }

  try {
    // ... (existing check for open checkin) ...

    const newCheckin = new Attendance({
      userId,
      checkinTime: new Date(timestamp),
      status: "CheckedIn",
      checkinId,
      punctualityStatus: punctualityStatus,
      halfDayStatus: halfDayStatus, // <--- Naye Field ko Save Karein
    });

    await newCheckin.save();
    return res.status(201).json({
      message: "Checkin recorded successfully.",
      record: newCheckin,
    });
  } catch (error) {
    // ... (error handling) ...
  }
});

// 2. CHECK-OUT Endpoint
app.post("/api/checkout", async (req, res) => {
  const { userId, timestamp, checkinId } = req.body;

  if (!userId || !timestamp || !checkinId) {
    return res
      .status(400)
      .json({
        message: "Missing required fields: userId, timestamp, checkinId",
      });
  }

  try {
    // Step 1: Record ko dhoondho
    const record = await Attendance.findOne({
      userId,
      status: "CheckedIn",
      checkinId,
    });

    if (!record) {
      return res
        .status(404)
        .json({
          message: "No active checkin session found for this user/checkinId.",
        });
    }

    const checkoutTime = new Date(timestamp);

    // Step 2: Duration Calculate karo
    const durationMs = calculateDuration(record.checkinTime, checkoutTime);

    // Step 3: Record ko update karo
    record.checkoutTime = checkoutTime;
    record.status = "CheckedOut";
    record.duration = durationMs; // Duration save kiya

    await record.save();

    res.status(200).json({ message: "Checkout recorded", record: record });
  } catch (error) {
    console.error("Checkout Error:", error);
    res.status(500).json({ message: "Failed to record checkout" });
  }
});

// 3. Status check endpoint (GET /api/status/:userId)
// ... (Status check logic same rahega) ...
app.get("/api/status/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const activeCheckin = await Attendance.findOne({
      userId,
      status: "CheckedIn",
    });

    if (activeCheckin) {
      return res.status(200).json({
        isCheckedIn: true,
        checkinTime: activeCheckin.checkinTime,
        checkinId: activeCheckin.checkinId,
      });
    } else {
      return res.status(200).json({ isCheckedIn: false });
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to get status" });
  }
});

// 4. GET HISTORY Endpoint (NEW)
app.get("/api/history/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    // Sirf woh records fetch karo jinka status 'CheckedOut' hai
    // Aur naye se purane order mein sort karo (descending order by checkinTime)
    const historyRecords = await Attendance.find({
      userId,
      status: "CheckedOut",
    })
      .sort({ checkinTime: -1 })
      .limit(30); // Last 30 records show kar sakte hain

    // Frontend ko dene ke liye data ko process karo
    const formattedHistory = historyRecords.map((record) => {
      return {
        checkinTime: record.checkinTime,
        checkoutTime: record.checkoutTime,
        duration: record.duration, // Yeh field ab database mein available hai
        punctualityStatus: record.punctualityStatus || "N/A",
      };
    });

    res.status(200).json(formattedHistory);
  } catch (error) {
    console.error("History Fetch Error:", error);
    res.status(500).json({ message: "Failed to fetch user history" });
  }
});

// === Start Server ===
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


const CHECK_HOUR = 5; // 5 AM
const CHECK_MINUTE = 35; // 35 minutes

const scheduleAbsenteeCheck = () => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Kal ki 5:35 AM ka timestamp calculate karein
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(CHECK_HOUR, CHECK_MINUTE, 0, 0);

    // Aaj ki 5:35 AM ka timestamp calculate karein (Agar time abhi nahi guzra)
    const todayTarget = new Date(now);
    todayTarget.setHours(CHECK_HOUR, CHECK_MINUTE, 0, 0);
    
    let targetTime = todayTarget;
    
    // Agar 5:35 AM guzar chuka hai, toh kal 5:35 AM ka target banayen
    if (now.getTime() > todayTarget.getTime()) {
        targetTime = tomorrow;
    }

    const timeUntilTarget = targetTime.getTime() - now.getTime();

    console.log(`Absentee check scheduled for: ${targetTime.toLocaleString()}. Running in ${Math.round(timeUntilTarget / 1000 / 60)} minutes.`);

    // Set a timeout for the next run
    setTimeout(async () => {
        console.log("TIMEOUT TRIGGERED: Running daily absentee check.");
        await runMarkAbsenteesCheck();
        
        // Job complete hone ke baad, agli baar ke liye dobara schedule karein
        scheduleAbsenteeCheck(); 
        
    }, timeUntilTarget);
};

// Server start hone ke baad schedule shuru karein
scheduleAbsenteeCheck();
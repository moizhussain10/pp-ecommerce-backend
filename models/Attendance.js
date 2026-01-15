// backend/models/Attendance.js
import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  checkinTime: { type: Date, required: true },
  checkoutTime: { type: Date, default: null },
  email: { type: String, default: "no-email@provided.com" },
  status: {
    type: String,
    enum: ["CheckedIn", "CheckedOut", "Absent"],
    default: "CheckedIn",
  }, // 'Absent' bhi add kiya
  checkinId: { type: String, required: true, unique: true }, // --- ATTENDANCE METADATA ---

  punctualityStatus: { type: String, default: "N/A" }, // ONLY ONE DEFINITION
  duration: { type: Number, default: null }, // Duration in milliseconds
  halfDayStatus: {
    type: String,
    enum: ["FullDay", "HalfDay", "N/A"],
    default: "FullDay",
  },
});

const Attendance = mongoose.model("Attendance", attendanceSchema);
export default Attendance;

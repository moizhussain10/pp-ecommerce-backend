// backend/server.js - Debug Version

import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

// CORS Configuration
app.use(cors({
  origin: ['https://pp-ecommerce-frontend.vercel.app', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors());

// Root Route - No DB
app.get("/", (req, res) => {
  res.json({ 
    message: "Backend is alive! 🚀",
    status: "active",
    timestamp: new Date().toISOString()
  });
});

// Test endpoint - No DB
app.get("/api/test", (req, res) => {
  res.json({ 
    message: "API test successful",
    timestamp: new Date().toISOString()
  });
});

// Mock endpoints for testing (No DB)
app.get("/api/status/:userId", (req, res) => {
  const { userId } = req.params;
  console.log('Status check for:', userId);
  
  res.status(200).json({ 
    isCheckedIn: false,
    message: "Mock response - DB disabled for testing"
  });
});

app.get("/api/history/:userId", (req, res) => {
  const { userId } = req.params;
  console.log('History check for:', userId);
  
  res.status(200).json([]);
});

app.post("/api/checkin", (req, res) => {
  console.log('Checkin request:', req.body);
  
  res.status(201).json({
    message: "Mock checkin successful",
    record: req.body
  });
});

app.post("/api/checkout", (req, res) => {
  console.log('Checkout request:', req.body);
  
  res.status(200).json({
    message: "Mock checkout successful"
  });
});

// Export for Vercel
export default app;
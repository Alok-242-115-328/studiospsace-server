import dns from "dns";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { OAuth2Client } from "google-auth-library"; // 👈 নতুন যোগ করা হলো

// DNS সেট করুন (MongoDB কানেকশনের সমস্যা এড়াতে)
dns.setServers(["8.8.8.8", "8.8.4.4"]);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Google OAuth Client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID); // 👈 নতুন

// Middlewares
app.use(cors({ origin: [process.env.CLIENT_URL || "http://localhost:3000"], credentials: true }));
app.use(express.json());
app.use(cookieParser());

// MongoDB Connection Setup
const client = new MongoClient(process.env.MONGODB_URI, {
  tls: true,
  tlsAllowInvalidCertificates: true 
});

let db;

async function connectDB() {
  try {
    await client.connect();
    db = client.db("studiospsace");
    await db.command({ ping: 1 });
    console.log("✅ MongoDB connected successfully");
  } catch (err) {
    console.error("❌ MongoDB error:", err);
  }
}

// ==========================================
// ROUTES
// ==========================================

// টেস্ট রাউট
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "🎬 Server running", dbConnected: !!db });
});

// ==========================================
// STUDIOS API ROUTES
// ==========================================

// ১. নতুন স্টুডিও অ্যাড করা (POST)
app.post("/api/studios", async (req, res) => {
  try {
    const studioData = req.body;
    studioData.createdAt = new Date();
    studioData.rating = 5.0;
    
    const result = await db.collection("studios").insertOne(studioData);
    res.status(201).json({ success: true, message: "Studio added successfully", id: result.insertedId });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to add studio", error: error.message });
  }
});

// ২. সব স্টুডিও পাওয়া (GET) - ফিল্টার এবং লিমিট সহ
app.get("/api/studios", async (req, res) => {
  try {
    const { category, limit } = req.query;
    let query = {};
    
    if (category) {
      query.category = category;
    }
    
    let cursor = db.collection("studios").find(query).sort({ createdAt: -1 });
    
    if (limit) {
      cursor = cursor.limit(parseInt(limit));
    }
    
    const studios = await cursor.toArray();
    res.status(200).json(studios);
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch studios" });
  }
});

// ৩. একটি নির্দিষ্ট স্টুডিও পাওয়া (GET by ID)
app.get("/api/studios/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const studio = await db.collection("studios").findOne(query);
    
    if (!studio) {
      return res.status(404).json({ success: false, message: "Studio not found" });
    }
    
    res.status(200).json(studio);
  } catch (error) {
    res.status(500).json({ success: false, message: "Invalid ID or server error" });
  }
});

// ৪. নির্দিষ্ট ইউজারের স্টুডিও পাওয়া (GET by Email)
app.get("/api/my-studios", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ success: false, message: "Email required" });
    
    const studios = await db.collection("studios").find({ hostEmail: email }).sort({ createdAt: -1 }).toArray();
    res.status(200).json(studios);
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch your studios" });
  }
});

// ৫. স্টুডিও আপডেট করা (PUT)
app.put("/api/studios/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const updatedData = req.body;
    delete updatedData._id;
    
    const query = { _id: new ObjectId(id) };
    const updateDoc = { $set: updatedData };
    
    await db.collection("studios").updateOne(query, updateDoc);
    res.status(200).json({ success: true, message: "Studio updated successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Update failed" });
  }
});

// ৬. স্টুডিও ডিলিট করা (DELETE)
app.delete("/api/studios/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    
    await db.collection("studios").deleteOne(query);
    res.status(200).json({ success: true, message: "Studio deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Delete failed" });
  }
});


// ==========================================
// BOOKINGS API ROUTES
// ==========================================

// ১. নতুন বুকিং তৈরি করা (POST)
app.post("/api/bookings", async (req, res) => {
  try {
    const bookingData = req.body;
    bookingData.createdAt = new Date();
    bookingData.status = "Pending";
    
    // ডাবল বুকিং চেক
    const existingBooking = await db.collection("bookings").findOne({
      studioId: bookingData.studioId,
      date: bookingData.date,
      time: bookingData.time,
      status: "Confirmed"
    });

    if (existingBooking) {
      return res.status(400).json({ success: false, message: "This slot is already booked!" });
    }

    const result = await db.collection("bookings").insertOne(bookingData);
    res.status(201).json({ success: true, message: "Booking successful", id: result.insertedId });
  } catch (error) {
    res.status(500).json({ success: false, message: "Booking failed", error: error.message });
  }
});

// ২. নির্দিষ্ট ইউজারের সব বুকিং দেখা (GET)
app.get("/api/bookings", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }
    
    const bookings = await db.collection("bookings").find({ userEmail: email }).sort({ createdAt: -1 }).toArray();
    res.status(200).json(bookings);
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch bookings" });
  }
});

// ৩. বুকিং ক্যানসেল করা (PATCH)
app.patch("/api/bookings/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const updateDoc = { $set: { status: "Cancelled" } };
    
    await db.collection("bookings").updateOne(query, updateDoc);
    res.status(200).json({ success: true, message: "Booking cancelled" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Cancellation failed" });
  }
});


// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

// ১. রেজিস্ট্রেশন (POST /api/auth/register)
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, photoURL, password } = req.body;

    const existingUser = await db.collection("users").findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Email already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = {
      name,
      email,
      photoURL: photoURL || "",
      password: hashedPassword,
      createdAt: new Date()
    };

    await db.collection("users").insertOne(newUser);
    res.status(201).json({ success: true, message: "User registered successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Registration failed", error: error.message });
  }
});

// ২. লগইন (POST /api/auth/login)
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await db.collection("users").findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    const token = jwt.sign(
      { email: user.email, name: user.name, id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000 
    });

    res.status(200).json({ 
      success: true, 
      message: "Login successful",
      user: { name: user.name, email: user.email, photoURL: user.photoURL }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Login failed", error: error.message });
  }
});

// ৩. গুগল লগইন (POST /api/auth/google)
app.post("/api/auth/google", async (req, res) => {
  try {
    const { token } = req.body;
    
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    const { email, name, picture } = payload;

    let user = await db.collection("users").findOne({ email });

    if (!user) {
      const newUser = { 
        name, 
        email, 
        photoURL: picture, 
        password: "google-auth-no-password", 
        createdAt: new Date() 
      };
      const result = await db.collection("users").insertOne(newUser);
      user = { ...newUser, _id: result.insertedId };
    }

    const jwtToken = jwt.sign(
      { email: user.email, name: user.name, id: user._id }, 
      process.env.JWT_SECRET, 
      { expiresIn: "7d" }
    );
    
    res.cookie("token", jwtToken, {
      httpOnly: true, 
      secure: process.env.NODE_ENV === "production", 
      sameSite: "none", 
      maxAge: 7 * 24 * 60 * 60 * 1000 
    });

    res.status(200).json({ 
      success: true, 
      user: { name: user.name, email: user.email, photoURL: user.photoURL } 
    });
  } catch (error) {
    console.error(error);
    res.status(401).json({ success: false, message: "Google Auth Failed" });
  }
});

// ৪. বর্তমান ইউজার চেক করা (GET /api/auth/me)
app.get("/api/auth/me", async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await db.collection("users").findOne({ email: decoded.email });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({ 
      success: true, 
      user: { name: user.name, email: user.email, photoURL: user.photoURL } 
    });
  } catch (error) {
    res.status(401).json({ success: false, message: "Invalid token" });
  }
});

// ৫. লগআউট (POST /api/auth/logout)
app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("token");
  res.status(200).json({ success: true, message: "Logged out successfully" });
});


// ==========================================
// SERVER START (একদম শেষে)
// ==========================================
connectDB().then(() => {
  app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));
});
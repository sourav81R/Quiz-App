// server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ✅ Serve frontend from /public
app.use(express.static(path.join(__dirname, "public")));

// MongoDB Connection
mongoose.connect("mongodb://127.0.0.1:27017/quizApp")
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1); // stop server if DB fails
  });

// Define Schema + Model
const questionSchema = new mongoose.Schema({
  quiz: { type: String, required: true },
  question: { type: String, required: true },
  options: { type: [String], required: true },
  answer: { type: String, required: true }
});

const Question = mongoose.model("Question", questionSchema);

// ================== API Routes ==================

// Get questions by quiz name
app.get("/api/questions/:quizName", async (req, res) => {
  try {
    const { quizName } = req.params;
    const questions = await Question.find({ quiz: quizName });

    if (!questions.length) {
      return res.status(404).json({ message: `No questions found for quiz: ${quizName}` });
    }

    res.json(questions);
  } catch (err) {
    console.error("❌ Error fetching questions:", err);
    res.status(500).json({ error: "Server error while fetching questions" });
  }
});

// ✅ Fallback: Serve frontend (index.html)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ================== Start Server ==================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running at: http://localhost:${PORT}`);
});

require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");
const { normalizeMongoUri, maskMongoUri, formatMongoError } = require("./mongoUri");
const User = require("./models/User");
const Question = require("./models/Question");
const Result = require("./models/Result");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

// Authentication middleware
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};

// In-memory questions database (fallback if MongoDB fails)
const loadFallbackQuestions = () => {
  const candidateFiles = [
    path.join(__dirname, "questions.json"),
    path.join(__dirname, "data", "questions.json"),
  ];

  for (const filePath of candidateFiles) {
    if (!fs.existsSync(filePath)) {
      continue;
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (err) {
      console.warn(`Warning: failed to parse fallback questions at ${filePath}`);
    }
  }

  console.warn("Warning: questions.json not found. Fallback data empty.");
  return [];
};

let questionsData = loadFallbackQuestions();
let mongoConnected = false;
let mongoConnectPromise = null;
const isDatabaseReady = () => mongoose.connection.readyState === 1;

const rawMongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
const mongoUri = normalizeMongoUri(rawMongoUri);

const ensureMongoConnection = async () => {
  if (!mongoUri) {
    mongoConnected = false;
    return false;
  }

  if (isDatabaseReady()) {
    mongoConnected = true;
    return true;
  }

  if (mongoConnectPromise) {
    return mongoConnectPromise;
  }

  console.log(`Connecting to MongoDB: ${maskMongoUri(mongoUri)}`);
  mongoConnectPromise = mongoose
    .connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4,
    })
    .then(() => {
      mongoConnected = true;
      console.log("MongoDB connected");
      return true;
    })
    .catch((err) => {
      mongoConnected = false;
      console.error("MongoDB Connection Error:", formatMongoError(err));
      return false;
    })
    .finally(() => {
      mongoConnectPromise = null;
    });

  return mongoConnectPromise;
};

if (!mongoUri) {
  console.warn("Warning: MONGODB_URI or MONGO_URI is missing. Running in fallback mode.");
} else {
  void ensureMongoConnection();
}

// ==================== AUTH ROUTES ====================

// Register Route
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;
    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();

    // Validation
    if (!name || !normalizedEmail || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: "Server configuration error" });
    }

    if (!(await ensureMongoConnection())) {
      return res.status(503).json({ error: "Database is not connected. Please try again." });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Create new user
    const newUser = new User({ name, email: normalizedEmail, password });
    await newUser.save();

    // Generate token
    const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      message: "Registration successful",
      token,
      user: { id: newUser._id, name: newUser.name, email: newUser.email },
    });
  } catch (err) {
    console.error("Registration error:", err);
    if (err && err.code === 11000) {
      return res.status(400).json({ error: "Email already registered" });
    }
    if (err && err.name === "ValidationError") {
      return res.status(400).json({ error: "Invalid registration data" });
    }
    if (err && /buffering timed out|server selection timed out|ECONN|ENOTFOUND/i.test(err.message)) {
      return res.status(503).json({ error: "Database is not connected. Please try again." });
    }
    res.status(500).json({ error: "Registration failed" });
  }
});

// Login Route
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: "Server configuration error" });
    }

    if (!(await ensureMongoConnection())) {
      return res.status(503).json({ error: "Database is not connected. Please try again." });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Generate token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      message: "Login successful",
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("Login error:", err);
    if (err && /buffering timed out|server selection timed out|ECONN|ENOTFOUND/i.test(err.message)) {
      return res.status(503).json({ error: "Database is not connected. Please try again." });
    }
    res.status(500).json({ error: "Login failed" });
  }
});

// ==================== QUIZ ROUTES ====================
app.get("/api/questions/:quizName", async (req, res) => {
  try {
    const requestedLevel = parseInt(req.query.level, 10) || 1;

    // Try database first; fallback to in-memory if not available
    if (await ensureMongoConnection()) {
      const questions = await Question.find({ quiz: req.params.quizName, level: requestedLevel });
      if (questions && questions.length > 0) {
        return res.json(questions);
      }
    }

    // Otherwise, use in-memory data
    const questions = questionsData.filter(
      (q) => q.quiz === req.params.quizName && (q.level || 1) === requestedLevel
    );
    res.json(questions);
  } catch (err) {
    console.error("Error fetching questions:", err);
    // Fallback to in-memory data on any error
    const questions = questionsData.filter(
      (q) => q.quiz === req.params.quizName && (q.level || 1) === (parseInt(req.query.level, 10) || 1)
    );
    res.json(questions);
  }
});

app.post("/api/questions", authMiddleware, async (req, res) => {
  try {
    const { quiz, question, options, answer, level } = req.body;

    if (!quiz || !question || !options || !answer) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (!(await ensureMongoConnection())) {
      return res.status(503).json({ error: "Database is not connected. Cannot add question." });
    }
    const newQuestion = new Question({ quiz, question, options, answer, level: level || 1 });
    await newQuestion.save();

    // Also update in-memory data so it's available immediately/in fallback mode
    questionsData.push({ quiz, question, options, answer, level: level || 1 });

    res.status(201).json({ message: "Question added successfully" });
  } catch (err) {
    console.error("Error adding question:", err);
    res.status(500).json({ error: "Failed to add question" });
  }
});

// ==================== LEADERBOARD ROUTES ====================
app.post("/api/results", authMiddleware, async (req, res) => {
  try {
    const { score, quiz, level } = req.body;

    if (!(await ensureMongoConnection())) {
      return res.status(503).json({ error: "Database not available. Cannot save result." });
    }
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const newResult = new Result({
      username: user.name,
      score,
      quiz,
      level: level || 1,
    });
    await newResult.save();
    res.status(201).json({ message: "Result saved successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to save result" });
  }
});

app.get("/api/user/progress", authMiddleware, async (req, res) => {
  try {
    if (!(await ensureMongoConnection())) {
      return res.json({});
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Find max level reached for each quiz where score was 8 or more
    const results = await Result.find({ username: user.name, score: { $gte: 8 } });

    const progress = {};
    results.forEach((r) => {
      const lvl = r.level || 1;
      if (!progress[r.quiz] || lvl > progress[r.quiz]) {
        progress[r.quiz] = lvl;
      }
    });

    res.json(progress);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch progress" });
  }
});

app.get("/api/leaderboard", async (req, res) => {
  try {
    if (!(await ensureMongoConnection())) {
      // Return an empty array if the database is not connected
      return res.json([]);
    }
    const { quiz, search } = req.query;
    const filter = {};
    if (quiz) {
      filter.quiz = quiz;
    }
    if (search) {
      filter.username = { $regex: search, $options: "i" };
    }
    const topScores = await Result.find(filter).sort({ score: -1, date: -1 }).limit(10);
    res.json(topScores);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// Fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import { fileURLToPath } from "url";
import { normalizeMongoUri, maskMongoUri, formatMongoError } from "./mongoUri.js";
import User from "./models/User.js";
import Question from "./models/Question.js";
import Result from "./models/Result.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
const normalizeQuizName = (value) => String(value || "").trim();

const normalizeLevel = (value, fallback = 1) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) || parsed < 1 ? fallback : parsed;
};

const normalizeQuestionRecord = (record = {}) => {
  const quiz = normalizeQuizName(record.quiz);
  const question = String(record.question || "").trim();
  const options = Array.isArray(record.options)
    ? record.options.map((opt) => String(opt || "").trim()).filter(Boolean)
    : [];
  const answer = String(record.answer || "").trim();

  if (!quiz || !question || options.length < 2 || !answer) {
    return null;
  }

  return {
    ...record,
    quiz,
    question,
    options,
    answer,
    level: normalizeLevel(record.level, 1),
  };
};

const normalizeQuestionPayload = (payload = {}) => {
  const quiz = normalizeQuizName(payload.quiz);
  const question = String(payload.question || "").trim();
  const answer = String(payload.answer || "").trim();
  const options = Array.isArray(payload.options)
    ? payload.options.map((opt) => String(opt || "").trim()).filter(Boolean)
    : [];
  const level = normalizeLevel(payload.level, 1);

  return {
    quiz,
    question,
    answer,
    options,
    level,
  };
};

const loadFallbackQuestions = () => {
  const candidateFiles = [
    path.join(__dirname, "public", "question.json"),
    path.join(__dirname, "questions.json"),
    path.join(__dirname, "data", "questions.json"),
  ];
  const mergedQuestions = [];
  const seen = new Set();

  for (const filePath of candidateFiles) {
    if (!fs.existsSync(filePath)) {
      continue;
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (Array.isArray(parsed)) {
        parsed.forEach((question) => {
          const normalized = normalizeQuestionRecord(question);
          if (!normalized) {
            return;
          }

          const dedupeKey = `${normalized.quiz.toLowerCase()}|${normalized.level}|${normalized.question.toLowerCase()}`;
          if (seen.has(dedupeKey)) {
            return;
          }

          seen.add(dedupeKey);
          mergedQuestions.push(normalized);
        });
      }
    } catch (err) {
      console.warn(`Warning: failed to parse fallback questions at ${filePath}`);
    }
  }

  if (mergedQuestions.length > 0) {
    return mergedQuestions;
  }

  console.warn("Warning: questions.json not found. Fallback data empty.");
  return [];
};

let questionsData = loadFallbackQuestions();
let mongoConnected = false;
let mongoConnectPromise = null;
let lastMongoConnectError = "";
let lastMongoFailureAt = 0;
const isDatabaseReady = () => mongoose.connection.readyState === 1;

const rawMongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
const primaryMongoUri = normalizeMongoUri(rawMongoUri);
const isProductionRuntime = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
const allowLocalMongoFallback =
  process.env.ALLOW_LOCAL_MONGO_FALLBACK != null
    ? process.env.ALLOW_LOCAL_MONGO_FALLBACK !== "false"
    : !isProductionRuntime;
const localFallbackMongoUri = normalizeMongoUri(
  process.env.LOCAL_MONGODB_URI || "mongodb://127.0.0.1:27017/quizApp"
);
let activeMongoUri = primaryMongoUri || (allowLocalMongoFallback ? localFallbackMongoUri : "");
let usingLocalMongoFallback = !primaryMongoUri && activeMongoUri === localFallbackMongoUri;
const mongoConnectOptions = {
  serverSelectionTimeoutMS: parseInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS, 10) || 10000,
  socketTimeoutMS: parseInt(process.env.MONGO_SOCKET_TIMEOUT_MS, 10) || 45000,
};
const mongoReconnectCooldownMs = parseInt(process.env.MONGO_RETRY_COOLDOWN_MS, 10) || 5000;
const configuredIpFamily = parseInt(process.env.MONGO_IP_FAMILY || "", 10);
if (configuredIpFamily === 4 || configuredIpFamily === 6) {
  mongoConnectOptions.family = configuredIpFamily;
}

const connectMongoWithUri = async (uri) => {
  if (!uri) {
    return false;
  }

  console.log(`Connecting to MongoDB: ${maskMongoUri(uri)}`);
  try {
    await mongoose.connect(uri, mongoConnectOptions);
    mongoConnected = true;
    lastMongoConnectError = "";
    lastMongoFailureAt = 0;
    console.log("MongoDB connected");
    return true;
  } catch (err) {
    mongoConnected = false;
    lastMongoConnectError = err?.message || String(err);
    lastMongoFailureAt = Date.now();
    console.error("MongoDB Connection Error:", formatMongoError(err));
    return false;
  }
};

const getDatabaseUnavailableMessage = () => {
  if (/bad auth|authentication failed/i.test(lastMongoConnectError)) {
    return "Database authentication failed. Check MongoDB credentials in server environment variables.";
  }
  if (/ENOTFOUND|querySrv|ECONNREFUSED|timed out/i.test(lastMongoConnectError)) {
    return "Database is unreachable. Check MongoDB network access and URI configuration.";
  }
  return "Database is not connected. Please try again.";
};

const ensureMongoConnection = async () => {
  if (!activeMongoUri) {
    mongoConnected = false;
    return false;
  }

  if (isDatabaseReady()) {
    mongoConnected = true;
    return true;
  }

  if (lastMongoFailureAt && Date.now() - lastMongoFailureAt < mongoReconnectCooldownMs) {
    return false;
  }

  if (mongoConnectPromise) {
    return mongoConnectPromise;
  }

  mongoConnectPromise = (async () => {
    const connected = await connectMongoWithUri(activeMongoUri);
    if (connected) {
      return true;
    }

    if (
      !usingLocalMongoFallback &&
      allowLocalMongoFallback &&
      localFallbackMongoUri &&
      localFallbackMongoUri !== activeMongoUri
    ) {
      usingLocalMongoFallback = true;
      activeMongoUri = localFallbackMongoUri;
      console.warn("Primary MongoDB unavailable. Falling back to local MongoDB.");
      return connectMongoWithUri(activeMongoUri);
    }

    return false;
  })().finally(() => {
    mongoConnectPromise = null;
  });

  return mongoConnectPromise;
};

if (!primaryMongoUri) {
  if (allowLocalMongoFallback && localFallbackMongoUri) {
    console.warn("Warning: MONGODB_URI or MONGO_URI is missing. Trying local MongoDB fallback.");
  } else {
    console.warn("Warning: MongoDB URI missing and local fallback disabled. Running in question fallback mode.");
  }
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
      return res.status(503).json({ error: getDatabaseUnavailableMessage() });
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
      return res.status(503).json({ error: getDatabaseUnavailableMessage() });
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
app.get("/api/questions", authMiddleware, async (req, res) => {
  try {
    if (!(await ensureMongoConnection())) {
      return res.status(503).json({ error: "Database is not connected. Cannot fetch your questions." });
    }

    const userQuestions = await Question.find({ userId: req.userId }).sort({ _id: -1 });
    res.json(userQuestions);
  } catch (err) {
    console.error("Error fetching user questions:", err);
    res.status(500).json({ error: "Failed to fetch your questions" });
  }
});

app.get("/api/questions/:quizName", async (req, res) => {
  const requestedQuiz = normalizeQuizName(req.params.quizName);
  const requestedLevel = normalizeLevel(req.query.level, 1);

  if (!requestedQuiz) {
    return res.status(400).json({ error: "Quiz name is required" });
  }

  const normalizeForMatch = (value) => normalizeQuizName(value).toLowerCase();

  try {
    // Try database first; fallback to in-memory if not available
    if (await ensureMongoConnection()) {
      const questions = await Question.find({
        quiz: { $regex: `^${requestedQuiz.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
        level: requestedLevel,
      });
      if (questions && questions.length > 0) {
        return res.json(questions);
      }
    }

    // Otherwise, use in-memory data
    const questions = questionsData.filter(
      (q) => normalizeForMatch(q.quiz) === normalizeForMatch(requestedQuiz) && (q.level || 1) === requestedLevel
    );
    res.json(questions);
  } catch (err) {
    console.error("Error fetching questions:", err);
    // Fallback to in-memory data on any error
    const questions = questionsData.filter(
      (q) => normalizeForMatch(q.quiz) === normalizeForMatch(requestedQuiz) && (q.level || 1) === requestedLevel
    );
    res.json(questions);
  }
});

app.post("/api/questions", authMiddleware, async (req, res) => {
  try {
    const normalizedPayload = normalizeQuestionPayload(req.body);

    if (
      !normalizedPayload.quiz ||
      !normalizedPayload.question ||
      normalizedPayload.options.length < 2 ||
      !normalizedPayload.answer
    ) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (!(await ensureMongoConnection())) {
      return res.status(503).json({ error: "Database is not connected. Cannot add question." });
    }
    const newQuestion = new Question({
      userId: req.userId,
      quiz: normalizedPayload.quiz,
      question: normalizedPayload.question,
      options: normalizedPayload.options,
      answer: normalizedPayload.answer,
      level: normalizedPayload.level,
    });
    await newQuestion.save();

    // Also update in-memory data so it's available immediately/in fallback mode
    questionsData.push({
      _id: String(newQuestion._id),
      userId: req.userId,
      quiz: normalizedPayload.quiz,
      question: normalizedPayload.question,
      options: normalizedPayload.options,
      answer: normalizedPayload.answer,
      level: normalizedPayload.level,
    });

    res.status(201).json({ message: "Question added successfully", question: newQuestion });
  } catch (err) {
    console.error("Error adding question:", err);
    res.status(500).json({ error: "Failed to add question" });
  }
});

app.put("/api/questions/:questionId", authMiddleware, async (req, res) => {
  try {
    const normalizedPayload = normalizeQuestionPayload(req.body);
    if (
      !normalizedPayload.quiz ||
      !normalizedPayload.question ||
      normalizedPayload.options.length < 2 ||
      !normalizedPayload.answer
    ) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (!(await ensureMongoConnection())) {
      return res.status(503).json({ error: "Database is not connected. Cannot update question." });
    }

    const questionToUpdate = await Question.findById(req.params.questionId);
    if (!questionToUpdate) {
      return res.status(404).json({ error: "Question not found" });
    }

    if (String(questionToUpdate.userId || "") !== String(req.userId)) {
      return res.status(403).json({ error: "You can only edit your own questions" });
    }

    questionToUpdate.quiz = normalizedPayload.quiz;
    questionToUpdate.question = normalizedPayload.question;
    questionToUpdate.options = normalizedPayload.options;
    questionToUpdate.answer = normalizedPayload.answer;
    questionToUpdate.level = normalizedPayload.level;
    await questionToUpdate.save();

    questionsData = questionsData.map((q) => {
      if (String(q._id || "") !== String(questionToUpdate._id)) {
        return q;
      }
      return {
        ...q,
        quiz: normalizedPayload.quiz,
        question: normalizedPayload.question,
        options: normalizedPayload.options,
        answer: normalizedPayload.answer,
        level: normalizedPayload.level,
      };
    });

    res.json({ message: "Question updated successfully", question: questionToUpdate });
  } catch (err) {
    if (err && err.name === "CastError") {
      return res.status(400).json({ error: "Invalid question id" });
    }
    console.error("Error updating question:", err);
    res.status(500).json({ error: "Failed to update question" });
  }
});

app.delete("/api/questions/:questionId", authMiddleware, async (req, res) => {
  try {
    if (!(await ensureMongoConnection())) {
      return res.status(503).json({ error: "Database is not connected. Cannot delete question." });
    }

    const questionToDelete = await Question.findById(req.params.questionId);
    if (!questionToDelete) {
      return res.status(404).json({ error: "Question not found" });
    }

    if (String(questionToDelete.userId || "") !== String(req.userId)) {
      return res.status(403).json({ error: "You can only delete your own questions" });
    }

    await Question.deleteOne({ _id: questionToDelete._id });
    questionsData = questionsData.filter((q) => String(q._id || "") !== String(questionToDelete._id));

    res.json({ message: "Question deleted successfully" });
  } catch (err) {
    if (err && err.name === "CastError") {
      return res.status(400).json({ error: "Invalid question id" });
    }
    console.error("Error deleting question:", err);
    res.status(500).json({ error: "Failed to delete question" });
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
      userId: req.userId,
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

app.delete("/api/results/:resultId", authMiddleware, async (req, res) => {
  try {
    if (!(await ensureMongoConnection())) {
      return res.status(503).json({ error: "Database not available. Cannot delete result." });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const result = await Result.findById(req.params.resultId);
    if (!result) {
      return res.status(404).json({ error: "Result not found" });
    }

    const belongsToUser =
      (result.userId && String(result.userId) === String(req.userId)) ||
      (!result.userId && result.username === user.name);

    if (!belongsToUser) {
      return res.status(403).json({ error: "You can only delete your own result" });
    }

    await Result.deleteOne({ _id: result._id });
    res.json({ message: "Result deleted successfully" });
  } catch (err) {
    if (err && err.name === "CastError") {
      return res.status(400).json({ error: "Invalid result id" });
    }
    res.status(500).json({ error: "Failed to delete result" });
  }
});

app.delete("/api/results", authMiddleware, async (req, res) => {
  try {
    if (!(await ensureMongoConnection())) {
      return res.status(503).json({ error: "Database not available. Cannot clear history." });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const ownershipFilter = {
      $or: [
        { userId: req.userId },
        { userId: { $exists: false }, username: user.name },
        { userId: null, username: user.name },
      ],
    };

    if (req.query.quiz) {
      ownershipFilter.quiz = String(req.query.quiz).trim();
    }

    const result = await Result.deleteMany(ownershipFilter);
    res.json({
      message: "History cleared successfully",
      deletedCount: result.deletedCount || 0,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to clear history" });
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
    const results = await Result.find({
      score: { $gte: 8 },
      $or: [
        { userId: req.userId },
        { userId: { $exists: false }, username: user.name },
        { userId: null, username: user.name },
      ],
    });

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

// Start server with port fallback (avoids crashing on EADDRINUSE)
const basePort = parseInt(process.env.PORT, 10) || 5000;
const maxPortAttempts = 10;

const startServer = (port, attempt = 0) => {
  const server = app.listen(port);

  server.once("listening", () => {
    console.log(`Server running at http://localhost:${port}`);
  });

  server.once("error", (err) => {
    if (err.code === "EADDRINUSE" && attempt < maxPortAttempts) {
      const nextPort = port + 1;
      console.warn(`Port ${port} is in use. Retrying on port ${nextPort}...`);
      startServer(nextPort, attempt + 1);
      return;
    }

    console.error("Failed to start server:", err.message || err);
    process.exit(1);
  });
};

startServer(basePort);

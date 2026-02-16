import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import { cert, getApps, initializeApp as initializeFirebaseAdminApp } from "firebase-admin/app";
import { getAuth as getFirebaseAdminAuth } from "firebase-admin/auth";
import { fileURLToPath } from "url";
import { resolveMongoUri, normalizeMongoUri, maskMongoUri, formatMongoError } from "./mongoUri.js";
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

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const getNameFromEmail = (email) => {
  const normalized = normalizeEmail(email);
  if (!normalized.includes("@")) {
    return "User";
  }
  return normalized.split("@")[0] || "User";
};

const firebaseWebConfig = {
  apiKey: String(process.env.FIREBASE_WEB_API_KEY || "").trim(),
  authDomain: String(process.env.FIREBASE_WEB_AUTH_DOMAIN || "").trim(),
  projectId: String(process.env.FIREBASE_WEB_PROJECT_ID || "").trim(),
  storageBucket: String(process.env.FIREBASE_WEB_STORAGE_BUCKET || "").trim(),
  messagingSenderId: String(process.env.FIREBASE_WEB_MESSAGING_SENDER_ID || "").trim(),
  appId: String(process.env.FIREBASE_WEB_APP_ID || "").trim(),
  measurementId: String(process.env.FIREBASE_WEB_MEASUREMENT_ID || "").trim(),
};
const firebaseWebConfigComplete =
  Boolean(firebaseWebConfig.apiKey) &&
  Boolean(firebaseWebConfig.authDomain) &&
  Boolean(firebaseWebConfig.projectId) &&
  Boolean(firebaseWebConfig.storageBucket) &&
  Boolean(firebaseWebConfig.messagingSenderId) &&
  Boolean(firebaseWebConfig.appId);
if (!firebaseWebConfigComplete) {
  console.warn("Firebase Web config not fully set. /api/config/firebase will return 503.");
}

const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const firebaseClientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const firebasePrivateKey = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
  : "";
const firebaseConfigComplete = Boolean(firebaseProjectId && firebaseClientEmail && firebasePrivateKey);

let firebaseAdminAuth = null;
if (firebaseConfigComplete) {
  try {
    const firebaseApp =
      getApps()[0] ||
      initializeFirebaseAdminApp({
        credential: cert({
          projectId: firebaseProjectId,
          clientEmail: firebaseClientEmail,
          privateKey: firebasePrivateKey,
        }),
      });
    firebaseAdminAuth = getFirebaseAdminAuth(firebaseApp);
    console.log("Firebase Admin initialized");
  } catch (err) {
    console.warn("Firebase Admin initialization failed:", err?.message || err);
  }
} else {
  console.warn("Firebase Admin credentials not set. Using REST fallback for Firebase token verification.");
}

const createLocalJwt = (payload) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("Server configuration error");
  }
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
};

const getBearerToken = (authorizationHeader = "") => {
  const [scheme, token] = String(authorizationHeader).split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return "";
  }
  return token.trim();
};

const adminLoginEmail = normalizeEmail(process.env.ADMIN_EMAIL);
const adminLoginPassword = String(process.env.ADMIN_PASSWORD || process.env.PASSWORD || "").trim();
if (!adminLoginEmail || !adminLoginPassword) {
  console.warn("ADMIN_EMAIL/ADMIN_PASSWORD not fully set. Admin panel login will be unavailable.");
}

const setFirebaseRequestContext = (req, decoded) => {
  req.authType = "firebase";
  req.userId = String(decoded.uid || "");
  req.authUid = String(decoded.uid || "");
  req.authEmail = normalizeEmail(decoded.email);
  req.authName = String(decoded.name || "").trim();
};

const setLocalRequestContext = (req, decoded) => {
  if (decoded?.authType === "firebase" && decoded?.authUid) {
    req.authType = "firebase";
    req.userId = String(decoded.authUid);
    req.authUid = String(decoded.authUid);
    req.authEmail = normalizeEmail(decoded.authEmail);
    req.authName = String(decoded.name || "").trim();
    return;
  }
  req.authType = "local";
  req.userId = decoded?.userId;
  req.authUid = null;
  req.authEmail = "";
  req.authName = "";
};

const getQuestionOwnershipFilter = (req) => {
  if (req.authType === "firebase" && req.authUid) {
    const firebaseFilter = [{ authUid: req.authUid }];
    if (req.authEmail) {
      firebaseFilter.push({ authEmail: req.authEmail });
    }
    return { $or: firebaseFilter };
  }
  return { userId: req.userId };
};

const getQuestionOwnershipMatch = (question, req) => {
  if (req.authType === "firebase" && req.authUid) {
    return (
      String(question.authUid || "") === String(req.authUid) ||
      (req.authEmail && String(question.authEmail || "") === String(req.authEmail))
    );
  }
  return String(question.userId || "") === String(req.userId);
};

const getResultOwnershipFilter = (req, fallbackUsername = "") => {
  if (req.authType === "firebase" && req.authUid) {
    const firebaseConditions = [{ authUid: req.authUid }];
    if (req.authEmail) {
      firebaseConditions.push({ authEmail: req.authEmail });
    }
    if (fallbackUsername) {
      firebaseConditions.push({
        userId: { $exists: false },
        authUid: { $exists: false },
        authEmail: { $exists: false },
        username: fallbackUsername,
      });
      firebaseConditions.push({
        userId: null,
        authUid: null,
        authEmail: null,
        username: fallbackUsername,
      });
    }
    return { $or: firebaseConditions };
  }
  return {
    $or: [
      { userId: req.userId },
      { userId: { $exists: false }, username: fallbackUsername },
      { userId: null, username: fallbackUsername },
    ],
  };
};

const verifyFirebaseTokenViaRest = async (idToken) => {
  const webApiKey = String(firebaseWebConfig.apiKey || "").trim();
  if (!webApiKey) {
    const err = new Error("FIREBASE_WEB_API_KEY is missing");
    err.code = "identitytoolkit/missing-api-key";
    throw err;
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(webApiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    }
  );

  let data = {};
  try {
    data = await response.json();
  } catch (err) {
    data = {};
  }

  if (!response.ok) {
    const apiMessage = String(data?.error?.message || "").trim() || `HTTP_${response.status}`;
    const err = new Error(apiMessage);
    err.code = `identitytoolkit/${apiMessage}`;
    throw err;
  }

  const user = Array.isArray(data?.users) ? data.users[0] : null;
  const uid = String(user?.localId || "").trim();
  if (!uid) {
    const err = new Error("INVALID_ID_TOKEN");
    err.code = "identitytoolkit/INVALID_ID_TOKEN";
    throw err;
  }

  return {
    uid,
    email: normalizeEmail(user?.email),
    name: String(user?.displayName || "").trim(),
  };
};

const verifyFirebaseIdentity = async (idToken) => {
  if (firebaseAdminAuth) {
    const decoded = await firebaseAdminAuth.verifyIdToken(idToken);
    return {
      uid: String(decoded.uid || "").trim(),
      email: normalizeEmail(decoded.email),
      name: String(decoded.name || "").trim(),
    };
  }
  return verifyFirebaseTokenViaRest(idToken);
};

app.get("/api/config/firebase", (req, res) => {
  if (!firebaseWebConfigComplete) {
    return res.status(503).json({
      error:
        "Firebase web config missing. Set FIREBASE_WEB_API_KEY, FIREBASE_WEB_AUTH_DOMAIN, FIREBASE_WEB_PROJECT_ID, FIREBASE_WEB_STORAGE_BUCKET, FIREBASE_WEB_MESSAGING_SENDER_ID and FIREBASE_WEB_APP_ID.",
    });
  }

  return res.json(firebaseWebConfig);
});

const authMiddleware = async (req, res, next) => {
  const token = getBearerToken(req.headers.authorization);

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    setLocalRequestContext(req, decoded);
    next();
  } catch (err) {
    try {
      const firebaseDecoded = await verifyFirebaseIdentity(token);
      setFirebaseRequestContext(req, firebaseDecoded);
      next();
    } catch (firebaseError) {
      return res.status(401).json({ error: "Invalid token" });
    }
  }
};

const adminAuthMiddleware = (req, res, next) => {
  const token = getBearerToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }
    req.adminEmail = normalizeEmail(decoded.adminEmail);
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

const getRecordTimestamp = (record) => {
  if (!record) {
    return null;
  }
  if (record.date) {
    const parsed = new Date(record.date);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (record._id && typeof record._id.getTimestamp === "function") {
    return record._id.getTimestamp();
  }
  return null;
};

const getRecordActorIdentity = (record = {}) => {
  if (record.userId) {
    const userId = String(record.userId);
    return {
      source: "local",
      key: `local:${userId}`,
      userId,
      authUid: "",
      authEmail: "",
    };
  }

  const authUid = String(record.authUid || "").trim();
  const authEmail = normalizeEmail(record.authEmail);
  if (authUid) {
    return {
      source: "firebase",
      key: `firebase:${authUid}`,
      userId: "",
      authUid,
      authEmail,
    };
  }

  if (authEmail) {
    return {
      source: "firebase",
      key: `firebase-email:${authEmail}`,
      userId: "",
      authUid: "",
      authEmail,
    };
  }

  return null;
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

const primaryMongoUri = resolveMongoUri(process.env);
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

    const token = createLocalJwt({ userId: String(newUser._id), authType: "local" });

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

    if (adminLoginEmail && adminLoginPassword && normalizedEmail === adminLoginEmail && password === adminLoginPassword) {
      const adminToken = createLocalJwt({
        isAdmin: true,
        role: "admin",
        adminEmail: adminLoginEmail,
      });

      return res.json({
        message: "Admin login successful",
        token: adminToken,
        user: {
          id: "admin",
          name: "Administrator",
          email: adminLoginEmail,
          isAdmin: true,
        },
      });
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

    const token = createLocalJwt({ userId: String(user._id), authType: "local" });

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

app.post("/api/auth/firebase", async (req, res) => {
  try {
    const { idToken, name } = req.body || {};
    const trimmedToken = String(idToken || "").trim();
    const providedName = String(name || "").trim();

    if (!trimmedToken) {
      return res.status(400).json({ error: "Firebase idToken is required" });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: "Server configuration error" });
    }

    const decoded = await verifyFirebaseIdentity(trimmedToken);
    const normalizedEmail = normalizeEmail(decoded.email);
    const resolvedName =
      String(decoded.name || "").trim() || providedName || getNameFromEmail(normalizedEmail);
    const uid = String(decoded.uid || "").trim();

    if (!uid) {
      return res.status(400).json({ error: "Invalid Firebase token" });
    }

    const token = createLocalJwt({
      authType: "firebase",
      authUid: uid,
      authEmail: normalizedEmail,
      name: resolvedName,
    });

    res.json({
      message: "Firebase login successful",
      token,
      user: {
        id: uid,
        name: resolvedName,
        email: normalizedEmail,
        provider: "firebase",
      },
    });
  } catch (err) {
    console.error("Firebase auth error:", err);
    const errorCode = String(err?.code || "");
    if (errorCode === "auth/id-token-expired") {
      return res.status(401).json({ error: "Firebase token expired. Please login again." });
    }
    if (
      errorCode === "auth/argument-error" ||
      errorCode === "auth/invalid-id-token" ||
      errorCode.includes("INVALID_ID_TOKEN") ||
      errorCode.includes("TOKEN_EXPIRED")
    ) {
      return res.status(401).json({ error: "Invalid Firebase token" });
    }
    if (errorCode.includes("missing-api-key")) {
      return res.status(503).json({ error: "Firebase web API key missing on server configuration." });
    }
    return res.status(500).json({ error: "Firebase authentication failed" });
  }
});

app.post("/api/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const normalizedEmail = normalizeEmail(email);
    const rawPassword = String(password || "");

    if (!normalizedEmail || !rawPassword) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: "Server configuration error" });
    }

    if (!adminLoginEmail || !adminLoginPassword) {
      return res.status(503).json({ error: "Admin credentials are not configured on server" });
    }

    if (normalizedEmail !== adminLoginEmail || rawPassword !== adminLoginPassword) {
      return res.status(401).json({ error: "Invalid admin credentials" });
    }

    const token = createLocalJwt({
      isAdmin: true,
      role: "admin",
      adminEmail: adminLoginEmail,
    });

    return res.json({
      message: "Admin login successful",
      token,
      user: {
        id: "admin",
        name: "Administrator",
        email: adminLoginEmail,
        isAdmin: true,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: "Admin login failed" });
  }
});

app.get("/api/admin/overview", adminAuthMiddleware, async (req, res) => {
  try {
    if (!(await ensureMongoConnection())) {
      return res.status(503).json({ error: "Database not available. Cannot load admin overview." });
    }

    const [localUsers, allQuestions, allResults, recentQuestionsRaw, recentResultsRaw] = await Promise.all([
      User.find({}).select("name email createdAt").sort({ createdAt: -1 }).lean(),
      Question.find({}).select("userId authUid authEmail").lean(),
      Result.find({}).select("userId authUid authEmail username date").lean(),
      Question.find({}).sort({ _id: -1 }).limit(30).lean(),
      Result.find({}).sort({ date: -1, _id: -1 }).limit(30).lean(),
    ]);

    const localUserMap = new Map(localUsers.map((u) => [String(u._id), u]));
    const actors = new Map();

    const ensureActor = (identity) => {
      if (!identity) {
        return null;
      }
      const key = identity.key;
      if (!actors.has(key)) {
        actors.set(key, {
          key,
          source: identity.source,
          userId: identity.userId || "",
          authUid: identity.authUid || "",
          authEmail: identity.authEmail || "",
          name: "",
          email: "",
          questionCount: 0,
          resultCount: 0,
          lastActiveAt: null,
          createdAt: null,
        });
      }
      return actors.get(key);
    };

    localUsers.forEach((user) => {
      const identity = {
        source: "local",
        key: `local:${String(user._id)}`,
        userId: String(user._id),
        authUid: "",
        authEmail: "",
      };
      const actor = ensureActor(identity);
      if (!actor) return;
      actor.name = String(user.name || "").trim() || "Local User";
      actor.email = normalizeEmail(user.email);
      actor.createdAt = user.createdAt ? new Date(user.createdAt) : null;
    });

    allQuestions.forEach((question) => {
      const identity = getRecordActorIdentity(question);
      const actor = ensureActor(identity);
      if (!actor) return;

      actor.questionCount += 1;
      if (!actor.email && identity.authEmail) {
        actor.email = identity.authEmail;
      }
      if (!actor.name && identity.authEmail) {
        actor.name = getNameFromEmail(identity.authEmail);
      }

      const ts = getRecordTimestamp(question);
      if (ts && (!actor.lastActiveAt || ts > actor.lastActiveAt)) {
        actor.lastActiveAt = ts;
      }
    });

    allResults.forEach((result) => {
      const identity = getRecordActorIdentity(result);
      const actor = ensureActor(identity);
      if (!actor) return;

      actor.resultCount += 1;
      if (!actor.email && identity.authEmail) {
        actor.email = identity.authEmail;
      }

      const resultUsername = String(result.username || "").trim();
      if (resultUsername && (!actor.name || actor.name === "Local User")) {
        actor.name = resultUsername;
      }
      if (!actor.name && identity.authEmail) {
        actor.name = getNameFromEmail(identity.authEmail);
      }
      if (!actor.name && identity.authUid) {
        actor.name = `firebase_${identity.authUid.slice(0, 6)}`;
      }

      const ts = getRecordTimestamp(result);
      if (ts && (!actor.lastActiveAt || ts > actor.lastActiveAt)) {
        actor.lastActiveAt = ts;
      }
    });

    const users = Array.from(actors.values())
      .map((actor) => ({
        source: actor.source,
        userId: actor.userId,
        authUid: actor.authUid,
        authEmail: actor.authEmail,
        name: actor.name || (actor.email ? getNameFromEmail(actor.email) : "Unknown User"),
        email: actor.email || "",
        questionCount: actor.questionCount,
        resultCount: actor.resultCount,
        totalActivity: actor.questionCount + actor.resultCount,
        lastActiveAt: actor.lastActiveAt ? actor.lastActiveAt.toISOString() : "",
        createdAt: actor.createdAt ? actor.createdAt.toISOString() : "",
      }))
      .sort((a, b) => {
        if (b.totalActivity !== a.totalActivity) return b.totalActivity - a.totalActivity;
        return new Date(b.lastActiveAt || 0).getTime() - new Date(a.lastActiveAt || 0).getTime();
      });

    const recentQuestions = recentQuestionsRaw.map((question) => {
      const identity = getRecordActorIdentity(question);
      let ownerName = "Unknown User";
      if (identity?.source === "local" && identity.userId) {
        ownerName = String(localUserMap.get(identity.userId)?.name || "Local User");
      } else if (identity?.authEmail) {
        ownerName = getNameFromEmail(identity.authEmail);
      } else if (identity?.authUid) {
        ownerName = `firebase_${identity.authUid.slice(0, 6)}`;
      }

      return {
        _id: String(question._id),
        quiz: String(question.quiz || ""),
        question: String(question.question || ""),
        level: question.level || 1,
        userId: identity?.userId || "",
        authUid: identity?.authUid || "",
        authEmail: identity?.authEmail || "",
        ownerName,
        createdAt: getRecordTimestamp(question)?.toISOString() || "",
      };
    });

    const recentResults = recentResultsRaw.map((result) => {
      const identity = getRecordActorIdentity(result);
      let ownerName = String(result.username || "").trim();
      if (!ownerName && identity?.source === "local" && identity.userId) {
        ownerName = String(localUserMap.get(identity.userId)?.name || "Local User");
      }
      if (!ownerName && identity?.authEmail) {
        ownerName = getNameFromEmail(identity.authEmail);
      }
      if (!ownerName && identity?.authUid) {
        ownerName = `firebase_${identity.authUid.slice(0, 6)}`;
      }

      return {
        _id: String(result._id),
        score: result.score || 0,
        quiz: String(result.quiz || ""),
        level: result.level || 1,
        date: result.date ? new Date(result.date).toISOString() : "",
        username: ownerName || "Unknown User",
        userId: identity?.userId || "",
        authUid: identity?.authUid || "",
        authEmail: identity?.authEmail || "",
      };
    });

    return res.json({
      stats: {
        localUsersCount: localUsers.length,
        trackedUsersCount: users.length,
        totalQuestionsCount: allQuestions.length,
        totalResultsCount: allResults.length,
      },
      users,
      recentQuestions,
      recentResults,
    });
  } catch (err) {
    console.error("Admin overview error:", err);
    return res.status(500).json({ error: "Failed to load admin overview" });
  }
});

app.delete("/api/admin/clear-all", adminAuthMiddleware, async (req, res) => {
  try {
    if (!(await ensureMongoConnection())) {
      return res.status(503).json({ error: "Database not available. Cannot clear all data." });
    }

    const [userDeleteResult, questionDeleteResult, resultDeleteResult] = await Promise.all([
      User.deleteMany({}),
      Question.deleteMany({}),
      Result.deleteMany({}),
    ]);

    // Keep static fallback questions (from json) and drop user-created in-memory records.
    questionsData = questionsData.filter((q) => {
      const hasDbIdentifier = Boolean(q && (q._id || q.userId || q.authUid || q.authEmail));
      return !hasDbIdentifier;
    });

    return res.json({
      message: "All user data cleared successfully",
      deleted: {
        users: userDeleteResult.deletedCount || 0,
        questions: questionDeleteResult.deletedCount || 0,
        results: resultDeleteResult.deletedCount || 0,
      },
    });
  } catch (err) {
    console.error("Admin clear-all error:", err);
    return res.status(500).json({ error: "Failed to clear all data" });
  }
});

app.post("/api/admin/users/remove", adminAuthMiddleware, async (req, res) => {
  try {
    if (!(await ensureMongoConnection())) {
      return res.status(503).json({ error: "Database not available. Cannot remove user data." });
    }

    const source = String(req.body?.source || "").trim().toLowerCase();
    const userId = String(req.body?.userId || "").trim();
    const authUid = String(req.body?.authUid || "").trim();
    const authEmail = normalizeEmail(req.body?.authEmail);

    if (!source || (source !== "local" && source !== "firebase")) {
      return res.status(400).json({ error: "Invalid source. Use local or firebase." });
    }

    if (source === "local") {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ error: "Invalid local user id" });
      }

      const localObjectId = new mongoose.Types.ObjectId(userId);
      const localUser = await User.findById(localObjectId).lean();

      const questionDeleteResult = await Question.deleteMany({ userId: localObjectId });
      const resultFilter = { $or: [{ userId: localObjectId }] };
      if (localUser?.name) {
        resultFilter.$or.push({
          userId: { $exists: false },
          authUid: { $exists: false },
          authEmail: { $exists: false },
          username: localUser.name,
        });
        resultFilter.$or.push({
          userId: null,
          authUid: null,
          authEmail: null,
          username: localUser.name,
        });
      }

      const resultDeleteResult = await Result.deleteMany(resultFilter);
      const userDeleteResult = await User.deleteOne({ _id: localObjectId });

      return res.json({
        message: "Local user data removed",
        deleted: {
          users: userDeleteResult.deletedCount || 0,
          questions: questionDeleteResult.deletedCount || 0,
          results: resultDeleteResult.deletedCount || 0,
        },
      });
    }

    const ownershipFilters = [];
    if (authUid) {
      ownershipFilters.push({ authUid });
    }
    if (authEmail) {
      ownershipFilters.push({ authEmail });
    }

    if (!ownershipFilters.length) {
      return res.status(400).json({ error: "authUid or authEmail is required for firebase user removal" });
    }

    const [questionDeleteResult, resultDeleteResult] = await Promise.all([
      Question.deleteMany({ $or: ownershipFilters }),
      Result.deleteMany({ $or: ownershipFilters }),
    ]);

    return res.json({
      message: "Firebase user data removed",
      deleted: {
        users: 0,
        questions: questionDeleteResult.deletedCount || 0,
        results: resultDeleteResult.deletedCount || 0,
      },
    });
  } catch (err) {
    console.error("Admin remove user error:", err);
    return res.status(500).json({ error: "Failed to remove user data" });
  }
});

app.delete("/api/admin/questions/:questionId", adminAuthMiddleware, async (req, res) => {
  try {
    if (!(await ensureMongoConnection())) {
      return res.status(503).json({ error: "Database not available. Cannot delete question." });
    }

    const deleteResult = await Question.deleteOne({ _id: req.params.questionId });
    if (!deleteResult.deletedCount) {
      return res.status(404).json({ error: "Question not found" });
    }

    questionsData = questionsData.filter((q) => String(q._id || "") !== String(req.params.questionId));
    return res.json({ message: "Question deleted by admin" });
  } catch (err) {
    if (err?.name === "CastError") {
      return res.status(400).json({ error: "Invalid question id" });
    }
    return res.status(500).json({ error: "Failed to delete question" });
  }
});

app.delete("/api/admin/results/:resultId", adminAuthMiddleware, async (req, res) => {
  try {
    if (!(await ensureMongoConnection())) {
      return res.status(503).json({ error: "Database not available. Cannot delete result." });
    }

    const deleteResult = await Result.deleteOne({ _id: req.params.resultId });
    if (!deleteResult.deletedCount) {
      return res.status(404).json({ error: "Result not found" });
    }

    return res.json({ message: "Result deleted by admin" });
  } catch (err) {
    if (err?.name === "CastError") {
      return res.status(400).json({ error: "Invalid result id" });
    }
    return res.status(500).json({ error: "Failed to delete result" });
  }
});

// ==================== QUIZ ROUTES ====================
app.get("/api/questions", authMiddleware, async (req, res) => {
  try {
    if (!(await ensureMongoConnection())) {
      return res.status(503).json({ error: "Database is not connected. Cannot fetch your questions." });
    }

    const userQuestions = await Question.find(getQuestionOwnershipFilter(req)).sort({ _id: -1 });
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

    const questionOwnerFields =
      req.authType === "firebase"
        ? {
            authUid: req.authUid,
            authEmail: req.authEmail || undefined,
          }
        : {
            userId: req.userId,
          };

    const newQuestion = new Question({
      ...questionOwnerFields,
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
      userId: req.authType === "local" ? req.userId : undefined,
      authUid: req.authType === "firebase" ? req.authUid : undefined,
      authEmail: req.authType === "firebase" ? req.authEmail : undefined,
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

    if (!getQuestionOwnershipMatch(questionToUpdate, req)) {
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

    if (!getQuestionOwnershipMatch(questionToDelete, req)) {
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
    const { score, quiz, level, username } = req.body;

    if (!(await ensureMongoConnection())) {
      return res.status(503).json({ error: "Database not available. Cannot save result." });
    }

    let resolvedUsername = "";
    if (req.authType === "firebase" && req.authUid) {
      resolvedUsername =
        String(username || "").trim() || req.authName || getNameFromEmail(req.authEmail);
    } else {
      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      resolvedUsername = user.name;
    }

    const resultOwnerFields =
      req.authType === "firebase" && req.authUid
        ? {
            authUid: req.authUid,
            authEmail: req.authEmail || undefined,
          }
        : {
            userId: req.userId,
          };

    const newResult = new Result({
      ...resultOwnerFields,
      username: resolvedUsername,
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

    let fallbackUsername = "";
    if (req.authType === "firebase" && req.authUid) {
      fallbackUsername = req.authName || getNameFromEmail(req.authEmail);
    } else {
      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      fallbackUsername = user.name;
    }

    const result = await Result.findById(req.params.resultId);
    if (!result) {
      return res.status(404).json({ error: "Result not found" });
    }

    let belongsToUser = false;
    if (req.authType === "firebase" && req.authUid) {
      belongsToUser =
        (result.authUid && String(result.authUid) === String(req.authUid)) ||
        (req.authEmail && result.authEmail && String(result.authEmail) === String(req.authEmail)) ||
        (!result.userId && !result.authUid && !result.authEmail && result.username === fallbackUsername);
    } else {
      belongsToUser =
        (result.userId && String(result.userId) === String(req.userId)) ||
        (!result.userId && result.username === fallbackUsername);
    }

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

    let fallbackUsername = "";
    if (req.authType === "firebase" && req.authUid) {
      fallbackUsername = req.authName || getNameFromEmail(req.authEmail);
    } else {
      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      fallbackUsername = user.name;
    }

    const ownershipFilter = getResultOwnershipFilter(req, fallbackUsername);

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

    let fallbackUsername = "";
    if (req.authType === "firebase" && req.authUid) {
      fallbackUsername = req.authName || getNameFromEmail(req.authEmail);
    } else {
      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      fallbackUsername = user.name;
    }

    // Find max level reached for each quiz where score was 8 or more
    const results = await Result.find({
      score: { $gte: 8 },
      ...getResultOwnershipFilter(req, fallbackUsername),
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

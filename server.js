// server.js
require("dotenv").config(); // ✅ load env variables

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const jwt = require("jsonwebtoken");
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
const questionsData = [
  // 🌍 General Knowledge (10)
  {
    quiz: "General Knowledge",
    question: "Which planet is known as the 'Red Planet'?",
    options: ["Venus", "Mars", "Jupiter", "Saturn"],
    answer: "Mars",
    level: 1
  },
  {
    quiz: "General Knowledge",
    question: "What is the capital city of Japan?",
    options: ["Beijing", "Tokyo", "Seoul", "Bangkok"],
    answer: "Tokyo",
    level: 1
  },
  {
    quiz: "General Knowledge",
    question: "Who wrote the play 'Romeo and Juliet'?",
    options: ["William Shakespeare", "Jane Austen", "Charles Dickens", "Mark Twain"],
    answer: "William Shakespeare",
    level: 1
  },
  {
    quiz: "General Knowledge",
    question: "In which year did the Titanic sink?",
    options: ["1905", "1912", "1920", "1931"],
    answer: "1912",
    level: 1
  },
  {
    quiz: "General Knowledge",
    question: "What is the largest continent on Earth?",
    options: ["Africa", "Asia", "Europe", "North America"],
    answer: "Asia",
    level: 1
  },
  {
    quiz: "General Knowledge",
    question: "Which country is known as the Land of the Rising Sun?",
    options: ["China", "Japan", "Thailand", "South Korea"],
    answer: "Japan",
    level: 1
  },
  {
    quiz: "General Knowledge",
    question: "How many players are there in a cricket team?",
    options: ["9", "10", "11", "12"],
    answer: "11",
    level: 1
  },
  {
    quiz: "General Knowledge",
    question: "What is the national currency of the USA?",
    options: ["Dollar", "Euro", "Pound", "Yen"],
    answer: "Dollar",
    level: 1
  },
  {
    quiz: "General Knowledge",
    question: "Which is the tallest mountain in the world?",
    options: ["K2", "Mount Everest", "Kangchenjunga", "Lhotse"],
    answer: "Mount Everest",
    level: 1
  },
  {
    quiz: "General Knowledge",
    question: "What is the smallest country in the world?",
    options: ["Monaco", "Vatican City", "Malta", "San Marino"],
    answer: "Vatican City",
    level: 1
  },

  // ➕ Mathematics (10)
  {
    quiz: "Mathematics",
    question: "What is 15 × 12?",
    options: ["150", "160", "180", "200"],
    answer: "180",
    level: 1
  },
  {
    quiz: "Mathematics",
    question: "What is the square root of 144?",
    options: ["10", "11", "12", "13"],
    answer: "12",
    level: 1
  },
  {
    quiz: "Mathematics",
    question: "What is 25% of 400?",
    options: ["50", "75", "100", "150"],
    answer: "100",
    level: 1
  },
  {
    quiz: "Mathematics",
    question: "What is the area of a circle with radius 5?",
    options: ["75.5", "78.5", "80.5", "82.5"],
    answer: "78.5",
    level: 1
  },
  {
    quiz: "Mathematics",
    question: "If x + 5 = 12, what is x?",
    options: ["5", "6", "7", "8"],
    answer: "7",
    level: 1
  },
  {
    quiz: "Mathematics",
    question: "What is 2^8?",
    options: ["128", "256", "512", "1024"],
    answer: "256",
    level: 1
  },
  {
    quiz: "Mathematics",
    question: "What is the sum of angles in a triangle?",
    options: ["180°", "270°", "360°", "540°"],
    answer: "180°",
    level: 1
  },
  {
    quiz: "Mathematics",
    question: "What is 50% of 250?",
    options: ["100", "125", "150", "175"],
    answer: "125",
    level: 1
  },
  {
    quiz: "Mathematics",
    question: "What is the value of π (pi) approximately?",
    options: ["2.14", "3.14", "4.14", "5.14"],
    answer: "3.14",
    level: 1
  },
  {
    quiz: "Mathematics",
    question: "How many sides does a hexagon have?",
    options: ["4", "5", "6", "8"],
    answer: "6",
    level: 1
  },

  // 🏛️ Politics (10)
  {
    quiz: "Politics",
    question: "Who is the current President of the United States?",
    options: ["Joe Biden", "Donald Trump", "Barack Obama", "George W. Bush"],
    answer: "Joe Biden",
    level: 1
  },
  {
    quiz: "Politics",
    question: "Which country is the United Kingdom a part of?",
    options: ["Europe", "Asia", "North America", "Africa"],
    answer: "Europe",
    level: 1
  },
  {
    quiz: "Politics",
    question: "What is the capital of Germany?",
    options: ["Munich", "Hamburg", "Berlin", "Frankfurt"],
    answer: "Berlin",
    level: 1
  },
  {
    quiz: "Politics",
    question: "Who is the Prime Minister of India?",
    options: ["Rahul Gandhi", "Narendra Modi", "Manmohan Singh", "Jawaharlal Nehru"],
    answer: "Narendra Modi",
    level: 1
  },
  {
    quiz: "Politics",
    question: "In which year did India gain independence?",
    options: ["1945", "1947", "1950", "1955"],
    answer: "1947",
    level: 1
  },
  {
    quiz: "Politics",
    question: "What is the legislative body of the United States?",
    options: ["Senate", "Congress", "Parliament", "Supreme Court"],
    answer: "Congress",
    level: 1
  },
  {
    quiz: "Politics",
    question: "Which country has the most number of states?",
    options: ["India", "USA", "Russia", "China"],
    answer: "India",
    level: 1
  },
  {
    quiz: "Politics",
    question: "What is the currency of the European Union?",
    options: ["Pound", "Euro", "Franc", "Guilder"],
    answer: "Euro",
    level: 1
  },
  {
    quiz: "Politics",
    question: "Who was the first Prime Minister of India?",
    options: ["Mahatma Gandhi", "Jawaharlal Nehru", "Sardar Vallabhbhai Patel", "B.R. Ambedkar"],
    answer: "Jawaharlal Nehru",
    level: 1
  },
  {
    quiz: "Politics",
    question: "What is the capital of France?",
    options: ["Lyon", "Marseille", "Paris", "Nice"],
    answer: "Paris",
    level: 1
  },

  // 🌿 Nature (10)
  {
    quiz: "Nature",
    question: "What is the largest mammal in the world?",
    options: ["African Elephant", "Giraffe", "Blue Whale", "Hippopotamus"],
    answer: "Blue Whale",
    level: 1
  },
  {
    quiz: "Nature",
    question: "How many legs does a spider have?",
    options: ["6", "8", "10", "12"],
    answer: "8",
    level: 1
  },
  {
    quiz: "Nature",
    question: "What is the fastest land animal?",
    options: ["Lion", "Cheetah", "Antelope", "Greyhound"],
    answer: "Cheetah",
    level: 1
  },
  {
    quiz: "Nature",
    question: "Which gas do plants absorb for photosynthesis?",
    options: ["Oxygen", "Nitrogen", "Carbon Dioxide", "Hydrogen"],
    answer: "Carbon Dioxide",
    level: 1
  },
  {
    quiz: "Nature",
    question: "What is the largest ocean on Earth?",
    options: ["Atlantic Ocean", "Indian Ocean", "Arctic Ocean", "Pacific Ocean"],
    answer: "Pacific Ocean",
    level: 1
  },
  {
    quiz: "Nature",
    question: "How many bones does an adult human have?",
    options: ["186", "206", "226", "246"],
    answer: "206",
    level: 1
  },
  {
    quiz: "Nature",
    question: "What is the process by which plants make their own food?",
    options: ["Respiration", "Photosynthesis", "Transpiration", "Digestion"],
    answer: "Photosynthesis",
    level: 1
  },
  {
    quiz: "Nature",
    question: "Which animal is known for its ability to change colors?",
    options: ["Frog", "Chameleon", "Parrot", "Butterfly"],
    answer: "Chameleon",
    level: 1
  },
  {
    quiz: "Nature",
    question: "What percentage of the Earth is covered by water?",
    options: ["50%", "65%", "71%", "85%"],
    answer: "71%",
    level: 1
  },
  {
    quiz: "Nature",
    question: "What is the only mammal that can fly?",
    options: ["Flying Squirrel", "Flying Fish", "Bat", "Flying Lemur"],
    answer: "Bat",
    level: 1
  },

  // 🌍 General Knowledge Level 2 (Example)
  {
    quiz: "General Knowledge",
    question: "What is the capital of Australia?",
    options: ["Sydney", "Melbourne", "Canberra", "Perth"],
    answer: "Canberra",
    level: 2
  },
  {
    quiz: "General Knowledge",
    question: "Which element has the chemical symbol 'Au'?",
    options: ["Silver", "Gold", "Copper", "Iron"],
    answer: "Gold",
    level: 2
  },
  {
    quiz: "General Knowledge",
    question: "Which country has the most natural lakes?",
    options: ["USA", "Canada", "Russia", "Brazil"],
    answer: "Canada",
    level: 2
  },
  {
    quiz: "General Knowledge",
    question: "What is the currency of Japan?",
    options: ["Yuan", "Yen", "Won", "Ringgit"],
    answer: "Yen",
    level: 2
  },
  {
    quiz: "General Knowledge",
    question: "Who painted the Mona Lisa?",
    options: ["Vincent van Gogh", "Pablo Picasso", "Leonardo da Vinci", "Claude Monet"],
    answer: "Leonardo da Vinci",
    level: 2
  },
  {
    quiz: "General Knowledge",
    question: "What is the smallest planet in our solar system?",
    options: ["Mars", "Mercury", "Venus", "Pluto"],
    answer: "Mercury",
    level: 2
  },
  {
    quiz: "General Knowledge",
    question: "Which ocean is the deepest?",
    options: ["Atlantic", "Indian", "Arctic", "Pacific"],
    answer: "Pacific",
    level: 2
  },
  {
    quiz: "General Knowledge",
    question: "What is the longest river in the world?",
    options: ["Amazon", "Nile", "Yangtze", "Mississippi"],
    answer: "Nile",
    level: 2
  },
  {
    quiz: "General Knowledge",
    question: "Who discovered penicillin?",
    options: ["Marie Curie", "Alexander Fleming", "Isaac Newton", "Albert Einstein"],
    answer: "Alexander Fleming",
    level: 2
  },
  {
    quiz: "General Knowledge",
    question: "What is the capital of Canada?",
    options: ["Toronto", "Vancouver", "Ottawa", "Montreal"],
    answer: "Ottawa",
    level: 2
  },

  // ➕ Mathematics Level 2
  {
    quiz: "Mathematics",
    question: "What is the square root of 225?",
    options: ["13", "14", "15", "16"],
    answer: "15",
    level: 2
  },
  {
    quiz: "Mathematics",
    question: "Solve for x: 3x - 7 = 20",
    options: ["7", "8", "9", "10"],
    answer: "9",
    level: 2
  },
  {
    quiz: "Mathematics",
    question: "What is 7 cubed (7^3)?",
    options: ["49", "243", "343", "512"],
    answer: "343",
    level: 2
  },
  {
    quiz: "Mathematics",
    question: "What is the value of 5 factorial (5!)?",
    options: ["60", "100", "120", "150"],
    answer: "120",
    level: 2
  },
  {
    quiz: "Mathematics",
    question: "What is the area of a triangle with base 10 and height 5?",
    options: ["25", "50", "15", "100"],
    answer: "25",
    level: 2
  },
  {
    quiz: "Mathematics",
    question: "What is 15% of 200?",
    options: ["20", "25", "30", "35"],
    answer: "30",
    level: 2
  },
  {
    quiz: "Mathematics",
    question: "How many degrees are in a right angle?",
    options: ["45", "90", "180", "360"],
    answer: "90",
    level: 2
  },
  {
    quiz: "Mathematics",
    question: "Solve: 2 + 2 * 2",
    options: ["8", "6", "4", "10"],
    answer: "6",
    level: 2
  },
  {
    quiz: "Mathematics",
    question: "What is the next prime number after 7?",
    options: ["8", "9", "10", "11"],
    answer: "11",
    level: 2
  },
  {
    quiz: "Mathematics",
    question: "How many seconds are in an hour?",
    options: ["60", "360", "3600", "600"],
    answer: "3600",
    level: 2
  },

  // 🏛️ Politics Level 2
  {
    quiz: "Politics",
    question: "Who is the current Secretary-General of the United Nations?",
    options: ["Ban Ki-moon", "Kofi Annan", "António Guterres", "Donald Trump"],
    answer: "António Guterres",
    level: 2
  },
  {
    quiz: "Politics",
    question: "Which country has the longest written constitution in the world?",
    options: ["USA", "India", "UK", "France"],
    answer: "India",
    level: 2
  },
  {
    quiz: "Politics",
    question: "Who is the current President of France?",
    options: ["Nicolas Sarkozy", "François Hollande", "Emmanuel Macron", "Marine Le Pen"],
    answer: "Emmanuel Macron",
    level: 2
  },
  {
    quiz: "Politics",
    question: "What is the lower house of the US Congress?",
    options: ["Senate", "House of Representatives", "Parliament", "Duma"],
    answer: "House of Representatives",
    level: 2
  },
  {
    quiz: "Politics",
    question: "In which city is the European Parliament primarily located?",
    options: ["Brussels", "Berlin", "Strasbourg", "Paris"],
    answer: "Strasbourg",
    level: 2
  },
  {
    quiz: "Politics",
    question: "Who was the first female Prime Minister of the United Kingdom?",
    options: ["Theresa May", "Margaret Thatcher", "Angela Merkel", "Indira Gandhi"],
    answer: "Margaret Thatcher",
    level: 2
  },
  {
    quiz: "Politics",
    question: "What is the standard voting age in most democratic countries?",
    options: ["16", "18", "21", "25"],
    answer: "18",
    level: 2
  },
  {
    quiz: "Politics",
    question: "Which ideology advocates for common ownership of the means of production?",
    options: ["Capitalism", "Communism", "Liberalism", "Fascism"],
    answer: "Communism",
    level: 2
  },
  {
    quiz: "Politics",
    question: "Who is the current Chancellor of Germany?",
    options: ["Angela Merkel", "Olaf Scholz", "Gerhard Schröder", "Helmut Kohl"],
    answer: "Olaf Scholz",
    level: 2
  },
  {
    quiz: "Politics",
    question: "What is the term length for a US Senator?",
    options: ["2 years", "4 years", "6 years", "8 years"],
    answer: "6 years",
    level: 2
  },

  // 🌿 Nature Level 2
  {
    quiz: "Nature",
    question: "What is the hardest natural substance on Earth?",
    options: ["Gold", "Iron", "Diamond", "Quartz"],
    answer: "Diamond",
    level: 2
  },
  {
    quiz: "Nature",
    question: "Which planet has the most moons?",
    options: ["Mars", "Jupiter", "Saturn", "Neptune"],
    answer: "Saturn",
    level: 2
  },
  {
    quiz: "Nature",
    question: "What is the largest desert in the world?",
    options: ["Sahara", "Gobi", "Antarctic", "Arabian"],
    answer: "Antarctic",
    level: 2
  },
  {
    quiz: "Nature",
    question: "What is the main gas in Earth's atmosphere?",
    options: ["Oxygen", "Carbon Dioxide", "Nitrogen", "Argon"],
    answer: "Nitrogen",
    level: 2
  },
  {
    quiz: "Nature",
    question: "Which animal is known as the 'King of the Jungle'?",
    options: ["Tiger", "Elephant", "Lion", "Gorilla"],
    answer: "Lion",
    level: 2
  },
  {
    quiz: "Nature",
    question: "What is the process of water turning into vapor?",
    options: ["Condensation", "Evaporation", "Precipitation", "Sublimation"],
    answer: "Evaporation",
    level: 2
  },
  {
    quiz: "Nature",
    question: "How many hearts does an octopus have?",
    options: ["1", "2", "3", "4"],
    answer: "3",
    level: 2
  },
  {
    quiz: "Nature",
    question: "What is the tallest grass in the world?",
    options: ["Wheat", "Bamboo", "Sugarcane", "Kentucky Bluegrass"],
    answer: "Bamboo",
    level: 2
  },
  {
    quiz: "Nature",
    question: "Which bird cannot fly but is a great swimmer?",
    options: ["Ostrich", "Emu", "Penguin", "Kiwi"],
    answer: "Penguin",
    level: 2
  },
  {
    quiz: "Nature",
    question: "What is the largest reef system in the world?",
    options: ["Belize Barrier Reef", "Great Barrier Reef", "Red Sea Coral Reef", "Pulley Ridge"],
    answer: "Great Barrier Reef",
    level: 2
  }
];

let mongoConnected = false;

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  serverSelectionTimeoutMS: 5000
})
  .then(() => {
    mongoConnected = true;
    console.log("✅ MongoDB connected");
  })
  .catch(err => {
    mongoConnected = false;
    console.warn("⚠️ MongoDB not available, using in-memory data:", err.message);
  });

// ==================== AUTH ROUTES ====================

// Register Route
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Create new user
    const newUser = new User({ name, email, password });
    await newUser.save();

    // Generate token
    const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, {
      expiresIn: "7d"
    });

    res.json({ 
      message: "Registration successful", 
      token, 
      user: { id: newUser._id, name: newUser.name, email: newUser.email } 
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// Login Route
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Generate token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d"
    });

    res.json({ 
      message: "Login successful", 
      token, 
      user: { id: user._id, name: user.name, email: user.email } 
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// ==================== QUIZ ROUTES ====================
app.get("/api/questions/:quizName", async (req, res) => {
  try {
    const requestedLevel = parseInt(req.query.level) || 1;
    // If MongoDB is connected, fetch from database
    if (mongoConnected) {
      const questions = await Question.find({ quiz: req.params.quizName, level: requestedLevel });
      if (questions && questions.length > 0) {
        return res.json(questions);
      }
    }
    
    // Otherwise, use in-memory data
    const questions = questionsData.filter(q => q.quiz === req.params.quizName && (q.level || 1) === requestedLevel);
    res.json(questions);
  } catch (err) {
    console.error("Error fetching questions:", err);
    // Fallback to in-memory data on any error
    const questions = questionsData.filter(q => q.quiz === req.params.quizName && (q.level || 1) === (parseInt(req.query.level) || 1));
    res.json(questions);
  }
});

app.post("/api/questions", async (req, res) => {
  try {
    const { quiz, question, options, answer, level } = req.body;

    if (!quiz || !question || !options || !answer) {
      return res.status(400).json({ error: "All fields are required" });
    }
    
    if (mongoConnected) {
      const newQuestion = new Question({ quiz, question, options, answer, level: level || 1 });
      await newQuestion.save();
    }

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
    const user = await User.findById(req.userId);
    
    if (!user) return res.status(404).json({ error: "User not found" });

    const newResult = new Result({
      username: user.name,
      score: score,
      quiz: quiz,
      level: level || 1
    });
    await newResult.save();
    res.status(201).json({ message: "Result saved successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to save result" });
  }
});

app.get("/api/user/progress", authMiddleware, async (req, res) => {
  try {
    if (!mongoConnected) return res.json({});
    
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Find max level reached for each quiz where score was 8 or more
    const results = await Result.find({ username: user.name, score: { $gte: 8 } });
    
    const progress = {};
    results.forEach(r => {
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
    const { quiz, search } = req.query;
    const filter = {};
    if (quiz) filter.quiz = quiz;
    if (search) filter.username = { $regex: search, $options: "i" };
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
  console.log(`✅ Server running at http://localhost:${PORT}`);
});

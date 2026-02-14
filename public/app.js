// ===== app.js =====

// ================== AUTH STATE ==================
let authToken = localStorage.getItem("authToken");
let currentUser = localStorage.getItem("currentUser");

if (currentUser) {
  currentUser = JSON.parse(currentUser);
}

let currentQuiz = "";
let currentLevel = 1;
let questions = [];
let currentQuestionIndex = 0;
let score = 0;
let userAnswers = [];
let userProgress = {};

let timerInterval = null;
let timeLeft = 10;

// ================== MUTE STATE ==================
let isMuted = localStorage.getItem("quizMuted") === "true";

// ================== AUTH FUNCTIONS ==================
async function handleRegister() {
  const name = document.getElementById("register-name").value.trim();
  const email = document.getElementById("register-email").value.trim();
  const password = document.getElementById("register-password").value;
  const confirmPassword = document.getElementById("register-confirm-password").value;

  if (!name || !email || !password || !confirmPassword) {
    showAuthMessage("All fields are required", "error");
    return;
  }

  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, confirmPassword })
    });

    const data = await res.json();

    if (!res.ok) {
      showAuthMessage(data.error || "Registration failed", "error");
      return;
    }

    // Save token and user
    localStorage.setItem("authToken", data.token);
    localStorage.setItem("currentUser", JSON.stringify(data.user));
    authToken = data.token;
    currentUser = data.user;

    showAuthMessage("Registration successful! Welcome!", "success");
    setTimeout(() => {
      document.getElementById("login-screen").style.display = "none";
      renderStartScreen();
    }, 1500);
  } catch (err) {
    console.error("Registration error:", err);
    showAuthMessage("Registration failed. Please try again.", "error");
  }
}

async function handleLogin() {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  if (!email || !password) {
    showAuthMessage("Email and password are required", "error");
    return;
  }

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      showAuthMessage(data.error || "Login failed", "error");
      return;
    }

    // Save token and user
    localStorage.setItem("authToken", data.token);
    localStorage.setItem("currentUser", JSON.stringify(data.user));
    authToken = data.token;
    currentUser = data.user;

    showAuthMessage("Login successful! Welcome back!", "success");
    setTimeout(() => {
      document.getElementById("login-screen").style.display = "none";
      renderStartScreen();
    }, 1500);
  } catch (err) {
    console.error("Login error:", err);
    showAuthMessage("Login failed. Please try again.", "error");
  }
}

function handleLogout() {
  if (confirm("Are you sure you want to logout?")) {
    localStorage.removeItem("authToken");
    localStorage.removeItem("currentUser");
    authToken = null;
    currentUser = null;

    // Reset quiz state
    currentQuiz = "";
    questions = [];
    currentQuestionIndex = 0;
    score = 0;
    userAnswers = [];

    // Show login screen
    document.getElementById("login-screen").style.display = "block";
    document.getElementById("start-screen").style.display = "none";
    document.getElementById("quiz-container").style.display = "none";
    document.getElementById("result-screen").style.display = "none";

    // Clear forms
    document.getElementById("login-email").value = "";
    document.getElementById("login-password").value = "";
    document.getElementById("register-name").value = "";
    document.getElementById("register-email").value = "";
    document.getElementById("register-password").value = "";
    document.getElementById("register-confirm-password").value = "";

    showAuthMessage("You have been logged out", "success");
  }
}

function showLogin() {
  document.getElementById("login-form").style.display = "block";
  document.getElementById("register-form").style.display = "none";
}

function showRegister() {
  document.getElementById("login-form").style.display = "none";
  document.getElementById("register-form").style.display = "block";
}

function showAuthMessage(message, type) {
  const messageDiv = document.getElementById("auth-message");
  messageDiv.textContent = message;
  messageDiv.className = `auth-message ${type}`;
  messageDiv.style.display = "block";

  setTimeout(() => {
    messageDiv.style.display = "none";
  }, 3000);
}

// Check if user is logged in on page load
window.addEventListener("DOMContentLoaded", () => {
  if (authToken && currentUser) {
    document.getElementById("login-screen").style.display = "none";
    renderStartScreen();
  } else {
    document.getElementById("login-screen").style.display = "block";
    document.getElementById("start-screen").style.display = "none";
  }
  initMuteButton();
});

// ================== MUTE BUTTON ==================

function initMuteButton() {
  const muteBtn = document.getElementById("mute-btn");
  if (muteBtn) muteBtn.textContent = isMuted ? "🔇" : "🔊";

  const quizTimer = document.getElementById("quiz-timer");
  if (quizTimer) quizTimer.style.display = isMuted ? "none" : "flex";
}

function toggleMute() {
  isMuted = !isMuted;
  localStorage.setItem("quizMuted", isMuted);

  const muteBtn = document.getElementById("mute-btn");
  const quizTimer = document.getElementById("quiz-timer");

  if (muteBtn) muteBtn.textContent = isMuted ? "🔇" : "🔊";
  if (quizTimer) quizTimer.style.display = isMuted ? "none" : "flex";

  if (isMuted && window.speechSynthesis && window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }
}

// ================== SPEECH ==================
function speak(text, callback) {
  if (isMuted) {
    if (callback) callback();
    return;
  }
  if (window.speechSynthesis) window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 1;

  if (callback) utterance.onend = callback;
  window.speechSynthesis.speak(utterance);
}

// ================== LOAD QUIZ ==================
async function loadQuiz(quizName, level = 1) {
  currentQuiz = quizName;
  currentLevel = level;
  currentQuestionIndex = 0;
  score = 0;
  userAnswers = [];

  try {
    const res = await fetch(`/api/questions/${encodeURIComponent(quizName)}?level=${level}`);
    questions = await res.json();

    if (!questions || !questions.length) {
      alert("No questions found for " + quizName);
      return;
    }

    document.getElementById("start-screen").style.display = "none";
    document.getElementById("quiz-container").style.display = "block";
    document.getElementById("quiz-title").textContent = `${quizName} - Level ${level}`;

    initMuteButton();

    const timerSpan = document.getElementById("timer-text");
    if (timerSpan) timerSpan.textContent = formatTime(10);

    document.getElementById("progress-bar").style.width = "0%";
    document.getElementById("progress-text").textContent = "";

    speak(`${quizName} quiz started. Let's begin!`, () => showQuestion());
  } catch (error) {
    console.error("Error loading quiz:", error);
    alert("Failed to load quiz. Check backend connection!");
  }
}

// ================== SHOW QUESTION ==================
function showQuestion() {
  clearTimers();

  const questionObj = questions[currentQuestionIndex];
  if (!questionObj) return;

  const block = document.getElementById("question-block");
  const gradientClass = `gradient-${(currentQuestionIndex % 6) + 1}`;

  block.innerHTML = `
    <div class="question-card ${gradientClass}">
      <h3>Q${currentQuestionIndex + 1}: ${escapeHtml(questionObj.question)}</h3>
      <ul id="options-list">
        ${questionObj.options
          .map(
            (opt) => `
          <li>
            <label>
              <input type="radio" name="option" value="${escapeHtml(opt)}"
                onchange="checkAnswer('${escapeJs(opt)}','${escapeJs(questionObj.answer)}')"
                ${userAnswers[currentQuestionIndex] === opt ? "checked" : ""}/>
              ${escapeHtml(opt)}
            </label>
          </li>
        `
          )
          .join("")}
      </ul>
      <p id="answer-feedback"></p>
    </div>
  `;

  document.getElementById("prev-btn").style.display =
    currentQuestionIndex === 0 ? "none" : "inline-block";
  document.getElementById("next-btn").style.display =
    currentQuestionIndex === questions.length - 1 ? "none" : "inline-block";
  document.getElementById("finish-btn").style.display =
    currentQuestionIndex === questions.length - 1 ? "inline-block" : "none";

  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  document.getElementById("progress-bar").style.width = progress + "%";
  document.getElementById("progress-text").textContent = `Question ${
    currentQuestionIndex + 1
  } of ${questions.length}`;

  let textToSpeak = `Question ${currentQuestionIndex + 1}. ${
    questionObj.question
  }. Options are: `;
  questionObj.options.forEach((opt, i) => {
    textToSpeak += `Option ${i + 1}, ${opt}. `;
  });

  speak(textToSpeak, () => startAnswerTimer());
}

// ================== TIMER ==================
function startAnswerTimer() {
  if (timerInterval) clearInterval(timerInterval);

  timeLeft = 10;
  const timerSpan = document.getElementById("timer-text");
  const timerContainer = document.getElementById("quiz-timer");

  if (timerContainer) timerContainer.classList.remove("timer-warning");
  if (timerSpan) timerSpan.textContent = formatTime(timeLeft);

  timerInterval = setInterval(() => {
    timeLeft--;
    if (timerSpan) timerSpan.textContent = formatTime(timeLeft);

    if (timeLeft <= 3 && timerContainer) {
      timerContainer.classList.add("timer-warning");
      if (timeLeft > 0) playBeep();
    }

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      if (!userAnswers[currentQuestionIndex]) {
        speak("Time's up! Moving to the next question.", () => nextQuestion());
      }
    }
  }, 1000);
}

// ================== CHECK ANSWER ==================
function checkAnswer(selectedEscaped, correctEscaped) {
  clearTimers();

  const selected = selectedEscaped;
  const correct = correctEscaped;

  const options = document.querySelectorAll("input[name='option']");
  options.forEach((opt) => {
    opt.disabled = true;
    if (opt.value === correct) opt.parentElement.classList.add("correct");
    if (opt.checked && opt.value !== correct) opt.parentElement.classList.add("wrong");
  });

  userAnswers[currentQuestionIndex] = selected;

  const feedback = document.getElementById("answer-feedback");
  if (selected === correct) {
    score++;
    feedback.innerHTML = "✅ Correct!";
    playCorrectSound();
    speak("Correct answer!", () => nextQuestion());
  } else {
    feedback.innerHTML = "❌ Wrong!";
    playWrongSound();
    speak(`Wrong. The correct answer is ${correct}`, () => nextQuestion());
  }
}

// ================== NAVIGATION ==================
function nextQuestion() {
  clearTimers();
  if (currentQuestionIndex < questions.length - 1) {
    currentQuestionIndex++;
    showQuestion();
  } else {
    finishQuiz();
  }
}

function prevQuestion() {
  clearTimers();
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    showQuestion();
  }
}

// ================== FINISH QUIZ ==================
function finishQuiz() {
  clearTimers();
  document.getElementById("quiz-container").style.display = "none";
  document.getElementById("result-screen").style.display = "block";

  const scoreText = `You scored ${score} out of ${questions.length}.`;
  document.getElementById("score-text").textContent = scoreText;

  // Save result to database
  if (authToken) {
    fetch("/api/results", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify({ score: score, quiz: currentQuiz, level: currentLevel })
    }).catch(err => console.error("Error saving result:", err));
  }

  // Play level up sound if score is 80% or higher
  if (score / questions.length >= 0.8) {
    playLevelUpSound();
    speak(`Congratulations! Level ${currentLevel} complete! ` + scoreText);
  } else {
    speak(scoreText);
  }

  const detailedResults = document.getElementById("detailed-results");
  detailedResults.innerHTML = questions
    .map((q, i) => {
      const isCorrect = userAnswers[i] === q.answer;
      return `
      <div class="result-item ${isCorrect ? "correct" : "wrong"}">
        <p><strong>Q${i + 1}:</strong> ${q.question}</p>
        <p><strong>Your Answer:</strong> ${userAnswers[i] || "Not Attempted"} ${
        isCorrect ? "(Correct)" : "(Wrong)"
      }</p>
        <p><strong>Correct Answer:</strong> ${q.answer}</p>
      </div>
    `;
    })
    .join("");
}

// ================== HELPERS ==================
function clearTimers() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  const timerContainer = document.getElementById("quiz-timer");
  if (timerContainer) timerContainer.classList.remove("timer-warning");
}

function formatTime(seconds) {
  return `${seconds < 10 ? "00:0" + seconds : "00:" + seconds}`;
}

function playBeep() {
  if (isMuted) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(1200, ctx.currentTime);
    gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.05);
  } catch (e) {}
}

function playCorrectSound() {
  if (isMuted) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(800, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.3);
  } catch (e) {}
}

function playWrongSound() {
  if (isMuted) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(300, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.2);
    gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.4);
  } catch (e) {}
}

function playLevelUpSound() {
  if (isMuted) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.15);
      gainNode.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.15);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.15 + 0.4);
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.start(ctx.currentTime + i * 0.15);
      oscillator.stop(ctx.currentTime + i * 0.15 + 0.4);
    });
  } catch (e) {}
}

function escapeHtml(unsafe) {
  if (!unsafe && unsafe !== 0) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeJs(str) {
  if (!str && str !== 0) return "";
  return String(str).replace(/'/g, "\\'");
}

// ================== RESTART QUIZ ==================
function restartQuiz() {
  clearTimers();
  if (window.speechSynthesis && window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }

  document.getElementById("result-screen").style.display = "none";
  document.getElementById("quiz-container").style.display = "none";
  renderStartScreen();

  currentQuiz = "";
  currentLevel = 1;
  questions = [];
  currentQuestionIndex = 0;
  score = 0;
  userAnswers = [];
  timeLeft = 10;

  document.getElementById("progress-bar").style.width = "0%";
  document.getElementById("progress-text").textContent = "";
  document.getElementById("quiz-title").textContent = "";

  initMuteButton();
  speak("Quiz restarted. Please choose a new quiz.");
}

document.addEventListener("DOMContentLoaded", initMuteButton);

// ================== PROGRESS ==================
async function fetchProgress() {
  if (!authToken) return;
  try {
    const res = await fetch("/api/user/progress", {
      headers: { "Authorization": `Bearer ${authToken}` }
    });
    if (res.ok) {
      userProgress = await res.json();
    }
  } catch (err) {
    console.error("Error fetching progress:", err);
  }
}

// ================== RENDER START SCREEN ==================
async function renderStartScreen() {
  const startScreen = document.getElementById("start-screen");
  if (!startScreen) return;

  await fetchProgress();
  startScreen.style.display = "block";

  // Inject CSS for animated border if not present
  if (!document.getElementById("start-screen-style")) {
    const style = document.createElement("style");
    style.id = "start-screen-style";
    style.innerHTML = `
      .start-container {
        border: 5px solid;
        border-radius: 15px;
        padding: 20px;
        background: white;
        animation: border-color-change 5s infinite;
        max-width: 600px;
        margin: 20px auto;
        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
      }
      @keyframes border-color-change {
        0% { border-color: #ff0000; box-shadow: 0 0 10px #ff0000; }
        25% { border-color: #00ff00; box-shadow: 0 0 10px #00ff00; }
        50% { border-color: #0000ff; box-shadow: 0 0 10px #0000ff; }
        75% { border-color: #ffff00; box-shadow: 0 0 10px #ffff00; }
        100% { border-color: #ff0000; box-shadow: 0 0 10px #ff0000; }
      }
      .user-info {
        position: relative;
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 40px;
        background: #f8f9fa;
        padding: 15px 20px;
        border-radius: 12px;
        border-left: 5px solid #6c5ce7;
        box-shadow: 0 2px 8px rgba(0,0,0,0.05);
      }
      #user-welcome {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 700;
        color: #2d3436;
      }
      .logout-btn {
        background: linear-gradient(135deg, #ff6b6b, #ee5253);
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 25px;
        cursor: pointer;
        font-weight: 600;
        box-shadow: 0 4px 10px rgba(238, 82, 83, 0.3);
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .logout-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 15px rgba(238, 82, 83, 0.4);
      }
      .start-container h1 {
        text-align: center;
        margin-bottom: 30px;
      }
      .letter {
        display: inline-block;
        animation: wave 1.5s infinite ease-in-out;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
      }
      @keyframes wave {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }
      #quiz-buttons { 
        display: grid; 
        grid-template-columns: repeat(2, 1fr); 
        gap: 20px; 
        padding: 0 10px;
      }
      #quiz-buttons button { 
        width: 100%; 
        padding: 20px; 
        font-size: 1.1rem; 
        cursor: pointer; 
        border-radius: 12px; 
        border: 1px solid #e0e0e0; 
        background: #ffffff; 
        transition: all 0.3s ease; 
        box-shadow: 0 4px 6px rgba(0,0,0,0.05); 
        font-weight: 600;
        color: #444;
      }
      #quiz-buttons button:hover { 
        background: #f8f9fa; 
        transform: translateY(-5px); 
        box-shadow: 0 8px 15px rgba(0,0,0,0.1); 
        border-color: #6c5ce7;
        color: #6c5ce7;
      }
      .add-quiz-btn {
        grid-column: span 2;
        background: linear-gradient(135deg, #6c5ce7, #a29bfe) !important;
        color: white !important;
        padding: 15px !important;
        border-radius: 12px !important;
        font-weight: 700 !important;
        margin-top: 10px !important;
      }
    `;
    document.head.appendChild(style);
  }

  const userName = currentUser ? currentUser.name : "User";
  
  const titleText = "Choose a Quiz";
  const colors = ["#e74c3c", "#e67e22", "#f1c40f", "#2ecc71", "#1abc9c", "#3498db", "#9b59b6", "#34495e", "#d35400", "#c0392b", "#16a085", "#27ae60", "#2980b9"];
  const animatedTitle = titleText.split("").map((char, i) => {
    if (char === " ") return " ";
    const color = colors[i % colors.length];
    return `<span class="letter" style="color: ${color}; animation-delay: ${i * 0.1}s">${char}</span>`;
  }).join("");

  startScreen.innerHTML = `
    <div class="start-container">
      <div class="user-info">
        <p id="user-welcome">👋 Welcome back, <span style="color: #6c5ce7;">${escapeHtml(userName)}</span>!</p>
        <button onclick="handleLogout()" class="logout-btn">Logout</button>
      </div>
      <h1>${animatedTitle}</h1>
      <div id="quiz-buttons">
        <button type="button" onclick="loadQuiz('General Knowledge')">General Knowledge</button>
        <button type="button" onclick="loadQuiz('Mathematics')">Mathematics</button>
        <button type="button" onclick="loadQuiz('Politics')">Politics</button>
        <button type="button" onclick="loadQuiz('Nature')">Nature</button>
        <button type="button" onclick="showLeaderboard()" class="add-quiz-btn" style="background: linear-gradient(135deg, #f1c40f, #f39c12) !important;">🏆 View Leaderboard</button>
        <button type="button" onclick="renderAddQuestionScreen()" class="add-quiz-btn">➕ Add New Question</button>
      </div>
    </div>
  `;
}

async function showLeaderboard(quizFilter = "", searchTerm = "") {
  try {
    const url = `/api/leaderboard?quiz=${encodeURIComponent(quizFilter)}&search=${encodeURIComponent(searchTerm)}`;
    const res = await fetch(url);
    const data = await res.json();
    
    const startScreen = document.getElementById("start-screen");
    if (!startScreen) return;

    const categories = ["General Knowledge", "Mathematics", "Politics", "Nature"];

    startScreen.innerHTML = `
      <div class="start-container">
        <h1 style="margin-bottom: 20px;">🏆 ${quizFilter || "Global"} Leaderboard</h1>

        <div class="search-container" style="margin-bottom: 20px; display: flex; gap: 10px; padding: 0 10px;">
          <input type="text" id="leaderboard-search" class="search-input" placeholder="Search username..." value="${escapeHtml(searchTerm)}" 
            onkeyup="if(event.key === 'Enter') showLeaderboard('${escapeJs(quizFilter)}', this.value)">
          <button onclick="showLeaderboard('${escapeJs(quizFilter)}', document.getElementById('leaderboard-search').value)" class="filter-btn active" style="margin:0; padding: 10px 15px;">🔍</button>
        </div>
        
        <div class="filter-container" style="margin-bottom: 20px; display: flex; flex-wrap: wrap; justify-content: center; gap: 10px;">
          <button onclick="showLeaderboard('', document.getElementById('leaderboard-search').value)" class="filter-btn ${!quizFilter ? 'active' : ''}">All</button>
          ${categories.map(cat => `
            <button onclick="showLeaderboard('${cat}', document.getElementById('leaderboard-search').value)" class="filter-btn ${quizFilter === cat ? 'active' : ''}">${cat}</button>
          `).join("")}
        </div>

        <div class="leaderboard-list">
          ${data.length > 0 ? data.map((entry, i) => `
            <div class="leaderboard-item">
              <span class="rank">${i + 1}. ${escapeHtml(entry.username)}</span>
              <div style="display: flex; flex-direction: column; align-items: flex-end;">
                <span class="score">${entry.score} pts</span>
                ${!quizFilter ? `<small style="font-size: 0.7rem; color: #888;">${escapeHtml(entry.quiz)}</small>` : ""}
              </div>
            </div>
          `).join("") : "<p style='text-align:center;'>No scores yet. Be the first!</p>"}
        </div>
        <button onclick="renderStartScreen()" class="logout-btn" style="background: #b2bec3; width: 100%; margin-top: 20px;">Back to Menu</button>
      </div>
    `;
  } catch (err) {
    console.error("Leaderboard error:", err);
    alert("Failed to load leaderboard.");
  }
}

function renderAddQuestionScreen() {
  const startScreen = document.getElementById("start-screen");
  if (!startScreen) return;

  startScreen.innerHTML = `
    <div class="start-container">
      <h1 style="margin-bottom: 20px;">Add New Question</h1>
      <div class="auth-form" style="display: flex; flex-direction: column; gap: 15px; text-align: left;">
        <div class="input-group">
          <label>Quiz Category (e.g., Science)</label>
          <input type="text" id="new-quiz-name" placeholder="Enter quiz name" required>
        </div>
        <div class="input-group">
          <label>Question Text</label>
          <input type="text" id="new-question-text" placeholder="Enter your question" required>
        </div>
        <div class="input-group">
          <label>Options (Comma separated)</label>
          <input type="text" id="new-options" placeholder="Option1, Option2, Option3, Option4" required>
        </div>
        <div class="input-group">
          <label>Correct Answer</label>
          <input type="text" id="new-answer" placeholder="Must match one of the options" required>
        </div>
        <div class="input-group">
          <label>Level (1, 2, 3...)</label>
          <input type="number" id="new-level" value="1" min="1" required>
        </div>
        <button onclick="submitNewQuestion()" class="logout-btn" style="background: #6c5ce7; width: 100%; margin: 10px 0;">Save Question</button>
        <button onclick="renderStartScreen()" class="logout-btn" style="background: #b2bec3; width: 100%; margin: 0;">Back to Menu</button>
      </div>
    </div>
  `;
}

async function submitNewQuestion() {
  const quiz = document.getElementById("new-quiz-name").value.trim();
  const question = document.getElementById("new-question-text").value.trim();
  const optionsStr = document.getElementById("new-options").value.trim();
  const answer = document.getElementById("new-answer").value.trim();
  const level = parseInt(document.getElementById("new-level").value) || 1;

  if (!quiz || !question || !optionsStr || !answer || !level) {
    alert("Please fill in all fields.");
    return;
  }

  const options = optionsStr.split(",").map(opt => opt.trim()).filter(opt => opt !== "");
  
  if (options.length < 2) {
    alert("Please provide at least 2 options.");
    return;
  }

  if (!options.includes(answer)) {
    alert("The correct answer must exactly match one of the options provided.");
    return;
  }

  try {
    const res = await fetch("/api/questions", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify({ quiz, question, options, answer, level })
    });

    if (res.ok) {
      alert("Question added successfully!");
      renderStartScreen();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to add question.");
    }
  } catch (err) {
    console.error("Error:", err);
    alert("An error occurred while saving the question.");
  }
}

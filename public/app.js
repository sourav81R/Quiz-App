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
let userManagedQuestions = [];
let editingQuestionId = null;
const QUIZ_CATEGORIES = ["General Knowledge", "Mathematics", "Politics", "Nature"];
const QUESTIONS_PER_LEVEL = 10;
const PASSING_SCORE = 8;

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
    userProgress = {};

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

function handleUnauthorizedSession(message = "Session expired. Please login again.") {
  localStorage.removeItem("authToken");
  localStorage.removeItem("currentUser");
  authToken = null;
  currentUser = null;
  userProgress = {};
  userManagedQuestions = [];
  editingQuestionId = null;

  const loginScreen = document.getElementById("login-screen");
  const startScreen = document.getElementById("start-screen");
  const quizContainer = document.getElementById("quiz-container");
  const resultScreen = document.getElementById("result-screen");

  if (loginScreen) loginScreen.style.display = "block";
  if (startScreen) startScreen.style.display = "none";
  if (quizContainer) quizContainer.style.display = "none";
  if (resultScreen) resultScreen.style.display = "none";

  showAuthMessage(message, "error");
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
function getMaxPassedLevel(quizName) {
  return parseInt(userProgress[quizName], 10) || 0;
}

function isLevelUnlocked(quizName, level) {
  if (level <= 1) return true;
  return getMaxPassedLevel(quizName) >= level - 1;
}

function startLevelQuiz(quizName, level) {
  if (!isLevelUnlocked(quizName, level)) {
    alert(`Level ${level} is locked. Score ${PASSING_SCORE}/${QUESTIONS_PER_LEVEL} in Level ${level - 1} to unlock it.`);
    return;
  }
  loadQuiz(quizName, level);
}

async function loadQuiz(quizName, level = 1) {
  if (!isLevelUnlocked(quizName, level)) {
    alert(`Level ${level} is locked for ${quizName}.`);
    return;
  }

  currentQuiz = quizName;
  currentLevel = level;
  currentQuestionIndex = 0;
  score = 0;
  userAnswers = [];

  try {
    const res = await fetch(`/api/questions/${encodeURIComponent(quizName)}?level=${level}`);
    questions = await res.json();

    if (!Array.isArray(questions) || !questions.length) {
      alert(`No questions found for ${quizName} Level ${level}.`);
      return;
    }

    if (questions.length < QUESTIONS_PER_LEVEL) {
      alert(
        `${quizName} Level ${level} has only ${questions.length} questions. It needs ${QUESTIONS_PER_LEVEL} questions.`
      );
      return;
    }

    questions = questions.slice(0, QUESTIONS_PER_LEVEL);

    document.getElementById("start-screen").style.display = "none";
    document.getElementById("quiz-container").style.display = "block";
    document.getElementById("quiz-title").textContent = `${quizName} - Level ${level} (${QUESTIONS_PER_LEVEL} Questions)`;

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

  const didPassLevel = score >= PASSING_SCORE;
  const scoreText = `You scored ${score} out of ${questions.length}.`;
  let unlockText = "";

  if (didPassLevel && currentLevel > getMaxPassedLevel(currentQuiz)) {
    userProgress[currentQuiz] = currentLevel;
  }

  if (currentLevel === 1) {
    unlockText = didPassLevel
      ? `Level 2 unlocked for ${currentQuiz}.`
      : `Score at least ${PASSING_SCORE}/${QUESTIONS_PER_LEVEL} in Level 1 to unlock Level 2.`;
  }

  document.getElementById("score-text").textContent = unlockText
    ? `${scoreText} ${unlockText}`
    : scoreText;

  // Save result to database
  if (authToken) {
    fetch("/api/results", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify({ score: score, quiz: currentQuiz, level: currentLevel })
    })
      .then((res) => {
        if (res.status === 401) {
          handleUnauthorizedSession();
        }
      })
      .catch((err) => console.error("Error saving result:", err));
  }

  // Play level up sound if score is 80% or higher
  if (didPassLevel) {
    playLevelUpSound();
    if (currentLevel === 1) {
      speak(`Congratulations! Level ${currentLevel} complete. Level 2 is now unlocked. ${scoreText}`);
    } else {
      speak(`Congratulations! Level ${currentLevel} complete! ${scoreText}`);
    }
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
      return;
    }
    if (res.status === 401) {
      handleUnauthorizedSession();
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
        width: min(1100px, calc(100% - 24px));
        max-width: 1100px;
        box-sizing: border-box;
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
        grid-template-columns: repeat(2, minmax(0, 1fr)); 
        gap: 20px; 
        width: 100%;
        max-width: 100%;
        padding: 0 10px;
        box-sizing: border-box;
      }
      .quiz-card {
        background: #ffffff;
        border: 1px solid #e7e7e7;
        border-radius: 12px;
        padding: 14px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.06);
        min-width: 0;
        box-sizing: border-box;
      }
      .quiz-card h3 {
        margin: 0 0 8px;
        color: #2d3436;
      }
      .quiz-lock-note {
        margin: 0 0 12px;
        font-size: 0.9rem;
        color: #636e72;
      }
      .quiz-level-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }
      .quiz-level-btn {
        width: 100%;
        padding: 12px;
        font-size: 0.95rem;
        cursor: pointer;
        border-radius: 10px;
        border: 1px solid #dcdde1;
        background: #ffffff;
        transition: all 0.2s ease;
        box-shadow: 0 2px 4px rgba(0,0,0,0.04);
        font-weight: 600;
        color: #2d3436;
        margin: 0;
        height: auto;
        min-height: 96px;
        box-sizing: border-box;
      }
      .quiz-level-btn:hover {
        transform: translateY(-2px);
        border-color: #6c5ce7;
        color: #6c5ce7;
      }
      .quiz-level-btn.locked {
        cursor: not-allowed;
        background: #f1f2f6;
        color: #999;
        border-color: #dfe4ea;
        box-shadow: none;
      }
      .quiz-level-btn.locked:hover {
        transform: none;
        color: #999;
        border-color: #dfe4ea;
      }
      .add-quiz-btn {
        grid-column: 1 / -1;
        background: linear-gradient(135deg, #6c5ce7, #a29bfe) !important;
        color: white !important;
        padding: 15px !important;
        border-radius: 12px !important;
        font-weight: 700 !important;
        margin-top: 10px !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
        width: 100% !important;
        height: auto !important;
      }
      #quiz-buttons .quiz-level-btn::before,
      #quiz-buttons .add-quiz-btn::before {
        content: none !important;
      }
      @media (max-width: 700px) {
        #quiz-buttons {
          grid-template-columns: 1fr;
        }
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

  const quizCards = QUIZ_CATEGORIES.map((quizName) => {
    const level2Unlocked = isLevelUnlocked(quizName, 2);
    const levelStatus = level2Unlocked
      ? "Level 2 is unlocked."
      : `Score ${PASSING_SCORE}/${QUESTIONS_PER_LEVEL} in Level 1 to unlock Level 2.`;

    return `
      <div class="quiz-card">
        <h3>${escapeHtml(quizName)}</h3>
        <p class="quiz-lock-note">${escapeHtml(levelStatus)}</p>
        <div class="quiz-level-row">
          <button type="button" class="quiz-level-btn" onclick="startLevelQuiz('${escapeJs(quizName)}', 1)">Level 1</button>
          <button
            type="button"
            class="quiz-level-btn ${level2Unlocked ? "" : "locked"}"
            onclick="startLevelQuiz('${escapeJs(quizName)}', 2)"
            ${level2Unlocked ? "" : "disabled"}
          >
            Level 2${level2Unlocked ? "" : " (Locked)"}
          </button>
        </div>
      </div>
    `;
  }).join("");

  startScreen.innerHTML = `
    <div class="start-container">
      <div class="user-info">
        <p id="user-welcome">👋 Welcome back, <span style="color: #6c5ce7;">${escapeHtml(userName)}</span>!</p>
        <button onclick="handleLogout()" class="logout-btn">Logout</button>
      </div>
      <h1>${animatedTitle}</h1>
      <div id="quiz-buttons">
        ${quizCards}
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

    const categories = QUIZ_CATEGORIES;
    const canManageHistory = Boolean(authToken && currentUser && currentUser.id);

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

        <div id="leaderboard-actions" style="display:flex; justify-content:flex-end; margin: 0 10px 10px;"></div>

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
        <p id="leaderboard-manage-note" style="margin: 5px 10px 0; font-size: 0.8rem; color: #777; text-align: right;"></p>
        <button onclick="renderStartScreen()" class="logout-btn" style="background: #b2bec3; width: 100%; margin-top: 20px;">Back to Menu</button>
      </div>
    `;

    const actionsContainer = startScreen.querySelector("#leaderboard-actions");
    const manageNote = startScreen.querySelector("#leaderboard-manage-note");
    if (actionsContainer) {
      if (canManageHistory) {
        actionsContainer.innerHTML = `
          <button
            onclick="clearMyLeaderboardHistory('${escapeJs(quizFilter)}', '${escapeJs(searchTerm)}')"
            class="logout-btn"
            style="background:#ff7675; margin:0; padding:8px 14px; border-radius:10px; font-size:0.9rem;"
          >
            Clear My History
          </button>
        `;
      } else {
        actionsContainer.innerHTML = `
          <button
            class="logout-btn"
            style="background:#d5d5d5; color:#666; margin:0; padding:8px 14px; border-radius:10px; font-size:0.9rem; cursor:not-allowed;"
            disabled
            title="Login required"
          >
            Clear My History
          </button>
        `;
      }
    }

    if (manageNote) {
      manageNote.textContent = canManageHistory
        ? "You can delete only your own entries."
        : "Login to manage your own history.";
    }

    const leaderboardList = startScreen.querySelector(".leaderboard-list");
    if (leaderboardList) {
      leaderboardList.innerHTML =
        data.length > 0
          ? data
              .map((entry, i) => {
                const canDelete =
                  canManageHistory &&
                  entry &&
                  entry._id &&
                  ((entry.userId && String(entry.userId) === String(currentUser.id)) ||
                    (!entry.userId && entry.username === currentUser.name));

                return `
                  <div class="leaderboard-item">
                    <span class="rank">${i + 1}. ${escapeHtml(entry.username)}</span>
                    <div style="display:flex; align-items:center; gap:10px;">
                      <div style="display: flex; flex-direction: column; align-items: flex-end;">
                        <span class="score">${entry.score} pts</span>
                        ${!quizFilter ? `<small style="font-size: 0.7rem; color: #888;">${escapeHtml(entry.quiz)}</small>` : ""}
                      </div>
                      ${
                        canDelete
                          ? `<button
                              onclick="deleteLeaderboardEntry('${escapeJs(String(entry._id))}', '${escapeJs(quizFilter)}', '${escapeJs(searchTerm)}')"
                              style="margin:0; padding:6px 10px; font-size:0.8rem; background:#ff6b6b; color:white; border:none; border-radius:8px;"
                            >
                              Delete
                            </button>`
                          : ""
                      }
                    </div>
                  </div>
                `;
              })
              .join("")
          : "<p style='text-align:center;'>No scores yet. Be the first!</p>";
    }
  } catch (err) {
    console.error("Leaderboard error:", err);
    alert("Failed to load leaderboard.");
  }
}

async function clearMyLeaderboardHistory(quizFilter = "", searchTerm = "") {
  if (!authToken) {
    alert("Please login to manage history.");
    return;
  }

  if (!confirm("Delete all of your quiz history?")) {
    return;
  }

  try {
    const res = await fetch("/api/results", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        handleUnauthorizedSession();
        return;
      }
      alert(data.error || "Failed to clear history.");
      return;
    }

    alert(`Deleted ${data.deletedCount || 0} record(s).`);
    showLeaderboard(quizFilter, searchTerm);
  } catch (err) {
    console.error("Clear history error:", err);
    alert("Failed to clear history.");
  }
}

async function deleteLeaderboardEntry(resultId, quizFilter = "", searchTerm = "") {
  if (!authToken) {
    alert("Please login to manage history.");
    return;
  }

  if (!resultId) {
    alert("Invalid result id.");
    return;
  }

  if (!confirm("Delete this entry?")) {
    return;
  }

  try {
    const res = await fetch(`/api/results/${encodeURIComponent(resultId)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        handleUnauthorizedSession();
        return;
      }
      alert(data.error || "Failed to delete entry.");
      return;
    }

    showLeaderboard(quizFilter, searchTerm);
  } catch (err) {
    console.error("Delete entry error:", err);
    alert("Failed to delete entry.");
  }
}

function renderAddQuestionScreen() {
  const startScreen = document.getElementById("start-screen");
  if (!startScreen) return;

  if (!authToken) {
    alert("Please login to add or manage questions.");
    return;
  }

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
        <button id="question-submit-btn" onclick="submitNewQuestion()" class="logout-btn" style="background: #6c5ce7; width: 100%; margin: 10px 0;">Save Question</button>
        <button id="cancel-edit-btn" onclick="cancelQuestionEdit()" class="logout-btn" style="display:none; background: #f39c12; width: 100%; margin: 0 0 10px 0;">Cancel Edit</button>
        <button onclick="renderStartScreen()" class="logout-btn" style="background: #b2bec3; width: 100%; margin: 0;">Back to Menu</button>
      </div>
      <hr style="margin: 22px 0; border: none; border-top: 1px solid #e6e6e6;">
      <h2 style="margin: 0 0 8px;">Your Questions</h2>
      <p style="margin: 0 0 14px; color: #666; text-align: center;">You can edit or delete only questions created by you.</p>
      <div id="user-questions-list" style="display:flex; flex-direction:column; gap:12px;"></div>
    </div>
  `;

  cancelQuestionEdit();
  loadManagedQuestions();
}

function cancelQuestionEdit() {
  editingQuestionId = null;

  const quizInput = document.getElementById("new-quiz-name");
  const questionInput = document.getElementById("new-question-text");
  const optionsInput = document.getElementById("new-options");
  const answerInput = document.getElementById("new-answer");
  const levelInput = document.getElementById("new-level");
  const submitBtn = document.getElementById("question-submit-btn");
  const cancelBtn = document.getElementById("cancel-edit-btn");

  if (quizInput) quizInput.value = "";
  if (questionInput) questionInput.value = "";
  if (optionsInput) optionsInput.value = "";
  if (answerInput) answerInput.value = "";
  if (levelInput) levelInput.value = "1";
  if (submitBtn) submitBtn.textContent = "Save Question";
  if (cancelBtn) cancelBtn.style.display = "none";
}

async function loadManagedQuestions() {
  const listContainer = document.getElementById("user-questions-list");
  if (!listContainer) return;

  listContainer.innerHTML = `<p style="text-align:center; color:#666;">Loading your questions...</p>`;

  try {
    const res = await fetch("/api/questions", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        handleUnauthorizedSession();
        return;
      }
      listContainer.innerHTML = `<p style="text-align:center; color:#c0392b;">${escapeHtml(data.error || "Failed to load your questions.")}</p>`;
      return;
    }

    userManagedQuestions = Array.isArray(data) ? data : [];
    renderManagedQuestionsList();
  } catch (err) {
    console.error("Error loading managed questions:", err);
    listContainer.innerHTML = `<p style="text-align:center; color:#c0392b;">Failed to load your questions.</p>`;
  }
}

function renderManagedQuestionsList() {
  const listContainer = document.getElementById("user-questions-list");
  if (!listContainer) return;

  if (!userManagedQuestions.length) {
    listContainer.innerHTML = `<p style="text-align:center; color:#666;">No questions added by you yet.</p>`;
    return;
  }

  listContainer.innerHTML = userManagedQuestions
    .map((q, i) => {
      const id = String(q._id || "");
      const optionsText = Array.isArray(q.options) ? q.options.join(", ") : "";
      return `
      <div style="border:1px solid #e1e1e1; border-radius:10px; padding:12px; background:#fff;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
          <div style="text-align:left;">
            <p style="margin:0 0 4px; font-weight:700; color:#2d3436;">${i + 1}. ${escapeHtml(q.question || "")}</p>
            <p style="margin:0 0 4px; color:#555;"><strong>Quiz:</strong> ${escapeHtml(q.quiz || "")} | <strong>Level:</strong> ${escapeHtml(q.level || 1)}</p>
            <p style="margin:0 0 4px; color:#555;"><strong>Options:</strong> ${escapeHtml(optionsText)}</p>
            <p style="margin:0; color:#16a085;"><strong>Answer:</strong> ${escapeHtml(q.answer || "")}</p>
          </div>
          <div style="display:flex; gap:8px; flex-shrink:0;">
            <button onclick="startQuestionEdit('${escapeJs(id)}')" style="margin:0; background:#6c5ce7; color:white; padding:7px 12px; border:none; border-radius:8px;">Edit</button>
            <button onclick="deleteManagedQuestion('${escapeJs(id)}')" style="margin:0; background:#e74c3c; color:white; padding:7px 12px; border:none; border-radius:8px;">Delete</button>
          </div>
        </div>
      </div>
    `;
    })
    .join("");
}

function startQuestionEdit(questionId) {
  const targetQuestion = userManagedQuestions.find((q) => String(q._id) === String(questionId));
  if (!targetQuestion) {
    alert("Question not found.");
    return;
  }

  editingQuestionId = String(targetQuestion._id);

  const quizInput = document.getElementById("new-quiz-name");
  const questionInput = document.getElementById("new-question-text");
  const optionsInput = document.getElementById("new-options");
  const answerInput = document.getElementById("new-answer");
  const levelInput = document.getElementById("new-level");
  const submitBtn = document.getElementById("question-submit-btn");
  const cancelBtn = document.getElementById("cancel-edit-btn");

  if (quizInput) quizInput.value = targetQuestion.quiz || "";
  if (questionInput) questionInput.value = targetQuestion.question || "";
  if (optionsInput) optionsInput.value = Array.isArray(targetQuestion.options) ? targetQuestion.options.join(", ") : "";
  if (answerInput) answerInput.value = targetQuestion.answer || "";
  if (levelInput) levelInput.value = String(targetQuestion.level || 1);
  if (submitBtn) submitBtn.textContent = "Update Question";
  if (cancelBtn) cancelBtn.style.display = "inline-block";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteManagedQuestion(questionId) {
  if (!authToken) {
    alert("Please login to delete questions.");
    return;
  }

  if (!questionId) {
    alert("Invalid question id.");
    return;
  }

  if (!confirm("Delete this question?")) {
    return;
  }

  try {
    const res = await fetch(`/api/questions/${encodeURIComponent(questionId)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        handleUnauthorizedSession();
        return;
      }
      alert(data.error || "Failed to delete question.");
      return;
    }

    if (editingQuestionId === questionId) {
      cancelQuestionEdit();
    }

    await loadManagedQuestions();
  } catch (err) {
    console.error("Error deleting question:", err);
    alert("Failed to delete question.");
  }
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
    const endpoint = editingQuestionId
      ? `/api/questions/${encodeURIComponent(editingQuestionId)}`
      : "/api/questions";
    const method = editingQuestionId ? "PUT" : "POST";

    const res = await fetch(endpoint, {
      method,
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      },
      body: JSON.stringify({ quiz, question, options, answer, level })
    });

    const data = await res.json();
    if (!res.ok) {
      if (res.status === 401) {
        handleUnauthorizedSession();
        return;
      }
      alert(data.error || "Failed to add question.");
      return;
    }

    alert(editingQuestionId ? "Question updated successfully!" : "Question added successfully!");
    cancelQuestionEdit();
    await loadManagedQuestions();
  } catch (err) {
    console.error("Error:", err);
    alert("An error occurred while saving the question.");
  }
}

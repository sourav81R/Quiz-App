// ===== app.js =====

let currentQuiz = "";
let questions = [];
let currentQuestionIndex = 0;
let score = 0;
let userAnswers = [];

let timerInterval = null;
let timeLeft = 10;

// ================== MUTE STATE ==================
let isMuted = localStorage.getItem("quizMuted") === "true";

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
async function loadQuiz(quizName) {
  currentQuiz = quizName;
  currentQuestionIndex = 0;
  score = 0;
  userAnswers = [];

  try {
    const res = await fetch(`http://localhost:5000/api/questions/${quizName}`);
    questions = await res.json();

    if (!questions || !questions.length) {
      alert("No questions found for " + quizName);
      return;
    }

    document.getElementById("start-screen").style.display = "none";
    document.getElementById("quiz-container").style.display = "block";
    document.getElementById("quiz-title").textContent = quizName;

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
  if (timerSpan) timerSpan.textContent = formatTime(timeLeft);

  timerInterval = setInterval(() => {
    timeLeft--;
    if (timerSpan) timerSpan.textContent = formatTime(timeLeft);

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
    speak("Correct answer!", () => nextQuestion());
  } else {
    feedback.innerHTML = "❌ Wrong!";
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
  speak(scoreText);

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
}

function formatTime(seconds) {
  return `${seconds < 10 ? "00:0" + seconds : "00:" + seconds}`;
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(800, ctx.currentTime);
    gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.15);
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
  document.getElementById("start-screen").style.display = "block";

  currentQuiz = "";
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

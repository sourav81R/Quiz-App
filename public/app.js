let currentQuiz = "";
let questions = [];
let currentQuestionIndex = 0;
let score = 0;
let userAnswers = [];

let timerInterval = null;
let timeLeft = 10;

// ================== MUTE STATE ==================
let isMuted = localStorage.getItem("quizMuted") === "true";

// Init mute button
function initMuteButton() {
  const muteBtn = document.getElementById("mute-btn");
  if (muteBtn) muteBtn.textContent = isMuted ? "🔇" : "🔊";

  const quizTimer = document.getElementById("quiz-timer");
  if (quizTimer) quizTimer.style.display = isMuted ? "none" : "block";
}

// Toggle mute + hide timer if muted
function toggleMute() {
  isMuted = !isMuted;
  localStorage.setItem("quizMuted", isMuted);

  const muteBtn = document.getElementById("mute-btn");
  const quizTimer = document.getElementById("quiz-timer");

  muteBtn.textContent = isMuted ? "🔇" : "🔊";
  quizTimer.style.display = isMuted ? "none" : "block";

  if (isMuted && window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }
}

// ================== SPEECH ==================
function speak(text, callback) {
  if (isMuted) return; // don’t speak if muted
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

    if (!questions.length) {
      alert("No questions found for " + quizName);
      return;
    }

    document.getElementById("start-screen").style.display = "none";
    document.getElementById("quiz-container").style.display = "block";
    document.getElementById("quiz-title").textContent = quizName;

    initMuteButton();

    // Reset timer display
    document.getElementById("quiz-timer").innerHTML = formatTime(10);

    // Speak quiz type and then show question
    speak(`You have selected ${quizName} quiz. Let's begin!`, () => {
      showQuestion();
    });
  } catch (error) {
    console.error("Error loading quiz:", error);
  }
}

// ================== SHOW QUESTION ==================
function showQuestion() {
  clearTimers();

  const questionObj = questions[currentQuestionIndex];
  const block = document.getElementById("question-block");

  // Pick gradient class (cycle through 1–6)
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
                  onchange="checkAnswer('${escapeJs(opt)}','${escapeJs(
    questionObj.answer
  )}')"
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

  // navigation buttons
  document.getElementById("prev-btn").style.display =
    currentQuestionIndex === 0 ? "none" : "inline-block";
  document.getElementById("next-btn").style.display =
    currentQuestionIndex === questions.length - 1 ? "none" : "inline-block";
  document.getElementById("finish-btn").style.display =
    currentQuestionIndex === questions.length - 1 ? "inline-block" : "none";

  // progress
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  document.getElementById("progress-bar").style.width = progress + "%";
  document.getElementById(
    "progress-text"
  ).textContent = `Question ${currentQuestionIndex + 1} of ${questions.length}`;

  // speak question + options
  let textToSpeak = `Question ${
    currentQuestionIndex + 1
  }. ${questionObj.question}. Options are: `;
  questionObj.options.forEach((opt, i) => {
    textToSpeak += `Option ${i + 1}, ${opt}. `;
  });

  speak(textToSpeak, () => startAnswerTimer());
}

// ================== START TIMER ==================
function startAnswerTimer() {
  if (timerInterval) clearInterval(timerInterval);

  timeLeft = 10;
  const timerEl = document.getElementById("quiz-timer");
  timerEl.innerHTML = formatTime(timeLeft);
  timerEl.classList.remove("timer-warning");

  timerInterval = setInterval(() => {
    timeLeft--;

    if (timeLeft <= 3 && timeLeft > 0) {
      timerEl.classList.add("timer-warning");
      playBeep();
    }

    timerEl.innerHTML = formatTime(timeLeft);

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      timerEl.classList.remove("timer-warning");

      if (!userAnswers[currentQuestionIndex]) {
        speak("Time's up! Moving to the next question.", () => {
          if (currentQuestionIndex < questions.length - 1) {
            currentQuestionIndex++;
            showQuestion();
          } else {
            finishQuiz();
          }
        });
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
    if (opt.value === correct) {
      opt.parentElement.classList.add("correct");
    }
    if (opt.checked && opt.value !== correct) {
      opt.parentElement.classList.add("wrong");
    }
  });

  userAnswers[currentQuestionIndex] = selected;
  const feedback = document.getElementById("answer-feedback");

  if (selected === correct) {
    score++;
    if (feedback) feedback.innerHTML = "✅ Correct!";
    speak("Correct answer!", () => nextQuestion());
  } else {
    if (feedback) feedback.innerHTML = "❌ Wrong!";
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
          <p><strong>Your Answer:</strong> ${
            userAnswers[i] || "Not Attempted"
          } ${isCorrect ? "(Correct)" : "(Wrong)"}</p>
          <p><strong>Correct Answer:</strong> ${q.answer}</p>
        </div>
      `;
    })
    .join("");
}

// ================== HELPERS ==================
function clearTimers() {
  if (timerInterval) clearInterval(timerInterval);
}

function formatTime(seconds) {
  return `00:${seconds < 10 ? "0" : ""}${seconds}`;
}

function playBeep() {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(800, ctx.currentTime);
  gainNode.gain.setValueAtTime(0.2, ctx.currentTime);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.2);
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

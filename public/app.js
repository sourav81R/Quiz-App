let currentQuiz = "";
let questions = [];
let currentQuestionIndex = 0;
let score = 0;
let userAnswers = [];

// Start a quiz
async function loadQuiz(quizName) {
  currentQuiz = quizName;
  currentQuestionIndex = 0;
  score = 0;
  userAnswers = [];

  try {
    // Replace with your backend or JSON file
    const res = await fetch(`http://localhost:5000/api/questions/${quizName}`);
    questions = await res.json();

    if (!questions.length) {
      alert("No questions found for " + quizName);
      return;
    }

    document.getElementById("start-screen").style.display = "none";
    document.getElementById("quiz-container").style.display = "block";
    document.getElementById("quiz-title").textContent = quizName;

    showQuestion();
  } catch (error) {
    console.error("Error loading quiz:", error);
  }
}

// Show a question
function showQuestion() {
  const questionObj = questions[currentQuestionIndex];

  const gradients = ["gradient-1", "gradient-2", "gradient-3", "gradient-4", "gradient-5", "gradient-6"];
  const gradientClass = gradients[currentQuestionIndex % gradients.length];

  const block = document.getElementById("question-block");
  block.innerHTML = `
    <div class="question-card ${gradientClass}">
      <h3>Q${currentQuestionIndex + 1}: ${questionObj.question}</h3>
      <ul id="options-list">
        ${questionObj.options
          .map(
            (opt) => `
            <li>
              <label>
                <input type="radio" name="option" value="${opt}"
                  onchange="checkAnswer('${opt}', '${questionObj.answer}')"
                  ${userAnswers[currentQuestionIndex] === opt ? "checked" : ""}>
                ${opt}
              </label>
            </li>
          `
          )
          .join("")}
      </ul>
      <p id="answer-feedback"></p>
    </div>
  `;

  // Show/hide navigation buttons
  document.getElementById("prev-btn").style.display =
    currentQuestionIndex === 0 ? "none" : "inline-block";
  document.getElementById("next-btn").style.display =
    currentQuestionIndex === questions.length - 1 ? "none" : "inline-block";
  document.getElementById("finish-btn").style.display =
    currentQuestionIndex === questions.length - 1 ? "inline-block" : "none";

  // Update progress bar
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
  document.getElementById("progress-bar").style.width = progress + "%";
  document.getElementById("progress-text").textContent =
    `Question ${currentQuestionIndex + 1} of ${questions.length}`;
}

// Check Answer immediately
function checkAnswer(selected, correct) {
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
    feedback.innerHTML = "<span class='feedback-correct'>✅ Correct!</span>";
  } else {
    feedback.innerHTML = "<span class='feedback-wrong'>❌ Wrong!</span>";
  }
}

// Next button
function nextQuestion() {
  if (currentQuestionIndex < questions.length - 1) {
    currentQuestionIndex++;
    showQuestion();
  }
}

// Previous button
function prevQuestion() {
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    showQuestion();
  }
}

// Finish quiz
function finishQuiz() {
  document.getElementById("quiz-container").style.display = "none";
  document.getElementById("result-screen").style.display = "block";

  document.getElementById("score-text").textContent =
    `You scored ${score} out of ${questions.length}.`;

  const detailedResults = document.getElementById("detailed-results");
  detailedResults.innerHTML = questions
    .map((q, i) => {
      const isCorrect = userAnswers[i] === q.answer;
      return `
        <div class="result-item ${isCorrect ? "correct" : "wrong"}">
          <p><strong>Q${i + 1}:</strong> ${q.question}</p>
          <p><strong>Your Answer:</strong> ${userAnswers[i] || "Not Attempted"} 
            ${isCorrect 
              ? "<span class='feedback-correct'>(Correct)</span>" 
              : "<span class='feedback-wrong'>(Wrong)</span>"}
          </p>
          <p><strong>Correct Answer:</strong> ${q.answer}</p>
        </div>
      `;
    })
    .join("");
}

// Restart quiz
function restartQuiz() {
  document.getElementById("result-screen").style.display = "none";
  document.getElementById("start-screen").style.display = "block";
}

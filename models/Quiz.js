import React, { useEffect, useState } from "react";
import { talkQuestion, speak } from "../utils/speech";

function Quiz({ currentQuestion, onNext, onPrevious }) {
  const [timeLeft, setTimeLeft] = useState(10);
  const [answered, setAnswered] = useState(false);

  // Reset when question changes
  useEffect(() => {
    if (currentQuestion) {
      setAnswered(false);
      setTimeLeft(10);

      // Speak the question
      talkQuestion(currentQuestion);
    }
  }, [currentQuestion]);

  // Countdown
  useEffect(() => {
    if (answered) return;
    if (timeLeft <= 0) {
      speak("Time’s up! Please give your answer. Do you want the previous question or next question?");
      return;
    }

    const timerId = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timerId);
  }, [timeLeft, answered]);

  const handleAnswer = (option) => {
    setAnswered(true);
    speak(`You selected ${option}`);
  };

  return (
    <div className="quiz-container">
      {/* Timer Top Right */}
      <div className="timer">{timeLeft > 0 ? `${timeLeft}s` : "⏰"}</div>

      {/* Question */}
      <h3>{currentQuestion?.question}</h3>

      {/* Options */}
      <div className="options">
        {currentQuestion?.options.map((opt, i) => (
          <button key={i} onClick={() => handleAnswer(opt)}>
            {opt}
          </button>
        ))}
      </div>

      {/* Navigation */}
      <div style={{ marginTop: "20px" }}>
        <button onClick={onPrevious}>Previous</button>
        <button onClick={onNext}>Next</button>
      </div>
    </div>
  );
}

export default Quiz;

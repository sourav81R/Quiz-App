// src/utils/speech.js
export const speak = (text, callback) => {
  if ("speechSynthesis" in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1;
    utterance.pitch = 1;

    if (callback) {
      utterance.onend = callback; // Run after speaking finishes
    }

    window.speechSynthesis.speak(utterance);
  }
};

// Speak full question with options
export const talkQuestion = (question, onFinish) => {
  speak(`Question: ${question.question}`, () => {
    let i = 0;
    const readOption = () => {
      if (i < question.options.length) {
        speak(`Option ${i + 1}: ${question.options[i]}`, () => {
          i++;
          readOption();
        });
      } else if (onFinish) {
        onFinish();
      }
    };
    readOption();
  });
};

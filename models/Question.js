const mongoose = require("mongoose");

const QuestionSchema = new mongoose.Schema({
  quiz: { type: String, required: true }, // Quiz category (General Knowledge, Mathematics, etc.)
  question: { type: String, required: true }, // The actual question text
  options: { type: [String], required: true }, // Array of options
  answer: { type: String, required: true }, // Correct answer (string, e.g. "Mars")
  image: { type: String }, // URL for the background image
  level: { type: Number, default: 1 }
});

module.exports = mongoose.model("Question", QuestionSchema);

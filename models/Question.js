const mongoose = require("mongoose");

const QuestionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: [String],
  correct: { type: Number, required: true } // index of correct option
});

module.exports = mongoose.model("Question", QuestionSchema);

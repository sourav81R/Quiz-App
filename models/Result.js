const mongoose = require("mongoose");

const ResultSchema = new mongoose.Schema({
  username: String,
  score: Number,
  quiz: String,
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Result", ResultSchema);

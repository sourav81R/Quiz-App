import mongoose from "mongoose";

const ResultSchema = new mongoose.Schema({
  username: String,
  score: Number,
  quiz: String,
  date: { type: Date, default: Date.now }
});

const Result = mongoose.model("Result", ResultSchema);

export default Result;

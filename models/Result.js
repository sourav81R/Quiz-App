import mongoose from "mongoose";

const ResultSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  authUid: { type: String },
  authEmail: { type: String },
  username: String,
  score: Number,
  quiz: String,
  level: { type: Number, default: 1 },
  date: { type: Date, default: Date.now }
});

const Result = mongoose.model("Result", ResultSchema);

export default Result;

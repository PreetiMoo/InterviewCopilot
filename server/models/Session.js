import mongoose from "mongoose";

const answerSchema = new mongoose.Schema(
  {
    question: String,
    answer: String,
    feedback: mongoose.Schema.Types.Mixed,
  },
  { _id: false }
);

const sessionSchema = new mongoose.Schema({
  company: { type: String, required: true },
  jobTitle: { type: String, required: true },
  cultureSignals: { type: String, default: "" },
  questions: { type: Array, default: [] },
  answers: { type: [answerSchema], default: [] },
  overallScore: { type: Number, default: null },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Session", sessionSchema);

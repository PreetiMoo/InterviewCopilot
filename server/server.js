import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import interviewRoutes from "./routes/interview.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api", interviewRoutes);

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("Missing MONGODB_URI in environment");
    process.exit(1);
  }
  await mongoose.connect(uri);
  console.log("MongoDB connected");

  app.listen(PORT, () => {
    console.log(`InterviewCopilot API listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

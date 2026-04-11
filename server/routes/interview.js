import { Router } from "express";
import {
  generateQuestions,
  getFeedback,
  listSessions,
} from "../controllers/interviewController.js";

const router = Router();

router.post("/generate-questions", generateQuestions);
router.post("/get-feedback", getFeedback);
router.get("/sessions", listSessions);

export default router;

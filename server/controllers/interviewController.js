import Session from "../models/Session.js";

/** @see https://ai.google.dev/api/models — https://ai.google.dev/gemini-api/docs/rate-limits */
const GEMINI_MODELS_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Ordered by free-tier availability. gemini-2.5-flash typically has free-tier quota
 * while 2.0-flash shows limit 0. 1.5 models are retired from v1beta.
 */
const MODELS_FREE_TIER_FIRST = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash",
];

const MODELS_PERFORMANCE_FIRST = [
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-2.0-flash-lite",
  "gemini-2.5-flash-lite",
];

const MAX_CULTURE_SIGNALS_CHARS = 3500;
const MAX_ANSWER_IN_PROMPT_CHARS = 8000;

function geminiModelCandidates() {
  const fromEnv = (process.env.GEMINI_MODEL || "").trim();
  const freeFirst = process.env.GEMINI_FREE_TIER !== "0";
  const fallbacks = freeFirst ? MODELS_FREE_TIER_FIRST : MODELS_PERFORMANCE_FIRST;
  if (fromEnv) return [fromEnv, ...fallbacks.filter((m) => m !== fromEnv)];
  return [...fallbacks];
}

function shouldTryNextModel(status, message) {
  const msg = String(message || "");
  if (status === 404 || status === 400) {
    if (/not found|not supported for generateContent|is not found/i.test(msg)) return true;
  }
  if (status === 429) return true;
  if (/quota exceeded|resource_exhausted|resource has been exhausted|rate limit|rate-limit/i.test(msg))
    return true;
  return false;
}

function truncate(str, max) {
  const s = String(str ?? "");
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n…[truncated]`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(message) {
  const m = /retry in ([\d.]+)\s*s/i.exec(String(message || ""));
  if (!m) return null;
  const sec = parseFloat(m[1], 10);
  if (!Number.isFinite(sec) || sec < 0) return null;
  return Math.min(Math.ceil(sec * 1000) + 500, 120_000);
}

function extractGeminiText(data) {
  const candidate = data?.candidates?.[0];
  if (!candidate) {
    const blockReason = data?.promptFeedback?.blockReason;
    if (blockReason) {
      console.error("[Gemini] Prompt blocked:", blockReason);
      return "";
    }
    console.error("[Gemini] No candidates in response:", JSON.stringify(data).slice(0, 500));
    return "";
  }
  const finish = candidate.finishReason;
  if (finish && finish !== "STOP" && finish !== "MAX_TOKENS") {
    console.warn("[Gemini] finishReason:", finish);
  }
  const parts = candidate.content?.parts;
  if (!parts?.length) return "";
  return parts.map((p) => p.text || "").join("");
}

function stripMarkdownFences(text) {
  return text.replace(/```(?:json|JSON)?\s*\n?([\s\S]*?)```/g, "$1");
}

function parseJsonFromModel(raw) {
  if (!raw || typeof raw !== "string") return null;
  let t = raw.trim();

  // 1. Direct parse
  try { return JSON.parse(t); } catch { /* continue */ }

  // 2. Strip markdown fences
  const unfenced = stripMarkdownFences(t).trim();
  if (unfenced !== t) {
    try { return JSON.parse(unfenced); } catch { /* continue */ }
    t = unfenced;
  }

  // 3. Extract outermost JSON array or object
  const arrStart = t.indexOf("[");
  const objStart = t.indexOf("{");

  if (arrStart !== -1 && (objStart === -1 || arrStart < objStart)) {
    const slice = extractBracketBlock(t, arrStart, "[", "]");
    if (slice) {
      try { return JSON.parse(slice); } catch { /* continue */ }
    }
  }
  if (objStart !== -1) {
    const slice = extractBracketBlock(t, objStart, "{", "}");
    if (slice) {
      try { return JSON.parse(slice); } catch { /* continue */ }
    }
  }

  // 4. Last resort: first [ to last ], first { to last }
  if (arrStart !== -1) {
    const end = t.lastIndexOf("]");
    if (end > arrStart) {
      try { return JSON.parse(t.slice(arrStart, end + 1)); } catch { /* continue */ }
    }
  }
  if (objStart !== -1) {
    const end = t.lastIndexOf("}");
    if (end > objStart) {
      try { return JSON.parse(t.slice(objStart, end + 1)); } catch { /* continue */ }
    }
  }

  return null;
}

function extractBracketBlock(str, start, open, close) {
  let depth = 0;
  let inStr = false;
  let escape = false;
  for (let i = start; i < str.length; i++) {
    const ch = str[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return str.slice(start, i + 1);
    }
  }
  return null;
}

/** If JSON array is truncated (MAX_TOKENS), try to salvage complete items. */
function salvageTruncatedArray(raw) {
  if (!raw || typeof raw !== "string") return null;
  const t = stripMarkdownFences(raw).trim();
  if (!t.startsWith("[")) return null;

  const items = [];
  let depth = 0;
  let inStr = false;
  let escape = false;
  let objStart = -1;

  for (let i = 1; i < t.length; i++) {
    const ch = t[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;

    if (ch === "{" && depth === 0) { objStart = i; depth = 1; }
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0 && objStart !== -1) {
        const block = t.slice(objStart, i + 1);
        try {
          items.push(JSON.parse(block));
        } catch { /* skip malformed item */ }
        objStart = -1;
      }
    }
  }
  return items.length >= 3 ? items : null;
}

async function callGeminiOnce(apiKey, modelId, prompt, maxOutputTokens, jsonMode = false) {
  const url = `${GEMINI_MODELS_BASE}/${encodeURIComponent(modelId)}:generateContent`;
  const genConfig = { temperature: 0.7, maxOutputTokens };
  if (jsonMode) genConfig.responseMimeType = "application/json";

  console.log(`[Gemini] Calling model=${modelId} jsonMode=${jsonMode} maxTokens=${maxOutputTokens}`);
  const res = await fetch(`${url}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: genConfig,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      data?.error?.message || data?.error?.status || res.statusText || "Gemini request failed";
    console.error(`[Gemini] ${modelId} error ${res.status}: ${msg.slice(0, 300)}`);
    const err = new Error(msg);
    err.status = res.status || 502;
    throw err;
  }
  const text = extractGeminiText(data);
  console.log(`[Gemini] ${modelId} response (${text.length} chars): ${text.slice(0, 200)}${text.length > 200 ? "…" : ""}`);
  return text;
}

async function callGemini(apiKey, prompt, { maxOutputTokens = 2048, jsonMode = false } = {}) {
  const candidates = geminiModelCandidates();
  let lastErr = null;
  for (let i = 0; i < candidates.length; i += 1) {
    const modelId = candidates[i];
    const hasNext = i < candidates.length - 1;
    try {
      return await callGeminiOnce(apiKey, modelId, prompt, maxOutputTokens, jsonMode);
    } catch (e) {
      lastErr = e;
      if (shouldTryNextModel(e.status, e.message) && hasNext) continue;

      const waitMs = !hasNext ? parseRetryAfterMs(e.message) : null;
      if (waitMs && shouldTryNextModel(e.status, e.message)) {
        console.log(`[Gemini] Last model ${modelId} rate-limited, waiting ${waitMs}ms…`);
        await sleep(waitMs);
        try {
          return await callGeminiOnce(apiKey, modelId, prompt, maxOutputTokens, jsonMode);
        } catch (e2) {
          lastErr = e2;
        }
      }
      throw augmentQuotaError(lastErr);
    }
  }
  throw augmentQuotaError(lastErr || new Error("Gemini request failed"));
}

function augmentQuotaError(err) {
  if (!err || !err.message) return err;
  if (!/quota exceeded|rate limit|429/i.test(err.message)) return err;
  const hint =
    " Free tier: the server tries smaller models first (see GEMINI_FREE_TIER). Wait for the suggested retry time or set GEMINI_MODEL to a model with quota: https://ai.google.dev/gemini-api/docs/rate-limits";
  if (err.message.includes("ai.google.dev/gemini-api/docs/rate-limits")) return err;
  err.message = `${err.message}${hint}`;
  return err;
}

export async function generateQuestions(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server missing GEMINI_API_KEY" });
  }
  const { jobTitle, company, cultureSignals = "" } = req.body || {};
  if (!jobTitle || !company) {
    return res.status(400).json({ error: "jobTitle and company are required" });
  }

  const signals = truncate(cultureSignals, MAX_CULTURE_SIGNALS_CHARS);
  const prompt = `You are an expert interview coach. 
Role: ${jobTitle} at ${company}.
Culture signals: ${signals}
Generate exactly 5 tailored interview questions.
Respond ONLY with a JSON array, no markdown, no preamble.
Each item: { question, tests, tip, difficulty }
Difficulty is one of: Easy, Medium, Hard`;

  try {
    const raw = await callGemini(apiKey, prompt, { maxOutputTokens: 4096, jsonMode: true });
    let parsed = parseJsonFromModel(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      parsed = salvageTruncatedArray(raw);
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      console.error("[generate-questions] Failed to parse. Raw response:", raw?.slice(0, 500));
      return res.status(502).json({
        error: "Could not parse questions from model response",
        hint: raw ? `Model returned: ${raw.slice(0, 120)}…` : "Model returned empty response",
      });
    }
    const questions = parsed.slice(0, 5).map((q) => ({
      question: String(q.question || "").trim(),
      tests: String(q.tests || "").trim(),
      tip: String(q.tip || "").trim(),
      difficulty: ["Easy", "Medium", "Hard"].includes(q.difficulty) ? q.difficulty : "Medium",
    }));
    if (questions.some((q) => !q.question)) {
      return res.status(502).json({ error: "Invalid question objects from model" });
    }

    const session = await Session.create({
      company: String(company).trim(),
      jobTitle: String(jobTitle).trim(),
      cultureSignals: String(cultureSignals || "").trim(),
      questions,
      answers: [],
      overallScore: null,
    });

    return res.json({ sessionId: session._id.toString(), questions });
  } catch (e) {
    const status = e.status || 500;
    return res.status(status).json({ error: e.message || "Failed to generate questions" });
  }
}

function averageScores(answers) {
  const nums = answers
    .map((a) => a.feedback?.score)
    .map((s) => {
      const n = typeof s === "number" ? s : parseFloat(String(s), 10);
      return Number.isFinite(n) ? n : null;
    })
    .filter((n) => n !== null);
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

export async function getFeedback(req, res) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Server missing GEMINI_API_KEY" });
  }
  const { sessionId, question, answer, jobTitle, company } = req.body || {};
  if (!sessionId || !question || answer === undefined || answer === null) {
    return res.status(400).json({ error: "sessionId, question, and answer are required" });
  }
  if (!jobTitle || !company) {
    return res.status(400).json({ error: "jobTitle and company are required" });
  }

  const answerTrim = truncate(answer, MAX_ANSWER_IN_PROMPT_CHARS);
  const prompt = `You are an interview coach giving feedback.
Question: ${question}
Candidate's answer: ${answerTrim}
Role: ${jobTitle} at ${company}
Respond ONLY with JSON: { strengths, improve, sampleStructure, score }
score is 1-10. All fields are strings.`;

  try {
    const raw = await callGemini(apiKey, prompt, { maxOutputTokens: 4096, jsonMode: true });
    const parsed = parseJsonFromModel(raw);
    if (!parsed || typeof parsed !== "object") {
      console.error("[get-feedback] Failed to parse. Raw response:", raw?.slice(0, 500));
      return res.status(502).json({
        error: "Could not parse feedback from model response",
        hint: raw ? `Model returned: ${raw.slice(0, 120)}…` : "Model returned empty response",
      });
    }

    const strengths = String(parsed.strengths ?? "").trim();
    const improve = String(parsed.improve ?? "").trim();
    const sampleStructure = String(parsed.sampleStructure ?? "").trim();
    let score = parsed.score;
    if (typeof score !== "number") score = parseFloat(String(score), 10);
    if (!Number.isFinite(score)) score = 5;
    score = Math.min(10, Math.max(1, Math.round(score * 10) / 10));

    const feedback = { strengths, improve, sampleStructure, score };

    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    session.answers.push({
      question: String(question).trim(),
      answer: String(answer).trim(),
      feedback,
    });
    const avg = averageScores(session.answers);
    if (avg !== null) session.overallScore = avg;
    await session.save();

    return res.json(feedback);
  } catch (e) {
    const status = e.status || 500;
    return res.status(status).json({ error: e.message || "Failed to get feedback" });
  }
}

export async function listSessions(req, res) {
  try {
    const sessions = await Session.find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()
      .exec();

    const list = sessions.map((s) => ({
      id: s._id.toString(),
      company: s.company,
      jobTitle: s.jobTitle,
      date: s.createdAt,
      score: s.overallScore != null ? s.overallScore : null,
    }));

    return res.json({ sessions: list });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Failed to list sessions" });
  }
}

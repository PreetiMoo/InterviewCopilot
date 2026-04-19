import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "../context/SessionContext.jsx";
import { tabDictationInjector } from "../dictation/tabDictationInjector.js";

function ErrorCard({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-lg border border-rose-500/40 bg-rose-950/50 text-rose-100 px-3 py-2 text-sm flex gap-2 items-start"
    >
      <span className="flex-1 leading-relaxed">{message}</span>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-rose-300 hover:text-white text-xs underline"
        >
          Dismiss
        </button>
      ) : null}
    </div>
  );
}

function SettingsModal({ open, onClose, url, onSave }) {
  const [value, setValue] = useState(url);
  useEffect(() => {
    if (open) setValue(url);
  }, [open, url]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-3"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-100">Backend URL</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 text-xs"
          >
            Close
          </button>
        </div>
        <p className="text-xs text-zinc-500 leading-relaxed">
          API base URL (no trailing slash). Add this host to{" "}
          <code className="text-zinc-400">manifest.json</code> host_permissions when deploying.
        </p>
        <input
          className="w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-600/60"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="http://localhost:5000"
        />
        <button
          type="button"
          onClick={() => onSave(value)}
          className="w-full rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium py-2"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function DifficultyBadge({ difficulty }) {
  const d = difficulty || "Medium";
  const map = {
    Easy: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    Medium: "bg-amber-500/15 text-amber-200 border-amber-500/30",
    Hard: "bg-rose-500/15 text-rose-200 border-rose-500/30",
  };
  const cls = map[d] || map.Medium;
  return (
    <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border ${cls}`}>
      {d}
    </span>
  );
}

function DetectScreen() {
  const {
    pageData,
    refreshFromStorage,
    manualCompany,
    setManualCompany,
    manualTitle,
    setManualTitle,
    manualDescription,
    setManualDescription,
    generateQuestions,
    loading,
    effectiveCompany,
    effectiveTitle,
  } = useSession();

  const manual = pageData?.manualMode;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-zinc-50">Detect</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Data from the job page (or enter manually if detection failed).
          </p>
        </div>
        <button
          type="button"
          onClick={() => refreshFromStorage()}
          className="text-xs text-violet-400 hover:text-violet-300"
        >
          Refresh
        </button>
      </div>

      {!pageData ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-400">
          No job data yet. Open a LinkedIn job or Glassdoor posting, then click Refresh.
        </div>
      ) : manual ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-xs text-amber-200/90">
            Manual mode: we could not scrape this page reliably. Paste details below.
          </div>
          <label className="block text-xs text-zinc-400">
            Company
            <input
              className="mt-1 w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100"
              value={manualCompany}
              onChange={(e) => setManualCompany(e.target.value)}
            />
          </label>
          <label className="block text-xs text-zinc-400">
            Job title
            <input
              className="mt-1 w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100"
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
            />
          </label>
          <label className="block text-xs text-zinc-400">
            Job description
            <textarea
              rows={6}
              className="mt-1 w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 resize-y min-h-[120px]"
              value={manualDescription}
              onChange={(e) => setManualDescription(e.target.value)}
            />
          </label>
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 space-y-2">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">Company</p>
            <p className="text-sm text-zinc-100 font-medium">{effectiveCompany || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-zinc-500">Job title</p>
            <p className="text-sm text-zinc-100 font-medium">{effectiveTitle || "—"}</p>
          </div>
          {pageData.jobDescription ? (
            <details className="text-xs text-zinc-400">
              <summary className="cursor-pointer text-violet-400">Preview description</summary>
              <p className="mt-2 max-h-32 overflow-y-auto leading-relaxed text-zinc-500">
                {pageData.jobDescription.slice(0, 1200)}
                {pageData.jobDescription.length > 1200 ? "…" : ""}
              </p>
            </details>
          ) : null}
        </div>
      )}

      <button
        type="button"
        disabled={loading || !pageData}
        onClick={generateQuestions}
        className="w-full rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:pointer-events-none text-white text-sm font-medium py-2.5"
      >
        {loading ? "Generating…" : "Generate Interview Questions"}
      </button>
    </div>
  );
}

function QuestionsScreen() {
  const { questions, startMockForIndex, goDetect, loading } = useSession();
  const [openTip, setOpenTip] = useState({});

  const toggleTip = (i) => {
    setOpenTip((prev) => ({ ...prev, [i]: !prev[i] }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-zinc-50">Questions</h2>
        <button
          type="button"
          onClick={goDetect}
          className="text-xs text-zinc-400 hover:text-zinc-200"
        >
          ← Detect
        </button>
      </div>
      {questions.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-400">
          No questions loaded. Go back to Detect and generate.
        </div>
      ) : (
        <ul className="space-y-3">
          {questions.map((q, i) => (
            <li
              key={i}
              className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-zinc-100 leading-snug flex-1">{q.question}</p>
                <DifficultyBadge difficulty={q.difficulty} />
              </div>
              <div className="text-xs">
                <button
                  type="button"
                  onClick={() => toggleTip(i)}
                  className="text-violet-400 hover:text-violet-300 flex items-center gap-1"
                >
                  <span>{openTip[i] ? "▼" : "▶"}</span>
                  <span>What this tests</span>
                </button>
                {openTip[i] ? (
                  <div className="mt-2 text-zinc-400 leading-relaxed border-l-2 border-zinc-700 pl-2">
                    {q.tests || "—"}
                    {q.tip ? (
                      <p className="mt-2 text-zinc-500">
                        <span className="text-zinc-500 font-medium">Tip: </span>
                        {q.tip}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={() => startMockForIndex(i)}
                className="w-full rounded-lg border border-zinc-600 hover:border-violet-500 hover:bg-violet-950/40 text-sm text-zinc-100 py-2"
              >
                Answer this
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MockScreen() {
  const {
    questions,
    mockIndex,
    userAnswer,
    setUserAnswer,
    getFeedbackForAnswer,
    feedback,
    loading,
    goQuestions,
    setMockIndex,
    setFeedback,
  } = useSession();

  const q = questions[mockIndex];
  const [voiceOn, setVoiceOn] = useState(false);
  const [speechError, setSpeechError] = useState("");
  const [voiceMode, setVoiceMode] = useState(""); // "tab" | "panel"
  const listeningRef = useRef(false);
  const dictationTabIdRef = useRef(null);
  const voiceCommittedRef = useRef("");
  const recognitionRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const panelSessionRef = useRef(() => {});

  const stopVoice = useCallback(async () => {
    listeningRef.current = false;
    const tabId = dictationTabIdRef.current;
    dictationTabIdRef.current = null;

    try {
      recognitionRef.current?.stop?.();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    if (tabId != null && chrome?.scripting) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            window.__icVoiceStop?.();
          },
        });
      } catch (e) {
        console.info("[InterviewCopilot voice] tab stop failed (tab may have closed)", e);
      }
    }

    try {
      await chrome.storage.local.remove(["icVoiceSeed", "icVoiceUpdate"]);
    } catch {
      /* ignore */
    }

    setVoiceMode("");
    setVoiceOn(false);
  }, []);

  const startPanelVoiceSession = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR || !listeningRef.current) return;

    const rec = new SR();
    recognitionRef.current = rec;
    rec.continuous = true;
    rec.interimResults = true;
    const navLang = typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-US";
    rec.lang = /^en/i.test(navLang) ? navLang : "en-US";
    rec.maxAlternatives = 1;

    rec.onstart = () => console.info("[InterviewCopilot voice] panel: onstart");
    rec.onresult = (ev) => {
      let finalPiece = "";
      let interimPiece = "";
      for (let i = ev.resultIndex; i < ev.results.length; i += 1) {
        const row = ev.results[i];
        const t = row[0]?.transcript ?? "";
        if (row.isFinal) finalPiece += t;
        else interimPiece += t;
      }
      finalPiece = finalPiece.trim();
      interimPiece = interimPiece.trim();
      if (finalPiece) {
        const cur = voiceCommittedRef.current;
        voiceCommittedRef.current = cur ? `${cur} ${finalPiece}`.trim() : finalPiece;
      }
      const display = [voiceCommittedRef.current, interimPiece].filter(Boolean).join(" ").trim();
      setUserAnswer(display);
    };

    rec.onerror = (ev) => {
      const code = ev.error || "";
      console.info("[InterviewCopilot voice] panel: onerror", code);
      if (code === "aborted") return;
      if (code === "no-speech") return;
      if (code === "audio-capture") {
        setSpeechError("No microphone found or it is in use.");
        void stopVoice();
        return;
      }
      if (code === "not-allowed") {
        setSpeechError("Microphone blocked. Allow mic for this extension.");
        void stopVoice();
        return;
      }
      if (code === "network") {
        setSpeechError("Speech recognition needs a network connection.");
        void stopVoice();
        return;
      }
      if (code === "service-not-allowed") {
        setSpeechError("Speech recognition blocked in the side panel. Use a normal tab (see hint below).");
        void stopVoice();
        return;
      }
    };

    rec.onend = () => {
      if (!listeningRef.current) {
        setVoiceOn(false);
        return;
      }
      recognitionRef.current = null;
      setTimeout(() => {
        if (listeningRef.current) panelSessionRef.current();
      }, 350);
    };

    try {
      rec.start();
    } catch (e) {
      console.info("[InterviewCopilot voice] panel: start() threw", e);
      setTimeout(() => {
        if (listeningRef.current) panelSessionRef.current();
      }, 200);
    }
  }, [setUserAnswer, stopVoice]);

  useEffect(() => {
    panelSessionRef.current = startPanelVoiceSession;
  }, [startPanelVoiceSession]);

  useEffect(() => {
    const onStorage = (changes, area) => {
      if (area !== "local" || !changes.icVoiceUpdate || !listeningRef.current) return;
      const nv = changes.icVoiceUpdate.newValue;
      if (!nv) return;
      if (nv.text != null) {
        voiceCommittedRef.current = nv.text;
        setUserAnswer((prev) => (prev === nv.text ? prev : nv.text));
      }
      if (nv.error && nv.error !== "no-speech") {
        setSpeechError(nv.message || `Speech: ${nv.error}`);
        if (["not-allowed", "service-not-allowed", "audio-capture", "no-api", "storage"].includes(nv.error)) {
          void stopVoice();
        }
      }
    };
    chrome.storage.onChanged.addListener(onStorage);
    return () => chrome.storage.onChanged.removeListener(onStorage);
  }, [setUserAnswer, stopVoice]);

  const toggleVoice = useCallback(async () => {
    if (listeningRef.current) {
      setSpeechError("");
      await stopVoice();
      return;
    }

    setSpeechError("");
    voiceCommittedRef.current = (userAnswer || "").trim();
    listeningRef.current = true;
    setVoiceOn(true);

    console.info(
      "[InterviewCopilot voice] Starting dictation. If using TAB mode, open DevTools (F12) on that webpage and filter console by InterviewCopilot."
    );

    const canTab =
      typeof chrome !== "undefined" &&
      chrome.tabs?.query &&
      chrome.scripting?.executeScript &&
      chrome.storage?.local;

    if (canTab) {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tab = tabs[0];
        if (tab?.id != null) {
          await chrome.storage.local.remove(["icVoiceSeed", "icVoiceUpdate"]);
          const seed = voiceCommittedRef.current;
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: tabDictationInjector,
            args: [seed],
          });
          dictationTabIdRef.current = tab.id;
          setVoiceMode("tab");
          console.info("[InterviewCopilot voice] Injected into tab", tab.id);
          return;
        }
        console.info("[InterviewCopilot voice] No active tab id; falling back to side panel.");
        setSpeechError(
          "No page tab in this window — speech runs in the active tab. Open LinkedIn (or any site), focus it, then try again. Using side panel fallback…"
        );
      } catch (e) {
        console.info("[InterviewCopilot voice] Tab inject failed; falling back to side panel.", e);
        setSpeechError(`Could not inject into tab (${e?.message || e}). Trying side panel…`);
      }
    }

    setVoiceMode("panel");
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
    } catch {
      /* optional */
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      listeningRef.current = false;
      setVoiceOn(false);
      setSpeechError("Speech recognition API not available.");
      return;
    }

    startPanelVoiceSession();
  }, [stopVoice, startPanelVoiceSession, userAnswer]);

  useEffect(() => {
    return () => {
      listeningRef.current = false;
      dictationTabIdRef.current = null;
      try {
        recognitionRef.current?.stop?.();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    void stopVoice();
  }, [mockIndex, stopVoice]);

  if (!q) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-400">
        No question selected.
        <button type="button" onClick={goQuestions} className="block mt-2 text-violet-400 text-xs">
          Back to questions
        </button>
      </div>
    );
  }

  const canUseTabVoice =
    typeof chrome !== "undefined" && !!(chrome.scripting && chrome.tabs && chrome.storage?.local);
  const canUsePanelVoice =
    typeof window !== "undefined" &&
    window.isSecureContext &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const hasSpeech = canUseTabVoice || canUsePanelVoice;

  const next = () => {
    setFeedback(null);
    setUserAnswer("");
    if (mockIndex < questions.length - 1) setMockIndex(mockIndex + 1);
    else goQuestions();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-zinc-50">Mock interview</h2>
        <button
          type="button"
          onClick={goQuestions}
          className="text-xs text-zinc-400 hover:text-zinc-200"
        >
          ← Questions
        </button>
      </div>
      <p className="text-xs text-zinc-500">
        Question {mockIndex + 1} of {questions.length}
      </p>
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
        <p className="text-sm text-zinc-100 leading-relaxed">{q.question}</p>
      </div>
      <label className="block text-xs text-zinc-400">
        Your answer
        <textarea
          rows={6}
          className="mt-1 w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 resize-y min-h-[100px]"
          value={userAnswer}
          onChange={(e) => {
            const v = e.target.value;
            if (listeningRef.current) voiceCommittedRef.current = v;
            setUserAnswer(v);
          }}
          placeholder="Type your answer, or use voice…"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={toggleVoice}
          disabled={!hasSpeech}
          className="rounded-lg border border-zinc-600 hover:border-violet-500 px-3 py-2 text-xs text-zinc-100 disabled:opacity-40"
        >
          {voiceOn ? "Stop voice" : "Use voice"}
        </button>
        <button
          type="button"
          onClick={getFeedbackForAnswer}
          disabled={loading}
          className="rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-3 py-2 text-xs font-medium text-white"
        >
          {loading ? "…" : "Get Feedback"}
        </button>
      </div>
      {!hasSpeech ? (
        <p className="text-[10px] text-zinc-600">
          Voice needs Chrome with the extension APIs. Install/update Chrome on desktop.
        </p>
      ) : (
        <p className="text-[10px] text-zinc-500 leading-relaxed">
          {voiceOn && voiceMode === "tab"
            ? "Listening via the active browser tab. Open DevTools on that tab (F12 → Console) and filter for “InterviewCopilot” to see logs."
            : voiceOn && voiceMode === "panel"
              ? "Side-panel mode: right-click inside this side panel → Inspect → Console for “InterviewCopilot voice”."
              : "Tip: focus a normal https tab (e.g. LinkedIn) before Use voice — Chrome transcribes there and text appears here."}
        </p>
      )}
      {speechError ? (
        <p className="text-[10px] text-amber-400/90 leading-relaxed" role="alert">
          {speechError}
        </p>
      ) : null}

      {feedback ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-3 space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">Score</span>
            <span className="text-lg font-semibold text-violet-300">
              {feedback.score != null ? `${feedback.score}/10` : "—"}
            </span>
          </div>
          <section>
            <h3 className="text-xs font-semibold text-emerald-400 mb-1">Strengths</h3>
            <p className="text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap">
              {feedback.strengths || "—"}
            </p>
          </section>
          <section>
            <h3 className="text-xs font-semibold text-amber-400 mb-1">Improve</h3>
            <p className="text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap">
              {feedback.improve || "—"}
            </p>
          </section>
          <section>
            <h3 className="text-xs font-semibold text-violet-400 mb-1">Sample answer structure</h3>
            <p className="text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap">
              {feedback.sampleStructure || "—"}
            </p>
          </section>
          <button
            type="button"
            onClick={next}
            className="w-full rounded-lg border border-zinc-600 py-2 text-xs text-zinc-100 hover:bg-zinc-900"
          >
            {mockIndex < questions.length - 1 ? "Next question" : "Back to all questions"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function HistoryScreen() {
  const { historySessions, loadHistory, goDetect, loading } = useSession();

  const formatDate = (d) => {
    try {
      return new Date(d).toLocaleString();
    } catch {
      return String(d || "");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-zinc-50">History</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={loadHistory}
            disabled={loading}
            className="text-xs text-violet-400 hover:text-violet-300 disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={goDetect}
            className="text-xs text-zinc-400 hover:text-zinc-200"
          >
            Detect
          </button>
        </div>
      </div>
      {historySessions.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 text-sm text-zinc-400">
          No sessions yet. Generate questions to create your first session.
        </div>
      ) : (
        <ul className="space-y-2">
          {historySessions.map((s) => (
            <li
              key={s.id}
              className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 flex flex-col gap-1"
            >
              <div className="flex justify-between gap-2">
                <span className="text-sm font-medium text-zinc-100">{s.company}</span>
                <span className="text-xs text-violet-300 shrink-0">
                  {s.score != null ? `${s.score}/10` : "—"}
                </span>
              </div>
              <p className="text-xs text-zinc-400">{s.jobTitle}</p>
              <p className="text-[10px] text-zinc-600">{formatDate(s.date)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SidePanel() {
  const { screen, error, clearError, backendUrl, setBackendUrl } = useSession();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur px-3 py-2 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-zinc-50">InterviewCopilot</h1>
          <p className="text-[10px] text-zinc-500 truncate max-w-[220px]" title={backendUrl}>
            {backendUrl}
          </p>
        </div>
        <button
          type="button"
          aria-label="Settings"
          onClick={() => setSettingsOpen(true)}
          className="p-2 rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:border-zinc-600"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.09a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
          </svg>
        </button>
      </header>

      <nav className="flex gap-1 px-2 py-2 border-b border-zinc-900 bg-zinc-950">
        <TabButton id="detect" label="Detect" active={screen === "detect"} />
        <TabButton id="questions" label="Questions" active={screen === "questions"} />
        <TabButton id="mock" label="Mock" active={screen === "mock"} />
        <TabButton id="history" label="History" active={screen === "history"} />
      </nav>

      <main className="flex-1 p-3 pb-8 space-y-3 overflow-y-auto">
        <ErrorCard message={error?.message} onDismiss={clearError} />
        {screen === "detect" ? <DetectScreen /> : null}
        {screen === "questions" ? <QuestionsScreen /> : null}
        {screen === "mock" ? <MockScreen /> : null}
        {screen === "history" ? <HistoryScreen /> : null}
      </main>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        url={backendUrl}
        onSave={async (v) => {
          await setBackendUrl(v);
          setSettingsOpen(false);
        }}
      />
    </div>
  );
}

function TabButton({ id, label, active }) {
  const { goDetect, goQuestions, setScreen, loadHistory } = useSession();
  const go = () => {
    if (id === "detect") goDetect();
    else if (id === "questions") goQuestions();
    else if (id === "mock") setScreen("mock");
    else if (id === "history") loadHistory();
  };
  return (
    <button
      type="button"
      onClick={go}
      className={`flex-1 rounded-md py-1.5 text-[11px] font-medium transition-colors ${
        active
          ? "bg-zinc-800 text-zinc-50"
          : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
      }`}
    >
      {label}
    </button>
  );
}

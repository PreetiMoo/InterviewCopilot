import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const SessionContext = createContext(null);

const DEFAULT_BACKEND = "http://localhost:5000";
const STORAGE_KEYS = {
  pageData: "lastPageData",
  backendUrl: "backendUrl",
};

async function storageGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, resolve);
  });
}

async function storageSet(obj) {
  return new Promise((resolve) => {
    chrome.storage.local.set(obj, resolve);
  });
}

export function SessionProvider({ children }) {
  const [screen, setScreen] = useState("detect");
  const [pageData, setPageData] = useState(null);
  const [backendUrl, setBackendUrlState] = useState(DEFAULT_BACKEND);
  const [sessionId, setSessionId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [mockIndex, setMockIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [historySessions, setHistorySessions] = useState([]);
  const [manualCompany, setManualCompany] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualDescription, setManualDescription] = useState("");

  const refreshFromStorage = useCallback(async () => {
    const data = await storageGet([STORAGE_KEYS.pageData, STORAGE_KEYS.backendUrl]);
    setPageData(data[STORAGE_KEYS.pageData] || null);
    const url = data[STORAGE_KEYS.backendUrl];
    setBackendUrlState(
      url && String(url).trim() ? String(url).trim().replace(/\/$/, "") : DEFAULT_BACKEND
    );
  }, []);

  useEffect(() => {
    refreshFromStorage();
    const listener = (changes, area) => {
      if (area !== "local") return;
      if (changes[STORAGE_KEYS.pageData]) {
        setPageData(changes[STORAGE_KEYS.pageData].newValue || null);
      }
      if (changes[STORAGE_KEYS.backendUrl]) {
        const v = changes[STORAGE_KEYS.backendUrl].newValue;
        setBackendUrlState(
          v && String(v).trim() ? String(v).trim().replace(/\/$/, "") : DEFAULT_BACKEND
        );
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [refreshFromStorage]);

  useEffect(() => {
    if (!pageData) return;
    if (pageData.manualMode) {
      setManualCompany(pageData.companyName || "");
      setManualTitle(pageData.jobTitle || "");
      setManualDescription(pageData.jobDescription || "");
    }
  }, [pageData]);

  const setBackendUrl = useCallback(async (url) => {
    const trimmed = String(url || "").trim().replace(/\/$/, "") || DEFAULT_BACKEND;
    await storageSet({ [STORAGE_KEYS.backendUrl]: trimmed });
    setBackendUrlState(trimmed);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const effectiveCompany = pageData?.manualMode ? manualCompany : pageData?.companyName || "";
  const effectiveTitle = pageData?.manualMode ? manualTitle : pageData?.jobTitle || "";
  const effectiveCulture =
    pageData?.cultureSignals ||
    (pageData?.reviewSnippets?.length
      ? pageData.reviewSnippets.join("\n")
      : "") ||
    "";

  const effectiveDescription = pageData?.manualMode
    ? manualDescription
    : pageData?.jobDescription || "";

  const generateQuestions = useCallback(async () => {
    setError(null);
    const company = String(effectiveCompany || "").trim();
    const jobTitle = String(effectiveTitle || "").trim();
    const cultureSignals = String(
      effectiveCulture || effectiveDescription.slice(0, 2000) || ""
    ).trim();

    if (!company || !jobTitle) {
      setError({ message: "Company and job title are required." });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/generate-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobTitle, company, cultureSignals }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.hint ? `${data.error}\n${data.hint}` : (data.error || res.statusText);
        throw new Error(msg || "Failed to generate questions");
      }
      if (!data.questions?.length) {
        throw new Error("No questions returned from server.");
      }
      setSessionId(data.sessionId);
      setQuestions(data.questions);
      setScreen("questions");
    } catch (e) {
      setError({ message: e.message || "Network error. Check backend URL and server." });
    } finally {
      setLoading(false);
    }
  }, [backendUrl, effectiveCompany, effectiveCulture, effectiveDescription, effectiveTitle]);

  const startMockForIndex = useCallback((index) => {
    setMockIndex(index);
    setUserAnswer("");
    setFeedback(null);
    setScreen("mock");
  }, []);

  const getFeedbackForAnswer = useCallback(async () => {
    setError(null);
    const q = questions[mockIndex];
    if (!q || !sessionId) {
      setError({ message: "Missing session or question." });
      return;
    }
    const answer = userAnswer.trim();
    if (!answer) {
      setError({ message: "Please write an answer before requesting feedback." });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/get-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          question: q.question,
          answer,
          jobTitle: effectiveTitle,
          company: effectiveCompany,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || res.statusText || "Failed to get feedback");
      }
      setFeedback(data);
    } catch (e) {
      setError({ message: e.message || "Network error." });
    } finally {
      setLoading(false);
    }
  }, [
    backendUrl,
    effectiveCompany,
    effectiveTitle,
    mockIndex,
    questions,
    sessionId,
    userAnswer,
  ]);

  const loadHistory = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/sessions`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || res.statusText || "Failed to load history");
      }
      setHistorySessions(data.sessions || []);
      setScreen("history");
    } catch (e) {
      setError({ message: e.message || "Could not load history." });
    } finally {
      setLoading(false);
    }
  }, [backendUrl]);

  const goDetect = useCallback(() => {
    setScreen("detect");
    setFeedback(null);
    setError(null);
  }, []);

  const goQuestions = useCallback(() => {
    setScreen("questions");
  }, []);

  const value = useMemo(
    () => ({
      screen,
      setScreen,
      pageData,
      refreshFromStorage,
      backendUrl,
      setBackendUrl,
      sessionId,
      questions,
      mockIndex,
      setMockIndex,
      userAnswer,
      setUserAnswer,
      feedback,
      setFeedback,
      loading,
      error,
      clearError,
      historySessions,
      manualCompany,
      setManualCompany,
      manualTitle,
      setManualTitle,
      manualDescription,
      setManualDescription,
      effectiveCompany,
      effectiveTitle,
      effectiveDescription,
      generateQuestions,
      startMockForIndex,
      getFeedbackForAnswer,
      loadHistory,
      goDetect,
      goQuestions,
    }),
    [
      screen,
      setScreen,
      pageData,
      refreshFromStorage,
      backendUrl,
      setBackendUrl,
      sessionId,
      questions,
      mockIndex,
      userAnswer,
      feedback,
      loading,
      error,
      clearError,
      historySessions,
      manualCompany,
      manualTitle,
      manualDescription,
      effectiveCompany,
      effectiveTitle,
      effectiveDescription,
      generateQuestions,
      startMockForIndex,
      getFeedbackForAnswer,
      loadHistory,
      goDetect,
      goQuestions,
    ]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

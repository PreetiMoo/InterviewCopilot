/**
 * Passed to chrome.scripting.executeScript({ func, args }).
 * Must be a plain function (serializable via toString) — no closure over imports.
 */
export function tabDictationInjector(seed) {
  var NS = "[InterviewCopilot voice]";
  function log() {
    var a = [NS];
    for (var i = 0; i < arguments.length; i += 1) a.push(arguments[i]);
    /* eslint-disable no-console */
    console.info.apply(console, a);
  }

  log("injected", window.location.href);

  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    log("SpeechRecognition API missing");
    chrome.storage.local.set({
      icVoiceUpdate: { error: "no-api", message: "Speech API unavailable on this page", ts: Date.now() },
    });
    return;
  }

  if (typeof window.__icVoiceStop === "function") {
    try {
      window.__icVoiceStop();
    } catch (e) {
      log("previous stop failed", e);
    }
  }

  var listening = true;
  var committed = String(seed != null ? seed : "").trim();
  var recognitionRef = null;
  var startVoiceSessionRef = { current: null };

  log("seed length", committed.length);

  var pushUpdate = function (text, error, extra) {
    chrome.storage.local.set({
      icVoiceUpdate: {
        text: text != null ? text : "",
        error: error || null,
        message: extra && extra.message ? extra.message : null,
        ts: Date.now(),
      },
    });
  };

  var startVoiceSession = function () {
    if (!listening) {
      log("startVoiceSession skipped (not listening)");
      return;
    }

    var rec = new SR();
    recognitionRef = rec;
    rec.continuous = true;
    rec.interimResults = true;
    var navLang = typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-US";
    rec.lang = /^en/i.test(navLang) ? navLang : "en-US";
    rec.maxAlternatives = 1;

    rec.onstart = function () {
      log("recognition onstart");
    };
    rec.onaudiostart = function () {
      log("recognition onaudiostart");
    };
    rec.onspeechstart = function () {
      log("recognition onspeechstart");
    };

    rec.onresult = function (ev) {
      var finalPiece = "";
      var interimPiece = "";
      for (var i = ev.resultIndex; i < ev.results.length; i += 1) {
        var row = ev.results[i];
        var t = row[0] && row[0].transcript ? row[0].transcript : "";
        if (row.isFinal) finalPiece += t;
        else interimPiece += t;
      }
      finalPiece = finalPiece.trim();
      interimPiece = interimPiece.trim();
      if (finalPiece) {
        committed = committed ? committed + " " + finalPiece : finalPiece;
        committed = committed.trim();
      }
      var parts = [];
      if (committed) parts.push(committed);
      if (interimPiece) parts.push(interimPiece);
      var display = parts.join(" ").trim();
      log("onresult displayLen=" + display.length);
      pushUpdate(display, null);
    };

    rec.onerror = function (ev) {
      var code = ev.error || "";
      log("onerror " + code);
      if (code === "aborted") return;
      if (code === "no-speech") return;
      pushUpdate(committed, code, { message: "Speech error: " + code });
      if (code === "not-allowed" || code === "service-not-allowed" || code === "audio-capture") {
        listening = false;
      }
    };

    rec.onend = function () {
      log("onend listening=" + listening);
      recognitionRef = null;
      if (!listening) return;
      setTimeout(function () {
        if (listening && startVoiceSessionRef.current) startVoiceSessionRef.current();
      }, 350);
    };

    try {
      rec.start();
      log("rec.start() called");
    } catch (e) {
      log("rec.start() threw", e);
      setTimeout(function () {
        if (listening && startVoiceSessionRef.current) startVoiceSessionRef.current();
      }, 200);
    }
  };

  startVoiceSessionRef.current = startVoiceSession;

  window.__icVoiceStop = function () {
    log("__icVoiceStop");
    listening = false;
    try {
      if (recognitionRef && recognitionRef.stop) recognitionRef.stop();
    } catch (e) {
      log("stop error", e);
    }
    recognitionRef = null;
    try {
      delete window.__icVoiceStop;
    } catch (e2) {
      window.__icVoiceStop = undefined;
    }
    startVoiceSessionRef.current = null;
  };

  startVoiceSession();
}

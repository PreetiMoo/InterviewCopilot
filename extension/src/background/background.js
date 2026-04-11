const PAGE_DATA_KEY = "lastPageData";
const BACKEND_URL_KEY = "backendUrl";
const DEFAULT_BACKEND = "http://localhost:5000";

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get([BACKEND_URL_KEY], (data) => {
    if (data[BACKEND_URL_KEY] == null || data[BACKEND_URL_KEY] === "") {
      chrome.storage.local.set({ [BACKEND_URL_KEY]: DEFAULT_BACKEND });
    }
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "PAGE_DATA" && message.payload) {
    chrome.storage.local.set({ [PAGE_DATA_KEY]: message.payload }, () => {
      sendResponse?.({ ok: true });
    });
    return true;
  }
  if (message?.type === "OPEN_SIDE_PANEL") {
    chrome.windows.getCurrent((win) => {
      if (chrome.runtime.lastError || !win?.id) {
        sendResponse?.({ ok: false, error: chrome.runtime.lastError?.message });
        return;
      }
      chrome.sidePanel.open({ windowId: win.id }).then(
        () => sendResponse?.({ ok: true }),
        (err) => sendResponse?.({ ok: false, error: String(err?.message || err) })
      );
    });
    return true;
  }
  return false;
});

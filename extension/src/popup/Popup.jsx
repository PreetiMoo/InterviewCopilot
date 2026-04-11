export function Popup() {
  const openPanel = () => {
    chrome.runtime.sendMessage({ type: "OPEN_SIDE_PANEL" }, () => {
      if (chrome.runtime.lastError) {
        console.warn(chrome.runtime.lastError.message);
      }
      window.close();
    });
  };

  return (
    <div className="p-4 flex flex-col gap-3 bg-zinc-950 text-zinc-100">
      <h1 className="text-sm font-semibold text-zinc-100">InterviewCopilot</h1>
      <p className="text-xs text-zinc-400 leading-relaxed">
        Open the side panel to detect jobs and practice interviews.
      </p>
      <button
        type="button"
        onClick={openPanel}
        className="rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium py-2.5 px-3 transition-colors"
      >
        Open Panel
      </button>
    </div>
  );
}

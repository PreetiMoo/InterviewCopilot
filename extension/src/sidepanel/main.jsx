import React from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import { SessionProvider } from "../context/SessionContext.jsx";
import { SidePanel } from "./SidePanel.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SessionProvider>
      <SidePanel />
    </SessionProvider>
  </React.StrictMode>
);

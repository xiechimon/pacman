import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./proto/themes.css";
import "@fontsource-variable/inter";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

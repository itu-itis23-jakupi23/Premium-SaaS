import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n";
import { applyDir, readLanguagePreference } from "./i18n";

applyDir(readLanguagePreference());
createRoot(document.getElementById("root")!).render(<App />);

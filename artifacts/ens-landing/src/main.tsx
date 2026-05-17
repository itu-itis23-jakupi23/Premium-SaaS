import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n";
import { applyDir } from "./i18n";

applyDir(localStorage.getItem('ens-lang') ?? navigator.language.split('-')[0] ?? 'en');
createRoot(document.getElementById("root")!).render(<App />);

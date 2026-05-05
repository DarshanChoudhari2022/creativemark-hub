import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// When running inside the Capacitor Android/iOS shell, always boot into the
// field-sales app. This keeps the admin CRM on the web where it belongs and
// makes the APK feel like a focused single-purpose tool.
(async () => {
  try {
    const { Capacitor } = await import("@capacitor/core");
    if (
      Capacitor.isNativePlatform() &&
      !window.location.pathname.startsWith("/field") &&
      !window.location.pathname.startsWith("/login") &&
      !window.location.pathname.startsWith("/reset-password")
    ) {
      window.history.replaceState(null, "", "/field");
    }
  } catch {
    /* not in Capacitor — no-op */
  }
  createRoot(document.getElementById("root")!).render(<App />);
})();

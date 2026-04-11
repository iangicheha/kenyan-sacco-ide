import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const SW_POST_CACHE_FIX = "kenyan-ide-sw-post-cache-fix-v2";

async function prepareServiceWorker(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  // Our public/sw.js is ~20 lines; errors at sw.js:67 are a stale/broken worker (e.g. Workbox caching POST).
  if (localStorage.getItem(SW_POST_CACHE_FIX) !== "done") {
    const regs = await navigator.serviceWorker.getRegistrations();
    let cacheNames: string[] = [];
    if ("caches" in window) {
      cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
    }
    await Promise.all(regs.map((r) => r.unregister()));
    localStorage.setItem(SW_POST_CACHE_FIX, "done");
    if (regs.length > 0 || cacheNames.length > 0) {
      window.location.reload();
      return;
    }
  }

  if (import.meta.env.DEV) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
    return;
  }

  await navigator.serviceWorker
    .register("/sw.js", { scope: "/", updateViaCache: "none" })
    .catch(() => {});
}

void prepareServiceWorker().then(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});

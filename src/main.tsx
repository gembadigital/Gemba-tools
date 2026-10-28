import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Android/Chrome "add to home screen" prompt: keep it for the Kaizen install hint (KaizenInstallHint).
window.addEventListener("beforeinstallprompt", (e: Event) => {
  e.preventDefault();
  (window as any).__gembaInstallPrompt = e;
  window.dispatchEvent(new Event("gemba-installable"));
});

// PWA (Faz 6.3): production only — in development a cached shell would hide code changes.
if ((import.meta as any).env?.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").catch(() => { /* app works without it */ }); });
}

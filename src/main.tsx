import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

const isStandaloneOfflineBundle =
  typeof window !== 'undefined' &&
  (Array.isArray(window.__TILAWA_OFFLINE_QURAN__) || window.location.protocol === 'file:');

if (!isStandaloneOfflineBundle) {
  let refreshing = false;
  const hadController =
    'serviceWorker' in navigator && Boolean(navigator.serviceWorker.controller);
  if ('serviceWorker' in navigator && hadController) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }

  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const checkUpdate = () => {
        registration.update().catch(() => {});
      };
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          checkUpdate();
        }
      });
      window.setInterval(checkUpdate, 30 * 60 * 1000);
    },
  });
}

createRoot(document.getElementById('root')!).render(<App />);

import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Intercept and prevent benign third-party WebRTC/Krisp audio worklet teardown notices from surfacing as fatal errors
if (typeof window !== 'undefined') {
  const isBenignNoiseTeardown = (msg: string) => {
    const lower = (msg || '').toLowerCase();
    return (
      lower.includes('krisp') ||
      lower.includes('wasm_or_worker_not_ready') ||
      lower.includes('error unloading krisp processor') ||
      lower.includes('audio-processor') ||
      lower.includes('audioworklet')
    );
  };

  window.addEventListener('error', (event) => {
    const errorMsg = event?.message || event?.error?.message || String(event?.error || '');
    if (isBenignNoiseTeardown(errorMsg)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      console.info('[AudioProcessor] Handled benign noise cancellation cleanup notice:', errorMsg);
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reasonMsg = event?.reason?.message || String(event?.reason || '');
    if (isBenignNoiseTeardown(reasonMsg)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      console.info('[AudioProcessor] Handled benign noise cancellation promise teardown notice:', reasonMsg);
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);


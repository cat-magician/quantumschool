import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { routerBasename } from './lib/appPaths';
import { AuthProvider } from './lib/AuthContext';
import { AppDialogProvider } from './lib/AppDialogContext';
import App from './App.tsx';
import './index.css';

// После выкладки новой версии старые чанки с сервера пропадают, и открытая
// вкладка, дойдя до ленивого раздела, упала бы белым экраном. Перезагрузка
// подтянет актуальную сборку. Не чаще раза в минуту — без сети иначе ушли бы
// в бесконечные перезагрузки.
const CHUNK_RELOAD_KEY = 'qc:chunk-reload-at';
window.addEventListener('vite:preloadError', (event) => {
  try {
    const last = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  } catch {
    return;
  }
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={routerBasename()}>
      <AuthProvider>
        <AppDialogProvider>
          <App />
        </AppDialogProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);

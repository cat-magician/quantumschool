import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { routerBasename } from './lib/appPaths';
import { AuthProvider } from './lib/AuthContext';
import { AppDialogProvider } from './lib/AppDialogContext';
import App from './App.tsx';
import './index.css';

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

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './app/App';
import { LangProvider } from './i18n';
import './styles.css';

// O estúdio de desenho saiu do site: apaga o que ele deixou salvo neste navegador.
try {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('draw-studio-')) localStorage.removeItem(key);
  }
} catch { /* sem armazenamento: não há o que apagar */ }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <LangProvider>
        <App />
      </LangProvider>
    </BrowserRouter>
  </StrictMode>,
);

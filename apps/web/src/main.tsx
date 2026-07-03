import { ColorSchemeProvider, DisplayPreferencesProvider } from '@evu/kb-ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.js';
import '@evu/kb-ui/theme/tokens.css';
import './styles.css';
import '@evu/kb-ui/theme/components.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Expected #root element to mount EvuKB web app.');
}

createRoot(rootElement).render(
  <StrictMode>
    <ColorSchemeProvider>
      <DisplayPreferencesProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </DisplayPreferencesProvider>
    </ColorSchemeProvider>
  </StrictMode>,
);

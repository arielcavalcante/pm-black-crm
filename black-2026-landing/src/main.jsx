import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { readEntry, clearPersonalQuery } from './domain.js';
import './styles.css';

const entry = readEntry(window.location.search);
clearPersonalQuery(window.location, window.history);
const config = {
  endpoint: import.meta.env.VITE_LEADS_ENDPOINT || '',
  resolveEndpoint: import.meta.env.VITE_RESOLVE_ENDPOINT || '',
  privacyUrl: import.meta.env.VITE_PRIVACY_URL || '',
  appUrl: import.meta.env.VITE_APP_URL || '',
  legalVersion: import.meta.env.VITE_LEGAL_VERSION || '',
  demo:
    import.meta.env.VITE_DEMO === 'true' ||
    (!import.meta.env.VITE_LEADS_ENDPOINT && !import.meta.env.VITE_RESOLVE_ENDPOINT),
};
createRoot(document.getElementById('root')).render(<React.StrictMode><App entry={entry} config={config} /></React.StrictMode>);

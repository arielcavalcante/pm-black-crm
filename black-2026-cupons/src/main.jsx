import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { CATEGORIAS, CUPONS } from './cupons.js';
import { validateCoupons } from './domain.js';
import './styles.css';

if (import.meta.env.DEV) {
	const problems = validateCoupons(CUPONS, CATEGORIAS);
	if (problems.length)
		console.warn(`[cupons.js] Revise a lista:\n- ${problems.join('\n- ')}`);
}

const config = {
	siteUrl: import.meta.env.VITE_SITE_URL || 'https://www.paguemenos.com.br',
	landingUrl: import.meta.env.VITE_LANDING_URL || '',
};
createRoot(document.getElementById('root')).render(
	<React.StrictMode>
		<App config={config} />
	</React.StrictMode>,
);

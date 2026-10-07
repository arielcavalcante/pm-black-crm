// Junta os builds das duas páginas num único site estático para o deploy:
//   /          → índice com links
//   /landing/  → black-2026-landing/dist
//   /cupons/   → black-2026-cupons/dist
// Os dist/ são gerados localmente (npm run build em cada pasta) e versionados.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';

const pages = [
	{ from: 'black-2026-landing/dist', to: 'landing', title: 'Landing de leads' },
	{ from: 'black-2026-cupons/dist', to: 'cupons', title: 'Cupons da Black' },
];

rmSync('site', { recursive: true, force: true });
mkdirSync('site');
for (const page of pages) {
	if (!existsSync(`${page.from}/index.html`))
		throw new Error(`${page.from}/index.html não existe. Rode "npm run build" na pasta.`);
	cpSync(page.from, `site/${page.to}`, { recursive: true });
}

const links = pages
	.map(page => `<li><a href="./${page.to}/">${page.title}</a></li>`)
	.join('\n\t\t\t');
const html = `<!doctype html>
<html lang="pt-BR">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<meta name="robots" content="noindex" />
		<title>Black 2026 · Páginas</title>
		<style>
			body { margin: 0; min-height: 100svh; display: grid; place-items: center; background: #01095c; color: #f7f8ff; font: 16px/1.5 system-ui, sans-serif; }
			main { padding: 24px; }
			h1 { font-size: 22px; margin: 0 0 16px; }
			ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
			a { display: block; padding: 14px 22px; border: 2px solid #ffffff60; border-radius: 999px; color: inherit; text-decoration: none; font-weight: 700; }
			a:hover, a:focus-visible { border-color: #fff; }
		</style>
	</head>
	<body>
		<main>
			<h1>Black 2026 · Páginas em validação</h1>
			<ul>
			${links}
			</ul>
		</main>
	</body>
</html>
`;
const notFound = html.replace('Páginas em validação', 'Página não encontrada');
writeFileSync('site/index.html', html);
writeFileSync('site/404.html', notFound);
console.log(`site/ pronto: ${pages.map(page => `/${page.to}/`).join(', ')}`);

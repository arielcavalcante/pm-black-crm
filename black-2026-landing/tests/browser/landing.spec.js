import { test, expect } from '@playwright/test';

const shared =
	'?token=owner-token&nome=Dona%20do%20Link&email=owner%40example.com&telefone=85999999999&categorias=SAUDE&canal_origem=EMAIL&utm_campaign=black';
const owner = {
	nome: 'Ana Silva',
	email: 'ana@example.com',
	telefone: '85999999999',
	canais_preferidos: ['EMAIL'],
	categorias: ['BELEZA'],
};
const confirmed = {
	ok: true,
	identidade_confirmada: true,
	csrf_token: 'test-csrf',
	ja_inscrito: true,
	canal_origem: 'EMAIL',
	cliente: owner,
};

test.beforeEach(async ({ page }) => {
	await page.route('**/api/resolve', route =>
		route.fulfill({ json: { ok: true, identidade_confirmada: false } }),
	);
});
async function fillGuest(page) {
	await page.getByLabel('Seu nome').fill('Bruno Silva');
	await page.locator('#email').fill('bruno@example.com');
	await page.getByRole('checkbox', { name: 'E-mail', exact: true }).check();
	await page.getByRole('checkbox', { name: 'Beleza', exact: true }).check();
}

test('link compartilhado não mostra nem reaproveita dados do dono em seis larguras', async ({
	page,
}) => {
	for (const width of [320, 375, 390, 768, 1024, 1440]) {
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/' + shared);
		await expect(page.getByLabel('Seu nome')).toHaveValue('');
		await expect(page.locator('#email')).toHaveValue('');
		await expect(page.locator('#telefone')).toHaveValue('');
		await expect(page.getByText('Dona do Link', { exact: false })).toHaveCount(
			0,
		);
		await expect(
			page.getByRole('checkbox', { name: 'Saúde e bem-estar', exact: true }),
		).not.toBeChecked();
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= innerWidth,
			),
		).toBe(true);
	}
	expect(page.url()).not.toContain('email=');
	await expect(
		page.getByRole('checkbox', { name: 'E-mail', exact: true }),
	).toBeChecked();
});

test('rascunho público sobrevive ao refresh sem expor dados em convite', async ({
	page,
}) => {
	await page.goto('/');
	await page.getByRole('checkbox', { name: 'E-mail', exact: true }).check();
	await page.getByLabel('Seu nome').fill('Bruno Silva');
	await page.locator('#email').fill('bruno@example.com');
	await page.getByRole('checkbox', { name: 'Beleza', exact: true }).check();
	await page.reload();
	await expect(page.getByLabel('Seu nome')).toHaveValue('Bruno Silva');
	await expect(page.locator('#email')).toHaveValue('bruno@example.com');
	await page.goto('/?token=owner-token');
	await expect(page.getByLabel('Seu nome')).toHaveValue('');
	await expect(page.locator('#email')).toHaveValue('');
});

test('novo visitante entra na lista sem token do dono e pode editar escolhas', async ({
	page,
}) => {
	let payload;
	await page.route('**/api/leads', async route => {
		payload = route.request().postDataJSON();
		expect(route.request().headers()['x-csrf-token']).toBeUndefined();
		await route.fulfill({ json: { ok: true, preferencias: payload } });
	});
	await page.goto('/' + shared);
	await fillGuest(page);
	await page.getByRole('checkbox', { name: 'SMS', exact: true }).check();
	await page.locator('#telefone').fill('85988888888');
	await page.getByRole('button', { name: 'Garantir meu acesso' }).click();
	await expect(
		page.getByRole('heading', { name: 'Pronto, Bruno! Você está na lista.' }),
	).toBeVisible();
	expect(payload.modo).toBe('PUBLICO');
	expect(payload.origem).toBe('LANDING');
	expect(payload.token).toBeUndefined();
	expect(payload.email).toBe('bruno@example.com');
	expect(payload.canais_preferidos).toEqual(['EMAIL', 'SMS']);
	expect(payload.tracking.utm_campaign).toBe('black');
	expect(await page.locator('.success .button').allTextContents()).toEqual([
		'Ver ofertas no site',
		'Editar escolhas',
	]);
	await page.getByRole('button', { name: 'Editar escolhas' }).click();
	await expect(page.locator('#email')).toHaveValue('bruno@example.com');
});

test('sessão confirmada oculta identificação e salva preferências com CSRF', async ({
	page,
}) => {
	let payload;
	await page.route('**/api/resolve', route =>
		route.fulfill({ json: confirmed }),
	);
	await page.route('**/api/leads', async route => {
		payload = route.request().postDataJSON();
		expect(route.request().headers()['x-csrf-token']).toBe('test-csrf');
		await route.fulfill({
			json: { ok: true, atualizado: true, preferencias: payload },
		});
	});
	await page.goto('/' + shared);
	await expect(page.getByText('Você está identificado, Ana.')).toBeVisible();
	await expect(page.locator('#email')).toHaveCount(0);
	await expect(page.getByText('Dona do Link', { exact: false })).toHaveCount(0);
	await page.screenshot({
		path: 'test-results/identified.png',
		fullPage: true,
	});
	await page.getByRole('button', { name: 'Salvar minhas escolhas' }).click();
	await expect(
		page.getByRole('heading', { name: 'Escolhas atualizadas, Ana!' }),
	).toBeVisible();
	expect(payload.modo).toBe('IDENTIFICADO');
	expect(payload.token).toBe('owner-token');
});

test('não sou eu limpa perfil, interesses e vínculo antes de novo cadastro', async ({
	page,
}) => {
	await page.route('**/api/resolve', route =>
		route.fulfill({ json: confirmed }),
	);
	await page.goto('/' + shared);
	await page
		.getByRole('button', { name: 'Não sou eu · fazer meu cadastro' })
		.click();
	await expect(page.locator('#email')).toHaveValue('');
	await expect(page.getByLabel('Seu nome')).toHaveValue('');
	await expect(
		page.getByRole('checkbox', { name: 'Beleza', exact: true }),
	).not.toBeChecked();
	expect(page.url()).not.toContain('token=');
	await expect(
		page.getByRole('button', { name: 'Garantir meu acesso' }),
	).toBeVisible();
});

test('contato incompleto reaparece ao escolher SMS e pode ser conferido', async ({
	page,
}) => {
	await page.route('**/api/resolve', route =>
		route.fulfill({
			json: { ...confirmed, cliente: { ...owner, telefone: '' } },
		}),
	);
	await page.goto('/?token=mine');
	await expect(page.getByText('Você está identificado, Ana.')).toBeVisible();
	await expect(page.locator('#telefone')).toHaveCount(0);
	await page.getByRole('checkbox', { name: 'SMS', exact: true }).check();
	await page.locator('#telefone').fill('85988888888');
	await expect(page.locator('#telefone')).toHaveValue('85988888888');
	await page.getByRole('button', { name: 'Ocultar dados' }).click();
	await expect(page.locator('#telefone')).toHaveCount(0);
	await page.getByRole('button', { name: 'Conferir meus dados' }).click();
	await expect(page.locator('#email')).toHaveValue('ana@example.com');
});

test('sessão expirada durante envio limpa identificação e permite novo cadastro', async ({
	page,
}) => {
	await page.route('**/api/resolve', route =>
		route.fulfill({ json: confirmed }),
	);
	await page.route('**/api/leads', route =>
		route.fulfill({ status: 401, json: { ok: false } }),
	);
	await page.goto('/?token=mine');
	await page.getByRole('button', { name: 'Salvar minhas escolhas' }).click();
	await expect(
		page.getByText('Sua sessão terminou.', { exact: false }),
	).toBeVisible();
	await expect(page.locator('#email')).toHaveValue('');
	await expect(page.getByRole('heading', { name: /Ana/ })).toHaveCount(0);
	expect(page.url()).not.toContain('token=');
});

test('convite expirado, resposta antiga e erro HTTP oferecem cadastro público', async ({
	page,
}) => {
	for (const response of [
		{ status: 410, json: { ok: false } },
		{ status: 503, json: { ok: false } },
		{ json: { ok: true, cliente: owner } },
	]) {
		await page.route('**/api/resolve', route => route.fulfill(response));
		await page.goto('/' + shared);
		await expect(page.locator('#email')).toHaveValue('');
		await expect(
			page.getByRole('button', { name: 'Garantir meu acesso' }),
		).toBeVisible();
		await expect(
			page.getByText('Você pode participar preenchendo seus dados abaixo.'),
		).toBeVisible();
	}
});

test('dados de visitante não vazam mesmo se API os enviar por engano', async ({
	page,
}) => {
	await page.route('**/api/resolve', route =>
		route.fulfill({
			json: {
				ok: true,
				identidade_confirmada: false,
				ja_inscrito: true,
				cliente: owner,
			},
		}),
	);
	await page.goto('/' + shared);
	await expect(page.locator('#email')).toHaveValue('');
	await expect(
		page.getByText('Você está identificado', { exact: false }),
	).toHaveCount(0);
});

test('qs legado oferece cadastro independente, sem resolver dono do link', async ({
	page,
}) => {
	let resolveCalls = 0;
	await page.route('**/api/resolve', route => {
		resolveCalls++;
		return route.fulfill({ json: confirmed });
	});
	await page.goto('/?qs=encrypted');
	await expect(page.locator('#email')).toHaveValue('');
	expect(resolveCalls).toBe(0);
});

test('validação, canais múltiplos por teclado e seleção de todas as categorias', async ({
	page,
}) => {
	await page.goto('/?canal_origem=EMAIL');
	const whatsapp = page.getByRole('checkbox', {
		name: 'WhatsApp',
		exact: true,
	});
	await whatsapp.focus();
	await page.keyboard.press('Space');
	await expect(whatsapp).toBeChecked();
	await page.getByRole('button', { name: 'Garantir meu acesso' }).click();
	await expect(page.locator('#telefone-error')).toBeVisible();
	await whatsapp.uncheck();
	await expect(page.locator('#telefone-error')).toHaveCount(0);
	await page.getByRole('button', { name: 'Marcar todas' }).click();
	await expect(page.getByText('12 escolhidas', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Desmarcar todas' }).click();
	await expect(
		page.getByText('Nenhuma escolhida', { exact: true }),
	).toBeVisible();
});

test('falha de envio conserva formulário público e chave de idempotência', async ({
	page,
}) => {
	const keys = [];
	await page.route('**/api/leads', route => {
		keys.push(route.request().postDataJSON().idempotency_key);
		return route.fulfill({ status: 503, json: { ok: false } });
	});
	await page.goto('/?canal_origem=EMAIL');
	await fillGuest(page);
	for (let i = 0; i < 2; i++) {
		await page.getByRole('button', { name: 'Garantir meu acesso' }).click();
		await expect(page.getByRole('alert')).toContainText(
			'Não conseguimos salvar',
		);
	}
	expect(keys).toHaveLength(2);
	expect(keys[0]).toBe(keys[1]);
	await expect(page.locator('#email')).toHaveValue('bruno@example.com');
});

import { test, expect } from '@playwright/test';
import { CUPONS } from '../../src/cupons.js';
import { matchCoupons } from '../../src/domain.js';

const escolhas = [
	['DERMO', 'Dermocosméticos'],
	['BELEZA', 'Beleza'],
];
const esperados = matchCoupons(
	escolhas.map(([code]) => code),
	CUPONS,
).map(cupom => cupom.codigo);

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	await page.evaluate(() => localStorage.clear());
	await page.reload();
});

async function chegarNasCategorias(page) {
	await page.getByLabel('Seu nome').fill('Ana Silva');
	await page.getByRole('button', { name: 'Continuar' }).click();
	await expect(page.getByRole('heading', { name: /Oi, Ana!/ })).toBeVisible();
}

test('pede nome e ao menos uma categoria', async ({ page }) => {
	await page.getByRole('button', { name: 'Continuar' }).click();
	await expect(page.getByText('Informe seu nome.')).toBeVisible();
	await expect(page.getByLabel('Seu nome')).toBeFocused();
	await chegarNasCategorias(page);
	await page.getByRole('button', { name: 'Continuar' }).click();
	await expect(page.getByText('Escolha ao menos uma categoria.')).toBeVisible();
	await expect(page.getByRole('checkbox').first()).toBeFocused();
});

test('gera e revela os cupons das categorias escolhidas', async ({
	page,
	context,
}) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await chegarNasCategorias(page);
	for (const [, label] of escolhas)
		await page.getByRole('checkbox', { name: label, exact: true }).check();
	await expect(page.locator('.unlock-meter')).toContainText(
		`${esperados.length} cupons esperando por você`,
	);
	await page.getByRole('button', { name: 'Continuar' }).click();
	// Gasto é opcional: gera sem responder.
	await expect(page.getByText('Quanto você pretende gastar?')).toBeVisible();
	await page.getByRole('button', { name: 'Gerar meus cupons' }).click();
	await expect(page.getByRole('heading', { name: /Só um instante, Ana/ })).toBeVisible();
	await expect(page.getByRole('status')).toContainText('Dermocosméticos e Beleza');
	await expect(
		page.getByRole('heading', {
			name: `Pronto, Ana! Liberamos ${esperados.length} cupons pra você.`,
		}),
	).toBeVisible({ timeout: 8000 });
	const cards = page.locator('.coupon');
	await expect(cards).toHaveCount(esperados.length);
	for (const [index, codigo] of esperados.entries())
		await expect(cards.nth(index).locator('.coupon-code')).toContainText(
			`Código: ${codigo}`,
		);
	// O efeito termina no código real.
	await expect(cards.last().locator('.code-text')).toHaveText(esperados.at(-1), {
		timeout: 6000,
	});
	await page.getByRole('button', { name: `Copiar cupom ${esperados[0]}` }).click();
	await expect(cards.first().getByRole('button')).toContainText('Copiado!');
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
		esperados[0],
	);
	await expect(page.getByRole('link', { name: /Entrar na lista da Black/ })).toHaveAttribute(
		'href',
		'https://example.com/black',
	);
});

test('volta direto aos cupons e permite refazer escolhas', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await chegarNasCategorias(page);
	await page.getByRole('checkbox', { name: 'Beleza', exact: true }).check();
	await page.getByRole('button', { name: 'Continuar' }).click();
	await page.getByRole('radio', { name: 'R$ 100' }).check();
	await page.getByRole('button', { name: 'Gerar meus cupons' }).click();
	await expect(page.locator('.coupon')).not.toHaveCount(0, { timeout: 4000 });
	await page.reload();
	await expect(page.getByRole('heading', { name: /Pronto, Ana!/ })).toBeVisible();
	await page.getByRole('button', { name: 'Refazer escolhas' }).click();
	await expect(page.getByRole('checkbox', { name: 'Beleza', exact: true })).toBeChecked();
	await page.getByRole('button', { name: 'Continuar' }).click();
	await expect(page.getByRole('radio', { name: 'R$ 100' })).toBeChecked();
});

test('separa os cupons que pedem um pedido maior que o valor informado', async ({
	page,
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await chegarNasCategorias(page);
	await page.getByRole('checkbox', { name: 'Farmacinha', exact: true }).check();
	await page.getByRole('checkbox', { name: 'Beleza', exact: true }).check();
	await page.getByRole('button', { name: 'Continuar' }).click();
	const todos = matchCoupons(['FARMACINHA', 'BELEZA'], CUPONS);
	const cabem = todos.filter(cupom => !(cupom.minimo > 50));
	await page.getByRole('radio', { name: 'R$ 50' }).check();
	await expect(page.locator('.unlock-meter')).toContainText(
		`${cabem.length} de ${todos.length}`,
	);
	await page.getByRole('button', { name: 'Gerar meus cupons' }).click();
	await expect(page.getByRole('heading', { name: /Pronto, Ana!/ })).toBeVisible({
		timeout: 4000,
	});
	await expect(page.locator('.coupons').first().locator('.coupon')).toHaveCount(
		cabem.length,
	);
	const bonus = page.locator('.bonus-coupons');
	await expect(bonus.locator('.coupon')).toHaveCount(todos.length - cabem.length);
	await expect(bonus).toContainText('Pedido mínimo de R$ 99');
	await expect(bonus).toContainText('EXEMPLO-FARMA15');
});

test('sem rolagem horizontal de 320 a 1440px', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await chegarNasCategorias(page);
	await page.getByRole('button', { name: 'Marcar todas' }).click();
	await page.getByRole('button', { name: 'Continuar' }).click();
	await page.getByRole('radio', { name: 'R$ 50' }).check();
	await page.getByRole('button', { name: 'Gerar meus cupons' }).click();
	await expect(page.locator('.coupon')).toHaveCount(CUPONS.length, { timeout: 4000 });
	for (const width of [320, 375, 390, 768, 1024, 1440]) {
		await page.setViewportSize({ width, height: 900 });
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
		).toBe(true);
	}
});

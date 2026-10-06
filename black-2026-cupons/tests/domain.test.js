import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIAS, CUPONS } from '../src/cupons.js';
import {
	availableCategories,
	budgetLabel,
	budgetLimit,
	firstName,
	formatMoney,
	GASTO_NAO_SEI,
	splitByBudget,
	validBudget,
	formatDiscount,
	matchCoupons,
	scramble,
	summarizeLabels,
	validateCoupons,
	validateName,
	validCategories,
} from '../src/domain.js';

const categorias = [
	['DERMO', 'Dermocosméticos'],
	['BELEZA', 'Beleza'],
	['SAUDE', 'Saúde e bem-estar'],
	['ALIMENTOS', 'Alimentos'],
];
const cupons = [
	{ codigo: 'A', desconto: 10, tipo: '%', categorias: ['DERMO'] },
	{ codigo: 'GERAL', tipo: 'FRETE', categorias: ['TODAS'] },
	{ codigo: 'B', desconto: 15, tipo: 'R$', categorias: ['BELEZA', 'DERMO'] },
	{ codigo: 'C', desconto: 5, tipo: '%', categorias: ['SAUDE'] },
];

test('a lista de cupons em src/cupons.js é válida', () => {
	assert.deepEqual(validateCoupons(CUPONS, CATEGORIAS), []);
	assert.ok(availableCategories(CATEGORIAS, CUPONS).length > 0);
});

test('só oferece categorias que têm cupom, na ordem da lista', () => {
	assert.deepEqual(
		availableCategories(categorias, cupons).map(([code]) => code),
		['DERMO', 'BELEZA', 'SAUDE'],
	);
});

test('cupons mais aderentes primeiro e cupom geral por último', () => {
	assert.deepEqual(
		matchCoupons(['DERMO', 'BELEZA'], cupons).map(c => c.codigo),
		['B', 'A', 'GERAL'],
	);
	assert.deepEqual(
		matchCoupons(['SAUDE'], cupons).map(c => c.codigo),
		['C', 'GERAL'],
	);
	assert.deepEqual(matchCoupons([], cupons), []);
	assert.deepEqual(matchCoupons(['DERMO'], cupons)[0].matched, ['DERMO']);
});

test('formata percentual, reais e frete', () => {
	assert.equal(formatDiscount({ desconto: 15, tipo: '%' }).texto, '15% de desconto');
	assert.equal(formatDiscount({ desconto: 1500, tipo: 'R$' }).texto, 'R$ 1.500 de desconto');
	assert.equal(formatDiscount({ tipo: 'FRETE' }).texto, 'Frete grátis');
});

test('embaralha sem mudar tamanho nem separadores e termina no código real', () => {
	const code = 'BLACK-DERMO 15';
	const mixed = scramble(code, 0, () => 0);
	assert.equal(mixed.length, code.length);
	assert.equal(mixed[5], '-');
	assert.equal(mixed[11], ' ');
	assert.equal(scramble(code, 1), code);
	assert.equal(scramble(code, 0.5, () => 0).slice(0, 7), code.slice(0, 7));
});

test('aponta problemas comuns na lista', () => {
	const problems = validateCoupons(
		[
			{ codigo: 'X', desconto: 10, tipo: '%', categorias: ['NAOEXISTE'] },
			{ codigo: 'x', desconto: 0, tipo: 'reais', categorias: [] },
			{ codigo: '', desconto: 120, tipo: '%', categorias: ['DERMO'] },
		],
		categorias,
	);
	assert.equal(problems.length, 7);
	assert.match(problems.join('\n'), /desconhecida "NAOEXISTE"/);
	assert.match(problems.join('\n'), /repetido/);
});

test('nome, primeiro nome, categorias salvas e resumo de rótulos', () => {
	assert.equal(validateName(' A '), 'Informe seu nome.');
	assert.equal(validateName('Ana'), '');
	assert.equal(firstName('  Ana   Maria '), 'Ana');
	assert.deepEqual(validCategories(['DERMO', 'X', 'DERMO'], categorias), ['DERMO']);
	assert.equal(summarizeLabels(['A']), 'A');
	assert.equal(summarizeLabels(['A', 'B']), 'A e B');
	assert.equal(summarizeLabels(['A', 'B', 'C']), 'A, B e C');
	assert.equal(summarizeLabels(['A', 'B', 'C', 'D']), 'A, B e mais 2');
});

test('valor que pretende gastar separa cupons por pedido mínimo', () => {
	const faixas = [50, 100, 150, 200];
	const lista = [
		{ codigo: 'SEM' },
		{ codigo: 'M149', minimo: 149 },
		{ codigo: 'M99', minimo: 99 },
		{ codigo: 'M100', minimo: 100 },
	];
	assert.equal(budgetLimit('', faixas), null);
	assert.equal(budgetLimit(GASTO_NAO_SEI, faixas), null);
	assert.equal(budgetLimit(100, faixas), 100);
	assert.equal(budgetLimit(200, faixas), Infinity);
	assert.equal(budgetLabel(200, faixas), 'R$ 200 ou mais');
	assert.equal(budgetLabel(GASTO_NAO_SEI, faixas), 'Ainda não sei');
	assert.equal(validBudget(75, faixas), '');
	assert.equal(validBudget(GASTO_NAO_SEI, faixas), GASTO_NAO_SEI);
	const { usaveis, maiores } = splitByBudget(lista, 100);
	assert.deepEqual(usaveis.map(c => c.codigo), ['SEM', 'M99', 'M100']);
	assert.deepEqual(maiores.map(c => c.codigo), ['M149']);
	assert.equal(splitByBudget(lista, null).maiores.length, 0);
	assert.equal(splitByBudget(lista, Infinity).maiores.length, 0);
	assert.equal(formatMoney(99.9), 'R$ 99,90');
	assert.match(validateCoupons([{ codigo: 'X', desconto: 5, tipo: '%', categorias: ['DERMO'], minimo: '99' }], categorias)[0], /mínimo/);
});

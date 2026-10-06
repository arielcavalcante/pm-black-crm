export const TODAS = 'TODAS';
export const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TIPOS = ['%', 'R$', 'FRETE'];

export function validateName(nome) {
	return typeof nome === 'string' && nome.trim().length >= 2
		? ''
		: 'Informe seu nome.';
}

export function firstName(nome) {
	return typeof nome === 'string' ? nome.trim().split(/\s+/)[0] || '' : '';
}

/** Categories that have at least one coupon, in the order of the list. */
export function availableCategories(categorias, cupons) {
	const used = new Set(cupons.flatMap(cupom => cupom.categorias));
	return categorias.filter(([code]) => used.has(code));
}

export function validCategories(values, categorias) {
	const codes = new Set(categorias.map(([code]) => code));
	return [
		...new Set(
			(Array.isArray(values) ? values : []).filter(value => codes.has(value)),
		),
	];
}

/**
 * Coupons that match the selected categories. Specific coupons first (the ones
 * covering more of the chosen categories), general (TODAS) ones last, ties
 * keep the order of the list.
 */
export function matchCoupons(selected, cupons) {
	const chosen = new Set(selected);
	if (!chosen.size) return [];
	return cupons
		.map((cupom, index) => {
			const geral = cupom.categorias.includes(TODAS);
			return {
				...cupom,
				geral,
				index,
				matched: geral ? [] : cupom.categorias.filter(code => chosen.has(code)),
			};
		})
		.filter(cupom => cupom.geral || cupom.matched.length)
		.sort(
			(a, b) =>
				a.geral - b.geral ||
				b.matched.length - a.matched.length ||
				a.index - b.index,
		);
}

export function formatDiscount(cupom) {
	if (cupom.tipo === 'FRETE')
		return {
			principal: 'Frete',
			unidade: '',
			antes: false,
			rotulo: 'GRÁTIS',
			texto: 'Frete grátis',
		};
	const valor = Number(cupom.desconto).toLocaleString('pt-BR');
	if (cupom.tipo === 'R$')
		return {
			principal: valor,
			unidade: 'R$',
			antes: true,
			rotulo: 'OFF',
			texto: `R$ ${valor} de desconto`,
		};
	return {
		principal: valor,
		unidade: '%',
		antes: false,
		rotulo: 'OFF',
		texto: `${valor}% de desconto`,
	};
}

export const GASTO_NAO_SEI = 'NAO_SEI';

export function formatMoney(value) {
	const number = Number(value);
	return `R$ ${number.toLocaleString('pt-BR', {
		minimumFractionDigits: Number.isInteger(number) ? 0 : 2,
		maximumFractionDigits: 2,
	})}`;
}

/** Saved/typed answer → '' (sem resposta), GASTO_NAO_SEI or one of the options. */
export function validBudget(value, faixas) {
	if (value === GASTO_NAO_SEI) return value;
	return faixas.includes(value) ? value : '';
}

/** Highest order minimum the person can use, or null when unknown. */
export function budgetLimit(gasto, faixas) {
	if (!faixas.includes(gasto)) return null;
	return gasto === faixas.at(-1) ? Infinity : gasto;
}

export function budgetLabel(gasto, faixas) {
	if (!faixas.includes(gasto)) return 'Ainda não sei';
	return gasto === faixas.at(-1)
		? `${formatMoney(gasto)} ou mais`
		: formatMoney(gasto);
}

/**
 * Coupons the order can already use (no minimum or minimum within the limit),
 * and the ones that need a bigger order, cheapest minimum first.
 */
export function splitByBudget(cupons, limit) {
	if (limit === null || limit === undefined)
		return { usaveis: cupons, maiores: [] };
	const fits = cupom => !(cupom.minimo > limit);
	return {
		usaveis: cupons.filter(fits),
		maiores: cupons
			.filter(cupom => !fits(cupom))
			.sort((a, b) => a.minimo - b.minimo),
	};
}

/** "A", "A e B", "A, B e C", "A, B e mais 2" (max = 2). */
export function summarizeLabels(labels, max = 2) {
	if (labels.length <= 1) return labels[0] || '';
	if (labels.length <= max + 1)
		return `${labels.slice(0, -1).join(', ')} e ${labels.at(-1)}`;
	const rest = labels.length - max;
	return `${labels.slice(0, max).join(', ')} e mais ${rest}`;
}

export function randomCode(length, random = Math.random) {
	return Array.from(
		{ length },
		() => CODE_CHARS[Math.floor(random() * CODE_CHARS.length)],
	).join('');
}

/**
 * Slot-machine effect: the first `progress` share of the code is final, the
 * rest is random. Separators (-, space…) never change, so width is stable.
 */
export function scramble(code, progress, random = Math.random) {
	const settled = Math.floor(Math.max(0, Math.min(1, progress)) * code.length);
	return [...code]
		.map((char, index) =>
			index < settled || !/[a-z0-9]/i.test(char)
				? char
				: CODE_CHARS[Math.floor(random() * CODE_CHARS.length)],
		)
		.join('');
}

/** Sanity check of the editable list; returns human readable problems. */
export function validateCoupons(cupons, categorias) {
	const problems = [];
	const codes = new Set(categorias.map(([code]) => code));
	const seen = new Set();
	cupons.forEach((cupom, index) => {
		const name = cupom?.codigo || `#${index + 1}`;
		if (typeof cupom?.codigo !== 'string' || !cupom.codigo.trim())
			problems.push(`Cupom ${name}: código vazio.`);
		else if (seen.has(cupom.codigo.trim().toUpperCase()))
			problems.push(`Cupom ${name}: código repetido.`);
		else seen.add(cupom.codigo.trim().toUpperCase());
		if (!TIPOS.includes(cupom?.tipo))
			problems.push(`Cupom ${name}: tipo deve ser '%', 'R$' ou 'FRETE'.`);
		if (
			cupom?.tipo !== 'FRETE' &&
			!(Number.isFinite(cupom?.desconto) && cupom.desconto > 0)
		)
			problems.push(`Cupom ${name}: desconto deve ser um número maior que 0.`);
		if (cupom?.tipo === '%' && cupom.desconto >= 100)
			problems.push(`Cupom ${name}: desconto percentual acima de 99%.`);
		if (
			cupom?.minimo !== undefined &&
			!(Number.isFinite(cupom.minimo) && cupom.minimo >= 0)
		)
			problems.push(`Cupom ${name}: mínimo deve ser um número (ex.: 99).`);
		if (!Array.isArray(cupom?.categorias) || !cupom.categorias.length)
			problems.push(`Cupom ${name}: sem categorias.`);
		else
			cupom.categorias
				.filter(code => code !== TODAS && !codes.has(code))
				.forEach(code =>
					problems.push(`Cupom ${name}: categoria desconhecida "${code}".`),
				);
	});
	return problems;
}

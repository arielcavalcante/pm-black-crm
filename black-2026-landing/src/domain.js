export const CHANNELS = {
	EMAIL: 'E-mail',
	WHATSAPP: 'WhatsApp',
	SMS: 'SMS',
	PUSH: 'App',
};
export const CATEGORIES = [
	['DERMO', 'Dermocosméticos'],
	['BELEZA', 'Beleza'],
	['HIGIENE', 'Higiene'],
	['INFANTIL', 'Mundo infantil'],
	['EMAGRECEDORES', 'Emagrecedores'],
	['FARMACINHA', 'Farmacinha'],
	['CUPOM', 'Cupom'],
	['VITAMINAS', 'Vitaminas e suplementos'],
	['SAUDE', 'Saúde e bem-estar'],
	['SERVICOS', 'Serviços de saúde'],
	['INCONTINENCIA', 'Incontinência'],
	['ALIMENTOS', 'Alimentos'],
];
const categoryCodes = new Set(CATEGORIES.map(([code]) => code));
const clean = (value, max) =>
	typeof value === 'string' ? value.trim().slice(0, max) : '';
export const validChannel = value => {
	const code = clean(value, 20).toUpperCase();
	return Object.hasOwn(CHANNELS, code) ? code : '';
};
export function validChannels(values) {
	return [
		...new Set(
			(Array.isArray(values) ? values : []).map(validChannel).filter(Boolean),
		),
	];
}
export function validCategories(values) {
	return [
		...new Set(
			(Array.isArray(values) ? values : []).filter(v => categoryCodes.has(v)),
		),
	];
}
export function normalizePhone(value) {
	let digits = clean(value, 40).replace(/\D/g, '');
	if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55'))
		digits = digits.slice(2);
	return digits;
}
export function normalizeProfile(data = {}) {
	return {
		nome: clean(data.nome, 100),
		email: clean(data.email, 254),
		telefone: normalizePhone(data.telefone),
		canais_preferidos: validChannels(
			Array.isArray(data.canais_preferidos)
				? data.canais_preferidos
				: [data.canal_preferido],
		),
		categorias: validCategories(data.categorias),
	};
}
export function requiresEmail(values) {
	const channels = validChannels(values);
	return channels.length === 1 && channels[0] === 'PUSH';
}
export function readEntry(search) {
	const params = new URLSearchParams(search);
	const medium = clean(params.get('utm_medium'), 30).toLowerCase();
	const originChannel =
		validChannel(params.get('canal_origem')) ||
		validChannel(medium === 'e-mail' ? 'EMAIL' : medium) ||
		'';
	// A forwarded URL is not proof of identity. Never read its owner's profile.
	const profile = normalizeProfile({
		canais_preferidos: [originChannel],
	});
	return {
		profile,
		originChannel,
		token: clean(params.get('token'), 4096),
		hasCloudPagesQuery: params.has('qs'),
		tracking: Object.fromEntries(
			['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']
				.map(key => [key, clean(params.get(key), 200)])
				.filter(([, value]) => value),
		),
	};
}
export function clearPersonalQuery(location, history) {
	const url = new URL(location.href);
	[
		'nome',
		'first_name',
		'email',
		'telefone',
		'phone',
		'canal',
		'canal_preferido',
		'canais',
		'canais_preferidos',
		'categorias',
		'id_pessoa',
		'subscriberkey',
	].forEach(key => url.searchParams.delete(key));
	history.replaceState(history.state, '', url.pathname + url.search + url.hash);
}
export function validateProfile(profile) {
	const errors = {};
	const channels = validChannels(profile.canais_preferidos);
	if (!channels.length)
		errors.canais_preferidos =
			'Escolha ao menos um canal para receber as ofertas.';
	if (profile.nome.trim().length < 2) errors.nome = 'Informe seu nome.';
	if (
		(requiresEmail(channels) || profile.email.trim()) &&
		!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim())
	)
		errors.email = 'Informe um e-mail válido.';
	const phone = normalizePhone(profile.telefone);
	const needsPhone = channels.some(channel =>
		['SMS', 'WHATSAPP'].includes(channel),
	);
	if ((needsPhone || phone) && !/^[1-9]\d{9,10}$/.test(phone))
		errors.telefone = 'Informe o telefone com DDD (10 ou 11 dígitos).';
	if (!validCategories(profile.categorias).length)
		errors.categorias = 'Escolha ao menos uma categoria.';
	return errors;
}

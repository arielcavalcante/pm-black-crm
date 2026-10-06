import { normalizeProfile, validateProfile, validChannel } from './domain.js';

export class ApiError extends Error {
	constructor(message, invalidLink = false, status = 0) {
		super(message);
		this.invalidLink = invalidLink;
		this.status = status;
	}
}
async function post(
	endpoint,
	body,
	signal,
	{ credentials = 'omit', csrfToken } = {},
) {
	let response;
	try {
		response = await fetch(endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
				...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
			},
			body: JSON.stringify(body),
			credentials,
			cache: 'no-store',
			signal: signal
				? AbortSignal.any([signal, AbortSignal.timeout(15000)])
				: AbortSignal.timeout(15000),
		});
	} catch (error) {
		if (signal?.aborted) throw error;
		throw new ApiError(
			'Não foi possível conectar. Confira sua conexão e tente novamente.',
		);
	}
	if ([401, 403, 410].includes(response.status))
		throw new ApiError(
			'Esse link não está mais válido.',
			true,
			response.status,
		);
	if (!response.ok)
		throw new ApiError(
			response.status === 429
				? 'Muitas tentativas. Aguarde um momento e tente novamente.'
				: 'Não conseguimos salvar agora. Suas escolhas continuam aqui; tente novamente.',
			false,
			response.status,
		);
	try {
		return await response.json();
	} catch {
		throw new ApiError(
			'Não recebemos uma confirmação válida. Tente novamente.',
		);
	}
}
export async function resolveInvite(endpoint, token, signal) {
	if (!endpoint)
		throw new ApiError(
			'O carregamento do convite ainda não está disponível. Tente novamente mais tarde.',
		);
	const data = await post(endpoint, { token: token || undefined }, signal, {
		credentials: 'include',
	});
	if (
		!data ||
		data.ok !== true ||
		typeof data.identidade_confirmada !== 'boolean'
	)
		throw new ApiError('Não foi possível carregar os dados do convite.');
	const originChannel = validChannel(data.canal_origem);
	// Discard profile data even if a misconfigured API returns it to a guest.
	if (!data.identidade_confirmada)
		return {
			confirmed: false,
			profile: normalizeProfile({ canais_preferidos: [originChannel] }),
			jaInscrito: false,
			originChannel,
			csrfToken: '',
		};
	if (
		!data.cliente ||
		typeof data.cliente !== 'object' ||
		Array.isArray(data.cliente) ||
		typeof data.csrf_token !== 'string' ||
		!data.csrf_token.trim() ||
		data.csrf_token.length > 4096
	)
		throw new ApiError('Não foi possível confirmar sua sessão.');
	return {
		confirmed: true,
		profile: normalizeProfile(data.cliente),
		jaInscrito: data.ja_inscrito === true,
		originChannel,
		csrfToken: data.csrf_token,
	};
}
export async function saveLead(config, payload, identity = {}) {
	if (config.demo)
		return { profile: normalizeProfile(payload), updated: false, demo: true };
	if (!config.endpoint || !config.legalVersion || !config.privacyUrl)
		throw new ApiError(
			'Os cadastros ainda não estão disponíveis. Por favor, tente novamente mais tarde.',
		);
	const confirmed = identity.confirmed === true && Boolean(identity.csrfToken);
	const body = {
		...normalizeProfile(payload),
		campanha: payload.campanha,
		versao_texto_legal: payload.versao_texto_legal,
		modo: confirmed ? 'IDENTIFICADO' : 'PUBLICO',
		origem: confirmed ? 'SESSAO' : 'LANDING',
		canal_origem: validChannel(payload.canal_origem) || undefined,
		marcas_produtos: payload.marcas_produtos,
		tracking: payload.tracking,
		idempotency_key: payload.idempotency_key,
		...(confirmed && payload.token ? { token: payload.token } : {}),
	};
	const data = await post(
		config.endpoint,
		body,
		undefined,
		confirmed
			? { credentials: 'include', csrfToken: identity.csrfToken }
			: { credentials: 'omit' },
	);
	if (
		!data ||
		data.ok !== true ||
		!data.preferencias ||
		typeof data.preferencias !== 'object' ||
		Array.isArray(data.preferencias)
	)
		throw new ApiError(
			'Não recebemos a confirmação das suas escolhas. Tente novamente.',
		);
	const profile = normalizeProfile(data.preferencias);
	if (Object.keys(validateProfile(profile)).length)
		throw new ApiError(
			'Não recebemos a confirmação das suas escolhas. Tente novamente.',
		);
	return { profile, updated: data.atualizado === true, demo: false };
}

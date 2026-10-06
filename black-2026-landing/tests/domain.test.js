import test from 'node:test';
import assert from 'node:assert/strict';
import {
	readEntry,
	normalizePhone,
	normalizeProfile,
	validateProfile,
	clearPersonalQuery,
} from '../src/domain.js';
import { saveLead, resolveInvite } from '../src/api.js';

const profile = {
	nome: 'Ana Silva',
	email: 'ana@example.com',
	telefone: '85999999999',
	canais_preferidos: ['EMAIL'],
	categorias: ['DERMO'],
};
test('URL compartilhada não fornece perfil nem interesses do dono', () => {
	const entry = readEntry(
		'?nome=Jo%C3%A3o&email=ana%2Bblack%40example.com&telefone=%2B5585999999999&canal=WHATSAPP&categorias=DERMO,BELEZA&utm_campaign=black&canal_origem=EMAIL',
	);
	assert.deepEqual(entry.profile, {
		nome: '',
		email: '',
		telefone: '',
		canais_preferidos: ['EMAIL'],
		categorias: [],
	});
	assert.equal(entry.tracking.utm_campaign, 'black');
});
test('não usa identificador aberto ou parâmetros desconhecidos como identidade', () => {
	const entry = readEntry('?id_pessoa=123&canal=__proto__&utm_admin=true');
	assert.equal(entry.token, '');
	assert.deepEqual(entry.profile.canais_preferidos, []);
	assert.equal(entry.profile.id_pessoa, undefined);
	assert.deepEqual(entry.tracking, {});
});
test('distingue token de qs criptografado', () => {
	assert.equal(readEntry('?token=opaque').token, 'opaque');
	assert.equal(readEntry('?qs=encrypted').hasCloudPagesQuery, true);
});
test('limpa dados pessoais da barra de endereço e mantém UTMs e token para recarregar', () => {
	let result;
	clearPersonalQuery(
		{
			href: 'https://example.com/?nome=Ana&email=a%40b.com&categorias=SAUDE&token=abc&utm_source=email#conteudo',
		},
		{
			state: null,
			replaceState: (_, __, url) => {
				result = url;
			},
		},
	);
	assert.equal(result, '/?token=abc&utm_source=email#conteudo');
});
test('exige telefone somente para WhatsApp/SMS e valida opcionais preenchidos', () => {
	assert.deepEqual(validateProfile({ ...profile, telefone: '' }), {});
	assert.ok(
		validateProfile({
			...profile,
			telefone: '',
			canais_preferidos: ['EMAIL', 'WHATSAPP'],
		}).telefone,
	);
	assert.ok(validateProfile({ ...profile, telefone: '123' }).telefone);
	assert.equal(normalizePhone('+55 (85) 99999-9999'), '85999999999');
	assert.equal(normalizePhone('55999999999'), '55999999999');
});
test('rejeita campos vazios e categorias desconhecidas', () => {
	assert.equal(
		Object.keys(
			validateProfile({
				nome: '',
				email: '',
				telefone: '',
				canais_preferidos: [],
				categorias: ['INVALIDA'],
			}),
		).length,
		3,
	);
	assert.equal(
		validateProfile({
			nome: 'Ana Silva',
			email: '',
			telefone: '',
			canais_preferidos: ['EMAIL'],
			categorias: ['BELEZA'],
		}).email,
		undefined,
	);
	assert.ok(
		validateProfile({
			nome: 'Ana Silva',
			email: '',
			telefone: '',
			canais_preferidos: ['PUSH'],
			categorias: ['BELEZA'],
		}).email,
	);
});
test('não simula confirmação de produção sem integração', async () => {
	await assert.rejects(
		saveLead({ demo: false, endpoint: '' }, profile),
		/ainda não estão disponíveis/,
	);
	assert.equal((await saveLead({ demo: true }, profile)).demo, true);
});
test('exibe confirmação somente com resposta válida e usa as preferências retornadas', async t => {
	const config = {
		endpoint: '/api/leads',
		privacyUrl: 'https://example.com/privacy',
		legalVersion: 'v1',
	};
	t.mock.method(
		globalThis,
		'fetch',
		async () =>
			new Response(
				JSON.stringify({
					ok: true,
					preferencias: { ...profile, categorias: ['BELEZA'] },
				}),
			),
	);
	assert.deepEqual((await saveLead(config, profile)).profile.categorias, [
		'BELEZA',
	]);
	globalThis.fetch.mock.mockImplementation(
		async () => new Response(JSON.stringify({ ok: true })),
	);
	await assert.rejects(saveLead(config, profile), /confirmação/);
	globalThis.fetch.mock.mockImplementation(async () => new Response('null'));
	await assert.rejects(saveLead(config, profile), /confirmação/);
	globalThis.fetch.mock.mockImplementation(
		async () => new Response('', { status: 503 }),
	);
	await assert.rejects(saveLead(config, profile), /salvar agora/);
});
test('API sinaliza convite expirado para o componente oferecer cadastro independente', async t => {
	t.mock.method(
		globalThis,
		'fetch',
		async () => new Response('', { status: 410 }),
	);
	await assert.rejects(
		resolveInvite('/api/resolve', 'expired'),
		error => error.invalidLink === true,
	);
});

test('origem sugere canal, mas preferências do link não são herdadas', () => {
	const entry = readEntry('?email=ana%40example.com&canal_origem=EMAIL');
	assert.equal(entry.profile.email, '');
	assert.deepEqual(entry.profile.canais_preferidos, ['EMAIL']);
	assert.deepEqual(readEntry('?utm_medium=email').profile.canais_preferidos, [
		'EMAIL',
	]);
	assert.deepEqual(
		readEntry('?utm_medium=__proto__').profile.canais_preferidos,
		[],
	);
	assert.deepEqual(
		readEntry('?canal_origem=EMAIL&canais=WHATSAPP,SMS').profile
			.canais_preferidos,
		['EMAIL'],
	);
	assert.deepEqual(readEntry('').profile.canais_preferidos, []);
});
test('compatibilidade singular de entrada, saída somente em lista', () => {
	const legacy = normalizeProfile({
		...profile,
		canais_preferidos: undefined,
		canal_preferido: 'WHATSAPP',
	});
	assert.deepEqual(legacy.canais_preferidos, ['WHATSAPP']);
	assert.equal(legacy.canal_preferido, undefined);
	assert.deepEqual(
		normalizeProfile({
			...profile,
			canais_preferidos: [],
			canal_preferido: 'EMAIL',
		}).canais_preferidos,
		[],
	);
});

test('resolver ignora perfil sem identidade confirmada e envia cookie somente ao servidor', async t => {
	let request;
	t.mock.method(globalThis, 'fetch', async (_, init) => {
		request = init;
		return new Response(
			JSON.stringify({
				ok: true,
				identidade_confirmada: false,
				cliente: profile,
				canal_origem: 'EMAIL',
				ja_inscrito: true,
			}),
		);
	});
	const result = await resolveInvite('/api/resolve', 'forwarded');
	assert.equal(result.confirmed, false);
	assert.equal(result.profile.email, '');
	assert.equal(result.jaInscrito, false);
	assert.deepEqual(result.profile.categorias, []);
	assert.equal(request.credentials, 'include');
});
test('resposta antiga ou confirmação sem CSRF não libera perfil', async t => {
	t.mock.method(
		globalThis,
		'fetch',
		async () => new Response(JSON.stringify({ ok: true, cliente: profile })),
	);
	await assert.rejects(resolveInvite('/api/resolve', 'token'));
	globalThis.fetch.mock.mockImplementation(
		async () =>
			new Response(
				JSON.stringify({
					ok: true,
					identidade_confirmada: true,
					cliente: profile,
				}),
			),
	);
	await assert.rejects(resolveInvite('/api/resolve', 'token'));
});
test('cadastro público não envia token do dono, cookies ou CSRF', async t => {
	let request;
	t.mock.method(globalThis, 'fetch', async (_, init) => {
		request = init;
		return new Response(JSON.stringify({ ok: true, preferencias: profile }));
	});
	await saveLead(
		{ endpoint: '/api/leads', privacyUrl: '/privacy', legalVersion: 'v1' },
		{ ...profile, token: 'owner', origem: 'CONVITE', modo: 'IDENTIFICADO' },
	);
	const body = JSON.parse(request.body);
	assert.equal(body.modo, 'PUBLICO');
	assert.equal(body.origem, 'LANDING');
	assert.equal(body.token, undefined);
	assert.equal(request.credentials, 'omit');
	assert.equal(request.headers['X-CSRF-Token'], undefined);
});
test('cadastro identificado envia sessão e proteção CSRF, nunca credenciais de Salesforce', async t => {
	let request;
	t.mock.method(globalThis, 'fetch', async (_, init) => {
		request = init;
		return new Response(JSON.stringify({ ok: true, preferencias: profile }));
	});
	await saveLead(
		{ endpoint: '/api/leads', privacyUrl: '/privacy', legalVersion: 'v1' },
		{ ...profile, token: 'owner' },
		{ confirmed: true, csrfToken: 'csrf' },
	);
	assert.equal(JSON.parse(request.body).modo, 'IDENTIFICADO');
	assert.equal(JSON.parse(request.body).token, 'owner');
	assert.equal(request.credentials, 'include');
	assert.equal(request.headers['X-CSRF-Token'], 'csrf');
});

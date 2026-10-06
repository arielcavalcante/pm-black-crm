import { useEffect, useRef, useState } from 'react';
import {
	CHANNELS,
	CATEGORIES,
	normalizeProfile,
	requiresEmail,
	validateProfile,
} from './domain.js';
import { resolveInvite, saveLead } from './api.js';

const assetUrl = filename => `${import.meta.env.BASE_URL}assets/${filename}`;
const draftStorageKey = 'black-2026-public-draft';

function readDraft() {
	try {
		const draft = JSON.parse(localStorage.getItem(draftStorageKey) || 'null');
		return draft?.profile ? normalizeProfile(draft.profile) : null;
	} catch {
		return null;
	}
}

function clearDraft() {
	try {
		localStorage.removeItem(draftStorageKey);
	} catch {}
}

function firstIncompleteStep(profile) {
	const validation = validateProfile(profile);
	if (validation.nome) return 1;
	if (!profile.categorias.length) return 2;
	if (!profile.canais_preferidos.length) return 3;
	if (validation.email || validation.telefone) return 4;
	return 4;
}

function Icon({ type, ...props }) {
	const assets = {
		EMAIL: 'email.svg',
		WHATSAPP: 'whatsapp.svg',
		SMS: 'sms.svg',
		PUSH: 'app.svg',
		check: 'check.svg',
		checkFill: 'check-fill.svg',
		plus: 'plus.svg',
	};
	if (assets[type])
		return (
			<img
				className={`asset-icon icon-${type}`}
				src={assetUrl(assets[type])}
				alt=''
				aria-hidden='true'
				{...props}
			/>
		);
	const paths = {
		arrow: <path d='M4 12h16m-6-6 6 6-6 6' />,
		lock: (
			<>
				<rect x='5' y='10' width='14' height='11' rx='3' />
				<path d='M8 10V7a4 4 0 0 1 8 0v3m-4 5v2' />
			</>
		),
		star: (
			<path d='m12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z' />
		),
	};
	return (
		<svg
			viewBox='0 0 24 24'
			fill='none'
			stroke='currentColor'
			strokeWidth='1.7'
			strokeLinecap='round'
			strokeLinejoin='round'
			aria-hidden='true'
			{...props}
		>
			{paths[type]}
		</svg>
	);
}
function Brand({ className = '' }) {
	return (
		<a
			className={`logo ${className}`.trim()}
			href='https://www.paguemenos.com.br'
			aria-label='Pague Menos — ir para o site'
		>
			<img
				src={assetUrl('logo.svg')}
				alt='Pague Menos'
				width='1707'
				height='537'
			/>
		</a>
	);
}
function Field({ name, label, value, onChange, error, required, ...props }) {
	return (
		<div className={`field field-${name}`}>
			<label htmlFor={name}>
				{label}
				{required && <span className='required-marker'>*</span>}
			</label>
			<input
				id={name}
				name={name}
				value={value}
				onChange={e => onChange(name, e.target.value)}
				aria-invalid={Boolean(error)}
				aria-describedby={error ? `${name}-error` : undefined}
				required={required}
				{...props}
			/>
			{error && (
				<span className='field-error' id={`${name}-error`}>
					{error}
				</span>
			)}
		</div>
	);
}
function Legend({ number, title, done }) {
	return (
		<legend>
			<span className={`step-number ${done ? 'complete' : ''}`}>
				{done ? <Icon type='checkFill' /> : number}
			</span>
			{title}
		</legend>
	);
}

export default function App({ entry, config }) {
	const draft = !config.demo && !entry.token ? readDraft() : null;
	const [profile, setProfile] = useState(draft || entry.profile);
	const [interestNotes, setInterestNotes] = useState('');
	const [currentStep, setCurrentStep] = useState(() =>
		firstIncompleteStep(draft || entry.profile),
	);
	const [originChannel, setOriginChannel] = useState(entry.originChannel);
	const [screen, setScreen] = useState(
		config.resolveEndpoint && !entry.hasCloudPagesQuery ? 'loading' : 'form',
	);
	const [identity, setIdentity] = useState({ confirmed: false, csrfToken: '' });
	const [editingContact, setEditingContact] = useState(false);
	const [identityNotice, setIdentityNotice] = useState('');
	const [errors, setErrors] = useState({});
	const [message, setMessage] = useState('');
	const [systemError, setSystemError] = useState('');
	const [busy, setBusy] = useState(false);
	const [saved, setSaved] = useState(null);
	const [existing, setExisting] = useState(false);
	const submitLock = useRef(false);
	const requestKey = useRef('');
	const heading = useRef(null);
	const initialRender = useRef(true);

	useEffect(() => {
		if (!config.resolveEndpoint || entry.hasCloudPagesQuery) return;
		const controller = new AbortController();
		setScreen('loading');
		resolveInvite(config.resolveEndpoint, entry.token, controller.signal)
			.then(result => {
				if (controller.signal.aborted) return;
				const source = result.originChannel || entry.originChannel;
				const resolvedProfile =
					!result.confirmed && draft
						? { ...result.profile, ...draft }
						: result.profile;
				if (
					result.confirmed &&
					resolvedProfile.email &&
					!resolvedProfile.canais_preferidos.includes('EMAIL')
				) {
					resolvedProfile.canais_preferidos = [
						'EMAIL',
						...resolvedProfile.canais_preferidos,
					];
				}
				if (
					!result.jaInscrito &&
					!resolvedProfile.canais_preferidos.length &&
					source
				) {
					resolvedProfile.canais_preferidos = [source];
				}
				setIdentity({
					confirmed: result.confirmed,
					csrfToken: result.csrfToken,
				});
				setOriginChannel(source);
				setProfile(resolvedProfile);
				setCurrentStep(firstIncompleteStep(resolvedProfile));
				setExisting(result.jaInscrito);
				setScreen('form');
			})
			.catch(error => {
				if (controller.signal.aborted) return;
				if (error.status >= 400 && !error.invalidLink) {
					setSystemError(
						error.status >= 500
							? 'Estamos com uma instabilidade temporária. Tente novamente em alguns instantes.'
							: 'Não conseguimos carregar este convite. Confira o link e tente novamente.',
					);
					setScreen('error');
					return;
				}
				setIdentity({ confirmed: false, csrfToken: '' });
				setProfile(entry.profile);
				setCurrentStep(firstIncompleteStep(entry.profile));
				setExisting(false);
				setIdentityNotice(
					'Você pode participar preenchendo seus dados abaixo.',
				);
				setScreen('form');
			});
		return () => controller.abort();
	}, [entry, config.resolveEndpoint]);

	useEffect(() => {
		if (initialRender.current) {
			initialRender.current = false;
			return;
		}
		heading.current?.focus({ preventScroll: true });
	}, [screen]);

	useEffect(() => {
		if (config.demo || identity.confirmed || screen === 'success') return;
		const normalized = normalizeProfile(profile);
		const hasData =
			normalized.nome ||
			normalized.email ||
			normalized.telefone ||
			normalized.canais_preferidos.some(
				channel => channel !== entry.originChannel,
			) ||
			normalized.categorias.length;
		if (!hasData) return;
		try {
			localStorage.setItem(
				draftStorageKey,
				JSON.stringify({ profile: normalized }),
			);
		} catch {}
	}, [config.demo, profile, identity.confirmed, screen]);

	const validation = validateProfile(profile);
	const nameDone = !validation.nome;
	const needsPhone = profile.canais_preferidos.some(code =>
		['WHATSAPP', 'SMS'].includes(code),
	);
	const emailChannelSelected = profile.canais_preferidos.some(code =>
		['EMAIL', 'PUSH'].includes(code),
	);
	const emailRequired = requiresEmail(profile.canais_preferidos);
	const contactDone = !validation.email && !validation.telefone;
	const progress = (currentStep - 1) * 25;
	const firstName = profile.nome.trim().split(/\s+/)[0];
	const update = (name, value) => {
		if (['nome', 'email', 'telefone'].includes(name)) setEditingContact(true);
		const next = { ...profile, [name]: value };
		setProfile(next);
		const nextErrors = validateProfile(next);
		setErrors(previous =>
			Object.fromEntries(
				Object.keys(previous).map(key => [key, nextErrors[key]]),
			),
		);
		setMessage('');
		requestKey.current = '';
	};
	const toggleChannel = code =>
		update(
			'canais_preferidos',
			profile.canais_preferidos.includes(code)
				? profile.canais_preferidos.filter(item => item !== code)
				: [...profile.canais_preferidos, code],
		);
	const toggleCategory = code =>
		update(
			'categorias',
			profile.categorias.includes(code)
				? profile.categorias.filter(item => item !== code)
				: [...profile.categorias, code],
		);
	const stepFields = {
		1: ['nome'],
		2: ['categorias'],
		3: ['canais_preferidos'],
		4: ['email', 'telefone'],
	};
	const [focusField, setFocusField] = useState('');
	function continueStep() {
		const stepErrors = Object.fromEntries(
			stepFields[currentStep]
				.map(field => [field, validation[field]])
				.filter(([, error]) => error),
		);
		if (Object.keys(stepErrors).length) {
			setFocusField(Object.keys(stepErrors)[0]);
			return;
		}
		setErrors({});
		setCurrentStep(step => Math.min(4, step + 1));
	}
	useEffect(() => {
		if (!focusField) return;
		document.querySelector(`[name="${focusField}"]`)?.focus();
		setFocusField('');
	}, [currentStep, focusField]);

	function useOwnRegistration(notice = '') {
		clearDraft();
		setIdentity({ confirmed: false, csrfToken: '' });
		setProfile(normalizeProfile({ canais_preferidos: [originChannel] }));
		setExisting(false);
		setEditingContact(false);
		setErrors({});
		setMessage('');
		setSaved(null);
		setIdentityNotice(notice);
		setCurrentStep(1);
		requestKey.current = '';
		setScreen('form');
		const url = new URL(window.location.href);
		url.searchParams.delete('token');
		url.searchParams.delete('qs');
		window.history.replaceState(
			window.history.state,
			'',
			url.pathname + url.search + url.hash,
		);
	}

	async function submit(event) {
		event.preventDefault();
		if (submitLock.current) return;
		if (Object.keys(validation).length) {
			const nextStep = firstIncompleteStep(profile);
			const first = stepFields[nextStep].find(field => validation[field]);
			setCurrentStep(nextStep);
			setFocusField(first || '');
			return;
		}
		submitLock.current = true;
		setBusy(true);
		setMessage('');
		requestKey.current ||= crypto.randomUUID();
		try {
			const result = await saveLead(
				config,
				{
					...normalizeProfile(profile),
					token: identity.confirmed ? entry.token || undefined : undefined,
					campanha: 'BLACK_2026',
					versao_texto_legal: config.legalVersion,
					canal_origem: originChannel || undefined,
					marcas_produtos: interestNotes.trim() || undefined,
					tracking: entry.tracking,
					idempotency_key: requestKey.current,
				},
				identity,
			);
			setSaved({
				...result,
				updated: result.updated || (result.demo && existing),
			});
			clearDraft();
			setProfile(result.profile);
			setExisting(true);
			setScreen('success');
			window.scrollTo({ top: 0, behavior: 'instant' });
		} catch (error) {
			setMessage(error.message);
			if (error.invalidLink && identity.confirmed)
				useOwnRegistration(
					'Sua sessão terminou. Preencha seus dados para continuar com um novo cadastro.',
				);
		} finally {
			submitLock.current = false;
			setBusy(false);
		}
	}

	return (
		<>
			<a className='skip-link' href='#conteudo'>
				Pular para o conteúdo
			</a>
			{config.demo && (
				<div className='demo-banner' role='status'>
					Modo demonstração{' '}
					<span>· Os dados não são enviados nem armazenados.</span>
				</div>
			)}
			{screen === 'success' && saved && (
				<div className='success-lights' aria-hidden='true'>
					<img src={assetUrl('holofote.png')} alt='' />
					<img src={assetUrl('holofote.png')} alt='' />
					<img src={assetUrl('holofote.png')} alt='' />
				</div>
			)}
			<header className='header'>
				<div className='header-inner'>
					<img
						className='header-black'
						src={assetUrl('black-da-pague.png')}
						alt='Black da Pague'
						width='731'
						height='262'
					/>
				</div>
			</header>
			<main className='page' id='conteudo'>
				<aside className='campaign' aria-labelledby='campaign-title'>
					<div className='campaign-top'>
						<h1 id='campaign-title'>
							Garanta as melhores ofertas da <span>Black da Pague</span>
						</h1>
						<p>
							Prepare sua lista de desejos.
							<br /> A gente avisa quando as ofertas chegarem.
						</p>
					</div>
					<div className='campaign-bottom'>
						<img
							className='campaign-cross'
							src={assetUrl('cross.png')}
							alt=''
							aria-hidden='true'
						/>
						<img
							className='campaign-juliette'
							src={assetUrl('juliette.png')}
							alt=''
							aria-hidden='true'
						/>
					</div>
				</aside>

				<section
					className={`form-panel ${screen !== 'form' ? 'state-panel' : ''}`}
					aria-labelledby='form-title'
					aria-busy={busy || screen === 'loading'}
				>
					{screen === 'form' && (
						<>
							<div className='intro'>
								<span className='section-kicker'>
									SUA LISTA BLACK COMEÇA AQUI
								</span>
								<h2 id='form-title' tabIndex='-1' ref={heading}>
									{firstName ? `Oi, ${firstName}!` : 'Fique sabendo primeiro.'}
									<br />
									{firstName
										? 'Vamos preparar sua Black?'
										: 'A Black vai ser do seu jeito.'}
								</h2>
								<p>
									Conte onde e sobre o que você quer receber.
									<br className='desktop-break' /> Leva menos de 1 minuto.
								</p>
							</div>
							<div className='progress'>
								<div className='progress-head'>
									<span>Etapa {currentStep} de 4</span>
									<strong>{progress}%</strong>
								</div>
								<div
									className='progress-track'
									role='progressbar'
									aria-label='Preenchimento do perfil'
									aria-valuenow={progress}
									aria-valuemin='0'
									aria-valuemax='100'
								>
									<span style={{ width: `${progress}%` }} />
								</div>
								<div className='progress-labels'>
									{['Nome', 'Ofertas', 'Canais', 'Contatos', 'Enviado'].map(
										(label, index) => (
											<span
												key={label}
												className={index < currentStep - 1 ? 'done' : ''}
											>
												{String(index + 1).padStart(2, '0')} {label}
											</span>
										),
									)}
								</div>
							</div>
							<form onSubmit={submit} noValidate>
								{currentStep === 1 && (
									<fieldset disabled={busy}>
										<Legend
											number='1'
											title='Como podemos te chamar?'
											done={nameDone}
										/>
										<div className='fields single-field'>
											<Field
												name='nome'
												label='Seu nome'
												value={profile.nome}
												onChange={update}
												error={errors.nome}
												autoComplete='name'
												maxLength={100}
												required
												placeholder='Como podemos te chamar?'
											/>
										</div>
									</fieldset>
								)}
								<fieldset
									className={currentStep === 3 ? '' : 'step-hidden'}
									disabled={busy}
									aria-describedby={
										errors.canais_preferidos ? 'canal-error' : 'canal-hint'
									}
								>
									<Legend
										number='3'
										title='Onde você quer receber?'
										done={profile.canais_preferidos.length > 0}
									/>
									<p className='hint' id='canal-hint'>
										Escolha um ou mais canais
									</p>
									<div className='channels'>
										{Object.entries(CHANNELS).map(([code, label]) => (
											<div className='channel' key={code}>
												<input
													type='checkbox'
													id={`channel-${code}`}
													name='canais_preferidos'
													value={code}
													checked={profile.canais_preferidos.includes(code)}
													onChange={() => toggleChannel(code)}
												/>
												<label htmlFor={`channel-${code}`}>
													<Icon
														type={
															profile.canais_preferidos.includes(code)
																? 'checkFill'
																: code
														}
													/>
													<span>{label}</span>
												</label>
											</div>
										))}
									</div>
									{errors.canais_preferidos && (
										<p className='field-error' id='canal-error'>
											{errors.canais_preferidos}
										</p>
									)}
									{profile.canais_preferidos.includes('PUSH') && (
										<p className='hint channel-note'>
											Se o canal escolhido não estiver ativo no seu cadastro,
											avisamos por outro canal em que você já recebe nossas
											comunicações.
										</p>
									)}
								</fieldset>
								{currentStep === 4 && (
									<fieldset disabled={busy}>
										<Legend
											number='4'
											title='Qual seu contato?'
											done={contactDone}
										/>
										<p className='hint'>
											Confira seus dados para ficar por dentro.
										</p>
										<div className='fields'>
											{emailChannelSelected && (
												<Field
													name='email'
													label='E-mail'
													value={profile.email}
													onChange={update}
													error={errors.email}
													type='email'
													autoComplete='email'
													maxLength={254}
													required={emailRequired}
													readOnly={Boolean(
														identity.confirmed &&
														profile.email &&
														!editingContact,
													)}
													className={
														identity.confirmed &&
														profile.email &&
														!editingContact
															? 'prefilled-field'
															: undefined
													}
													onClick={() =>
														identity.confirmed && setEditingContact(true)
													}
													placeholder='voce@exemplo.com'
												/>
											)}
											{(needsPhone || profile.telefone) && (
												<Field
													name='telefone'
													label={
														needsPhone
															? 'Celular com DDD'
															: 'Celular com DDD (opcional)'
													}
													value={profile.telefone}
													onChange={update}
													error={errors.telefone}
													type='tel'
													inputMode='tel'
													autoComplete='tel'
													pattern='[0-9]*'
													enterKeyHint='done'
													maxLength={22}
													required={needsPhone}
													readOnly={Boolean(
														identity.confirmed &&
														profile.telefone &&
														!editingContact,
													)}
													onClick={() =>
														identity.confirmed && setEditingContact(true)
													}
													placeholder='(85) 99999-9999'
												/>
											)}
										</div>
									</fieldset>
								)}
								{currentStep === 2 && (
									<fieldset
										disabled={busy}
										aria-describedby={
											errors.categorias ? 'categorias-error' : 'categorias-hint'
										}
									>
										<Legend
											number='2'
											title='Quais ofertas te interessam?'
											done={profile.categorias.length > 0}
										/>
										<div className='category-tools'>
											<p className='hint' id='categorias-hint'>
												Escolha quantas quiser
											</p>
											<button
												type='button'
												className='text-button'
												onClick={() =>
													update(
														'categorias',
														profile.categorias.length === CATEGORIES.length
															? []
															: CATEGORIES.map(([code]) => code),
													)
												}
											>
												{profile.categorias.length === CATEGORIES.length
													? 'Desmarcar todas'
													: 'Marcar todas'}
											</button>
										</div>
										<div className='chips'>
											{CATEGORIES.map(([code, label]) => (
												<div className='chip' key={code}>
													<input
														type='checkbox'
														id={`category-${code}`}
														name='categorias'
														value={code}
														checked={profile.categorias.includes(code)}
														onChange={() => toggleCategory(code)}
													/>
													<label htmlFor={`category-${code}`}>
														<Icon
															type={
																profile.categorias.includes(code)
																	? 'checkFill'
																	: 'plus'
															}
														/>
														{label}
													</label>
												</div>
											))}
										</div>
										<p className='counter' aria-live='polite'>
											{profile.categorias.length === 0
												? 'Nenhuma escolhida'
												: `${profile.categorias.length} ${profile.categorias.length === 1 ? 'escolhida' : 'escolhidas'}`}
										</p>
										{errors.categorias && (
											<p className='field-error' id='categorias-error'>
												{errors.categorias}
											</p>
										)}
										<div className='textarea-field'>
											<label htmlFor='marcas-produtos'>
												Quais marcas e produtos você mais se interessa?
											</label>
											<textarea
												id='marcas-produtos'
												name='marcas_produtos'
												value={interestNotes}
												onChange={event => {
													setInterestNotes(event.target.value);
													setMessage('');
												}}
												maxLength={500}
												rows={4}
												placeholder='Ex.: marcas, produtos ou linhas que você procura'
											/>
										</div>
									</fieldset>
								)}
								{currentStep === 4 && (
									<p className='legal'>
										Usamos suas escolhas só para personalizar as ofertas da
										Black. Suas preferências gerais de comunicação continuam as
										mesmas. Saiba mais na nossa{' '}
										{config.privacyUrl ? (
											<a
												href={config.privacyUrl}
												target='_blank'
												rel='noopener noreferrer'
											>
												Política de Privacidade
											</a>
										) : (
											<>
												<span className='pending-policy'>
													Política de Privacidade
												</span>
												<span className='config-note'>
													{' '}
													(link a configurar)
												</span>
											</>
										)}
										.
									</p>
								)}
								{currentStep === 4 && message && (
									<p className='error-message' role='alert'>
										{message}
									</p>
								)}
								<div className='step-actions'>
									{currentStep > 1 && (
										<button
											className='button secondary'
											type='button'
											disabled={busy}
											onClick={() => setCurrentStep(step => step - 1)}
										>
											Voltar
										</button>
									)}
									{currentStep < 4 ? (
										<button
											className='button primary'
											type='button'
											disabled={busy}
											onClick={continueStep}
										>
											Continuar
										</button>
									) : (
										<button
											className={`button primary ${Object.keys(validation).length ? 'is-pending' : ''}`}
											type='submit'
											disabled={busy}
										>
											Cadastrar
										</button>
									)}
								</div>
								<p className='form-foot'>
									<Icon type='lock' /> Suas preferências deixam a Black com a
									sua cara.
								</p>
							</form>
						</>
					)}
					{screen === 'loading' && (
						<div className='state-content'>
							<div className='spinner' />
							<h2 id='form-title' ref={heading} tabIndex='-1'>
								Preparando sua Black…
							</h2>
							<p role='status'>Estamos buscando os dados do seu convite.</p>
						</div>
					)}
					{screen === 'error' && (
						<div className='state-content error-state'>
							<div className='error-icon'>!</div>
							<span className='section-kicker'>BLACK 2026</span>
							<h2 id='form-title' ref={heading} tabIndex='-1'>
								Não conseguimos abrir sua Black.
							</h2>
							<p role='alert'>{systemError}</p>
							<button
								className='button primary'
								type='button'
								onClick={() => window.location.reload()}
							>
								Tentar novamente
							</button>
						</div>
					)}
					{screen === 'success' && saved && (
						<div className='state-content success'>
							<div className='progress success-progress'>
								<div className='progress-head'>
									<span>Etapa 5 de 5</span>
									<strong>100%</strong>
								</div>
								<div
									className='progress-track'
									role='progressbar'
									aria-label='Cadastro enviado'
									aria-valuenow='100'
									aria-valuemin='0'
									aria-valuemax='100'
								>
									<span style={{ width: '100%' }} />
								</div>
								<div className='progress-labels'>
									{['Nome', 'Ofertas', 'Canais', 'Contatos', 'Enviado'].map(
										(label, index) => (
											<span className='done' key={label}>
												{String(index + 1).padStart(2, '0')} {label}
											</span>
										),
									)}
								</div>
							</div>
							<div className='success-badge'>
								<Icon type='checkFill' />
							</div>
							<span className='section-kicker'>
								BLACK 2026 ·{' '}
								{saved.demo ? 'DEMONSTRAÇÃO' : 'SUAS ESCOLHAS SALVAS'}
							</span>
							<h2 id='form-title' ref={heading} tabIndex='-1'>
								{saved.demo
									? 'Tudo pronto para a sua Black!'
									: saved.updated
										? `Escolhas atualizadas, ${firstName}!`
										: `Pronto, ${firstName}! Você está na lista.`}
							</h2>
							<p>
								{saved.demo
									? 'Este foi um teste. Nenhum cadastro foi enviado ou armazenado.'
									: saved.updated
										? 'Suas novas escolhas já valem para as próximas ofertas da Black.'
										: 'Quando as ofertas da Black começarem, você fica sabendo primeiro.'}
							</p>
							<div className='summary-card'>
								<small>VOCÊ ESCOLHEU RECEBER POR</small>
								<div className='summary-channels'>
									{saved.profile.canais_preferidos.map(code => (
										<strong key={code}>
											<Icon type={code} />
											{CHANNELS[code]}
										</strong>
									))}
								</div>
							</div>
							<div className='summary-card'>
								<small>OFERTAS QUE TÊM A SUA CARA</small>
								<div className='summary-tags'>
									{CATEGORIES.filter(([code]) =>
										saved.profile.categorias.includes(code),
									).map(([code, label]) => (
										<span key={code}>{label}</span>
									))}
								</div>
							</div>
							<p className='note'>
								Se o canal escolhido não estiver ativo no seu cadastro, avisamos
								por outro canal em que você já recebe nossas comunicações.
							</p>
							<a
								className='button primary'
								href='https://www.paguemenos.com.br'
								target='_blank'
								rel='noopener noreferrer'
							>
								Ver ofertas no site
							</a>
						</div>
					)}
				</section>
			</main>
			<footer className='footer'>
				<Brand className='footer-logo' />
			</footer>
		</>
	);
}

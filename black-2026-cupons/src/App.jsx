import { useEffect, useRef, useState } from 'react';
import { AVISO, CATEGORIAS, CUPONS, FAIXAS_GASTO } from './cupons.js';
import {
	availableCategories,
	budgetLabel,
	budgetLimit,
	firstName,
	formatDiscount,
	formatMoney,
	GASTO_NAO_SEI,
	matchCoupons,
	randomCode,
	scramble,
	splitByBudget,
	summarizeLabels,
	validateName,
	validBudget,
	validCategories,
} from './domain.js';

const assetUrl = filename => `${import.meta.env.BASE_URL}assets/${filename}`;
const storageKey = 'black-2026-cupons';
const STEP_LABELS = ['Nome', 'Interesses', 'Gasto', 'Cupons'];
const OPTIONS = availableCategories(CATEGORIAS, CUPONS);
const LABELS = Object.fromEntries(CATEGORIAS);

const prefersReducedMotion = () =>
	typeof window.matchMedia === 'function' &&
	window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function readSaved() {
	try {
		const data = JSON.parse(localStorage.getItem(storageKey) || 'null');
		if (!data || typeof data !== 'object') return null;
		return {
			nome: typeof data.nome === 'string' ? data.nome.slice(0, 100) : '',
			categorias: validCategories(data.categorias, OPTIONS),
			gasto: validBudget(data.gasto, FAIXAS_GASTO),
			revelado: data.revelado === true,
		};
	} catch {
		return null;
	}
}
function writeSaved(data) {
	try {
		localStorage.setItem(storageKey, JSON.stringify(data));
	} catch {}
}

async function copyText(text) {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		try {
			const area = document.createElement('textarea');
			area.value = text;
			area.setAttribute('readonly', '');
			area.style.position = 'fixed';
			area.style.opacity = '0';
			document.body.appendChild(area);
			area.select();
			const ok = document.execCommand('copy');
			area.remove();
			return ok;
		} catch {
			return false;
		}
	}
}

function track(event, data) {
	// Sem dados pessoais: só categorias e códigos. No-op sem GTM/dataLayer.
	try {
		window.dataLayer?.push({ event, ...data });
	} catch {}
}

function Icon({ type, ...props }) {
	const assets = {
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
		lock: (
			<>
				<rect x='5' y='10' width='14' height='11' rx='3' />
				<path d='M8 10V7a4 4 0 0 1 8 0v3m-4 5v2' />
			</>
		),
		copy: (
			<>
				<rect x='9' y='9' width='11' height='11' rx='2.5' />
				<path d='M15 9V6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15H9' />
			</>
		),
		done: <path d='m5 12.5 4.5 4.5L19 7.5' />,
		arrow: <path d='M4 12h16m-6-6 6 6-6 6' />,
	};
	return (
		<svg
			viewBox='0 0 24 24'
			fill='none'
			stroke='currentColor'
			strokeWidth='1.9'
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
				onChange={e => onChange(e.target.value)}
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
function Progress({ step, percent, label = 'Progresso' }) {
	return (
		<div className='progress'>
			<div className='progress-head'>
				<span>
					Etapa {step} de {STEP_LABELS.length}
				</span>
				<strong>{percent}%</strong>
			</div>
			<div
				className='progress-track'
				role='progressbar'
				aria-label={label}
				aria-valuenow={percent}
				aria-valuemin='0'
				aria-valuemax='100'
			>
				<span style={{ width: `${percent}%` }} />
			</div>
			<div className='progress-labels'>
				{STEP_LABELS.map((item, index) => (
					<span
						key={item}
						className={
							index < step - 1 || percent === 100 ? 'done' : undefined
						}
					>
						{String(index + 1).padStart(2, '0')} {item}
					</span>
				))}
			</div>
		</div>
	);
}

/** Fixed-width characters, so the slot-machine effect never jitters. */
function CodeText({ text, className = '', settled = false }) {
	if (settled)
		return (
			<span className={`code-text ${className}`.trim()} aria-hidden='true'>
				{text}
			</span>
		);
	return (
		<span className={`code-text ${className}`.trim()} aria-hidden='true'>
			{[...text].map((char, index) => (
				<span className='code-char' key={index}>
					{char}
				</span>
			))}
		</span>
	);
}

function UnlockMeter({ unlocked, total, children }) {
	return (
		<div className='unlock-meter'>
			<div className='unlock-tickets' aria-hidden='true'>
				{Array.from({ length: total }, (_, index) => (
					<span key={index} className={index < unlocked ? 'on' : undefined} />
				))}
			</div>
			<p aria-live='polite'>{children}</p>
		</div>
	);
}
function plural(count, one, many) {
	return `${count} ${count === 1 ? one : many}`;
}

function Generating({ nome, categorias, gasto, heading, onDone }) {
	const [progress, setProgress] = useState(0);
	const [code, setCode] = useState(() => randomCode(10));
	const done = useRef(onDone);
	done.current = onDone;
	const reduced = prefersReducedMotion();

	useEffect(() => {
		const duration = reduced ? 1200 : 4200;
		let frame = 0;
		let timer = 0;
		let lastSwap = 0;
		const start = performance.now();
		const tick = now => {
			const t = Math.min(1, (now - start) / duration);
			// Ease-out, with a short "thinking" pause in the middle.
			const eased = t < 0.55 ? t * 1.1 : 0.605 + (t - 0.55) * 0.878;
			setProgress(Math.min(1, eased));
			if (!reduced && now - lastSwap > 65) {
				setCode(randomCode(10));
				lastSwap = now;
			}
			if (t < 1) frame = requestAnimationFrame(tick);
			else timer = setTimeout(() => done.current(), 350);
		};
		frame = requestAnimationFrame(tick);
		return () => {
			cancelAnimationFrame(frame);
			clearTimeout(timer);
		};
	}, [reduced]);

	const first = firstName(nome);
	const labels = categorias.map(code => LABELS[code]);
	const phase = progress < 0.28 ? 0 : progress < 0.8 ? 1 : 2;
	const message = [
		`Lendo suas escolhas, ${first}…`,
		`Procurando as melhores ofertas de ${summarizeLabels(labels)}…`,
		budgetLimit(gasto, FAIXAS_GASTO) === null
			? 'Liberando seus cupons…'
			: `Separando os que valem para pedidos de ${budgetLabel(gasto, FAIXAS_GASTO)}…`,
	][phase];
	const percent = Math.round(progress * 100);

	return (
		<div className='state-content generator'>
			<Progress
				step={4}
				percent={Math.round(67 + progress * 33)}
				label='Gerando seus cupons'
			/>
			<span className='section-kicker'>BLACK 2026 · GERANDO SEUS CUPONS</span>
			<h2 id='form-title' ref={heading} tabIndex='-1'>
				Só um instante, {first}.
			</h2>
			<div className='generator-ticket' aria-hidden='true'>
				<small>SEU CÓDIGO</small>
				<CodeText
					text={reduced ? '••••••••••' : code}
					className='generator-code'
				/>
				<div className='generator-bar'>
					<span style={{ width: `${percent}%` }} />
				</div>
				<strong className='generator-percent'>{percent}%</strong>
			</div>
			<p className='generator-message' role='status'>
				{message}
			</p>
			<ul className='gen-cats' aria-label='Categorias analisadas'>
				{categorias.map((category, index) => {
					const ready = progress >= ((index + 1) / (categorias.length + 1)) * 0.92;
					return (
						<li key={category} className={ready ? 'done' : undefined}>
							{ready && <Icon type='done' />}
							{LABELS[category]}
						</li>
					);
				})}
			</ul>
		</div>
	);
}

function CouponCard({ cupom, index, nome, instant, bonus, onCopied }) {
	const reduced = instant || prefersReducedMotion();
	const [shown, setShown] = useState(() =>
		reduced ? cupom.codigo : scramble(cupom.codigo, 0),
	);
	const [copied, setCopied] = useState('');
	const discount = formatDiscount(cupom);
	const terms = [
		cupom.minimo > 0 && `Pedido mínimo de ${formatMoney(cupom.minimo)}`,
		cupom.condicoes,
		cupom.link && (
			<a href={cupom.link} target='_blank' rel='noopener noreferrer'>
				Ver produtos
			</a>
		),
	].filter(Boolean);
	const covers = cupom.geral
		? 'Válido para todas as categorias'
		: cupom.categorias.map(code => LABELS[code]).join(' · ');

	useEffect(() => {
		if (reduced) return setShown(cupom.codigo);
		const delay = 450 + index * 380;
		const duration = 1100;
		let frame = 0;
		let last = 0;
		const start = performance.now();
		const tick = now => {
			const t = (now - start - delay) / duration;
			if (t >= 1) return setShown(cupom.codigo);
			if (now - last > 55) {
				setShown(scramble(cupom.codigo, Math.max(0, t)));
				last = now;
			}
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, [cupom.codigo, index, reduced]);

	useEffect(() => {
		if (!copied) return;
		const timer = setTimeout(() => setCopied(''), 2200);
		return () => clearTimeout(timer);
	}, [copied]);

	async function copy() {
		const ok = await copyText(cupom.codigo);
		setCopied(ok ? 'ok' : 'fail');
		onCopied(
			ok
				? `Cupom ${cupom.codigo} copiado.`
				: 'Não foi possível copiar. Selecione o código e copie manualmente.',
		);
		if (ok) track('cupom_copiado', { cupom: cupom.codigo });
	}

	return (
		<li
			className={['coupon', cupom.geral && 'coupon-general', bonus && 'coupon-bonus']
				.filter(Boolean)
				.join(' ')}
			style={{ '--i': index }}
		>
			<div className='coupon-value' aria-hidden='true'>
				<strong>
					{discount.antes && <small>{discount.unidade}</small>}
					{discount.principal}
					{!discount.antes && discount.unidade && (
						<small>{discount.unidade}</small>
					)}
				</strong>
				<span>{discount.rotulo}</span>
			</div>
			<div className='coupon-body'>
				<p className='coupon-for'>
					Liberado para {firstName(nome)} · Black 2026
				</p>
				<h3 className='coupon-cats'>
					<span className='visually-hidden'>{discount.texto} · </span>
					{covers}
				</h3>
				<div className='coupon-code-row'>
					<p className='coupon-code'>
						<span className='visually-hidden'>Código: {cupom.codigo}</span>
						<CodeText text={shown} settled={shown === cupom.codigo} />
					</p>
					<button
						type='button'
						className={`coupon-copy ${copied === 'ok' ? 'copied' : ''}`.trim()}
						onClick={copy}
						aria-label={`Copiar cupom ${cupom.codigo}`}
					>
						<Icon type={copied === 'ok' ? 'done' : 'copy'} />
						{copied === 'ok' ? 'Copiado!' : 'Copiar'}
					</button>
				</div>
				{terms.length > 0 && (
					<p className='coupon-terms'>
						{terms.map((term, position) => (
							<span key={position}>
								{position > 0 && ' · '}
								{term}
							</span>
						))}
					</p>
				)}
			</div>
		</li>
	);
}

function Reveal({ nome, coupons, gasto, instant, heading, config, onRedo }) {
	const [announcement, setAnnouncement] = useState('');
	const first = firstName(nome);
	const limit = budgetLimit(gasto, FAIXAS_GASTO);
	const split = splitByBudget(coupons, limit);
	// Se nenhum cupom cabe no valor informado, mostra todos como principais.
	const { usaveis, maiores } = split.usaveis.length
		? split
		: { usaveis: coupons, maiores: [] };
	const allNeedMore = !split.usaveis.length && limit !== null;
	const count = usaveis.length;
	const nextMinimum = maiores[0]?.minimo;
	const card = (cupom, index, bonus = false) => (
		<CouponCard
			key={cupom.codigo}
			cupom={cupom}
			index={index}
			nome={nome}
			instant={instant}
			bonus={bonus}
			onCopied={setAnnouncement}
		/>
	);
	return (
		<div className='state-content success reveal'>
			<Progress step={4} percent={100} label='Cupons gerados' />
			<span className='section-kicker'>BLACK 2026 · SEUS CUPONS</span>
			<h2 id='form-title' ref={heading} tabIndex='-1'>
				Pronto, {first}!<br />
				{allNeedMore
					? `Separamos ${plural(count, 'cupom', 'cupons')} pra você.`
					: `Liberamos ${plural(count, 'cupom', 'cupons')} pra você.`}
			</h2>
			<p>
				{allNeedMore
					? `Eles pedem um valor um pouco acima de ${budgetLabel(gasto, FAIXAS_GASTO)}. Confira o mínimo em cada um.`
					: limit !== null && limit !== Infinity
						? `${count === 1 ? 'Ele vale' : 'Todos valem'} para pedidos de ${budgetLabel(gasto, FAIXAS_GASTO)}. Copie o código e aplique no carrinho.`
						: 'Copie o código e aplique no carrinho ao finalizar a compra.'}
			</p>
			<ul className='coupons'>
				{usaveis.map((cupom, index) => card(cupom, index))}
			</ul>
			{maiores.length > 0 && (
				<section className='bonus-coupons' aria-labelledby='bonus-title'>
					<h3 id='bonus-title' className='bonus-title'>
						<small>PEDIDO UM POUCO MAIOR?</small>
						{maiores.length === 1
							? `A partir de ${formatMoney(nextMinimum)}, você também libera este`
							: `Aumentando o pedido, você libera mais ${maiores.length}`}
					</h3>
					<ul className='coupons'>
						{maiores.map((cupom, index) =>
							card(cupom, usaveis.length + index, true),
						)}
					</ul>
				</section>
			)}
			<p className='visually-hidden' aria-live='polite'>
				{announcement}
			</p>
			{AVISO && <p className='note'>{AVISO}</p>}
			<a
				className='button primary'
				href={config.siteUrl}
				target='_blank'
				rel='noopener noreferrer'
			>
				Usar meus cupons no site
			</a>
			<button className='button secondary' type='button' onClick={onRedo}>
				Refazer escolhas
			</button>
			{config.landingUrl && (
				<div className='summary-card cross-link'>
					<small>QUER SABER PRIMEIRO?</small>
					<p>
						Conte onde quer receber as ofertas e a gente avisa quando a Black
						começar.
					</p>
					<a href={config.landingUrl}>
						Entrar na lista da Black <Icon type='arrow' />
					</a>
				</div>
			)}
		</div>
	);
}

export default function App({ config }) {
	const [saved] = useState(readSaved);
	const [nome, setNome] = useState(saved?.nome || '');
	const [categorias, setCategorias] = useState(saved?.categorias || []);
	const [gasto, setGasto] = useState(saved?.gasto || '');
	const [step, setStep] = useState(validateName(saved?.nome) ? 1 : 2);
	const [screen, setScreen] = useState(() =>
		saved?.revelado &&
		!validateName(saved.nome) &&
		matchCoupons(saved.categorias, CUPONS).length
			? 'reveal'
			: 'form',
	);
	const [instant, setInstant] = useState(screen === 'reveal');
	const [errors, setErrors] = useState({});
	const [focusField, setFocusField] = useState('');
	const heading = useRef(null);
	const panel = useRef(null);
	const initialRender = useRef(true);

	const coupons = matchCoupons(categorias, CUPONS);
	const usable = splitByBudget(coupons, budgetLimit(gasto, FAIXAS_GASTO)).usaveis;
	const first = firstName(nome);

	useEffect(() => {
		writeSaved({ nome, categorias, gasto, revelado: screen === 'reveal' });
	}, [nome, categorias, gasto, screen]);

	useEffect(() => {
		if (initialRender.current) {
			initialRender.current = false;
			return;
		}
		heading.current?.focus({ preventScroll: true });
		const top = panel.current?.getBoundingClientRect().top ?? 0;
		if (top < 0 || top > window.innerHeight * 0.6)
			panel.current?.scrollIntoView({
				block: 'start',
				behavior: prefersReducedMotion() ? 'auto' : 'smooth',
			});
	}, [screen]);

	useEffect(() => {
		if (!focusField) return;
		document.querySelector(`[name="${focusField}"]`)?.focus();
		setFocusField('');
	}, [step, focusField]);

	function updateName(value) {
		setNome(value);
		if (errors.nome) setErrors({ ...errors, nome: validateName(value) });
	}
	function setChosen(next) {
		setCategorias(next);
		if (errors.categorias && next.length) setErrors({});
	}
	const toggleCategory = code =>
		setChosen(
			categorias.includes(code)
				? categorias.filter(item => item !== code)
				: [...categorias, code],
		);

	function continueStep() {
		if (step === 1) {
			const error = validateName(nome);
			if (error) {
				setErrors({ nome: error });
				setFocusField('nome');
				return;
			}
		}
		if (step === 2 && !categorias.length) {
			setErrors({ categorias: 'Escolha ao menos uma categoria.' });
			setFocusField('categorias');
			return;
		}
		setErrors({});
		setStep(current => Math.min(3, current + 1));
	}

	function generate(event) {
		event.preventDefault();
		if (step < 3) return continueStep();
		setErrors({});
		setInstant(false);
		setScreen('generating');
		track('cupons_gerados', {
			categorias,
			gasto: gasto || GASTO_NAO_SEI,
			cupons: coupons.map(cupom => cupom.codigo),
		});
	}

	function redo() {
		setScreen('form');
		setStep(2);
	}

	return (
		<>
			<a className='skip-link' href='#conteudo'>
				Pular para o conteúdo
			</a>
			{screen === 'reveal' && (
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
							Cupons feitos pra sua <span>Black da Pague</span>
						</h1>
						<p>
							Escolha o que você ama.
							<br /> A gente libera cupons com a sua cara.
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
					ref={panel}
					className={`form-panel ${screen !== 'form' ? 'state-panel' : ''}`}
					aria-labelledby='form-title'
					aria-busy={screen === 'generating'}
				>
					{screen === 'form' && (
						<>
							<div className='intro'>
								<span className='section-kicker'>CUPONS DA BLACK 2026</span>
								<h2 id='form-title' tabIndex='-1' ref={heading}>
									{step > 1 && first ? `Oi, ${first}!` : 'Seus cupons,'}
									<br />
									{step > 1 && first
										? 'Vamos liberar seus cupons?'
										: 'do seu jeito.'}
								</h2>
								<p>
									Conte do que você gosta e a gente prepara seus cupons na hora.
									<br className='desktop-break' /> Leva menos de 1 minuto.
								</p>
							</div>
							<Progress
								step={step}
								percent={Math.round(((step - 1) * 100) / 3)}
								label='Preenchimento'
							/>
							<form onSubmit={generate} noValidate>
								{step === 1 && (
									<fieldset>
										<Legend
											number='1'
											title='Como podemos te chamar?'
											done={!validateName(nome)}
										/>
										<div className='fields single-field'>
											<Field
												name='nome'
												label='Seu nome'
												value={nome}
												onChange={updateName}
												error={errors.nome}
												autoComplete='given-name'
												maxLength={100}
												enterKeyHint='next'
												required
												placeholder='Como podemos te chamar?'
											/>
										</div>
									</fieldset>
								)}
								{step === 2 && (
									<fieldset
										aria-describedby={
											errors.categorias ? 'categorias-error' : 'categorias-hint'
										}
									>
										<Legend
											number='2'
											title='Do que você mais gosta?'
											done={categorias.length > 0}
										/>
										<div className='category-tools'>
											<p className='hint' id='categorias-hint'>
												Quanto mais escolher, mais cupons você libera
											</p>
											<button
												type='button'
												className='text-button'
												onClick={() =>
													setChosen(
														categorias.length === OPTIONS.length
															? []
															: OPTIONS.map(([code]) => code),
													)
												}
											>
												{categorias.length === OPTIONS.length
													? 'Desmarcar todas'
													: 'Marcar todas'}
											</button>
										</div>
										<div className='chips'>
											{OPTIONS.map(([code, label]) => (
												<div className='chip' key={code}>
													<input
														type='checkbox'
														id={`category-${code}`}
														name='categorias'
														value={code}
														checked={categorias.includes(code)}
														onChange={() => toggleCategory(code)}
													/>
													<label htmlFor={`category-${code}`}>
														<Icon
															type={
																categorias.includes(code) ? 'checkFill' : 'plus'
															}
														/>
														{label}
													</label>
												</div>
											))}
										</div>
										<UnlockMeter
											unlocked={coupons.length}
											total={CUPONS.length}
										>
											{coupons.length === 0 ? (
												'Escolha uma categoria para liberar seu primeiro cupom'
											) : (
												<>
													<strong key={coupons.length}>
														{plural(coupons.length, 'cupom', 'cupons')}
													</strong>{' '}
													esperando por você
												</>
											)}
										</UnlockMeter>
										{errors.categorias && (
											<p className='field-error' id='categorias-error'>
												{errors.categorias}
											</p>
										)}
									</fieldset>
								)}
								{step === 3 && (
									<fieldset aria-describedby='gasto-hint'>
										<Legend
											number='3'
											title='Quanto você pretende gastar?'
											done={Boolean(gasto)}
										/>
										<p className='hint' id='gasto-hint'>
											Opcional. Vários cupons têm valor mínimo de pedido; assim
											mostramos primeiro os que você já pode usar.
										</p>
										<div className='chips budget-chips'>
											{[...FAIXAS_GASTO, GASTO_NAO_SEI].map(value => (
												<div className='chip' key={value}>
													<input
														type='radio'
														id={`gasto-${value}`}
														name='gasto'
														value={value}
														checked={gasto === value}
														onChange={() => setGasto(value)}
													/>
													<label htmlFor={`gasto-${value}`}>
														{gasto === value && <Icon type='checkFill' />}
														{value === GASTO_NAO_SEI
															? 'Ainda não sei'
															: budgetLabel(value, FAIXAS_GASTO)}
													</label>
												</div>
											))}
										</div>
										<UnlockMeter unlocked={usable.length} total={coupons.length}>
											{!budgetLimit(gasto, FAIXAS_GASTO) ? (
												<>
													<strong key='all'>
														{plural(coupons.length, 'cupom', 'cupons')}
													</strong>{' '}
													esperando por você
												</>
											) : usable.length === coupons.length ? (
												<>
													<strong key='fit-all'>
														{coupons.length === 1
															? 'Seu cupom'
															: `Todos os ${coupons.length} cupons`}
													</strong>{' '}
													{coupons.length === 1 ? 'vale' : 'valem'} para esse valor
												</>
											) : (
												<>
													<strong key={usable.length}>
														{usable.length} de {coupons.length}
													</strong>{' '}
													cupons {usable.length === 1 ? 'vale' : 'valem'} para esse
													valor
												</>
											)}
										</UnlockMeter>
									</fieldset>
								)}
								<div className='step-actions'>
									{step > 1 && (
										<button
											className='button secondary'
											type='button'
											onClick={() => {
												setErrors({});
												setStep(current => current - 1);
											}}
										>
											Voltar
										</button>
									)}
									<button
										className={`button primary ${step === 2 && !categorias.length ? 'is-pending' : ''}`.trim()}
										type='submit'
									>
										{step < 3 ? 'Continuar' : 'Gerar meus cupons'}
									</button>
								</div>
								<p className='form-foot'>
									<Icon type='lock' /> Sem cadastro: é só escolher e usar.
								</p>
							</form>
						</>
					)}
					{screen === 'generating' && (
						<Generating
							nome={nome}
							categorias={categorias}
							gasto={gasto}
							heading={heading}
							onDone={() => setScreen('reveal')}
						/>
					)}
					{screen === 'reveal' && (
						<Reveal
							nome={nome}
							coupons={coupons}
							gasto={gasto}
							instant={instant}
							heading={heading}
							config={config}
							onRedo={redo}
						/>
					)}
				</section>
			</main>
			<footer className='footer'>
				<Brand className='footer-logo' />
			</footer>
		</>
	);
}

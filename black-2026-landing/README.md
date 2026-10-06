# Landing Black 2026 — Pague Menos

Frontend React + Vite baseado no protótipo fornecido, com canais múltiplos e cadastro público para quem receber um link compartilhado. Desktop em duas colunas, celular em coluna única. Fonte Rebond Grotesque local; fundo do body `#01095C` com sombra interna de 180px `#000003`, superfície `.page` em `#ffffff14` e blocos internos sem preenchimento de fundo. Header e footer transparentes.

**Status:** layout, formulário, fallback e cliente HTTP implementados. Backend, login/SSO, endpoints e gravação na Salesforce **ainda não estão conectados**. Testes usam respostas simuladas e não comprovam a integração real. Na prévia sem endpoints, todos são visitantes e nenhum dado é enviado ou armazenado.

## Executar e publicar

Node 22.12+ e npm, nesta pasta:

```sh
npm install
npm run dev
npm test
npm run test:e2e
npm run build
npm run preview
```

Os testes de navegador usam Google Chrome instalado (`channel: chrome`). Copie `.env.example` para `.env.local`, configure os valores e gere o build. Publique **toda a pasta `dist/`** em HTTPS. `dist/index.html` depende dos assets; não funciona como arquivo isolado nem como e-mail no Content Builder. Mudanças nas variáveis exigem novo build.

O modo de demonstração existe somente no servidor de desenvolvimento quando `VITE_LEADS_ENDPOINT` está vazio. Ele é identificado na tela; a confirmação não afirma que houve cadastro. Sem configurações obrigatórias, o build de produção apresenta indisponibilidade ao salvar e nunca simula sucesso.

## Link compartilhado: regra de identidade

**Ter o link de alguém não comprova ser essa pessoa.** A presença de `token`, nome, e-mail, telefone, UTMs, um cookie legível por JavaScript ou uma flag como `logged=true` nunca libera dados pessoais.

| Situação                                                                                | Comportamento                                                                                           |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Sem sessão, sessão de outra pessoa ou identidade não confirmada                         | Formulário público com identificação vazia; não reutiliza dados nem interesses do dono do convite       |
| Sessão válida, validada pelo backend como pertencente ao destinatário do convite        | Perfil retornado pelo servidor; identificação recolhida se todos os dados necessários estiverem válidos |
| Sessão válida sem convite                                                               | Backend pode retornar o perfil do próprio usuário da sessão                                             |
| Telefone ausente e seleção de WhatsApp/SMS                                              | Identificação reaparece para completar o contato                                                        |
| “Conferir meus dados”                                                                   | Abre os campos do perfil confirmado                                                                     |
| “Não sou eu · fazer meu cadastro”                                                       | Limpa perfil, interesses, token e confirmação local; inicia cadastro público independente               |
| Convite expirado, resposta antiga/malformada, falha de consulta ou ausência de endpoint | Formulário público sem identificação do destinatário                                                    |
| Sessão expira no envio identificado (401/403/410)                                       | Não mostra sucesso; limpa identificação e oferece novo cadastro com aviso                               |
| `qs` de CloudPages aberto diretamente no React                                          | Não tenta decodificar nem buscar dono; oferece cadastro público                                         |

A opção “Não sou eu” não encerra a sessão do site; apenas desvincula este formulário. O envio público usa `credentials: omit`, sem token do convite, sem CSRF de sessão e sem vínculo com o destinatário. O backend também precisa garantir essa separação. Não basta esconder os campos: **o endpoint de consulta não deve enviar o perfil do dono a visitantes**, nem sequer com valores mascarados.

Esta regra substitui o preenchimento antigo diretamente por `nome/email/telefone` na URL. Esses parâmetros e as preferências pessoais do link são descartados antes da primeira renderização e removidos da barra de endereço. Como já vieram no link, podem ter sido vistos em mensagens, histórico e logs de infraestrutura: **novos disparos devem usar token opaco, nunca dados pessoais na URL**. Não há localStorage, fingerprinting nem identificação por dispositivo.

Quem abre seu próprio convite em um aparelho sem sessão também verá os campos: o frontend não consegue distinguir essa pessoa de quem recebeu o link encaminhado. Se for desejado evitar redigitação nesse caso, o time precisa implementar login/SSO ou verificação de posse via código. Essa autenticação não está implementada neste projeto. Cookie do e-commerce não fica automaticamente disponível para outro domínio/CloudPage.

## Parâmetros aceitos

Exemplo público, seguro para compartilhar:

```text
http://127.0.0.1:5173/?canal_origem=EMAIL&utm_source=salesforce&utm_medium=email&utm_campaign=black_2026
```

Exemplo de convite para produção (trocar domínio e token):

```text
https://SEU-DOMINIO/?token=TOKEN_OPACO_TEMPORARIO&canal_origem=EMAIL&utm_source=salesforce&utm_medium=email&utm_campaign=black_2026
```

| Parâmetro                                                               | Uso atual                                                                                 |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `token`                                                                 | Referência de convite; só o backend pode confrontá-lo com a sessão                        |
| `canal_origem`                                                          | `EMAIL`, `WHATSAPP`, `SMS` ou `PUSH`; sugestão de canal para novos cadastros              |
| `utm_medium`                                                            | Na falta de canal explícito, `email`/`e-mail`, `whatsapp`, `sms` ou `push` sugere o canal |
| `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`   | Atribuição informativa; nunca autoriza acesso                                             |
| `nome`, `email`, `telefone`, aliases e IDs abertos                      | Ignorados e removidos, inclusive em links antigos                                         |
| `categorias`, `canal`, `canal_preferido`, `canais`, `canais_preferidos` | Preferências pessoais do link ignoradas; visitante escolhe as próprias                    |

O canal de origem retornado pelo backend tem precedência sobre o da URL. Usuários já inscritos mantêm suas preferências salvas. Para novo perfil confirmado sem canais, a origem é usada como sugestão. Todo usuário pode alterar os canais; origem não é consentimento. UTMs também não devem conter dados pessoais. Codificar os valores de query individualmente.

## Contrato 1 — contexto de sessão e convite

`VITE_RESOLVE_ENDPOINT`: POST JSON, `credentials: include`, `cache: no-store`, timeout de 15 segundos. Chamado na abertura quando configurado, inclusive sem token. Não é um endpoint que retorna perfil apenas por token.

```json
{ "token": "TOKEN_OPACO_TEMPORARIO" }
```

Sem token, o corpo é `{}`. O backend deve:

1. Validar uma sessão real e vigente (cookie HttpOnly/SSO/BFF). A identidade vem da sessão, nunca da URL ou payload.
2. Se houver token, validar prazo, campanha e elegibilidade e confrontar a identidade da sessão com o destinatário do convite.
3. Sem sessão ou com destinatário diferente, responder como visitante **sem `cliente`, sem IDs pessoais e sem preferências do dono**.
4. Com identidade confirmada, retornar somente o perfil autorizado da sessão e um token CSRF associado a essa sessão. A consulta não deve gravar cadastro, reativar opt-in ou consumir o convite: scanners de e-mail podem abrir links antes do usuário.

Resposta pública (200):

```json
{
	"ok": true,
	"identidade_confirmada": false,
	"canal_origem": "EMAIL"
}
```

Resposta identificada (200):

```json
{
	"ok": true,
	"identidade_confirmada": true,
	"csrf_token": "TOKEN_CSRF_DA_SESSAO",
	"ja_inscrito": true,
	"canal_origem": "EMAIL",
	"cliente": {
		"nome": "Ana Silva",
		"email": "ana@example.com",
		"telefone": "85999999999",
		"canais_preferidos": ["EMAIL", "WHATSAPP"],
		"categorias": ["BELEZA"]
	}
}
```

`identidade_confirmada` deve ser booleano. Respostas antigas sem esse campo ou identificadas sem CSRF são rejeitadas e caem no formulário público. Quando falso, o frontend ignora `cliente` mesmo que venha por erro, mas isso não corrige um vazamento na rede: o backend não pode enviar esses dados.

## Contrato 2 — gravação

`VITE_LEADS_ENDPOINT`: POST JSON, timeout de 15s. O adaptador monta um payload permitido, com os campos do próprio formulário. A identidade não é decidida pelo frontend: `modo` só indica a intenção e **deve ser revalidado pelo servidor**.

Exemplo público, incluindo pessoa ainda não cadastrada:

```json
{
	"modo": "PUBLICO",
	"origem": "LANDING",
	"nome": "Bruno Silva",
	"email": "bruno@example.com",
	"telefone": "85988888888",
	"canais_preferidos": ["EMAIL", "SMS"],
	"categorias": ["BELEZA"],
	"campanha": "BLACK_2026",
	"versao_texto_legal": "VERSAO_APROVADA",
	"canal_origem": "EMAIL",
	"tracking": { "utm_source": "salesforce", "utm_campaign": "black_2026" },
	"idempotency_key": "UUID"
}
```

Público: `credentials: omit`, nenhum `token`, nenhum cabeçalho CSRF de sessão. Criar um registro de inscrição/lead independente, sem alterar a conta de uma pessoa já cadastrada apenas por coincidência de e-mail/telefone. Não herdar IDs, consentimentos, interesses ou autorização do dono do link. A forma de validar posse do novo contato e efetivar os opt-ins deve ser implementada no backend conforme as regras aprovadas.

Identificado: mesmos campos de formulário, `modo: "IDENTIFICADO"`, `origem: "SESSAO"` e `token` do convite se houver. Requisição com `credentials: include` e `X-CSRF-Token` recebido na consulta. O servidor deve revalidar sessão, CSRF, destinatário do convite, campanha e permissões **no momento da gravação**; nunca usar só o modo ou token enviado. Associar preferências à chave da sessão validada. Alterar nome/e-mail/telefone no formulário não autoriza trocar identidade nem sobrescrever a base master; definir verificação para mudanças de contato.

Retornar 200/201 **depois de persistir**, com os valores efetivamente gravados:

```json
{
	"ok": true,
	"atualizado": false,
	"preferencias": {
		"nome": "Bruno Silva",
		"email": "bruno@example.com",
		"telefone": "85988888888",
		"canais_preferidos": ["EMAIL", "SMS"],
		"categorias": ["BELEZA"]
	}
}
```

Para público, a resposta deve refletir os dados que ele próprio submeteu e que foram aceitos, nunca revelar registros encontrados pelo e-mail informado. `atualizado` refere-se às preferências autorizadas, não à existência de uma conta pesquisada anonimamente. Não retornar sucesso antes de persistência; se a Salesforce usar fila assíncrona, acompanhar a gravação ou implementar um estado pendente explícito antes de confirmar inscrição.

401/403/410 no envio identificado pedem nova identificação pelo fallback; nenhum dado é salvo automaticamente. 429 pede aguardar. Outros erros/timeout mantêm escolhas para nova tentativa. Chave de idempotência persiste nas tentativas do mesmo payload, muda após edição/troca de identidade e deve ser validada/deduplicada pelo backend, com escopo adequado à sessão ou ao cadastro público. Mesma chave com payload diferente deve ser rejeitada. Não há sucesso para resposta inválida/vazia.

## Campos e modelo de dados Salesforce

Nome (2–100 caracteres) e e-mail são obrigatórios. Telefone brasileiro com DDD é obrigatório quando WhatsApp ou SMS estiver entre os canais; opcional preenchido também é validado. Precisa haver ao menos um canal e uma categoria. Revalidar tudo no servidor.

Canais: `EMAIL`, `WHATSAPP`, `SMS`, `PUSH`. O contrato usa **`canais_preferidos: string[]`**. Somente o leitor de perfil da API mantém compatibilidade com `canal_preferido` singular. Categorias: `DERMO`, `BELEZA`, `HIGIENE`, `INFANTIL`, `EMAGRECEDORES`, `VITAMINAS`, `FARMACINHA`, `CUPOM` , `SAUDE`, `SERVICOS`, `INCONTINENCIA`, `ALIMENTOS`.

O anexo cita `DE_BLACK_CENTRAL_PREFERENCIAS`, `DE_BLACK_CENTRAL_DEPARA` e uma DE de convites. Confirmar os nomes/External Keys reais, Business Unit/MID, identidade estável, tipos, tamanhos, chaves, retenção e relacionamento com a master; não foram fornecidos esquemas ou acesso à conta. Mapear listas para registros filhos por cliente/campanha/canal ou representação textual acordada: uma DE não recebe array JavaScript como tipo nativo. Atualizar segmentações/Journeys para seleção múltipla, evitar disparos duplicados e respeitar opt-outs de cada canal. Não sobrescrever o perfil original em links encaminhados.

Implementar backend com credenciais server-to-server/Installed Package e permissões mínimas ou camada servidor de CloudPages aprovada. Segredos Salesforce, Client Secret e token OAuth ficam exclusivamente no servidor. O token do convite e o CSRF não são tokens OAuth Salesforce. Referência: [autenticação Marketing Cloud](https://trailhead.salesforce.com/content/learn/modules/marketing-cloud-apis/stay-secure-with-access-tokens).

Se usar `CloudPagesURL`, ler o `qs` no servidor da CloudPage via `RequestParameter`, validar o contexto e encaminhar um token opaco de convite ao React. A ponte precisa preservar UTMs e estabelecer/validar a sessão adequada; um redirecionamento com token sozinho não autentica. O React não descriptografa `qs`. [Referência oficial CloudPagesURL](https://developer.salesforce.com/docs/marketing/marketing-cloud-ampscript/references/mc-ampscript-sites/mc-ampscript-reference-sites-cloud-pages-url.html).

## Configuração, sessão e publicação

| Variável pública        | Finalidade                                                            |
| ----------------------- | --------------------------------------------------------------------- |
| `VITE_LEADS_ENDPOINT`   | API de gravação; obrigatória em produção                              |
| `VITE_RESOLVE_ENDPOINT` | API de contexto/sessão; sem ela, sempre usar formulário público       |
| `VITE_PRIVACY_URL`      | Política HTTPS aprovada; obrigatória para envio em produção           |
| `VITE_LEGAL_VERSION`    | Versão aprovada do texto exibido; obrigatória para envio em produção  |
| `VITE_APP_URL`          | Reservada para futuro destino de download; sem uso na interface atual |

Preferir um backend no mesmo domínio da landing conectado ao login existente. Em outro domínio, a API deve configurar CORS com origem explícita, `Access-Control-Allow-Credentials: true` e preflight para POST, Content-Type e X-CSRF-Token, além da política adequada de cookies. O `credentials: include` do React não garante que o navegador disponibilizará cookies entre sites: integrar SSO/BFF e testar bloqueio de cookies de terceiros. Não copiar cookies/tokens de autenticação para a URL ou localStorage. Verificar Origin/CSRF no backend; não confiar só em CORS.

Configurações `VITE_*` são públicas e incorporadas ao build, nunca segredos. [Referência Vite](https://vite.dev/guide/env-and-mode). Servir em HTTPS, necessário também para `crypto.randomUUID`. Usar `Cache-Control: no-store` nas respostas pessoais, não registrar PII/tokens em logs e não cachear perfil por token compartilhável. Assets com hash podem ser cacheados. Links localhost não são públicos para disparo. Definir expiração/reuso de convites, limite de tentativas, proteção antiabuso do cadastro público e horário do servidor. O backend deve validar vigência/elegibilidade mesmo no fluxo público: o fallback não autoriza inscrição em campanha encerrada.

## Pendências para liberar a campanha

- Implementar sessão/SSO + `/resolve`, gravação identificada e **cadastro público para novos leads**. Respostas de teste não substituem isso.
- Aprovar a regra de opt-in e comprovação do contato para novos usuários antes de incluí-los nos disparos. Não reativar opt-out por clique, seleção de canal ou compartilhamento. App não registra dispositivo nem concede permissão push.
- Validar texto legal, versão e link de privacidade. O texto original diz que as preferências gerais permanecem iguais: confirmar adequação para novos leads. A nota de fallback ainda usa “o canal escolhido” no singular; aprovar texto para canais múltiplos e regra quando somente alguns canais estão ativos. Nenhum texto legal novo foi inventado.
- Confirmar política para leads públicos duplicados, alterações de contato, destinatário diferente da sessão e eventual verificação por código. Aprovar como comprovar opt-in e registrar versão/data/hora por canal.
- Confirmar licença web da Rebond Grotesque. Os OTFs de 400/500/600/700/800 vieram do material Pague Menos presente no computador, estão em `src/assets/fonts/` e são servidos localmente com `font-display: swap`. WOFF2 oficiais podem substituí-los para reduzir transferência. O header usa `public/assets/logo.svg` e `black-da-pague.png`. Os ícones de canais, check e + vêm da mesma pasta. Check e + recebem filtro CSS branco para contraste, sem alterar os SVGs originais. Ao selecionar um canal, seu ícone é substituído por `check.svg`; o controle semântico de seleção múltipla continua acessível por teclado, sem caixa de checkbox visível.
- Confirmar a vigência de inscrições; não foi inventada data de fechamento.

## Homologação obrigatória na integração real

1. Abrir o mesmo link como dono autenticado, pessoa diferente autenticada, visitante em janela privada e novo usuário. Só o dono com sessão correspondente recebe seu perfil. Inspecionar a resposta de rede, não apenas os campos visíveis.
2. Visitante de link encaminhado cadastra seus próprios contatos e canais; conferir o novo registro e comprovar que nenhuma linha do dono mudou. Repetir sem token e com `qs`/parâmetros legados.
3. Testar “Não sou eu”, contatos incompletos, múltiplos canais, “Conferir meus dados”, perda de sessão durante POST, convite inválido/expirado e endpoint fora do ar. Não mostrar confirmação falsa.
4. Testar domínio de produção, sessão real do e-commerce/SSO, cookies bloqueados, CSRF inválido, CORS/preflight, links rastreados da Salesforce, scanners de e-mail e UTMs.
5. Confirmar idempotência, timeout, 429, gravação parcial, concorrência e confirmação somente após persistência. Verificar atualização/remoção de canais e filtros de opt-out nos Journeys.
6. Conferir texto aprovado, dados persistidos, fonte, foco por teclado e layouts de 320–1440px. “Ver ofertas” precede “Editar escolhas” na confirmação.

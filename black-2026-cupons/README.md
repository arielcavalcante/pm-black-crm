# Cupons Black 2026 — Pague Menos

Página irmã da landing de leads (`black-2026-landing`), com a mesma base visual e estrutura. O cliente informa o nome, escolhe as categorias de interesse, diz (se quiser) quanto pretende gastar e assiste aos cupons sendo "gerados" na hora: um código embaralha até revelar os cupons que combinam com as escolhas.

**Status:** frontend completo, sem backend. Nada é enviado à Salesforce; nome, escolhas e valor ficam só no navegador (localStorage), para a pessoa reabrir a página e ver os mesmos cupons. **Os cupons em `src/cupons.js` são exemplos fictícios.**

## Fluxo

1. **Nome** — personaliza a geração ("Só um instante, Ana") e cada cupom ("Liberado para Ana").
2. **Interesses** — os mesmos chips do passo 2 da landing. Um medidor mostra quantos cupons já foram desbloqueados a cada categoria marcada ("Quanto mais escolher, mais cupons você libera").
3. **Gasto** (opcional) — "Quanto você pretende gastar?" com opções em pílula (R$ 50, R$ 100, R$ 150, R$ 200 ou mais, Ainda não sei). O medidor mostra quantos dos cupons liberados valem para aquele valor. Dá para gerar sem responder.
4. **Gerando** (~4 s, sem etapa própria na barra: ela anda de 67% a 100% enquanto gera) — ticket com código embaralhando, barra de progresso, mensagens com as categorias escolhidas e chips sendo "analisados" um a um.
5. **Cupons** — holofotes da tela de sucesso da landing, cupons em formato de ticket entrando em sequência, código fazendo efeito de caça-níquel até parar no código real, botão **Copiar**, "Usar meus cupons no site" e "Refazer escolhas". Com valor informado, aparecem primeiro os cupons cujo pedido mínimo cabe nele; os demais vêm abaixo em "Pedido um pouco maior?", do menor mínimo para o maior (ainda copiáveis — é um incentivo a aumentar o carrinho). Se nenhum couber, todos aparecem como principais, com o aviso do mínimo.

Todos os botões são em pílula (`border-radius: 999px`).

Os códigos são os da lista: o mesmo para todos que escolherem a mesma categoria. A sensação de "gerado agora" é só de apresentação. A copy evita prometer exclusividade ("liberado para você", não "exclusivo"); ajuste com o jurídico se mudar isso.

Com `prefers-reduced-motion`, a geração dura ~1 s e não há embaralhamento.

## Editar a lista de cupons

Tudo em **`src/cupons.js`**:

```js
{
	codigo: 'BLACKDERMO15', // exatamente como o cliente digita no carrinho
	desconto: 15,
	tipo: '%',              // '%' | 'R$' | 'FRETE'
	categorias: ['DERMO'],  // códigos de CATEGORIAS; ['TODAS'] = aparece para qualquer escolha
	minimo: 99,             // opcional: pedido mínimo em reais ("Pedido mínimo de R$ 99")
	condicoes: 'Exceto medicamentos controlados', // opcional, outro texto curto
	link: 'https://…',      // opcional, mostra "Ver produtos"
}
```

- Só aparecem como opção as categorias que têm ao menos um cupom.
- Ordem na tela: cupons que cobrem mais categorias escolhidas primeiro, `TODAS` por último; empates seguem a ordem do arquivo.
- Os códigos de categoria são os mesmos da landing (`DERMO`, `BELEZA`, `HIGIENE`…), para conversar com as DEs da Salesforce. Categoria nova: adicione em `CATEGORIAS` (e na landing, se fizer sentido).
- `npm test` valida a lista (código vazio ou repetido, tipo inválido, desconto fora da faixa, categoria inexistente). Em `npm run dev`, problemas também aparecem no console.
- `FAIXAS_GASTO` define as opções da etapa 3. Cada valor significa "pretendo gastar pelo menos R$ X" e libera cupons com mínimo até X; a última vale como "ou mais" e libera todos.
- `AVISO` é o texto abaixo dos cupons; troque pelo texto aprovado.

## Executar e publicar

Node 22.12+:

```sh
npm install
npm run dev
npm test
npm run test:e2e   # usa o Google Chrome instalado
npm run build
```

Publique a pasta `dist/` inteira em HTTPS. Variáveis em `.env.local` (veja `.env.example`):

| Variável           | Uso                                                                 |
| ------------------ | ------------------------------------------------------------------- |
| `VITE_SITE_URL`    | Destino de "Usar meus cupons no site" (padrão: paguemenos.com.br)   |
| `VITE_LANDING_URL` | Se preenchida, a tela final convida para a lista da Black (landing) |

Este projeto **não** tem `.openai/hosting.json`: o da landing aponta para o projeto de hospedagem dela e publicaria por cima. Configure um destino próprio.

## Medição

Se a página tiver GTM/`dataLayer`, são enviados `cupons_gerados` (categorias, valor escolhido — ou `NAO_SEI` — e códigos exibidos) e `cupom_copiado` (código). Nenhum dado pessoal vai nesses eventos. Sem `dataLayer`, nada acontece.

## Relação com a landing

Copiados sem alteração: fontes, assets, cabeçalho, rodapé, painel, chips, botões, barra de etapas e holofotes. Todo o CSS da landing está no topo de `src/styles.css`; o que é exclusivo daqui fica no bloco `/* Cupons */` no fim do arquivo. Ajustes visuais compartilhados precisam ser feitos nos dois projetos.

## Pendências

- Substituir os cupons de exemplo pela lista aprovada e conferir cada código no carrinho.
- Aprovar `AVISO` e as condições de cada cupom.
- Se for preciso registrar interesses na Salesforce, plugar no mesmo contrato de gravação da landing (o README dela descreve sessão, CSRF e cadastro público).

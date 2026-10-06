/*
 * ─────────────────────────────────────────────────────────────────────────────
 *  LISTA DE CUPONS — este é o único arquivo que precisa ser editado.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  ⚠️  OS CUPONS ABAIXO SÃO EXEMPLOS FICTÍCIOS. Substitua pela lista aprovada
 *      antes de publicar.
 *
 *  Cada cupom:
 *    codigo      Código exato que o cliente digita no carrinho (obrigatório).
 *    desconto    Número. Ex.: 15 (ignorado quando tipo = 'FRETE').
 *    tipo        '%'      → "15% OFF"
 *                'R$'     → "R$ 15 OFF"
 *                'FRETE'  → "Frete grátis"
 *    categorias  Códigos da lista CATEGORIAS abaixo. Use ['TODAS'] para um
 *                cupom que aparece para qualquer escolha (fica por último).
 *    minimo      (opcional) Valor mínimo do pedido em reais. Ex.: 99.
 *                Aparece como "Pedido mínimo de R$ 99" e é comparado com
 *                quanto a pessoa pretende gastar (etapa 3).
 *    condicoes   (opcional) Outro texto curto exibido no cupom.
 *                Ex.: 'Exceto medicamentos controlados'.
 *    link        (opcional) URL para os produtos do cupom ("Ver produtos").
 *
 *  Ordem: quando vários cupons combinam com as escolhas, aparecem primeiro os
 *  que cobrem mais categorias escolhidas; empatados, vale a ordem desta lista.
 *  Só aparecem como opção as categorias que têm pelo menos um cupom.
 */

// Mesmos códigos e nomes da landing de leads, para as duas páginas
// conversarem entre si e com a Salesforce.
export const CATEGORIAS = [
	['DERMO', 'Dermocosméticos'],
	['BELEZA', 'Beleza'],
	['HIGIENE', 'Higiene'],
	['INFANTIL', 'Mundo infantil'],
	['EMAGRECEDORES', 'Emagrecedores'],
	['FARMACINHA', 'Farmacinha'],
	['VITAMINAS', 'Vitaminas e suplementos'],
	['SAUDE', 'Saúde e bem-estar'],
	['SERVICOS', 'Serviços de saúde'],
	['INCONTINENCIA', 'Incontinência'],
	['ALIMENTOS', 'Alimentos'],
];

export const CUPONS = [
	{
		codigo: 'EXEMPLO-DERMO15',
		desconto: 15,
		tipo: '%',
		categorias: ['DERMO'],
	},
	{
		codigo: 'EXEMPLO-BELEZA20',
		desconto: 20,
		tipo: '%',
		categorias: ['BELEZA'],
	},
	{
		codigo: 'EXEMPLO-CUIDADO10',
		desconto: 10,
		tipo: 'R$',
		categorias: ['HIGIENE', 'INCONTINENCIA'],
		minimo: 79,
	},
	{
		codigo: 'EXEMPLO-PEQUENOS',
		desconto: 10,
		tipo: '%',
		categorias: ['INFANTIL'],
	},
	{
		codigo: 'EXEMPLO-VITA20',
		desconto: 20,
		tipo: '%',
		categorias: ['VITAMINAS', 'EMAGRECEDORES'],
	},
	{
		codigo: 'EXEMPLO-FARMA15',
		desconto: 15,
		tipo: 'R$',
		categorias: ['FARMACINHA', 'SAUDE'],
		minimo: 99,
	},
	{
		codigo: 'EXEMPLO-BEMESTAR',
		desconto: 12,
		tipo: '%',
		categorias: ['SAUDE', 'SERVICOS'],
	},
	{
		codigo: 'EXEMPLO-SABOR10',
		desconto: 10,
		tipo: '%',
		categorias: ['ALIMENTOS'],
	},
	{
		codigo: 'EXEMPLO-FRETE',
		tipo: 'FRETE',
		categorias: ['TODAS'],
		minimo: 149,
	},
];

// Opções da etapa "Quanto você pretende gastar?" (opcional para o cliente).
// Cada valor é "pretendo gastar pelo menos R$ X": libera cupons com mínimo
// até X. A última opção vale como "ou mais" e libera todos os cupons.
export const FAIXAS_GASTO = [50, 100, 150, 200];

// Texto exibido abaixo dos cupons. Ajustar com o texto aprovado.
export const AVISO =
	'Confira as condições de uso de cada cupom antes de finalizar a compra.';

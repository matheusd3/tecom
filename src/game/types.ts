// Tipos do núcleo do jogo Computer Shop Tycoon

export type ProductType = "notebook" | "mouse" | "keyboard" | "monitor" | "headset" | "webcam" | "ssd" | "ram";
export type ServiceType = "diagnosis" | "repair" | "upgrade" | "cleaning";
export type EmployeeRole = "seller" | "technician" | "manager" | "consultant";
export type CustomerStatus = "waiting" | "beingServed" | "repairing" | "leaving";
export type GamePhase = "planning" | "active" | "summary";

/**
 * Passos do tutorial. Cada um aparece quando a situação que ele resolve
 * acontece pela primeira vez — nunca antes de o jogador precisar dela.
 */
export type TutorialPassoId =
  | "objetivo"
  | "atender"
  | "repor"
  | "reparo"
  | "bebedouro"
  | "fechamento"
  | "despedida";

/** Quantos dias o Seu Zé fica na loja antes de se aposentar. */
export const DIAS_COM_ZE = 3;

// ---------------------------------------------------------------- o arco

/**
 * A temporada tem fim. Era o buraco medido da Fase 6: o dia subia para sempre,
 * a meta subia junto e nada acontecia quando o jogador falhava — o caixa
 * chegava a R$ 424 mil no dia 40 falhando quase todo dia.
 */
export const DIAS_DO_ARCO = 30;

/**
 * A dívida que o Seu Zé deixa junto com a loja, em parcelas CRESCENTES.
 *
 * Crescentes por medição, não por gosto. O caixa do jogador cresce assim nos
 * dias de vencimento: 24k, 27k, 96k, 163k, 249k — quase parado até o dia 12 e
 * explodindo depois, porque a partir do dia 15 o catálogo de melhorias acaba e
 * nada mais consome dinheiro. Parcela fixa contra essa curva é sufoco no
 * começo e decoração no fim; a escada acompanha o bolso e continua doendo.
 */
export const PARCELAS_DA_DIVIDA = [10_000, 14_000, 22_000, 34_000, 50_000];
export const DIVIDA_INICIAL = PARCELAS_DA_DIVIDA.reduce((a, b) => a + b, 0);
/** Parcelas caem nos dias 6, 12, 18, 24 e 30. */
export const INTERVALO_DA_PARCELA = 6;

/** Valor da parcela número `n` (1 a 5); a última repete se passar do fim. */
export function valorDaParcela(numero: number): number {
  return PARCELAS_DA_DIVIDA[Math.min(Math.max(numero, 1), PARCELAS_DA_DIVIDA.length) - 1];
}
/** A partir daqui o fechamento avisa que a parcela está chegando. */
export const DIAS_DE_AVISO = 3;

/** Dois atrasos trazem o filho do Seu Zé à porta; três tiram a loja. */
export const ATRASOS_PARA_OFERTA = 2;
export const ATRASOS_PARA_PERDER = 3;

/** O que o Seu Zé pede além de quitar: a loja valendo mais do que ele deixou. */
export const REPUTACAO_DO_OBJETIVO = 70;

/** Quanto o filho oferece pela loja. É pouco de propósito. */
export const OFERTA_DO_FILHO = 3_000;

// ------------------------------------------------- eventos do degrau 1

/**
 * Movimento extra ganho na porta. Hoje só a blogueira concede, e é o que faz
 * dela a primeira decisão do jogo cuja consequência não cabe em 120 segundos:
 * o preço é pago hoje, na bancada, e o retorno vem nos turnos seguintes.
 */
export interface ImpulsoDeFluxo {
  /** Turnos que ainda rendem gente extra. */
  diasRestantes: number;
  /** Multiplica o intervalo entre chegadas. Menor = mais movimento. */
  fator: number;
  origem: "blogueira";
}

/**
 * O bêbado do bairro. Não compra nada e não entra na fila: ele fica no meio do
 * salão atrapalhando, e a paciência de quem espera cai mais rápido enquanto
 * ele estiver lá. Sai quando o jogador chega perto e manda sair.
 *
 * É o primeiro motivo de andar pela loja que não é carregar coisa — todo o
 * resto (buscar, levar, repor) é logística.
 */
export interface Bebado {
  chegouEm: number;
  /** Vai embora sozinho neste instante, se ninguém o expulsar antes. */
  vaiEmboraEm: number;
}

/** Quanto mais rápido a paciência cai com o bêbado no salão. */
export const BEBADO_PRESSA = 1.8;
/** Quanto tempo ele fica se ninguém o enxotar. */
export const BEBADO_DURACAO = 45;
/** Distância para conseguir mandar ele sair. */
export const ALCANCE_DO_BEBADO = 2.2;

/** Dias em que o movimento continua alto depois do conserto da blogueira. */
export const DIAS_DE_IMPULSO = 3;
/** Intervalo entre chegadas multiplicado por isto enquanto o impulso dura. */
export const FATOR_DO_IMPULSO = 0.62;
/** Reputação perdida quando o jogador recusa o conserto de graça. */
export const REPUTACAO_POR_RECUSAR_BLOGUEIRA = 6;

export type FimDoArco =
  | "vitoria"
  | "derrotaDivida"
  | "derrotaDesistencia"
  | "fimSemObjetivo";

export interface EstadoDivida {
  /** Quanto ainda falta pagar. */
  saldo: number;
  parcelasPagas: number;
  /** Parcelas que venceram sem caixa para pagar. */
  atrasos: number;
  /** Dia da próxima cobrança. */
  proximaNoDia: number;
}

export interface EstadoArco {
  divida: EstadoDivida;
  /** Preenchido quando a temporada termina; até lá, indefinido. */
  fim?: FimDoArco;
  /**
   * O filho do Seu Zé à porta, esperando resposta no fechamento. Aceitar é
   * desistir; recusar é assumir mais um mês com a dívida no pescoço.
   */
  ofertaDoFilho?: { valor: number; noDia: number };
  /** Recusou uma vez: ele não volta a bater na porta na mesma partida. */
  filhoJaFoiRecusado?: boolean;
}

export interface EstadoTutorial {
  /** Passos já mostrados. Vai no save: senão o jogo reensina tudo a cada recarga. */
  passosVistos: TutorialPassoId[];
  /** O jogador dispensou as lições. O Seu Zé continua na loja até o dia 3. */
  pulado: boolean;
  /** Passo exibido agora. Existe para o jogo não repausar a cada consulta. */
  passoNaTela?: TutorialPassoId;
}
export type ShiftEventType = "influencer" | "couponLeak" | "powerSurge";
export type RepairStatus = "queued" | "inProgress" | "ready" | "returning" | "completed";
export type UpgradeId =
  | "segundoBalcao"
  | "bancadaRapida"
  | "carrinho"
  | "prateleiraGrande"
  | "letreiroRua"
  | "cafeDaEspera"
  | "bebedouroAutomatico"
  | "cafeteiraAutomatica"
  | "treinamentoBancada"
  | "manualAtendimento"
  | "consultorSenior"
  // Linha de capacidade de atendimento: quantos itens o atendente leva por vez.
  | "cestaAtendimento"
  | "carrinhoAtendimento"
  | "carrinhoDuplo";

/** Por que esta melhoria está na oferta de hoje — a interface mostra o selo. */
export type MotivoDaOferta = "consultor" | "sorteio" | "acessivel";

export interface Upgrade {
  id: UpgradeId;
  nome: string;
  descricao: string;
  custo: number;
  requer: UpgradeId[];
  /**
   * Camada do catálogo. Serve para o consultor não empurrar uma compra de
   * R$ 4.200 no dia 1 e para a oferta subir de patamar junto com a loja.
   */
  tier: 1 | 2 | 3;
  /**
   * Gargalo que esta melhoria resolve. É o que liga a oferta ao diagnóstico do
   * consultor: sem isso o sorteio ignora o que está doendo na loja.
   */
  resolve: Gargalo;
}

/** O que estava travando a loja no turno que acabou. */
export type Gargalo = "fila" | "reparo" | "estoque" | "equipe" | "movimento" | "fluxo";

/** O que ficou guardado no estado sobre a oferta do fechamento atual. */
export interface OfertaDoDia {
  id: UpgradeId;
  motivo: MotivoDaOferta;
  /** Preenchido quando o motivo é "consultor": a observação que justifica. */
  justificativa?: string;
}

/** A oferta já casada com o catálogo, pronta para virar cartão na tela. */
export interface OfertaDeMelhoria extends Upgrade {
  motivo: MotivoDaOferta;
  justificativa?: string;
}

export interface Product {
  id: string;
  type: ProductType;
  name: string;
  basePrice: number;
  costPrice: number;
  sellingPrice: number;
  /** Unidades na PRATELEIRA: só o que está exposto pode ser vendido. */
  stock: number;
  /** Unidades no almoxarifado, esperando alguém levar para a prateleira. */
  storage: number;
  demand: number;
  repairRate: number;
  unitsSold: number;
  lastRestockedAt: number;
}

export interface Service {
  id: string;
  type: ServiceType;
  name: string;
  basePrice: number;
  difficulty: number;
  avgRepairTime: number;
}

export interface Employee {
  id: string;
  name: string;
  role: EmployeeRole;
  salary: number;
  skill: number;
  happiness: number;
  isBusy: boolean;
  busyUntil: number;
  /**
   * Tarefa que este funcionário está executando agora. É por funcionário (e não
   * uma só no estado) porque vários auxiliares podem estar em tarefas
   * diferentes ao mesmo tempo, e a cena precisa animar o trajeto de cada um.
   */
  currentTask?: "venda" | "levarReparo" | "trazerReparo" | "repor" | "cafe";
}

export interface Customer {
  id: string;
  name: string;
  satisfaction: number;
  needsProduct?: ProductType;
  needsService?: ServiceType;
  budget: number;
  patience: number;
  arrivalTime: number;
  departureTime?: number;
  status: CustomerStatus;
  story: string;
  urgency: "low" | "medium" | "high";
  /** Clientes excêntricos deixam consequências mais claras no turno. */
  trait?: "couponHunter" | "panicked" | "blogueira";
  /**
   * A blogueira não paga: ela pede o conserto de graça e o jogador decide.
   * Enquanto for `true` ela está esperando resposta no balcão.
   */
  pedeDeGraca?: boolean;
}

export interface ShiftEvent {
  type: ShiftEventType;
  title: string;
  description: string;
  /** Quantos clientes ainda são afetados. */
  remainingUses: number;
}

export interface Sale {
  id: string;
  customerId: string;
  productType: ProductType;
  quantity: number;
  price: number;
  cost: number;
  profit: number;
  timestamp: number;
}

export interface RepairOrder {
  id: string;
  customerId: string;
  serviceType: ServiceType;
  technicianId?: string;
  startTime: number;
  endTime?: number;
  price: number;
  cost: number;
  profit: number;
  completed: boolean;
  status: RepairStatus;
  /** Conserto da blogueira: não fatura, paga em movimento quando fica pronto. */
  gratuito?: boolean;
}

/**
 * Pedido de desconto levantado pelo atendente auxiliar. Ele fecha venda no
 * preço de vitrine sozinho; abaixo disso, quem decide é o dono da loja.
 */
export interface DiscountRequest {
  customerId: string;
  customerName: string;
  productName: string;
  showcasePrice: number;
  customerPrice: number;
  /** Quem pediu — aparece na tela para o jogador saber de onde veio. */
  askedBy: string;
  /** Desconto é exceção para baixo; ágio é a oferta acima da vitrine. */
  kind: "discount" | "premium";
}

export interface GameState {
  time: number;
  timeSpeed: number;
  isPaused: boolean;
  phase: GamePhase;
  day: number;
  shiftDuration: number;
  shiftTimeRemaining: number;
  dailyGoal: number;
  reputation: number;
  shiftRevenue: number;
  shiftProfit: number;
  activeEvent?: ShiftEvent;
  selectedCustomerId?: string;
  /** Instante da prioridade manual; auxiliares podem assumir após a reserva expirar. */
  selectedCustomerAt?: number;
  cash: number;
  totalRevenue: number;
  totalExpenses: number;
  products: Map<ProductType, Product>;
  employees: Map<string, Employee>;
  customers: Map<string, Customer>;
  sales: Sale[];
  repairs: RepairOrder[];
  supportTask?: string;
  /** Que tipo de tarefa o auxiliar está fazendo — a cena usa para encenar o trajeto. */
  supportTaskKind?: "venda" | "levarReparo" | "trazerReparo" | "repor" | "cafe";
  /** Venda que o auxiliar não podia decidir sozinho: primeiro pedido exibido na UI. */
  pendingDiscount?: DiscountRequest;
  /** Pedidos independentes, um por auxiliar; pendingDiscount mantém compatibilidade visual. */
  pendingDiscounts: DiscountRequest[];

  missedSales: number;
  missedRepairs: number;
  idleEmployeeTime: number;
  customerSatisfactionAvg: number;
  employeeHappinessAvg: number;
  upgrades: UpgradeId[];
  upgradesOferecidos: OfertaDoDia[];
  nivelDoBebedouro: number;
  /** Doses disponíveis na cafeteira. Café é consumível e pode ser reposto pela equipe. */
  nivelDoCafe: number;
  /**
   * Tutorial conduzido pelo Seu Zé. Mora no `GameState` — e não numa variável
   * do componente — porque tem de sobreviver ao recarregar da página junto com
   * o resto da partida (contrato 3 da Fase 6).
   */
  tutorial: EstadoTutorial;
  /** A temporada: dívida, fim e a oferta do filho. */
  arco: EstadoArco;
  /** Movimento extra herdado de turnos anteriores. */
  impulsoDeFluxo?: ImpulsoDeFluxo;
  /** O bêbado, enquanto estiver na loja. */
  bebado?: Bebado;
  /**
   * O relógio foi parado pelo JOGO para alguém falar, não pelo jogador.
   * Só esta pausa o jogo desfaz sozinho, e só ela deixa as ações passarem.
   */
  pausadoPeloJogo?: boolean;
  /** A blogueira já parou o relógio uma vez nesta partida. */
  blogueiraJaPausou?: boolean;
}

/**
 * Goles de um galão cheio. Mora aqui porque três camadas precisam do mesmo
 * número: o núcleo (que consome), a cena (que desenha a régua) e a ponte do
 * teclado (que decide se vale a pena buscar outro galão).
 */
export const GOLES_BEBEDOURO = 8;
export const DOSES_CAFE = 10;

/**
 * Quanto acima da vitrine o cliente ainda fecha sem negociação. Mora aqui
 * porque TRÊS camadas precisam do mesmo número: o núcleo decide a venda
 * direta, a ponte do teclado monta o cartão de ágio e o cartão do balcão
 * escolhe o rótulo do botão.
 *
 * Já divergiu duas vezes (1,15 no núcleo contra 1,08 nas outras duas), e o
 * sintoma é cruel de achar: o MESMO cliente vira venda direta para o
 * auxiliar e pedido de ágio para o jogador. Não copie o número.
 */
export const CUSTOMER_PRICE_TOLERANCE = 1.15;

/**
 * Quando o painel lateral é gaveta sobre a loja, em vez de coluna ao lado.
 * Mora aqui porque a interface E a cena precisam da mesma resposta: sem os
 * painéis comendo as laterais, a câmera pode chegar mais perto.
 */
export const CONSULTA_GAVETA =
  "(pointer: coarse) and (orientation: landscape) and (max-height: 500px)";

export interface Opportunity {
  id: string;
  type: "sales" | "service" | "hiring" | "pricing" | "stock";
  title: string;
  description: string;
  potentialProfit: number;
  severity: "low" | "medium" | "high";
  recommendation: string;
  timestamp: number;
  acao?: { rotulo: string; tipo: "reporPrateleira" | "comprarEstoque" | "ajustarPreco" | "contratar"; produto?: ProductType; quantidade?: number; preco?: number; funcao?: EmployeeRole };
}

export interface ActionResult {
  ok: boolean;
  message: string;
}

export interface ShiftReport {
  day: number;
  goal: number;
  revenue: number;
  profit: number;
  sales: number;
  repairs: number;
  customersLost: number;
  /** Salários do dia. Sai do caixa no fechamento, então precisa aparecer. */
  folha: number;
  /**
   * Parcela da dívida vencida neste fechamento. Sai do caixa antes de o
   * jogador ler o lucro, igual à folha — dívida que só aparece numa tela de
   * fim de jogo não é pressão, é surpresa.
   */
  parcela?: { valor: number; pago: boolean };
  reputationChange: number;
  goalReached: boolean;
  topOpportunity?: Opportunity;
  highlights: string[];
}

export interface GameHandle {
  scene: any;
  dispose(): void;
}

/**
 * Versão do formato do save. Sobe sempre que um campo muda de significado —
 * um retrato de versão diferente é recusado inteiro, porque meio estado
 * carregado é pior que começar de novo.
 */
export const VERSAO_SAVE = 4;

/**
 * O `GameState` com os `Map` desmontados em pares.
 *
 * `JSON.stringify` serializa `Map` como `{}`: sem esta conversão o jogo
 * voltaria sem produtos, sem equipe e sem clientes, e sem erro nenhum no
 * console para denunciar.
 */
export type EstadoSerializado = Omit<GameState, "products" | "employees" | "customers"> & {
  products: Array<[ProductType, Product]>;
  employees: Array<[string, Employee]>;
  customers: Array<[string, Customer]>;
};

/**
 * O que o `GameWorld` guarda FORA do `GameState`: relógios de chegada, marcos
 * do início do turno e memória do consultor. Sem eles a partida volta com o
 * estado certo e o ritmo errado — clientes chegando na hora errada e o
 * fechamento comparando com marcos zerados.
 */
export interface RelogiosSerializados {
  opportunities: Opportunity[];
  shiftReport: ShiftReport | null;
  customerSpawnTimer: number;
  nextCustomerSpawn: number;
  opportunityCheckTimer: number;
  lastOpportunityAt: Array<[string, number]>;
  shiftStartRevenue: number;
  shiftStartExpenses: number;
  shiftStartSales: number;
  shiftStartRepairs: number;
  shiftStartMissed: number;
  shiftStartReputation: number;
  customerSequence: number;
  /** `-Infinity` não sobrevive ao JSON: vai como `null` e volta como `-Infinity`. */
  lastRepairHelpAt: number | null;
  supportRotation: number;
  shiftHighlights: string[];
  supportAttendantTimer: number;
  nextDrinkAt: Array<[string, number]>;
  nextCoffeeAt: number;
  shiftPerdidosPorEspera: number;
}

/** Retrato completo da partida: tudo que precisa voltar ao recarregar a página. */
export interface InstantaneoJogo {
  versao: number;
  /** `Date.now()` de quando foi gravado — a tela inicial mostra "há X". */
  salvoEm: number;
  estado: EstadoSerializado;
  relogios: RelogiosSerializados;
}

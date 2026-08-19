// Tipos do núcleo do jogo Computer Shop Tycoon

export type ProductType = "notebook" | "mouse" | "keyboard" | "monitor" | "headset" | "webcam" | "ssd" | "ram";
export type ServiceType = "diagnosis" | "repair" | "upgrade" | "cleaning";
export type EmployeeRole = "seller" | "technician" | "manager" | "consultant";
export type CustomerStatus = "waiting" | "beingServed" | "repairing" | "leaving";
export type GamePhase = "planning" | "active" | "summary";
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
  trait?: "influencer" | "couponHunter" | "panicked";
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
}

/**
 * Goles de um galão cheio. Mora aqui porque três camadas precisam do mesmo
 * número: o núcleo (que consome), a cena (que desenha a régua) e a ponte do
 * teclado (que decide se vale a pena buscar outro galão).
 */
export const GOLES_BEBEDOURO = 8;
export const DOSES_CAFE = 10;

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
  reputationChange: number;
  goalReached: boolean;
  topOpportunity?: Opportunity;
  highlights: string[];
}

export interface GameHandle {
  scene: any;
  dispose(): void;
}

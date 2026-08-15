import {
  ActionResult,
  Customer,
  Employee,
  EmployeeRole,
  GameState,
  Opportunity,
  Product,
  ProductType,
  RepairOrder,
  Sale,
  ServiceType,
  ShiftEvent,
  ShiftReport,
} from "./types";

const MONTH_SECONDS = 14_400; // 30 dias de jogo, com 1 dia = 8 minutos
const CUSTOMER_PATIENCE_PER_SECOND = 0.38;
const CUSTOMER_SPAWN_MIN_SECONDS = 7;
const CUSTOMER_SPAWN_MAX_SECONDS = 15;
const SHIFT_DURATION = 120;
/**
 * Tempo que o cliente leva da porta até o balcão. Ninguém pode ser atendido
 * antes de chegar: sem isso o atendente auxiliar fechava a venda enquanto o
 * cliente ainda estava atravessando a loja.
 */
const CUSTOMER_WALK_IN_SECONDS = 2.5;
/**
 * Teto de contratação por função. A loja é pequena: sem limite, dava para
 * comprar a fila inteira de funcionários e o turno se resolvia sozinho.
 * O vendedor inicial é o próprio jogador e fica fora da conta.
 */
const LIMITE_EQUIPE: Record<EmployeeRole, number> = {
  seller: 2,
  technician: 3,
  manager: 1,
};
/** Preço de vitrine não passa disso vezes o valor de mercado do produto. */
const PRICE_CEILING_FACTOR = 2.5;
/** Quanto cada ajuda do jogador tira do prazo do conserto. */
const REPAIR_HELP_SECONDS = 7;
/** Intervalo mínimo entre duas ajudas, para E repetido não zerar o reparo. */
const REPAIR_HELP_COOLDOWN = 2;
const CUSTOMER_NAMES = [
  "Bia do RGB", "Caio do TCC", "Nando da LAN", "Dona Cida", "Rafa do home office",
  "Léo do podcast", "Maya do campeonato", "Seu Osmar", "Pri da entrevista", "Gui do servidor",
];

export class GameWorld {
  private state: GameState;
  private opportunities: Opportunity[] = [];
  private customerSpawnTimer = 0;
  private nextCustomerSpawn = this.randomBetween(CUSTOMER_SPAWN_MIN_SECONDS, CUSTOMER_SPAWN_MAX_SECONDS);
  private opportunityCheckTimer = 0;
  private lastPayrollMonth = 0;
  private lastOpportunityAt = new Map<string, number>();
  private shiftStartRevenue = 0;
  private shiftStartExpenses = 0;
  private shiftStartSales = 0;
  private shiftStartRepairs = 0;
  private shiftStartMissed = 0;
  private shiftStartReputation = 60;
  private shiftReport: ShiftReport | null = null;
  private customerSequence = 0;
  private lastRepairHelpAt = -Infinity;
  private supportRotation = 0;
  private shiftHighlights: string[] = [];
  private supportAttendantTimer = 0;

  constructor() {
    this.state = this.createInitialState();
  }

  public update(deltaTime: number): void {
    if (this.state.phase !== "active" || this.state.isPaused || deltaTime <= 0) return;

    const elapsed = Math.min(deltaTime, 2) * this.state.timeSpeed;
    this.state.time += elapsed;
    this.state.shiftTimeRemaining = Math.max(0, this.state.shiftTimeRemaining - elapsed);
    this.releaseFinishedEmployees();
    this.updateWaitingCustomers(elapsed);
    this.generateCustomers(elapsed);
    this.processRepairs();
    this.runSupportAttendant(elapsed);
    this.removeDepartedCustomers();
    // Desconto pendente morre com o cliente que o motivou.
    if (this.state.pendingDiscount) {
      const cliente = this.state.customers.get(this.state.pendingDiscount.customerId);
      if (!cliente || cliente.status !== "waiting") this.state.pendingDiscount = undefined;
    }
    this.processPayroll();
    this.updateDemand(elapsed);
    this.updateAverages();

    this.opportunityCheckTimer += elapsed;
    if (this.opportunityCheckTimer >= 20) {
      this.opportunityCheckTimer = 0;
      this.analyzeOpportunities();
    }
    if (this.state.shiftTimeRemaining === 0) this.finishShift();
  }

  public getState(): GameState {
    return this.state;
  }

  public getOpportunities(): Opportunity[] {
    return [...this.opportunities];
  }

  public clearOpportunities(): void {
    this.opportunities = [];
  }

  public setTimeSpeed(speed: number): void {
    this.state.timeSpeed = Math.max(0.5, Math.min(4, speed));
  }

  public togglePause(): void {
    if (this.state.phase !== "active") {
      this.startShift();
      return;
    }
    this.state.isPaused = !this.state.isPaused;
  }

  public startShift(): ActionResult {
    if (this.state.phase === "active") {
      this.state.isPaused = false;
      return { ok: true, message: "Turno retomado." };
    }
    this.state.phase = "active";
    this.state.isPaused = false;
    this.state.shiftTimeRemaining = SHIFT_DURATION;
    this.state.selectedCustomerId = undefined;
    this.shiftStartRevenue = this.state.totalRevenue;
    this.shiftStartExpenses = this.state.totalExpenses;
    this.shiftStartSales = this.state.sales.length;
    this.shiftStartRepairs = this.state.repairs.filter((repair) => repair.status === "completed").length;
    this.shiftStartMissed = this.state.missedSales + this.state.missedRepairs;
    this.shiftStartReputation = this.state.reputation;
    this.shiftReport = null;
    this.state.shiftRevenue = 0;
    this.state.shiftProfit = 0;
    this.shiftHighlights = [];
    this.state.activeEvent = this.rollShiftEvent();
    if (this.state.activeEvent) this.addHighlight(this.state.activeEvent.description);
    return { ok: true, message: `Turno ${this.state.day} iniciado.` };
  }

  public selectCustomer(customerId: string): ActionResult {
    const customer = this.state.customers.get(customerId);
    if (!customer || customer.status !== "waiting") return { ok: false, message: "Cliente não está mais na fila." };
    this.state.selectedCustomerId = customerId;
    return { ok: true, message: `${customer.name} foi priorizado.` };
  }

  public getShiftReport(): ShiftReport | null {
    return this.shiftReport;
  }

  /** Quantos ainda cabem na equipe. O jogador é o vendedor da casa e não conta. */
  public vagasRestantes(role: EmployeeRole): number {
    const limite = LIMITE_EQUIPE[role];
    const contratados = Array.from(this.state.employees.values()).filter(
      (employee) => employee.role === role && employee.id !== "seller-1"
    ).length;
    return Math.max(0, limite - contratados);
  }

  public hireEmployee(role: EmployeeRole, name: string): boolean {
    if (this.vagasRestantes(role) === 0) return false;
    const salary = role === "seller" ? 2_000 : role === "technician" ? 2_500 : 3_000;
    const onboardingCost = salary * 2;
    if (this.state.cash < onboardingCost) return false;

    const id = `employee-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
    this.state.employees.set(id, {
      id,
      name: name.trim() || "Novo funcionário",
      role,
      salary,
      skill: 50,
      happiness: 80,
      isBusy: false,
      busyUntil: 0,
    });
    this.recordExpense(onboardingCost);
    return true;
  }

  /** A compra chega no ALMOXARIFADO. Da prateleira só sai o que alguém repôs. */
  public buyStock(productType: ProductType, quantity: number): boolean {
    const product = this.state.products.get(productType);
    const amount = Math.max(0, Math.floor(quantity));
    if (!product || amount === 0) return false;
    const cost = product.costPrice * amount;
    if (this.state.cash < cost) return false;

    product.storage += amount;
    product.lastRestockedAt = this.state.time;
    this.recordExpense(cost);
    return true;
  }

  /** Quantas unidades cabem numa viagem do almoxarifado até a prateleira. */
  public static readonly CAIXA_DE_REPOSICAO = 5;

  /** O que falta na prateleira e existe no almoxarifado — o que vale buscar. */
  public produtoParaRepor(): ProductType | undefined {
    let escolhido: Product | undefined;
    for (const product of this.state.products.values()) {
      if (product.storage <= 0) continue;
      // Prioriza o que está mais vazio na prateleira; empate vai para a demanda.
      if (
        !escolhido ||
        product.stock < escolhido.stock ||
        (product.stock === escolhido.stock && product.demand > escolhido.demand)
      ) {
        escolhido = product;
      }
    }
    return escolhido?.type;
  }

  /** Move uma caixa do almoxarifado para a prateleira. */
  public restockShelf(productType: ProductType, quantity = GameWorld.CAIXA_DE_REPOSICAO): ActionResult {
    const product = this.state.products.get(productType);
    if (!product) return { ok: false, message: "Produto desconhecido." };
    if (product.storage <= 0) {
      return { ok: false, message: `Não há ${product.name} no almoxarifado. Compre no painel de estoque.` };
    }
    const movidas = Math.min(product.storage, Math.max(1, Math.floor(quantity)));
    product.storage -= movidas;
    product.stock += movidas;
    return {
      ok: true,
      message: `${movidas} ${product.name} na prateleira (${product.storage} no almoxarifado).`,
    };
  }

  /** Teto de preço: acima disso nenhum cliente compraria mesmo, e o número só
   *  serviria para estourar a interface. */
  public precoMaximo(productType: ProductType): number {
    const product = this.state.products.get(productType);
    return product ? Math.round(product.basePrice * PRICE_CEILING_FACTOR * 100) / 100 : 0;
  }

  public setProductPrice(productType: ProductType, newPrice: number): boolean {
    const product = this.state.products.get(productType);
    if (!product || !Number.isFinite(newPrice) || newPrice < product.costPrice) return false;
    if (newPrice > this.precoMaximo(productType)) return false;
    product.sellingPrice = Math.round(newPrice * 100) / 100;
    return true;
  }

  /** Fecha manualmente uma venda. O jogo nunca vende automaticamente. */
  /**
   * `sellerId` existe para o atendente auxiliar fechar a própria venda sem
   * consumir a disponibilidade do vendedor do jogador.
   */
  public sellToCustomer(customerId: string, offeredPrice: number, sellerId?: string): ActionResult {
    const customer = this.state.customers.get(customerId);
    if (!customer?.needsProduct || customer.status !== "waiting") {
      return { ok: false, message: "Esse cliente não está disponível para atendimento." };
    }
    if (!this.chegouAoBalcao(customer)) {
      return { ok: false, message: `${customer.name} ainda está entrando na loja.` };
    }
    const escolhido = sellerId ? this.state.employees.get(sellerId) : this.availableEmployee("seller");
    const seller = escolhido && !escolhido.isBusy ? escolhido : undefined;
    if (!seller) return { ok: false, message: "Todos os vendedores estão ocupados." };
    const product = this.state.products.get(customer.needsProduct);
    if (!product) return { ok: false, message: "Produto desconhecido." };
    if (product.stock <= 0) {
      return {
        ok: false,
        message: product.storage > 0
          ? `Prateleira vazia: há ${product.storage} ${product.name} no almoxarifado para repor.`
          : `Sem ${product.name} na prateleira nem no almoxarifado.`,
      };
    }
    const price = Math.round(offeredPrice * 100) / 100;
    if (price < product.costPrice) return { ok: false, message: "Essa oferta fica abaixo do custo." };
    if (price > customer.budget) return { ok: false, message: "O cliente não aceita esse valor." };

    const serviceDuration = Math.max(3, 10 - seller.skill / 15);
    seller.isBusy = true;
    seller.busyUntil = this.state.time + serviceDuration;
    product.stock--;
    product.unitsSold++;
    this.state.sales.push({
      id: `sale-${Math.floor(this.state.time * 1000)}`, customerId: customer.id,
      productType: product.type, quantity: 1, price, cost: product.costPrice,
      profit: price - product.costPrice, timestamp: this.state.time,
    });
    this.recordRevenue(price);
    this.state.shiftProfit += price - product.costPrice;
    customer.satisfaction = Math.min(100, 72 + seller.skill / 4 + (price < product.sellingPrice ? 8 : 0));
    customer.status = "leaving";
    customer.departureTime = this.state.time + 2;
    seller.happiness = Math.min(100, seller.happiness + 1);
    const bonus = this.applyCustomerTrait(customer, "sale");
    return { ok: true, message: `Venda fechada por R$ ${price.toFixed(2).replace(".", ",")}.${bonus}` };
  }

  /** Recebe o aparelho no balcão para que alguém o leve à assistência. */
  public receiveRepair(customerId: string): ActionResult {
    const customer = this.state.customers.get(customerId);
    if (!customer?.needsService || customer.status !== "waiting") {
      return { ok: false, message: "Esse reparo não está disponível." };
    }
    if (!this.chegouAoBalcao(customer)) {
      return { ok: false, message: `${customer.name} ainda está entrando na loja.` };
    }
    customer.status = "beingServed";
    // Depois de receber o aparelho, ele deixa a fila. A próxima interação deve
    // mirar um cliente que ainda aguarda, não o reparo que já está em trânsito.
    this.state.selectedCustomerId = undefined;
    return { ok: true, message: "Aparelho recebido. Leve-o à bancada técnica." };
  }

  /** Deixa o aparelho na assistência. Se o técnico estiver ocupado, entra na pilha. */
  public acceptRepair(customerId: string): ActionResult {
    const customer = this.state.customers.get(customerId);
    if (!customer?.needsService || customer.status !== "beingServed") {
      return { ok: false, message: "Receba o aparelho no balcão antes de levá-lo à assistência." };
    }
    const technician = this.availableEmployee("technician");
    const skill = technician?.skill ?? 50;
    const price = 180 + skill * 1.5;
    const cost = price * 0.2;
    const surgeDelay = this.state.activeEvent?.type === "powerSurge" && this.consumeEventUse("powerSurge") ? 18 : 0;
    const duration = Math.max(18, 58 - skill * 0.3) + surgeDelay;
    const repair: RepairOrder = {
      id: `repair-${Math.floor(this.state.time * 1000)}`, customerId: customer.id,
      serviceType: customer.needsService, technicianId: technician?.id, startTime: this.state.time,
      endTime: undefined, price, cost, profit: price - cost, completed: false,
      status: "queued",
    };
    this.state.repairs.push(repair);
    customer.status = "repairing";
    if (technician) this.startRepair(repair, technician, duration);
    if (surgeDelay) this.addHighlight("Pico de energia atrasou um reparo em 18 s.");
    return technician
      ? { ok: true, message: `Aparelho na bancada: previsão de ${Math.ceil(duration)} s de jogo.` }
      : { ok: true, message: "Técnico ocupado: aparelho entrou na pilha da assistência." };
  }

  /**
   * O jogador põe a mão no conserto. Se ninguém começou (técnico ocupado), ele
   * mesmo assume a bancada; se já está rodando, cada ajuda encurta o prazo.
   */
  public helpRepair(): ActionResult {
    const naFila = this.state.repairs.find((repair) => repair.status === "queued");
    if (naFila) {
      // Sem técnico livre quem trabalha é o jogador — e rende menos que um
      // profissional, senão contratar técnico não faria diferença.
      const duracao = Math.max(24, 58 - 35 * 0.3);
      naFila.startTime = this.state.time;
      naFila.endTime = this.state.time + duracao;
      naFila.status = "inProgress";
      naFila.technicianId = undefined;
      this.lastRepairHelpAt = this.state.time;
      this.addHighlight("Sem técnico livre: o próprio atendente assumiu um conserto.");
      return { ok: true, message: `Você assumiu o conserto: ${Math.ceil(duracao)} s de jogo.` };
    }

    const emAndamento = this.state.repairs.find((repair) => repair.status === "inProgress");
    if (!emAndamento?.endTime) {
      return { ok: false, message: "Não há conserto para ajudar nesta bancada." };
    }
    if (this.state.time - this.lastRepairHelpAt < REPAIR_HELP_COOLDOWN) {
      return { ok: false, message: "Calma: deixe o técnico trabalhar um pouco antes de ajudar de novo." };
    }
    this.lastRepairHelpAt = this.state.time;
    const restanteAntes = emAndamento.endTime - this.state.time;
    emAndamento.endTime = this.state.time + Math.max(2, restanteAntes - REPAIR_HELP_SECONDS);
    const restante = Math.ceil(emAndamento.endTime - this.state.time);
    const tecnico = emAndamento.technicianId ? this.state.employees.get(emAndamento.technicianId) : undefined;
    if (tecnico) tecnico.busyUntil = emAndamento.endTime;
    return { ok: true, message: `Você ajudou no conserto: faltam ${restante} s.` };
  }

  /** Fecha a venda que o auxiliar não podia decidir sozinho. */
  public approveDiscount(): ActionResult {
    const pedido = this.state.pendingDiscount;
    if (!pedido) return { ok: false, message: "Não há desconto esperando aprovação." };
    const helper = Array.from(this.state.employees.values()).find(
      (employee) => employee.role === "seller" && employee.id !== "seller-1" && !employee.isBusy
    );
    const resultado = this.sellToCustomer(pedido.customerId, pedido.customerPrice, helper?.id);
    if (resultado.ok) {
      this.state.pendingDiscount = undefined;
      this.state.supportTask = `${pedido.askedBy} fechou ${pedido.productName} com o desconto aprovado.`;
      this.state.supportTaskKind = "venda";
      if (helper) {
        helper.isBusy = true;
        helper.busyUntil = this.state.time + 4;
      }
    }
    return resultado;
  }

  public declineDiscount(): ActionResult {
    const pedido = this.state.pendingDiscount;
    if (!pedido) return { ok: false, message: "Não há desconto esperando aprovação." };
    this.state.pendingDiscount = undefined;
    return { ok: true, message: `Preço mantido para ${pedido.customerName}.` };
  }

  /** Retira um reparo pronto para devolvê-lo ao balcão. */
  public collectCompletedRepair(customerId: string): ActionResult {
    const repair = this.state.repairs.find((item) => item.customerId === customerId && item.status === "ready");
    if (!repair) return { ok: false, message: "Nenhum aparelho pronto para retirar nesta bancada." };
    repair.status = "returning";
    return { ok: true, message: "Aparelho reparado retirado. Leve-o ao balcão." };
  }

  /** Devolve o aparelho reparado e só então fecha financeiramente a ordem. */
  public returnRepairToCustomer(customerId: string): ActionResult {
    const repair = this.state.repairs.find((item) => item.customerId === customerId && item.status === "returning");
    const customer = this.state.customers.get(customerId);
    if (!repair || !customer) return { ok: false, message: "Esse aparelho não está pronto para devolução." };
    repair.status = "completed";
    repair.completed = true;
    this.recordRevenue(repair.price);
    this.state.shiftProfit += repair.profit;
    customer.satisfaction = 95;
    customer.status = "leaving";
    customer.departureTime = this.state.time + 2;
    return { ok: true, message: "Reparo entregue no balcão e pagamento recebido." };
  }

  public declineCustomer(customerId: string): ActionResult {
    const customer = this.state.customers.get(customerId);
    if (!customer || customer.status !== "waiting") return { ok: false, message: "Esse cliente não está disponível." };
    this.loseCustomer(customer, "dispensado no balcão");
    return { ok: true, message: "Cliente dispensado. A reputação sentiu a porta batendo." };
  }

  public reset(): void {
    this.state = this.createInitialState();
    this.opportunities = [];
    this.customerSpawnTimer = 0;
    this.opportunityCheckTimer = 0;
    this.lastPayrollMonth = 0;
    this.lastOpportunityAt.clear();
    this.customerSequence = 0;
    this.shiftHighlights = [];
    this.supportAttendantTimer = 0;
  }

  private createInitialState(): GameState {
    const products = new Map<ProductType, Product>();
    const catalog: Array<[ProductType, string, number, number]> = [
      ["notebook", "Notebook", 2_500, 4], ["mouse", "Mouse", 50, 8],
      ["keyboard", "Teclado", 150, 6], ["monitor", "Monitor", 800, 4],
      ["headset", "Headset", 200, 5], ["webcam", "Webcam", 300, 5],
      ["ssd", "SSD", 400, 5], ["ram", "Memória RAM", 300, 5],
    ];
    for (const [type, name, basePrice, stock] of catalog) {
      products.set(type, {
        id: `product-${type}`, type, name, basePrice,
        costPrice: basePrice * 0.6, sellingPrice: basePrice * 1.25, stock,
        // A loja abre com uma reserva nos fundos; o resto é decisão de compra.
        storage: stock * 2,
        demand: this.randomBetween(35, 75), repairRate: type === "notebook" || type === "monitor" ? 25 : 8,
        unitsSold: 0, lastRestockedAt: 0,
      });
    }

    const employees = new Map<string, Employee>();
    employees.set("seller-1", { id: "seller-1", name: "João Vendedor", role: "seller", salary: 2_000, skill: 60, happiness: 80, isBusy: false, busyUntil: 0 });
    employees.set("tech-1", { id: "tech-1", name: "Maria Técnica", role: "technician", salary: 2_500, skill: 70, happiness: 78, isBusy: false, busyUntil: 0 });

    return {
      time: 0, timeSpeed: 1, isPaused: true, phase: "planning", day: 1,
      shiftDuration: SHIFT_DURATION, shiftTimeRemaining: SHIFT_DURATION, dailyGoal: 900, reputation: 60,
      cash: 10_000,
      shiftRevenue: 0, shiftProfit: 0,
      totalRevenue: 0, totalExpenses: 0, monthlyRevenue: 0, monthlyExpenses: 0,
      products, employees, customers: new Map(), sales: [], repairs: [],
      missedSales: 0, missedRepairs: 0, idleEmployeeTime: 0,
      customerSatisfactionAvg: 80, employeeHappinessAvg: 79,
    };
  }

  private generateCustomers(elapsed: number): void {
    if (Array.from(this.state.customers.values()).filter((customer) => customer.status === "waiting").length >= 3) return;
    this.customerSpawnTimer += elapsed;
    if (this.customerSpawnTimer < this.nextCustomerSpawn) return;
    this.customerSpawnTimer = 0;
    this.nextCustomerSpawn = this.randomBetween(CUSTOMER_SPAWN_MIN_SECONDS, CUSTOMER_SPAWN_MAX_SECONDS);
    const productTypes: ProductType[] = ["notebook", "mouse", "keyboard", "monitor", "headset", "webcam", "ssd", "ram"];
    const wantsProduct = Math.random() < 0.7;
    const type = productTypes[Math.floor(Math.random() * productTypes.length)];
    const product = this.state.products.get(type)!;
    const id = `customer-${Math.floor(this.state.time * 1000)}-${Math.floor(Math.random() * 10_000)}`;
    const trait = this.nextCustomerTrait();
    const couponDiscount = this.state.activeEvent?.type === "couponLeak" && wantsProduct && this.consumeEventUse("couponLeak") ? 0.12 : 0;
    const influencerBoost = trait === "influencer" ? 0.12 : 0;
    this.customerSequence++;
    const name = trait === "influencer" ? "Nina do TechTok" : `${CUSTOMER_NAMES[(this.customerSequence - 1) % CUSTOMER_NAMES.length]} #${this.customerSequence}`;
    this.state.customers.set(id, {
      id, name, satisfaction: 55,
      needsProduct: wantsProduct ? type : undefined,
      needsService: wantsProduct ? undefined : "repair",
      // O orçamento é o máximo que o cliente aceita pagar, e ele se ancora no
      // VALOR DE MERCADO do item (basePrice), não no preço que a loja pediu.
      // Seguir a vitrine transformava preço alto em dinheiro grátis: bastava
      // pedir 1e+106 que o cliente aceitava. Agora subir o preço afasta
      // compradores, que é o trade-off que a decisão de preço deveria ter.
      budget: wantsProduct
        ? Math.round(product.basePrice * (1 - couponDiscount + influencerBoost) * this.randomBetween(0.95, 1.6) * 100) / 100
        : 0,
      patience: trait === "panicked" ? this.randomBetween(38, 62) : this.randomBetween(55, 100), arrivalTime: this.state.time, status: "waiting",
      urgency: Math.random() < 0.22 ? "high" : Math.random() < 0.55 ? "medium" : "low",
      story: this.customerStory(wantsProduct ? this.productStory(type) : this.repairStory(), trait, couponDiscount > 0),
      trait,
    });
  }

  private updateWaitingCustomers(elapsed: number): void {
    for (const customer of this.state.customers.values()) {
      if (customer.status !== "waiting") continue;
      const urgencyMultiplier = customer.urgency === "high" ? 1.65 : customer.urgency === "medium" ? 1.2 : 1;
      customer.patience = Math.max(0, customer.patience - elapsed * CUSTOMER_PATIENCE_PER_SECOND * urgencyMultiplier);
      if (customer.patience > 0) continue;
      this.loseCustomer(customer, "cansou de esperar");
    }
  }

  private processRepairs(): void {
    for (const repair of this.state.repairs) {
      if (repair.status !== "inProgress" || !repair.endTime || repair.endTime > this.state.time) continue;
      repair.status = "ready";
      const technician = repair.technicianId ? this.state.employees.get(repair.technicianId) : undefined;
      if (technician) {
        technician.isBusy = false;
        technician.happiness = Math.min(100, technician.happiness + 2);
      }
      this.addHighlight("Um aparelho ficou pronto na bancada; devolva-o no balcão para receber.");
    }
    for (const repair of this.state.repairs.filter((item) => item.status === "queued")) {
      const technician = this.availableEmployee("technician");
      if (!technician) break;
      const duration = Math.max(18, 58 - technician.skill * 0.3);
      this.startRepair(repair, technician, duration);
    }
  }

  private startRepair(repair: RepairOrder, technician: Employee, duration: number): void {
    repair.technicianId = technician.id;
    repair.startTime = this.state.time;
    repair.endTime = this.state.time + duration;
    repair.status = "inProgress";
    technician.isBusy = true;
    technician.busyUntil = repair.endTime;
  }

  /**
   * O segundo vendedor é um atendente auxiliar de verdade: ele fica no balcão.
   * Prioridade dele é VENDER — assim o jogador pode ficar na assistência — e a
   * logística de reparo é o que ele faz quando não há venda para fechar.
   *
   * Ele nunca decide um desconto: se o cliente não paga o preço de vitrine, a
   * venda continua parada esperando a aprovação do dono da loja. E não rouba o
   * cliente que o jogador priorizou (quem está com `selectedCustomerId`).
   */
  private runSupportAttendant(elapsed: number): void {
    const attendants = Array.from(this.state.employees.values()).filter((employee) => employee.role === "seller");
    if (attendants.length < 2) {
      this.state.supportTask = undefined;
      this.state.supportTaskKind = undefined;
      return;
    }
    this.supportAttendantTimer += elapsed;
    if (this.supportAttendantTimer < 7) return;
    this.supportAttendantTimer = 0;

    // Cada auxiliar livre pega a própria tarefa nesta rodada. Antes só o
    // primeiro trabalhava: contratar o terceiro não mudava nada na loja.
    // O rodízio importa quando há menos tarefa que gente — sem ele o primeiro
    // da lista pegava tudo e os outros pareciam enfeite.
    const auxiliares = attendants.filter((employee) => employee.id !== "seller-1");
    this.supportRotation = (this.supportRotation + 1) % Math.max(1, auxiliares.length);
    const ordem = [
      ...auxiliares.slice(this.supportRotation),
      ...auxiliares.slice(0, this.supportRotation),
    ];
    for (const helper of ordem) {
      if (helper.isBusy) continue;
      this.darTarefaAoAuxiliar(helper);
    }
  }

  /** Uma tarefa para um auxiliar livre. Devolve false se não havia o que fazer. */
  private darTarefaAoAuxiliar(helper: Employee): boolean {
    const ocupar = (tarefa: string, tipo: NonNullable<Employee["currentTask"]>) => {
      helper.isBusy = true;
      helper.busyUntil = this.state.time + 4;
      helper.currentTask = tipo;
      this.state.supportTask = tarefa;
      this.state.supportTaskKind = tipo;
    };

    const atendivel = (customer: Customer) =>
      customer.status === "waiting" &&
      this.chegouAoBalcao(customer) &&
      customer.id !== this.state.selectedCustomerId;

    const vendaDireta = Array.from(this.state.customers.values()).find((customer) => {
      if (!atendivel(customer) || !customer.needsProduct) return false;
      const product = this.state.products.get(customer.needsProduct);
      return !!product && product.stock > 0 && customer.budget >= product.sellingPrice;
    });
    if (vendaDireta?.needsProduct) {
      const product = this.state.products.get(vendaDireta.needsProduct)!;
      const resultado = this.sellToCustomer(vendaDireta.id, product.sellingPrice, helper.id);
      if (resultado.ok) {
        ocupar(`${helper.name} vendeu ${product.name} no balcão.`, "venda");
        return true;
      }
    }

    // Cliente que quer comprar mas não paga a vitrine: o auxiliar não decide,
    // ele PERGUNTA. Antes ele simplesmente pulava, e de fora parecia que o
    // vendedor às vezes trabalhava e às vezes não.
    if (!this.state.pendingDiscount) {
      const precisaAval = Array.from(this.state.customers.values()).find((customer) => {
        if (!atendivel(customer) || !customer.needsProduct) return false;
        const product = this.state.products.get(customer.needsProduct);
        return !!product && product.stock > 0 && customer.budget < product.sellingPrice;
      });
      if (precisaAval?.needsProduct) {
        const product = this.state.products.get(precisaAval.needsProduct)!;
        this.state.pendingDiscount = {
          customerId: precisaAval.id,
          customerName: precisaAval.name,
          productName: product.name,
          showcasePrice: product.sellingPrice,
          customerPrice: precisaAval.budget,
          askedBy: helper.name,
        };
        this.state.supportTask = `${helper.name} pediu aprovação de desconto em ${product.name}.`;
        this.state.supportTaskKind = undefined;
        return true;
      }
    }

    const waitingRepair = Array.from(this.state.customers.values()).find(
      (customer) => atendivel(customer) && customer.needsService
    );
    if (waitingRepair) {
      this.receiveRepair(waitingRepair.id);
      this.acceptRepair(waitingRepair.id);
      ocupar(`${helper.name} levou um aparelho para a assistência.`, "levarReparo");
      return true;
    }
    const readyRepair = this.state.repairs.find(
      (repair) => repair.status === "ready" && !this.reparoJaEmMaos(repair.customerId)
    );
    if (readyRepair) {
      this.collectCompletedRepair(readyRepair.customerId);
      this.returnRepairToCustomer(readyRepair.customerId);
      ocupar(`${helper.name} devolveu um reparo pronto ao balcão.`, "trazerReparo");
      return true;
    }

    // Sem cliente para atender, o auxiliar abastece a prateleira. É a tarefa de
    // menor prioridade: atender vem antes de arrumar.
    const paraRepor = this.produtoParaRepor();
    if (paraRepor && (this.state.products.get(paraRepor)?.stock ?? 0) < 6) {
      const resultado = this.restockShelf(paraRepor);
      if (resultado.ok) {
        const nome = this.state.products.get(paraRepor)?.name ?? "mercadoria";
        ocupar(`${helper.name} repôs ${nome} na prateleira.`, "repor");
        return true;
      }
    }
    return false;
  }

  /** Evita dois auxiliares saindo atrás do mesmo aparelho na mesma rodada. */
  private reparoJaEmMaos(customerId: string): boolean {
    return this.state.repairs.some(
      (repair) => repair.customerId === customerId && repair.status === "returning"
    );
  }

  /** O cliente só pode ser atendido depois de atravessar a loja. */
  private chegouAoBalcao(customer: Customer): boolean {
    return this.state.time - customer.arrivalTime >= CUSTOMER_WALK_IN_SECONDS;
  }

  private releaseFinishedEmployees(): void {
    for (const employee of this.state.employees.values()) {
      if (employee.role !== "technician" && employee.isBusy && employee.busyUntil <= this.state.time) {
        employee.isBusy = false;
        employee.currentTask = undefined;
      }
      if (!employee.isBusy) this.state.idleEmployeeTime += this.state.timeSpeed;
    }
  }

  private leaveCustomer(customer: Customer, reason: "stock" | "price"): void {
    customer.satisfaction = reason === "stock" ? 20 : 35;
    customer.status = "leaving";
    customer.departureTime = this.state.time + 2;
    this.state.missedSales++;
  }

  private removeDepartedCustomers(): void {
    for (const [id, customer] of this.state.customers) {
      if (customer.status === "leaving" && customer.departureTime && customer.departureTime <= this.state.time) {
        this.state.customers.delete(id);
        if (this.state.selectedCustomerId === id) this.state.selectedCustomerId = undefined;
      }
    }
  }

  private finishShift(): void {
    // A loja fechou: a fila não atravessa magicamente para o próximo dia.
    // Isso transforma o último minuto em uma decisão real, inclusive quando a
    // meta já foi atingida e o jogador cogita ignorar quem ficou esperando.
    for (const customer of this.state.customers.values()) {
      if (customer.status === "waiting") this.loseCustomer(customer, "ficou sem atendimento até o fechamento");
    }
    // Aparelho na assistência não vira pó no fechamento: o cliente continua na
    // loja e o serviço retoma no próximo turno. O que estiver pronto pode ser
    // devolvido no balcão mesmo com a loja fechada.
    const naAssistencia = this.state.repairs.filter(
      (repair) => repair.status !== "completed"
    );
    if (naAssistencia.length) {
      const prontos = naAssistencia.filter((repair) => repair.status === "ready" || repair.status === "returning").length;
      this.addHighlight(
        prontos
          ? `${naAssistencia.length} aparelho(s) na assistência — ${prontos} pronto(s) para devolver agora no balcão; o resto retoma no próximo turno.`
          : `${naAssistencia.length} aparelho(s) continuam na assistência e o conserto retoma no próximo turno.`
      );
    }
    this.analyzeOpportunities();
    const revenue = this.state.totalRevenue - this.shiftStartRevenue;
    const profit = this.state.shiftProfit - (this.state.totalExpenses - this.shiftStartExpenses);
    const sales = this.state.sales.length - this.shiftStartSales;
    const repairs = this.state.repairs.filter((repair) => repair.status === "completed").length - this.shiftStartRepairs;
    const customersLost = this.state.missedSales + this.state.missedRepairs - this.shiftStartMissed;
    const goalReached = revenue >= this.state.dailyGoal;
    if (goalReached) this.state.reputation = Math.min(100, this.state.reputation + 5);
    this.shiftReport = {
      day: this.state.day, goal: this.state.dailyGoal, revenue, profit, sales, repairs, customersLost,
      reputationChange: this.state.reputation - this.shiftStartReputation,
      goalReached, topOpportunity: this.opportunities[0], highlights: [...this.shiftHighlights],
    };
    this.state.phase = "summary";
    this.state.isPaused = true;
    this.state.day++;
    this.state.dailyGoal = 900 + (this.state.day - 1) * 180;
  }

  private processPayroll(): void {
    const currentMonth = Math.floor(this.state.time / MONTH_SECONDS);
    if (currentMonth <= this.lastPayrollMonth) return;
    this.lastPayrollMonth = currentMonth;
    this.state.monthlyRevenue = 0;
    this.state.monthlyExpenses = 0;
    const salaries = Array.from(this.state.employees.values()).reduce((total, employee) => total + employee.salary, 0);
    this.recordExpense(salaries);
    if (this.state.cash >= 0) return;
    for (const employee of this.state.employees.values()) employee.happiness = Math.max(0, employee.happiness - 15);
  }

  private analyzeOpportunities(): void {
    for (const product of this.state.products.values()) {
      if (product.stock <= 2 && product.demand >= 55) {
        // Prateleira vazia com caixa cheia no almoxarifado é problema de
        // reposição, não de compra: a recomendação precisa dizer isso.
        const temNoAlmoxarifado = product.storage > 0;
        this.addOpportunity(
          `stock-${product.type}`,
          "stock",
          temNoAlmoxarifado ? `Prateleira vazia: ${product.name}` : `Estoque baixo: ${product.name}`,
          temNoAlmoxarifado
            ? `${product.stock} na prateleira e ${product.storage} parado(s) no almoxarifado, com demanda de ${Math.round(product.demand)}%.`
            : `${product.stock} unidade(s) e nada no almoxarifado, para uma demanda de ${Math.round(product.demand)}%.`,
          product.sellingPrice * 4,
          "high",
          temNoAlmoxarifado
            ? `Vá ao almoxarifado, pegue uma caixa de ${product.name} e reponha a prateleira.`
            : `Compre ${product.name} no painel: a mercadoria chega no almoxarifado.`
        );
      }
      if (product.stock >= 10 && product.unitsSold === 0 && this.state.time - product.lastRestockedAt > 300) {
        this.addOpportunity(`pricing-${product.type}`, "pricing", `${product.name} está parado no estoque`,
          "Há muitas unidades sem nenhuma venda recente.", product.sellingPrice - product.costPrice,
          "medium", "Teste uma redução de preço ou destaque este item em uma promoção.");
      }
    }
    if (this.state.missedSales >= 3) {
      this.addOpportunity("missed-sales", "sales", `${this.state.missedSales} vendas perdidas`,
        "Clientes não encontraram estoque ou orçamento compatível.", this.state.missedSales * 120,
        "high", "Verifique itens sem estoque e revise preços acima do orçamento dos clientes.");
    }
    const waitingRepairs = Array.from(this.state.customers.values()).filter((customer) => customer.status === "waiting" && customer.needsService).length;
    if (waitingRepairs >= 2) {
      this.addOpportunity("repair-queue", "service", "Fila na assistência técnica",
        `${waitingRepairs} clientes aguardam atendimento técnico.`, waitingRepairs * 220,
        "high", "Contrate um técnico ou aumente a habilidade da equipe atual.");
    }
    const waitingSales = Array.from(this.state.customers.values()).filter((customer) => customer.status === "waiting" && customer.needsProduct).length;
    if (waitingSales >= 3) {
      this.addOpportunity("sales-queue", "hiring", "Fila de clientes no balcão",
        `${waitingSales} clientes aguardam um vendedor.`, waitingSales * 90,
        "medium", "Contrate outro vendedor para reduzir a espera e evitar desistências.");
    }
  }

  private addOpportunity(key: string, type: Opportunity["type"], title: string, description: string, potentialProfit: number, severity: Opportunity["severity"], recommendation: string): void {
    const lastShown = this.lastOpportunityAt.get(key) ?? -Infinity;
    if (this.state.time - lastShown < 90) return;
    this.lastOpportunityAt.set(key, this.state.time);
    this.opportunities.unshift({ id: `opp-${key}-${Math.floor(this.state.time)}`, type, title, description, potentialProfit: Math.round(potentialProfit), severity, recommendation, timestamp: this.state.time });
    this.opportunities = this.opportunities.slice(0, 10);
  }

  private updateDemand(elapsed: number): void {
    for (const product of this.state.products.values()) {
      const movement = (Math.random() - 0.45) * elapsed * 1.4;
      product.demand = Math.max(5, Math.min(100, product.demand + movement));
    }
  }

  private updateAverages(): void {
    const customers = Array.from(this.state.customers.values());
    if (customers.length) this.state.customerSatisfactionAvg = customers.reduce((total, customer) => total + customer.satisfaction, 0) / customers.length;
    const employees = Array.from(this.state.employees.values());
    this.state.employeeHappinessAvg = employees.reduce((total, employee) => total + employee.happiness, 0) / Math.max(1, employees.length);
  }

  private availableEmployee(role: EmployeeRole): Employee | undefined {
    return Array.from(this.state.employees.values()).find((employee) => employee.role === role && !employee.isBusy);
  }

  private recordRevenue(value: number): void {
    this.state.cash += value;
    this.state.totalRevenue += value;
    this.state.monthlyRevenue += value;
    this.state.shiftRevenue += value;
  }

  private recordExpense(value: number): void {
    this.state.cash -= value;
    this.state.totalExpenses += value;
    this.state.monthlyExpenses += value;
  }

  private randomBetween(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  private productStory(type: ProductType): string {
    const stories: Record<ProductType, string[]> = {
      notebook: ["Preciso trabalhar hoje à noite.", "Meu computador morreu antes da faculdade."],
      mouse: ["Quero melhorar meu setup sem gastar demais."],
      keyboard: ["Vou começar no emprego novo amanhã."],
      monitor: ["Preciso de mais espaço para editar vídeos."],
      headset: ["Tenho campeonato online hoje."],
      webcam: ["Tenho uma entrevista por vídeo em uma hora."],
      ssd: ["Meu PC está travando com arquivos do trabalho."],
      ram: ["Quero deixar meu computador mais rápido."],
    };
    const options = stories[type];
    return options[Math.floor(Math.random() * options.length)];
  }

  private repairStory(): string {
    const stories = ["O notebook não liga e tenho uma entrega urgente.", "Derrubei água no teclado ontem.", "Meu computador faz um barulho estranho desde cedo."];
    return stories[Math.floor(Math.random() * stories.length)];
  }

  private rollShiftEvent(): ShiftEvent | undefined {
    const roll = Math.random();
    if (roll < 0.28) return {
      type: "influencer", title: "TechTok na fila",
      description: "Uma criadora de conteúdo pode aparecer. Uma boa venda vira propaganda gratuita.", remainingUses: 1,
    };
    if (roll < 0.52) return {
      type: "couponLeak", title: "Cupom vazou",
      description: "Um cupom misterioso circulou no grupo do bairro: os próximos dois clientes chegam querendo desconto.", remainingUses: 2,
    };
    if (roll < 0.68) return {
      type: "powerSurge", title: "Pico de energia",
      description: "A régua de energia está fazendo barulho de pipoca. O próximo reparo pode atrasar.", remainingUses: 1,
    };
    return undefined;
  }

  private nextCustomerTrait(): Customer["trait"] {
    if (this.state.activeEvent?.type === "influencer" && this.state.activeEvent.remainingUses > 0) {
      this.consumeEventUse("influencer");
      return "influencer";
    }
    const roll = Math.random();
    if (roll < 0.18) return "panicked";
    if (roll < 0.32) return "couponHunter";
    return undefined;
  }

  private customerStory(base: string, trait: Customer["trait"], couponAffected: boolean): string {
    if (trait === "influencer") return `${base} Ela já abriu a câmera: "se der certo, viraliza".`;
    if (trait === "panicked") return `${base} Está olhando o relógio a cada cinco segundos.`;
    if (couponAffected || trait === "couponHunter") return `${base} Chegou com um print de cupom e confiança demais.`;
    return base;
  }

  private applyCustomerTrait(customer: Customer, action: "sale" | "repair"): string {
    if (customer.trait !== "influencer" || action !== "sale") return "";
    this.state.reputation = Math.min(100, this.state.reputation + 4);
    this.addHighlight("Nina do TechTok aprovou a compra: +4 de reputação e uma fila mais animada.");
    return " Nina do TechTok postou a compra: +4 de reputação!";
  }

  private loseCustomer(customer: Customer, reason: string): void {
    customer.satisfaction = 0;
    customer.status = "leaving";
    customer.departureTime = this.state.time + 2;
    if (customer.needsProduct) this.state.missedSales++;
    else this.state.missedRepairs++;
    const penalty = customer.trait === "influencer" ? 7 : customer.urgency === "high" ? 4 : 2;
    this.state.reputation = Math.max(0, this.state.reputation - penalty);
    this.addHighlight(`${customer.name} ${reason}: reputação ${penalty > 0 ? `-${penalty}` : "inalterada"}.`);
  }

  private consumeEventUse(type: ShiftEvent["type"]): boolean {
    const event = this.state.activeEvent;
    if (!event || event.type !== type || event.remainingUses <= 0) return false;
    event.remainingUses--;
    return true;
  }

  private addHighlight(message: string): void {
    if (!this.shiftHighlights.includes(message)) this.shiftHighlights.push(message);
    this.shiftHighlights = this.shiftHighlights.slice(-4);
  }
}

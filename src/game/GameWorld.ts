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
} from "./types";

const MONTH_SECONDS = 14_400; // 30 dias de jogo, com 1 dia = 8 minutos
const CUSTOMER_PATIENCE_PER_SECOND = 0.38;
const CUSTOMER_SPAWN_MIN_SECONDS = 7;
const CUSTOMER_SPAWN_MAX_SECONDS = 15;

export class GameWorld {
  private state: GameState;
  private opportunities: Opportunity[] = [];
  private customerSpawnTimer = 0;
  private nextCustomerSpawn = this.randomBetween(CUSTOMER_SPAWN_MIN_SECONDS, CUSTOMER_SPAWN_MAX_SECONDS);
  private opportunityCheckTimer = 0;
  private lastPayrollMonth = 0;
  private lastOpportunityAt = new Map<string, number>();

  constructor() {
    this.state = this.createInitialState();
  }

  public update(deltaTime: number): void {
    if (this.state.isPaused || deltaTime <= 0) return;

    const elapsed = Math.min(deltaTime, 2) * this.state.timeSpeed;
    this.state.time += elapsed;
    this.releaseFinishedEmployees();
    this.updateWaitingCustomers(elapsed);
    this.generateCustomers(elapsed);
    this.processRepairs();
    this.removeDepartedCustomers();
    this.processPayroll();
    this.updateDemand(elapsed);
    this.updateAverages();

    this.opportunityCheckTimer += elapsed;
    if (this.opportunityCheckTimer >= 20) {
      this.opportunityCheckTimer = 0;
      this.analyzeOpportunities();
    }
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
    this.state.isPaused = !this.state.isPaused;
  }

  public hireEmployee(role: EmployeeRole, name: string): boolean {
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

  public buyStock(productType: ProductType, quantity: number): boolean {
    const product = this.state.products.get(productType);
    const amount = Math.max(0, Math.floor(quantity));
    if (!product || amount === 0) return false;
    const cost = product.costPrice * amount;
    if (this.state.cash < cost) return false;

    product.stock += amount;
    product.lastRestockedAt = this.state.time;
    this.recordExpense(cost);
    return true;
  }

  public setProductPrice(productType: ProductType, newPrice: number): boolean {
    const product = this.state.products.get(productType);
    if (!product || !Number.isFinite(newPrice) || newPrice < product.costPrice) return false;
    product.sellingPrice = Math.round(newPrice * 100) / 100;
    return true;
  }

  /** Fecha manualmente uma venda. O jogo nunca vende automaticamente. */
  public sellToCustomer(customerId: string, offeredPrice: number): ActionResult {
    const customer = this.state.customers.get(customerId);
    if (!customer?.needsProduct || customer.status !== "waiting") {
      return { ok: false, message: "Esse cliente não está disponível para atendimento." };
    }
    const seller = this.availableEmployee("seller");
    if (!seller) return { ok: false, message: "Todos os vendedores estão ocupados." };
    const product = this.state.products.get(customer.needsProduct);
    if (!product || product.stock <= 0) return { ok: false, message: "O produto está sem estoque." };
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
    customer.satisfaction = Math.min(100, 72 + seller.skill / 4 + (price < product.sellingPrice ? 8 : 0));
    customer.status = "leaving";
    customer.departureTime = this.state.time + 2;
    seller.happiness = Math.min(100, seller.happiness + 1);
    return { ok: true, message: `Venda fechada por R$ ${price.toFixed(2).replace(".", ",")}.` };
  }

  /** Aceita manualmente uma ordem de serviço para o próximo técnico livre. */
  public acceptRepair(customerId: string): ActionResult {
    const customer = this.state.customers.get(customerId);
    if (!customer?.needsService || customer.status !== "waiting") {
      return { ok: false, message: "Esse reparo não está disponível." };
    }
    const technician = this.availableEmployee("technician");
    if (!technician) return { ok: false, message: "Todos os técnicos estão ocupados." };
    const price = 180 + technician.skill * 1.5;
    const cost = price * 0.2;
    const duration = Math.max(18, 58 - technician.skill * 0.3);
    const endTime = this.state.time + duration;
    this.state.repairs.push({
      id: `repair-${Math.floor(this.state.time * 1000)}`, customerId: customer.id,
      serviceType: customer.needsService, technicianId: technician.id, startTime: this.state.time,
      endTime, price, cost, profit: price - cost, completed: false,
    });
    customer.status = "repairing";
    technician.isBusy = true;
    technician.busyUntil = endTime;
    return { ok: true, message: `Ordem aceita: previsão de ${Math.ceil(duration)} s de jogo.` };
  }

  public declineCustomer(customerId: string): ActionResult {
    const customer = this.state.customers.get(customerId);
    if (!customer || customer.status !== "waiting") return { ok: false, message: "Esse cliente não está disponível." };
    customer.satisfaction = 20;
    customer.status = "leaving";
    customer.departureTime = this.state.time + 2;
    if (customer.needsProduct) this.state.missedSales++;
    else this.state.missedRepairs++;
    return { ok: true, message: "Cliente dispensado." };
  }

  public reset(): void {
    this.state = this.createInitialState();
    this.opportunities = [];
    this.customerSpawnTimer = 0;
    this.opportunityCheckTimer = 0;
    this.lastPayrollMonth = 0;
    this.lastOpportunityAt.clear();
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
        demand: this.randomBetween(35, 75), repairRate: type === "notebook" || type === "monitor" ? 25 : 8,
        unitsSold: 0, lastRestockedAt: 0,
      });
    }

    const employees = new Map<string, Employee>();
    employees.set("seller-1", { id: "seller-1", name: "João Vendedor", role: "seller", salary: 2_000, skill: 60, happiness: 80, isBusy: false, busyUntil: 0 });
    employees.set("tech-1", { id: "tech-1", name: "Maria Técnica", role: "technician", salary: 2_500, skill: 70, happiness: 78, isBusy: false, busyUntil: 0 });

    return {
      time: 0, timeSpeed: 1, isPaused: false, cash: 10_000,
      totalRevenue: 0, totalExpenses: 0, monthlyRevenue: 0, monthlyExpenses: 0,
      products, employees, customers: new Map(), sales: [], repairs: [],
      missedSales: 0, missedRepairs: 0, idleEmployeeTime: 0,
      customerSatisfactionAvg: 80, employeeHappinessAvg: 79,
    };
  }

  private generateCustomers(elapsed: number): void {
    if (Array.from(this.state.customers.values()).some((customer) => customer.status === "waiting")) return;
    this.customerSpawnTimer += elapsed;
    if (this.customerSpawnTimer < this.nextCustomerSpawn) return;
    this.customerSpawnTimer = 0;
    this.nextCustomerSpawn = this.randomBetween(CUSTOMER_SPAWN_MIN_SECONDS, CUSTOMER_SPAWN_MAX_SECONDS);
    const productTypes: ProductType[] = ["notebook", "mouse", "keyboard", "monitor", "headset", "webcam", "ssd", "ram"];
    const wantsProduct = Math.random() < 0.7;
    const type = productTypes[Math.floor(Math.random() * productTypes.length)];
    const id = `customer-${Math.floor(this.state.time * 1000)}-${Math.floor(Math.random() * 10_000)}`;
    this.state.customers.set(id, {
      id, name: `Cliente ${this.state.customers.size + 1}`, satisfaction: 55,
      needsProduct: wantsProduct ? type : undefined,
      needsService: wantsProduct ? undefined : "repair",
      budget: wantsProduct ? this.randomBetween(80, 3_500) : 0,
      patience: 100, arrivalTime: this.state.time, status: "waiting",
    });
    // Cada chegada é uma decisão. A loja aguarda o jogador em vez de agir sozinha.
    this.state.isPaused = true;
  }

  private updateWaitingCustomers(elapsed: number): void {
    for (const customer of this.state.customers.values()) {
      if (customer.status !== "waiting") continue;
      customer.patience = Math.max(0, customer.patience - elapsed * CUSTOMER_PATIENCE_PER_SECOND);
      if (customer.patience > 0) continue;
      customer.satisfaction = 0;
      customer.status = "leaving";
      customer.departureTime = this.state.time + 2;
      if (customer.needsProduct) this.state.missedSales++;
      else this.state.missedRepairs++;
    }
  }

  private processRepairs(): void {
    for (const repair of this.state.repairs) {
      if (repair.completed || !repair.endTime || repair.endTime > this.state.time) continue;
      repair.completed = true;
      this.recordRevenue(repair.price);
      const technician = this.state.employees.get(repair.technicianId);
      if (technician) {
        technician.isBusy = false;
        technician.happiness = Math.min(100, technician.happiness + 2);
      }
      const customer = this.state.customers.get(repair.customerId);
      if (customer) {
        customer.satisfaction = 95;
        customer.status = "leaving";
        customer.departureTime = this.state.time + 2;
      }
    }

  }

  private releaseFinishedEmployees(): void {
    for (const employee of this.state.employees.values()) {
      if (employee.isBusy && employee.busyUntil <= this.state.time) employee.isBusy = false;
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
      if (customer.status === "leaving" && customer.departureTime && customer.departureTime <= this.state.time) this.state.customers.delete(id);
    }
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
        this.addOpportunity(`stock-${product.type}`, "stock", `Estoque baixo: ${product.name}`,
          `${product.stock} unidade(s) para uma demanda de ${Math.round(product.demand)}%.`, product.sellingPrice * 4,
          "high", `Compre 5 unidades de ${product.name} para evitar vendas perdidas.`);
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
  }

  private recordExpense(value: number): void {
    this.state.cash -= value;
    this.state.totalExpenses += value;
    this.state.monthlyExpenses += value;
  }

  private randomBetween(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }
}

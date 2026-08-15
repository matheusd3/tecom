// Tipos do núcleo do jogo Computer Shop Tycoon

export type ProductType = "notebook" | "mouse" | "keyboard" | "monitor" | "headset" | "webcam" | "ssd" | "ram";
export type ServiceType = "diagnosis" | "repair" | "upgrade" | "cleaning";
export type EmployeeRole = "seller" | "technician" | "manager";
export type CustomerStatus = "waiting" | "beingServed" | "repairing" | "leaving";
export type GamePhase = "planning" | "active" | "summary";
export type ShiftEventType = "influencer" | "couponLeak" | "powerSurge";
export type RepairStatus = "queued" | "inProgress" | "ready" | "returning" | "completed";

export interface Product {
  id: string;
  type: ProductType;
  name: string;
  basePrice: number;
  costPrice: number;
  sellingPrice: number;
  stock: number;
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
  cash: number;
  totalRevenue: number;
  totalExpenses: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  products: Map<ProductType, Product>;
  employees: Map<string, Employee>;
  customers: Map<string, Customer>;
  sales: Sale[];
  repairs: RepairOrder[];
  supportTask?: string;
  missedSales: number;
  missedRepairs: number;
  idleEmployeeTime: number;
  customerSatisfactionAvg: number;
  employeeHappinessAvg: number;
}

export interface Opportunity {
  id: string;
  type: "sales" | "service" | "hiring" | "pricing" | "stock";
  title: string;
  description: string;
  potentialProfit: number;
  severity: "low" | "medium" | "high";
  recommendation: string;
  timestamp: number;
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
  reputationChange: number;
  goalReached: boolean;
  topOpportunity?: Opportunity;
  highlights: string[];
}

export interface GameHandle {
  scene: any;
  dispose(): void;
}

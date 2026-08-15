// scene.ts — Cena Babylon de fundo e ponte com o GameWorld.
//
// A cena 3D é apenas ambientação: o dashboard HTML é a interface real do jogo.
// Regras do contrato Babylon-in-React (ver manus-adaptations.md):
//  - createGameScene(engine, canvas) devolve um GameHandle com { scene, dispose }.
//  - Esta função NÃO inicia o render loop; quem controla o ciclo de vida é o
//    GameCanvas, que chama handle.update(dt) e depois scene.render().

import { Scene } from "@babylonjs/core/scene";
import type { Engine } from "@babylonjs/core/Engines/engine";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { GameWorld } from "./GameWorld";
import type { Employee, EmployeeRole, ProductType } from "./types";

export type PlayerStation = "balcao" | "prateleira" | "bancada" | "loja";

export interface GameHandle {
  scene: Scene;
  world: GameWorld;
  /** Posição atual do atendente para a interface contextual. */
  getPlayerStation(): PlayerStation;
  getCarriedProduct(): ProductType | undefined;
  getCarriedRepairCustomerId(): string | undefined;
  pickUpProduct(productType: ProductType): boolean;
  pickUpRepair(customerId: string): boolean;
  putDownProduct(): void;
  /** Avança a simulação e a animação da cena. deltaSeconds em segundos reais. */
  update(deltaSeconds: number): void;
  dispose(): void;
}

// Referência de módulo mantida por compatibilidade com quem já usava
// getGameWorld(). A fonte de verdade continua sendo o GameHandle.
let gameWorld: GameWorld | null = null;

export function getGameWorld(): GameWorld | null {
  return gameWorld;
}

export function resetGameWorld(): void {
  gameWorld = null;
}

const CIANO = new Color3(0, 0.9, 1);
const MAGENTA = new Color3(1, 0.18, 0.59);
const LIMA = new Color3(0.71, 1, 0.23);
const AZUL_LOJA = new Color3(0.1, 0.48, 0.82);
const CORAL = new Color3(1, 0.32, 0.2);
const AMARELO = new Color3(1, 0.78, 0.16);
const CREME = new Color3(0.96, 0.91, 0.78);

export async function createGameScene(
  engine: Engine,
  _canvas: HTMLCanvasElement
): Promise<GameHandle> {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.059, 0.078, 0.098, 1); // #0F1419

  // Câmera fixa: sem attachControl, porque o mouse pertence ao dashboard.
  const camera = new ArcRotateCamera(
    "camera",
    -Math.PI / 2,
    Math.PI / 3.1,
    52,
    new Vector3(0, 0, 0),
    scene
  );
  camera.minZ = 0.1;

  const luz = new HemisphericLight("luz", new Vector3(0, 1, 0), scene);
  luz.intensity = 1.45;

  criarAmbiente(scene);
  const player = criarAtendente(scene);

  const world = new GameWorld();
  const repairPiles = criarPilhasDeReparo(scene, world);
  // João é o avatar controlado pela pessoa jogando. Os demais contratados
  // ganham corpos próprios e aparecem/desaparecem conforme a equipe muda.
  const equipeVisivel = criarEquipeVisivel(scene, world);
  gameWorld = world;

  return {
    scene,
    world,
    update(deltaSeconds: number) {
      world.update(deltaSeconds);
      player.update(deltaSeconds);
      equipeVisivel.update(deltaSeconds);
      repairPiles.update();
    },
    getPlayerStation() {
      return player.station();
    },
    getCarriedProduct() {
      return player.carriedProduct();
    },
    getCarriedRepairCustomerId() {
      return player.carriedRepairCustomerId();
    },
    pickUpProduct(productType) {
      return player.pickUpProduct(productType);
    },
    pickUpRepair(customerId) {
      return player.pickUpRepair(customerId);
    },
    putDownProduct() {
      player.putDownProduct();
    },
    dispose() {
      player.dispose();
      equipeVisivel.dispose();
      scene.dispose();
      if (gameWorld === world) {
        gameWorld = null;
      }
    },
  };
}

function criarAmbiente(scene: Scene): void {
  const chao = CreateGround("loja-chao", { width: 76, height: 58 }, scene);
  const matChao = new StandardMaterial("mat-loja-chao", scene);
  matChao.diffuseColor = CREME;
  matChao.specularColor = Color3.Black();
  chao.material = matChao;

  // Azulejos grandes dão leitura rápida de um jogo de gestão em tempo real.
  const grade = CreateGround(
    "grade",
    { width: 76, height: 58, subdivisions: 20 },
    scene
  );
  grade.position.y = 0.02;
  const matGrade = new StandardMaterial("matGrade", scene);
  matGrade.wireframe = true;
  matGrade.disableLighting = true;
  matGrade.emissiveColor = AZUL_LOJA.scale(0.62);
  grade.material = matGrade;

  criarParede(scene, "parede-fundo", new Vector3(0, 6, 27), new Vector3(76, 12, 1), AZUL_LOJA);
  criarParede(scene, "parede-esquerda", new Vector3(-37.5, 6, 0), new Vector3(1, 12, 58), CORAL);
  criarParede(scene, "parede-direita", new Vector3(37.5, 6, 0), new Vector3(1, 12, 58), CORAL);

  // Entrada frontal e vitrines laterais.
  criarParede(scene, "vitrine-esquerda", new Vector3(-24, 5, -27), new Vector3(24, 10, 0.7), AMARELO);
  criarParede(scene, "vitrine-direita", new Vector3(24, 5, -27), new Vector3(24, 10, 0.7), AMARELO);
  criarParede(scene, "porta-loja", new Vector3(0, 4.5, -27), new Vector3(10, 9, 0.35), AZUL_LOJA);
  criarFachadaColorida(scene);

  criarPrateleira(scene, "estoque-a", new Vector3(-24, 0, 15), CORAL);
  criarPrateleira(scene, "estoque-b", new Vector3(-10, 0, 15), AMARELO);
  criarPrateleira(scene, "estoque-c", new Vector3(4, 0, 15), AZUL_LOJA);
  criarPrateleira(scene, "estoque-d", new Vector3(18, 0, 15), LIMA);

  criarBalcao(scene);
  criarBancadaTecnica(scene);

  criarEstacao(scene, "balcao", new Vector3(0, 0.25, -15), new Vector3(16, 0.5, 4), CORAL);
  criarEstacao(scene, "bancada", new Vector3(26, 0.25, 9), new Vector3(9, 0.5, 6), LIMA);
  criarEstacao(scene, "prateleira", new Vector3(-11, 0.2, 15), new Vector3(38, 0.4, 8), AMARELO);
}

function criarParede(scene: Scene, name: string, position: Vector3, size: Vector3, color: Color3): void {
  const wall = CreateBox(name, { width: size.x, height: size.y, depth: size.z }, scene);
  wall.position = position;
  const material = new StandardMaterial(`mat-${name}`, scene);
  material.diffuseColor = color;
  material.emissiveColor = color.scale(0.18);
  material.specularColor = Color3.Black();
  wall.material = material;
}

function criarPrateleira(scene: Scene, name: string, position: Vector3, accent: Color3): void {
  const escuro = new Color3(0.16, 0.22, 0.28);
  criarParede(scene, `${name}-corpo`, new Vector3(position.x, 3.5, position.z), new Vector3(10, 7, 2.2), escuro);
  for (let tier = 0; tier < 3; tier++) {
    criarParede(scene, `${name}-nivel-${tier}`, new Vector3(position.x, 1.45 + tier * 2, position.z - 1.22), new Vector3(9.2, 0.18, 0.35), accent.scale(0.55));
    for (let item = 0; item < 3; item++) {
      const caixa = CreateBox(`${name}-produto-${tier}-${item}`, { width: 1.65, height: 1.05, depth: 0.8 }, scene);
      caixa.position = new Vector3(position.x - 3 + item * 3, 0.75 + tier * 2, position.z - 1.35);
      const material = new StandardMaterial(`mat-${name}-produto-${tier}-${item}`, scene);
      material.disableLighting = true;
      material.emissiveColor = (item === 1 ? accent : item === 2 ? CORAL : AZUL_LOJA).scale(0.72);
      caixa.material = material;
    }
  }
}

function criarBalcao(scene: Scene): void {
  criarParede(scene, "balcao-corpo", new Vector3(0, 1.7, -16.2), new Vector3(16, 3.2, 2.4), CORAL.scale(0.55));
  criarParede(scene, "balcao-tampo", new Vector3(0, 3.45, -16.2), new Vector3(16.5, 0.28, 2.7), AMARELO);
  criarParede(scene, "balcao-faixa", new Vector3(0, 1.7, -17.45), new Vector3(14, 0.28, 0.15), CREME);
}

function criarBancadaTecnica(scene: Scene): void {
  criarParede(scene, "bancada-corpo", new Vector3(26, 1.55, 9), new Vector3(9, 3, 4.8), AZUL_LOJA.scale(0.64));
  criarParede(scene, "bancada-tampo", new Vector3(26, 3.18, 9), new Vector3(9.4, 0.26, 5.15), LIMA);
  const monitor = CreateBox("bancada-monitor", { width: 2.8, height: 1.8, depth: 0.22 }, scene);
  monitor.position = new Vector3(26, 4.25, 9.7);
  const matMonitor = new StandardMaterial("mat-bancada-monitor", scene);
  matMonitor.disableLighting = true;
  matMonitor.emissiveColor = LIMA.scale(0.65);
  monitor.material = matMonitor;
}

function criarPilhasDeReparo(scene: Scene, world: GameWorld): { update(): void } {
  const aguardando = criarCaixasDePilha(scene, "fila-assistencia", CORAL);
  const prontos = criarCaixasDePilha(scene, "prontos-assistencia", CIANO);
  const organizar = (caixas: Mesh[], quantidade: number, origem: Vector3) => {
    caixas.forEach((caixa, index) => {
      caixa.setEnabled(index < quantidade);
      if (index < quantidade) {
        caixa.position = new Vector3(origem.x + (index % 3) * 1.25, 0.75 + Math.floor(index / 3) * 0.75, origem.z);
      }
    });
  };
  return {
    update() {
      const repairs = world.getState().repairs;
      organizar(aguardando, repairs.filter((repair) => repair.status === "queued").length, new Vector3(21.5, 0, 12.5));
      organizar(prontos, repairs.filter((repair) => repair.status === "ready").length, new Vector3(28, 0, 12.5));
    },
  };
}

function criarCaixasDePilha(scene: Scene, name: string, color: Color3): Mesh[] {
  return Array.from({ length: 6 }, (_, index) => {
    const caixa = CreateBox(`${name}-${index}`, { width: 1.05, height: 0.65, depth: 0.9 }, scene);
    const material = new StandardMaterial(`mat-${name}-${index}`, scene);
    material.disableLighting = true;
    material.emissiveColor = color.scale(0.8);
    caixa.material = material;
    caixa.setEnabled(false);
    return caixa;
  });
}

function criarFachadaColorida(scene: Scene): void {
  const cores = [CORAL, AMARELO, AZUL_LOJA, LIMA, CORAL, AMARELO];
  cores.forEach((color, index) => {
    criarParede(scene, `faixa-fachada-${index}`, new Vector3(-27.5 + index * 11, 10.5, -27.45), new Vector3(10.5, 1.6, 0.2), color);
  });
}

function criarEstacao(scene: Scene, name: string, position: Vector3, size: Vector3, color: Color3): void {
  const station = CreateBox(`estacao-${name}`, { width: size.x, height: size.y, depth: size.z }, scene);
  station.position = position;
  const material = new StandardMaterial(`mat-estacao-${name}`, scene);
  material.disableLighting = true;
  material.emissiveColor = color.scale(0.32);
  material.alpha = 0.8;
  station.material = material;
}

type FuncionarioVisual = { root: TransformNode; role: EmployeeRole; phase: number };

/** Mostra no salão cada funcionário que não é o atendente controlado pelo jogador. */
function criarEquipeVisivel(scene: Scene, world: GameWorld): { update(deltaSeconds: number): void; dispose(): void } {
  const visuais = new Map<string, FuncionarioVisual>();
  let elapsed = 0;

  const criarVisual = (employee: Employee): FuncionarioVisual => {
    const root = new TransformNode(`funcionario-${employee.id}`, scene);
    const isTech = employee.role === "technician";
    const corpo = CreateBox(`funcionario-corpo-${employee.id}`, { width: 1.45, height: 2.15, depth: 1.05 }, scene);
    corpo.parent = root;
    corpo.position.y = 1.08;
    const cabeca = CreateSphere(`funcionario-cabeca-${employee.id}`, { diameter: 1.25, segments: 12 }, scene);
    cabeca.parent = root;
    cabeca.position.y = 2.72;
    const uniforme = new StandardMaterial(`mat-funcionario-${employee.id}`, scene);
    uniforme.disableLighting = true;
    uniforme.emissiveColor = isTech ? MAGENTA : AMARELO;
    corpo.material = uniforme;
    const rosto = new StandardMaterial(`mat-rosto-funcionario-${employee.id}`, scene);
    rosto.disableLighting = true;
    rosto.emissiveColor = isTech ? CREME : CIANO;
    cabeca.material = rosto;

    const marca = CreateBox(`funcionario-marca-${employee.id}`, { width: 2.75, height: 0.06, depth: 2.75 }, scene);
    marca.parent = root;
    marca.position.y = 0.04;
    const matMarca = new StandardMaterial(`mat-marca-funcionario-${employee.id}`, scene);
    matMarca.disableLighting = true;
    matMarca.emissiveColor = isTech ? MAGENTA.scale(0.7) : AMARELO.scale(0.72);
    matMarca.alpha = 0.7;
    marca.material = matMarca;
    return { root, role: employee.role, phase: Math.random() * Math.PI * 2 };
  };

  const posicionar = (employee: Employee, visual: FuncionarioVisual, sellerIndex: number) => {
    // Técnico fica junto da bancada. Atendentes auxiliares ocupam vagas atrás
    // do balcão, sem se confundir com o personagem controlado pelo jogador.
    if (employee.role === "technician") {
      visual.root.position.x = employee.isBusy ? 29.5 : 31.5;
      visual.root.position.z = employee.isBusy ? 7.5 : 12.5;
      visual.root.rotation.y = Math.PI;
    } else {
      visual.root.position.x = -6 + sellerIndex * 5;
      visual.root.position.z = -12.7;
      visual.root.rotation.y = Math.PI;
    }
  };

  return {
    update(deltaSeconds) {
      elapsed += deltaSeconds;
      const employees = Array.from(world.getState().employees.values()).filter((employee) => employee.id !== "seller-1");
      const activeIds = new Set(employees.map((employee) => employee.id));
      for (const [id, visual] of visuais) {
        if (!activeIds.has(id)) {
          visual.root.dispose(false, true);
          visuais.delete(id);
        }
      }

      let sellerIndex = 0;
      for (const employee of employees) {
        let visual = visuais.get(employee.id);
        if (!visual) {
          visual = criarVisual(employee);
          visuais.set(employee.id, visual);
        }
        posicionar(employee, visual, employee.role === "seller" ? sellerIndex++ : 0);
        visual.root.position.y = Math.sin(elapsed * (employee.isBusy ? 5 : 2.2) + visual.phase) * 0.06;
      }
    },
    dispose() {
      for (const visual of visuais.values()) visual.root.dispose(false, true);
      visuais.clear();
    },
  };
}

function criarAtendente(scene: Scene): {
  update(deltaSeconds: number): void;
  station(): PlayerStation;
  carriedProduct(): ProductType | undefined;
  carriedRepairCustomerId(): string | undefined;
  pickUpProduct(productType: ProductType): boolean;
  pickUpRepair(customerId: string): boolean;
  putDownProduct(): void;
  dispose(): void;
} {
  const root = new TransformNode("atendente", scene);
  // Começa em frente ao balcão, na parte aberta do enquadramento. Assim o
  // atendente permanece visível mesmo quando há um cartão de cliente aberto.
  root.position = new Vector3(0, 0, -18);
  const corpo = CreateBox("atendente-corpo", { width: 1.7, height: 2.4, depth: 1.2 }, scene);
  corpo.parent = root;
  corpo.position.y = 1.2;
  const cabeca = CreateSphere("atendente-cabeca", { diameter: 1.45, segments: 12 }, scene);
  cabeca.parent = root;
  cabeca.position.y = 3.05;

  const uniforme = new StandardMaterial("mat-atendente", scene);
  uniforme.disableLighting = true;
  uniforme.emissiveColor = CIANO;
  corpo.material = uniforme;
  const rosto = new StandardMaterial("mat-atendente-rosto", scene);
  rosto.disableLighting = true;
  rosto.emissiveColor = MAGENTA;
  cabeca.material = rosto;

  const base = CreateBox("atendente-marca", { width: 3.2, height: 0.08, depth: 3.2 }, scene);
  base.parent = root;
  base.position.y = 0.06;
  const materialBase = new StandardMaterial("mat-atendente-marca", scene);
  materialBase.disableLighting = true;
  materialBase.emissiveColor = LIMA.scale(0.8);
  materialBase.alpha = 0.75;
  base.material = materialBase;

  const caixa = CreateBox("atendente-caixa", { width: 1.35, height: 0.85, depth: 1.1 }, scene);
  caixa.parent = root;
  caixa.position = new Vector3(0, 2.15, 0.95);
  const materialCaixa = new StandardMaterial("mat-atendente-caixa", scene);
  materialCaixa.disableLighting = true;
  materialCaixa.emissiveColor = LIMA;
  caixa.material = materialCaixa;
  caixa.setEnabled(false);
  let itemCarregado: { productType?: ProductType; repairCustomerId?: string } | undefined;

  const pressed = new Set<string>();
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "W", "A", "S", "D"].includes(event.key)) {
      pressed.add(event.key.toLowerCase());
      event.preventDefault();
    }
  };
  const onKeyUp = (event: KeyboardEvent) => pressed.delete(event.key.toLowerCase());
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  return {
    update(deltaSeconds) {
      const direction = new Vector3(
        (pressed.has("d") || pressed.has("arrowright") ? 1 : 0) - (pressed.has("a") || pressed.has("arrowleft") ? 1 : 0),
        0,
        (pressed.has("s") || pressed.has("arrowdown") ? 1 : 0) - (pressed.has("w") || pressed.has("arrowup") ? 1 : 0),
      );
      if (direction.lengthSquared() === 0) return;
      direction.normalize();
      root.position.addInPlace(direction.scale(13 * Math.min(deltaSeconds, 0.08)));
      root.position.x = Math.max(-34, Math.min(34, root.position.x));
      root.position.z = Math.max(-23, Math.min(23, root.position.z));
      root.rotation.y = Math.atan2(direction.x, direction.z);
    },
    station() {
      if (Vector3.Distance(root.position, new Vector3(0, 0, -15)) < 9) return "balcao";
      if (Vector3.Distance(root.position, new Vector3(-11, 0, 15)) < 20) return "prateleira";
      if (Vector3.Distance(root.position, new Vector3(26, 0, 9)) < 11) return "bancada";
      return "loja";
    },
    carriedProduct() {
      return itemCarregado?.productType;
    },
    carriedRepairCustomerId() {
      return itemCarregado?.repairCustomerId;
    },
    pickUpProduct(productType) {
      if (itemCarregado) return false;
      itemCarregado = { productType };
      caixa.setEnabled(true);
      return true;
    },
    pickUpRepair(customerId) {
      if (itemCarregado) return false;
      itemCarregado = { repairCustomerId: customerId };
      caixa.setEnabled(true);
      return true;
    },
    putDownProduct() {
      itemCarregado = undefined;
      caixa.setEnabled(false);
    },
    dispose() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      root.dispose(false, true);
    },
  };
}

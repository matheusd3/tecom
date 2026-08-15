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

export type PlayerStation = "balcao" | "prateleira" | "bancada" | "loja";

export interface GameHandle {
  scene: Scene;
  world: GameWorld;
  /** Posição atual do atendente para a interface contextual. */
  getPlayerStation(): PlayerStation;
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
  luz.intensity = 1.1;

  const { prateleiras } = criarAmbiente(scene);
  const player = criarAtendente(scene);

  const world = new GameWorld();
  gameWorld = world;

  let tempoAnimacao = 0;

  return {
    scene,
    world,
    update(deltaSeconds: number) {
      world.update(deltaSeconds);

      // Animação puramente estética, independente de pausa do jogo.
      tempoAnimacao += deltaSeconds;
      camera.alpha = -Math.PI / 2 + Math.sin(tempoAnimacao * 0.05) * 0.25;
      player.update(deltaSeconds);
      prateleiras.forEach((mesh, i) => {
        mesh.rotation.y = Math.sin(tempoAnimacao * 0.35 + i) * 0.05;
      });
    },
    getPlayerStation() {
      return player.station();
    },
    dispose() {
      player.dispose();
      scene.dispose();
      if (gameWorld === world) {
        gameWorld = null;
      }
    },
  };
}

function criarAmbiente(scene: Scene): { prateleiras: Mesh[] } {
  // Grade neon no chão
  const grade = CreateGround(
    "grade",
    { width: 76, height: 58, subdivisions: 20 },
    scene
  );
  const matGrade = new StandardMaterial("matGrade", scene);
  matGrade.wireframe = true;
  matGrade.disableLighting = true;
  matGrade.emissiveColor = CIANO.scale(0.22);
  grade.material = matGrade;

  const cores = [CIANO, MAGENTA, LIMA, CIANO, MAGENTA];
  const prateleiras: Mesh[] = cores.map((cor, i) => {
    const bloco = CreateBox(`prateleira-${i}`, { width: 5, height: 7, depth: 2 }, scene);
    bloco.position = new Vector3(-27 + i * 8, 3.5, 15);

    const mat = new StandardMaterial(`matPrateleira-${i}`, scene);
    mat.disableLighting = true;
    mat.emissiveColor = cor.scale(0.55);
    mat.alpha = 0.85;
    bloco.material = mat;
    return bloco;
  });

  criarEstacao(scene, "balcao", new Vector3(0, 0.25, -15), new Vector3(16, 0.5, 4), MAGENTA);
  criarEstacao(scene, "bancada", new Vector3(26, 0.25, 9), new Vector3(9, 0.5, 6), LIMA);
  criarEstacao(scene, "prateleira", new Vector3(-11, 0.2, 15), new Vector3(38, 0.4, 8), CIANO);

  return { prateleiras };
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

function criarAtendente(scene: Scene): {
  update(deltaSeconds: number): void;
  station(): PlayerStation;
  dispose(): void;
} {
  const root = new TransformNode("atendente", scene);
  root.position = new Vector3(0, 0, 3);
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
      if (Vector3.Distance(root.position, new Vector3(26, 0, 9)) < 7) return "bancada";
      return "loja";
    },
    dispose() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      root.dispose(false, true);
    },
  };
}

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
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { GameWorld } from "./GameWorld";

export interface GameHandle {
  scene: Scene;
  world: GameWorld;
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
    120,
    new Vector3(0, 6, 0),
    scene
  );
  camera.minZ = 0.1;

  const luz = new HemisphericLight("luz", new Vector3(0, 1, 0), scene);
  luz.intensity = 1.1;

  const { prateleiras } = criarAmbiente(scene);

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
      prateleiras.forEach((mesh, i) => {
        mesh.rotation.y += deltaSeconds * (0.1 + i * 0.02);
        mesh.position.y = 4 + Math.sin(tempoAnimacao * 0.6 + i) * 0.6;
      });
    },
    dispose() {
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
    { width: 400, height: 400, subdivisions: 40 },
    scene
  );
  const matGrade = new StandardMaterial("matGrade", scene);
  matGrade.wireframe = true;
  matGrade.disableLighting = true;
  matGrade.emissiveColor = CIANO.scale(0.22);
  grade.material = matGrade;

  // Blocos representando as prateleiras da loja
  const cores = [CIANO, MAGENTA, LIMA, CIANO, MAGENTA];
  const prateleiras: Mesh[] = cores.map((cor, i) => {
    const bloco = CreateBox(`prateleira-${i}`, { size: 8 }, scene);
    const angulo = (i / cores.length) * Math.PI * 2;
    bloco.position = new Vector3(Math.cos(angulo) * 26, 4, Math.sin(angulo) * 26);

    const mat = new StandardMaterial(`matPrateleira-${i}`, scene);
    mat.disableLighting = true;
    mat.emissiveColor = cor.scale(0.55);
    mat.alpha = 0.85;
    bloco.material = mat;
    return bloco;
  });

  return { prateleiras };
}

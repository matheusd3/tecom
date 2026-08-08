// scene.ts - Inicialização da cena Babylon e integração com GameWorld

import { Scene } from "@babylonjs/core/scene";
import { Engine } from "@babylonjs/core/Engines/engine";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { GameWorld } from "./GameWorld";

export interface GameHandle {
  scene: Scene;
  dispose(): void;
}

let gameWorld: GameWorld | null = null;
let lastFrameTime = Date.now();

export function getGameWorld(): GameWorld | null {
  return gameWorld;
}

export async function createGameScene(
  engine: Engine,
  canvas: HTMLCanvasElement
): Promise<GameHandle> {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.06, 0.08, 0.1, 1); // Cinza escuro (#0F1419)

  // Luz ambiente
  const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
  light.intensity = 1.2;

  // Inicializar GameWorld
  gameWorld = new GameWorld();

  // Criar interface visual simples com meshes Babylon
  createGameUI(scene);

  // Loop de atualização do jogo
  engine.runRenderLoop(() => {
    const now = Date.now();
    const deltaTime = (now - lastFrameTime) / 1000; // Converter para segundos
    lastFrameTime = now;

    if (gameWorld) {
      gameWorld.update(deltaTime);
    }

    scene.render();
  });

  return {
    scene,
    dispose() {
      scene.dispose();
      gameWorld = null;
    },
  };
}

// Função para resetar o gameWorld quando necessário
export function resetGameWorld(): void {
  gameWorld = null;
}

function createGameUI(scene: Scene): void {
  // Criar um plano de fundo com grid
  const ground = MeshBuilder.CreateGround("ground", { width: 100, height: 100 }, scene);
  const groundMaterial = new StandardMaterial("groundMat", scene);
  groundMaterial.emissiveColor = new Color3(0.1, 0.12, 0.15);
  ground.material = groundMaterial;

  // Criar alguns cubos representando a loja
  const shopBox = MeshBuilder.CreateBox("shop", { size: 20 }, scene);
  shopBox.position.y = 10;
  const shopMaterial = new StandardMaterial("shopMat", scene);
  shopMaterial.emissiveColor = new Color3(0, 0.85, 1); // Ciano
  shopBox.material = shopMaterial;

  // Câmera isométrica
  const camera = scene.activeCamera;
  if (camera) {
    camera.position = new Vector3(50, 40, 50);
    camera.attachControl(true);
  }
}

// scene.ts — a loja 3D e a ponte com o GameWorld.
//
// A cena deixou de ser papel de parede: ela é a loja onde o atendente anda,
// esbarra nos móveis e encontra os clientes da simulação. A interface HTML
// continua sendo onde as decisões são tomadas.
//
// Regras do contrato Babylon-in-React (ver manus-adaptations.md):
//  - createGameScene(engine, canvas) devolve um GameHandle com { scene, dispose }.
//  - Esta função NÃO inicia o render loop; quem controla o ciclo de vida é o
//    GameCanvas, que chama handle.update(dt) e depois scene.render().

import { Scene } from "@babylonjs/core/scene";
import type { Engine } from "@babylonjs/core/Engines/engine";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";

import { GameWorld } from "./GameWorld";
import type { ProductType } from "./types";
import { construirLoja } from "./store/props";
import { criarFabricaDePessoas } from "./store/characters";
import { criarJogador } from "./store/player";
import { criarMultidao } from "./store/crowd";
import { CORES_PRODUTO, PALETA, cor } from "./store/materials";
import type { Estacao } from "./store/layout";

export type { Estacao } from "./store/layout";

export interface GameHandle {
  scene: Scene;
  world: GameWorld;
  /** Avança a simulação e a animação da cena. deltaSeconds em segundos reais. */
  update(deltaSeconds: number): void;
  /** Avisa quando o atendente entra ou sai de uma estação da loja. */
  aoMudarEstacao(callback: (estacao: Estacao | null) => void): void;
  /** Avisa quando ele aperta E dentro de uma estação. */
  aoInteragir(callback: (estacao: Estacao) => void): void;
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

/** Cor da caixa que o atendente carrega, estável por tipo de produto. */
const ORDEM_PRODUTOS: ProductType[] = [
  "notebook",
  "mouse",
  "keyboard",
  "monitor",
  "headset",
  "webcam",
  "ssd",
  "ram",
];

function corDoProduto(tipo: ProductType | undefined): string {
  const indice = tipo ? ORDEM_PRODUTOS.indexOf(tipo) : -1;
  return CORES_PRODUTO[(indice < 0 ? 0 : indice) % CORES_PRODUTO.length];
}

export async function createGameScene(
  engine: Engine,
  _canvas: HTMLCanvasElement
): Promise<GameHandle> {
  const scene = new Scene(engine);
  scene.clearColor = Color4.FromHexString(`${PALETA.fundoCena}ff`);
  scene.ambientColor = new Color3(0.35, 0.4, 0.45);

  // Câmera fixa, de cima e de frente: sem attachControl e sem rotação
  // automática — o jogador precisa reconhecer a loja sempre do mesmo ângulo.
  const camera = new ArcRotateCamera(
    "camera",
    -Math.PI / 2,
    Math.PI / 3.55,
    38,
    new Vector3(-0.6, 2.2, 0.8),
    scene
  );
  camera.minZ = 0.5;
  camera.maxZ = 220;
  camera.fov = 0.82;

  const ambiente = new HemisphericLight("luzAmbiente", new Vector3(0.2, 1, -0.3), scene);
  ambiente.intensity = 0.5;
  ambiente.diffuse = cor("#eef7ff");
  ambiente.groundColor = cor("#24333d");
  ambiente.specular = new Color3(0.12, 0.14, 0.16);

  const principal = new DirectionalLight("luzPrincipal", new Vector3(-0.35, -1, 0.45), scene);
  principal.position = new Vector3(10, 22, -14);
  principal.intensity = 0.5;
  principal.diffuse = cor("#ffeed4");
  principal.specular = new Color3(0.15, 0.15, 0.15);

  // Faz o neon dos letreiros e das luminárias sangrar um pouco.
  const brilho = new GlowLayer("brilho", scene);
  brilho.intensity = 0.35;

  const loja = construirLoja(scene);
  const pessoas = criarFabricaDePessoas(scene);
  const multidao = criarMultidao(pessoas);

  const world = new GameWorld();
  gameWorld = world;

  let aoMudarEstacao: ((estacao: Estacao | null) => void) | null = null;
  let aoInteragir: ((estacao: Estacao) => void) | null = null;

  const jogador = criarJogador(pessoas, {
    aoMudarEstacao(estacao) {
      loja.destacarZona(estacao);
      aoMudarEstacao?.(estacao);
    },
    aoInteragir(estacao) {
      // Carregar é encenação: mostra o que o atendente está fazendo sem mexer
      // em uma linha da economia do GameWorld.
      if (estacao === "estoque") {
        const alvo = proximoClienteComProduto(world);
        jogador.definirCarga("produto", corDoProduto(alvo));
      } else if (estacao === "assistencia") {
        jogador.definirCarga(jogador.carga === "aparelho" ? null : "aparelho", "#b9c7d1");
      } else if (estacao === "balcao") {
        jogador.definirCarga(null);
      }
      aoInteragir?.(estacao);
    },
  });

  loja.destacarZona(jogador.estacao);

  return {
    scene,
    world,

    update(deltaSeconds: number) {
      world.update(deltaSeconds);
      jogador.atualizar(deltaSeconds);
      multidao.sincronizar(world.getState());
      multidao.atualizar(deltaSeconds);
    },

    aoMudarEstacao(callback) {
      aoMudarEstacao = callback;
      callback(jogador.estacao);
    },

    aoInteragir(callback) {
      aoInteragir = callback;
    },

    dispose() {
      jogador.dispose();
      multidao.dispose();
      scene.dispose();
      if (gameWorld === world) {
        gameWorld = null;
      }
    },
  };
}

/** Qual produto o atendente pegaria agora — o do cliente da vez. */
function proximoClienteComProduto(world: GameWorld): ProductType | undefined {
  const estado = world.getState();
  const selecionado = estado.selectedCustomerId
    ? estado.customers.get(estado.selectedCustomerId)
    : undefined;
  if (selecionado?.needsProduct) return selecionado.needsProduct;
  return Array.from(estado.customers.values()).find(
    (cliente) => cliente.status === "waiting" && cliente.needsProduct
  )?.needsProduct;
}

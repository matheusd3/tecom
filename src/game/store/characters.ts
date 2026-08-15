// characters.ts — bonecos montados com primitivas, sem asset externo.
//
// O mesmo molde serve para o atendente e para os clientes; o que muda são as
// cores, o indicador de "sou eu" e os balões de pedido. Tudo que precisa ser
// lido em dois segundos (quem é o jogador, o que o cliente quer, quanto de
// paciência resta) mora aqui, em cima da cabeça do boneco.

import type { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { CreateCapsule } from "@babylonjs/core/Meshes/Builders/capsuleBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateDisc } from "@babylonjs/core/Meshes/Builders/discBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";

import { PALETA, cor, fosco, materialIcone, neon } from "./materials";

export type TipoCarga = "produto" | "aparelho" | "caixa";
export type TipoPedido = "produto" | "reparo";

export interface OpcoesPersonagem {
  nome: string;
  /** Cor da camiseta/uniforme — é o que identifica a pessoa de longe. */
  roupa: string;
  calca: string;
  pele: string;
  cabelo: string;
  /** O atendente ganha boné, seta e anel no chão. */
  jogador?: boolean;
}

export interface Personagem {
  raiz: TransformNode;
  /** Avança a animação. `velocidade` em unidades por segundo. */
  animar(deltaSeconds: number, velocidade: number): void;
  /** Vira o boneco na direção em que ele anda (ou para onde deve olhar). */
  olharPara(dx: number, dz: number): void;
  definirCarga(tipo: TipoCarga | null, hex?: string): void;
  definirPedido(tipo: TipoPedido | null): void;
  /** 0..1 — mostra a barrinha de paciência; null esconde. */
  definirPaciencia(fracao: number | null): void;
  /** Realce do anel do jogador quando ele está numa estação. */
  destacar(ativo: boolean): void;
  dispose(): void;
}

export interface FabricaDePessoas {
  criar(opcoes: OpcoesPersonagem): Personagem;
}

/** Cores de clientes: saturadas e distintas entre si. */
export const CORES_CLIENTE = [
  { roupa: "#ff8a3d", calca: "#37506b", cabelo: "#3a2418" },
  { roupa: "#57d2ff", calca: "#2c3e50", cabelo: "#141414" },
  { roupa: "#ff5fa8", calca: "#39304f", cabelo: "#6b3410" },
  { roupa: "#b6ff3a", calca: "#334455", cabelo: "#241a12" },
  { roupa: "#8f7bff", calca: "#2f3d4d", cabelo: "#0f0f14" },
  { roupa: "#ffd75e", calca: "#3c4a3a", cabelo: "#4a2c14" },
  { roupa: "#3ee6b0", calca: "#2b3a4a", cabelo: "#2b1b10" },
  { roupa: "#ff6b6b", calca: "#404a5a", cabelo: "#120c08" },
];

export const PELES = ["#f2c6a0", "#d99a6c", "#a36a43", "#71442a", "#f7d9bf"];

export function criarFabricaDePessoas(scene: Scene): FabricaDePessoas {
  // Materiais compartilhados: um por cena, não um por boneco.
  const compartilhados = {
    olho: fosco(scene, "matOlho", "#12181d"),
    sombra: (() => {
      const m = new StandardMaterial("matSombra", scene);
      m.diffuseColor = Color3.Black();
      m.specularColor = Color3.Black();
      m.emissiveColor = Color3.Black();
      m.alpha = 0.26;
      m.backFaceCulling = false;
      m.freeze();
      return m;
    })(),
    balao: (() => {
      const m = new StandardMaterial("matBalao", scene);
      m.diffuseColor = cor("#f4fbff");
      m.emissiveColor = cor("#f4fbff").scale(0.75);
      m.specularColor = Color3.Black();
      m.freeze();
      return m;
    })(),
    barraFundo: neon(scene, "matBarraFundo", "#0d1a22", 0.9),
    iconeProduto: materialIcone(scene, "iconeProduto", "produto", PALETA.lima),
    iconeReparo: materialIcone(scene, "iconeReparo", "reparo", PALETA.magenta),
    seta: neon(scene, "matSetaJogador", PALETA.lima, 1.3),
  };

  let contador = 0;

  return {
    criar(opcoes) {
      contador += 1;
      return montar(scene, `pessoa-${contador}`, opcoes, compartilhados);
    },
  };
}

type Compartilhados = {
  olho: StandardMaterial;
  sombra: StandardMaterial;
  balao: StandardMaterial;
  barraFundo: StandardMaterial;
  iconeProduto: StandardMaterial;
  iconeReparo: StandardMaterial;
  seta: StandardMaterial;
};

function montar(
  scene: Scene,
  id: string,
  opcoes: OpcoesPersonagem,
  comum: Compartilhados
): Personagem {
  const raiz = new TransformNode(id, scene);
  // Bonecos propositalmente grandes em relação aos móveis: de cima, é isso que
  // faz o atendente e a fila serem achados em um segundo.
  raiz.scaling.setAll(1.45);
  const corpo = new TransformNode(`${id}-corpo`, scene);
  corpo.parent = raiz;

  const proprios: StandardMaterial[] = [];
  const material = (nome: string, hex: string, brilho = 0.22) => {
    const m = fosco(scene, `${id}-${nome}`, hex, { brilho });
    proprios.push(m);
    return m;
  };

  const matRoupa = material("roupa", opcoes.roupa, 0.28);
  const matCalca = material("calca", opcoes.calca);
  const matPele = material("pele", opcoes.pele, 0.26);
  const matCabelo = material("cabelo", opcoes.cabelo);

  // Sombra falsa: barata e suficiente para "colar" o boneco no chão.
  const sombra = CreateDisc(`${id}-sombra`, { radius: 0.6, tessellation: 16 }, scene);
  sombra.rotation.x = Math.PI / 2;
  sombra.position.y = 0.025;
  sombra.material = comum.sombra;
  sombra.parent = raiz;
  sombra.isPickable = false;

  // Pernas.
  const pernas: Mesh[] = [-1, 1].map((lado) => {
    const perna = CreateCapsule(`${id}-perna-${lado}`, { radius: 0.16, height: 0.66 }, scene);
    perna.position.set(lado * 0.2, 0.33, 0);
    perna.material = matCalca;
    perna.parent = corpo;
    return perna;
  });

  // Tronco + detalhe de uniforme.
  const tronco = CreateCapsule(`${id}-tronco`, { radius: 0.4, height: 1.02 }, scene);
  tronco.position.y = 1.12;
  tronco.material = matRoupa;
  tronco.parent = corpo;

  const faixa = CreateBox(`${id}-faixa`, { width: 0.5, height: 0.16, depth: 0.12 }, scene);
  faixa.position.set(0, 1.18, 0.36);
  faixa.material = opcoes.jogador ? material("cracha", PALETA.ciano, 0.9) : matCalca;
  faixa.parent = corpo;

  // Braços: giram ao andar e sobem quando o atendente carrega algo.
  const bracos: Mesh[] = [-1, 1].map((lado) => {
    const braco = CreateCapsule(`${id}-braco-${lado}`, { radius: 0.13, height: 0.78 }, scene);
    braco.position.set(lado * 0.5, 1.16, 0);
    braco.rotation.z = lado * -0.16;
    braco.material = matPele;
    braco.parent = corpo;
    return braco;
  });

  // Cabeça, olhos e cabelo.
  const cabeca = CreateSphere(`${id}-cabeca`, { diameter: 0.74, segments: 12 }, scene);
  cabeca.position.y = 1.82;
  cabeca.scaling.z = 0.94;
  cabeca.material = matPele;
  cabeca.parent = corpo;

  for (const lado of [-1, 1]) {
    const olho = CreateSphere(`${id}-olho-${lado}`, { diameter: 0.13, segments: 8 }, scene);
    olho.position.set(lado * 0.15, 1.86, 0.3);
    olho.material = comum.olho;
    olho.parent = corpo;
  }

  const cabelo = CreateSphere(`${id}-cabelo`, { diameter: 0.78, segments: 12 }, scene);
  cabelo.position.set(0, 1.9, -0.05);
  cabelo.scaling.set(1, 0.72, 1);
  cabelo.material = matCabelo;
  cabelo.parent = corpo;

  if (opcoes.jogador) {
    // Boné: o atendente precisa ser reconhecido em qualquer canto da loja.
    const bone = CreateCylinder(`${id}-bone`, { diameter: 0.8, height: 0.26 }, scene);
    bone.position.set(0, 2.06, -0.02);
    bone.material = matRoupa;
    bone.parent = corpo;
    const aba = CreateBox(`${id}-aba`, { width: 0.66, height: 0.07, depth: 0.4 }, scene);
    aba.position.set(0, 1.96, 0.34);
    aba.material = matRoupa;
    aba.parent = corpo;
  }

  // Item carregado, à frente do peito.
  const carga = CreateBox(`${id}-carga`, { width: 0.78, height: 0.5, depth: 0.5 }, scene);
  carga.position.set(0, 1.28, 0.66);
  const matCarga = new StandardMaterial(`${id}-matCarga`, scene);
  matCarga.diffuseColor = cor(PALETA.ambar);
  matCarga.emissiveColor = cor(PALETA.ambar).scale(0.35);
  matCarga.specularColor = Color3.Black();
  proprios.push(matCarga);
  carga.material = matCarga;
  carga.parent = corpo;
  carga.setEnabled(false);

  const fitaCarga = CreateBox(`${id}-carga-fita`, { width: 0.8, height: 0.52, depth: 0.12 }, scene);
  fitaCarga.position.copyFrom(carga.position);
  fitaCarga.material = comum.balao;
  fitaCarga.parent = corpo;
  fitaCarga.setEnabled(false);

  // Painel de leitura acima da cabeça. Fica num nó que anula o giro do corpo,
  // então balão e barra continuam virados para a câmera fixa sem billboard.
  const hud = new TransformNode(`${id}-hud`, scene);
  hud.parent = raiz;

  const balao = CreatePlane(`${id}-balao`, { width: 1, height: 1 }, scene);
  balao.position.set(0, 2.95, 0);
  balao.material = comum.iconeProduto;
  balao.parent = hud;
  balao.setEnabled(false);

  // Barra de paciência: cresce da esquerda para a direita.
  const larguraBarra = 1.1;
  const pivo = new TransformNode(`${id}-barra-pivo`, scene);
  pivo.parent = hud;
  pivo.position.set(-larguraBarra / 2, 2.42, 0);

  const barraFundo = CreatePlane(`${id}-barra-fundo`, { width: larguraBarra + 0.08, height: 0.24 }, scene);
  barraFundo.position.set(0, 2.42, 0.02);
  barraFundo.material = comum.barraFundo;
  barraFundo.parent = hud;
  barraFundo.setEnabled(false);

  const matBarra = new StandardMaterial(`${id}-matBarra`, scene);
  matBarra.disableLighting = true;
  matBarra.diffuseColor = Color3.Black();
  matBarra.emissiveColor = cor(PALETA.lima);
  proprios.push(matBarra);
  const barra = CreatePlane(`${id}-barra`, { width: larguraBarra, height: 0.16 }, scene);
  barra.position.set(larguraBarra / 2, 0, -0.01);
  barra.material = matBarra;
  barra.parent = pivo;
  pivo.setEnabled(false);

  // Marcadores exclusivos do jogador.
  let seta: Mesh | null = null;
  let anel: Mesh | null = null;
  let matAnel: StandardMaterial | null = null;
  if (opcoes.jogador) {
    seta = CreateCylinder(`${id}-seta`, { diameterTop: 0, diameterBottom: 0.62, height: 0.7, tessellation: 6 }, scene);
    seta.position.y = 2.85;
    seta.rotation.x = Math.PI;
    seta.material = comum.seta;
    seta.parent = raiz;

    matAnel = new StandardMaterial(`${id}-matAnel`, scene);
    matAnel.disableLighting = true;
    matAnel.diffuseColor = Color3.Black();
    matAnel.emissiveColor = cor(PALETA.ciano).scale(0.9);
    matAnel.alpha = 0.85;
    proprios.push(matAnel);
    anel = CreateTorus(`${id}-anel`, { diameter: 1.8, thickness: 0.12, tessellation: 24 }, scene);
    anel.position.y = 0.05;
    anel.material = matAnel;
    anel.parent = raiz;
    anel.isPickable = false;
  }

  let fase = 0;
  let carregando = false;

  return {
    raiz,

    animar(dt, velocidade) {
      const andando = velocidade > 0.15;
      fase += dt * (andando ? 5 + Math.min(velocidade, 12) * 0.55 : 1.8);
      const balanco = Math.sin(fase);

      if (andando) {
        pernas[0].rotation.x = balanco * 0.75;
        pernas[1].rotation.x = -balanco * 0.75;
        corpo.position.y = Math.abs(Math.sin(fase)) * 0.07;
        corpo.rotation.z = balanco * 0.03;
      } else {
        pernas[0].rotation.x *= 0.85;
        pernas[1].rotation.x *= 0.85;
        corpo.position.y = Math.sin(fase) * 0.02;
        corpo.rotation.z *= 0.85;
      }

      if (carregando) {
        // Mãos à frente segurando o item.
        bracos[0].rotation.x = -1.15;
        bracos[1].rotation.x = -1.15;
      } else if (andando) {
        bracos[0].rotation.x = -balanco * 0.6;
        bracos[1].rotation.x = balanco * 0.6;
      } else {
        bracos[0].rotation.x *= 0.85;
        bracos[1].rotation.x *= 0.85;
      }

      if (seta) {
        seta.rotation.y += dt * 2.2;
        seta.position.y = 2.85 + Math.sin(fase * 1.2) * 0.09;
      }
      if (balao.isEnabled()) {
        balao.position.y = 2.95 + Math.sin(fase * 1.1) * 0.07;
      }
      hud.rotation.y = -raiz.rotation.y;
    },

    olharPara(dx, dz) {
      if (Math.abs(dx) < 0.001 && Math.abs(dz) < 0.001) return;
      const alvo = Math.atan2(dx, dz);
      // Giro curto: interpola pelo menor arco.
      let delta = alvo - raiz.rotation.y;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      raiz.rotation.y += delta * 0.25;
    },

    definirCarga(tipo, hex) {
      carregando = tipo !== null;
      carga.setEnabled(carregando);
      fitaCarga.setEnabled(carregando && tipo === "produto");
      if (!carregando) return;
      const corItem = hex ?? (tipo === "produto" ? PALETA.ambar : PALETA.metal);
      matCarga.diffuseColor = cor(corItem);
      matCarga.emissiveColor = cor(corItem).scale(0.4);
      // Aparelho em manutenção é achatado como um notebook fechado.
      carga.scaling.set(1, tipo === "aparelho" ? 0.45 : 1, tipo === "aparelho" ? 1.35 : 1);
    },

    definirPedido(tipo) {
      if (!tipo) {
        balao.setEnabled(false);
        return;
      }
      balao.material = tipo === "produto" ? comum.iconeProduto : comum.iconeReparo;
      balao.setEnabled(true);
    },

    definirPaciencia(fracao) {
      if (fracao === null) {
        pivo.setEnabled(false);
        barraFundo.setEnabled(false);
        return;
      }
      const valor = Math.max(0, Math.min(1, fracao));
      pivo.setEnabled(true);
      barraFundo.setEnabled(true);
      pivo.scaling.x = Math.max(0.001, valor);
      matBarra.emissiveColor = cor(
        valor > 0.6 ? PALETA.lima : valor > 0.3 ? PALETA.ambar : PALETA.vermelho
      );
    },

    destacar(ativo) {
      if (!matAnel) return;
      matAnel.emissiveColor = cor(ativo ? PALETA.lima : PALETA.ciano).scale(ativo ? 1.35 : 0.8);
    },

    dispose() {
      raiz.dispose(false, false);
      for (const m of proprios) m.dispose();
    },
  };
}

// props.ts — a loja construída em blocos primitivos.
//
// Tudo aqui é cenário estático: piso, paredes, balcão, gôndolas, bancada da
// assistência e decoração. A colisão não é lida daqui — ela vem de layout.ts,
// e cada móvel é desenhado exatamente sobre o retângulo que o bloqueia.

import type { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { CreateCylinder } from "@babylonjs/core/Meshes/Builders/cylinderBuilder";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { CreatePlane } from "@babylonjs/core/Meshes/Builders/planeBuilder";
import { CreateTorus } from "@babylonjs/core/Meshes/Builders/torusBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
// createInstance() só existe quando o módulo de instâncias entra no bundle.
import "@babylonjs/core/Meshes/instancedMesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";

import type { GameState } from "../types";
import {
  ALTURA_PAREDE,
  LOJA,
  MOVEIS,
  PORTA,
  centro,
  largura,
  profundidade,
  type Estacao,
  type Retangulo,
} from "./layout";
import {
  CORES_PRODUTO,
  COR_ESTACAO,
  PALETA,
  cor,
  fosco,
  materialCartaz,
  materialPiso,
  materialPlaca,
  neon,
  vidro,
} from "./materials";

export interface Loja {
  /** Acende o tapete e o letreiro da estação onde o atendente está. */
  destacarZona(estacao: Estacao | null): void;
  /** Mostra no chão da bancada quantos aparelhos esperam e quantos ficaram prontos. */
  atualizarPilhas(estado: GameState): void;
}

interface Tapete {
  material: StandardMaterial;
  base: Color3;
}

function bloco(
  scene: Scene,
  nome: string,
  dim: { l: number; a: number; p: number },
  pos: { x: number; y: number; z: number },
  material: StandardMaterial
): Mesh {
  const m = CreateBox(nome, { width: dim.l, height: dim.a, depth: dim.p }, scene);
  m.position.set(pos.x, pos.y, pos.z);
  m.material = material;
  m.freezeWorldMatrix();
  return m;
}

/** Bloco que preenche exatamente um retângulo do layout. */
function blocoDoRetangulo(
  scene: Scene,
  nome: string,
  r: Retangulo,
  altura: number,
  baseY: number,
  material: StandardMaterial,
  encolher = 0
): Mesh {
  const c = centro(r);
  return bloco(
    scene,
    nome,
    { l: largura(r) - encolher, a: altura, p: profundidade(r) - encolher },
    { x: c.x, y: baseY + altura / 2, z: c.z },
    material
  );
}

/** Fábrica de caixinhas de produto: a primeira de cada cor vira o molde. */
function fabricaDeCaixas(scene: Scene) {
  const moldes = new Map<string, Mesh>();
  return (hex: string, pos: Vector3, escala: Vector3): void => {
    const molde = moldes.get(hex);
    if (!molde) {
      const m = CreateBox(`caixa-${hex}`, { size: 1 }, scene);
      m.material = fosco(scene, `matCaixa-${hex}`, hex, { brilho: 0.28 });
      m.position.copyFrom(pos);
      m.scaling.copyFrom(escala);
      m.freezeWorldMatrix();
      moldes.set(hex, m);
      return;
    }
    const inst = molde.createInstance(`caixa-${hex}-${pos.x.toFixed(1)}-${pos.z.toFixed(1)}-${pos.y.toFixed(1)}`);
    inst.position.copyFrom(pos);
    inst.scaling.copyFrom(escala);
    inst.freezeWorldMatrix();
  };
}

function criarMateriais(scene: Scene) {
  return {
    piso: materialPiso(scene),
    paredeBaixa: fosco(scene, "matParedeBaixa", PALETA.paredeBaixa),
    paredeAlta: fosco(scene, "matParedeAlta", PALETA.paredeAlta),
    rodape: fosco(scene, "matRodape", PALETA.rodape),
    madeira: fosco(scene, "matMadeira", PALETA.madeira),
    madeiraEscura: fosco(scene, "matMadeiraEscura", PALETA.madeiraEscura),
    metal: fosco(scene, "matMetal", PALETA.metal, { especular: 0.35 }),
    metalEscuro: fosco(scene, "matMetalEscuro", PALETA.metalEscuro, { especular: 0.3 }),
    preto: fosco(scene, "matPreto", PALETA.preto),
    branco: fosco(scene, "matBranco", PALETA.branco),
    vidro: vidro(scene, "matVidro"),
    telaCiano: neon(scene, "matTelaCiano", PALETA.ciano, 0.75),
    telaLima: neon(scene, "matTelaLima", PALETA.lima, 0.7),
    telaAmbar: neon(scene, "matTelaAmbar", PALETA.ambar, 0.7),
    neonCiano: neon(scene, "matNeonCiano", PALETA.ciano, 1.15),
    neonMagenta: neon(scene, "matNeonMagenta", PALETA.magenta, 1.15),
    neonLima: neon(scene, "matNeonLima", PALETA.lima, 1.1),
    luminaria: neon(scene, "matLuminaria", "#fff3d6", 1.05),
    folha: fosco(scene, "matFolha", "#3fbf7f", { brilho: 0.25 }),
    folhaClara: fosco(scene, "matFolhaClara", "#6ee39b", { brilho: 0.25 }),
    vaso: fosco(scene, "matVaso", "#d76a4a", { brilho: 0.22 }),
    papelao: fosco(scene, "matPapelao", "#c79a63", { brilho: 0.2 }),
    fita: fosco(scene, "matFita", "#e8d6b0", { brilho: 0.2 }),
  };
}

type Materiais = ReturnType<typeof criarMateriais>;

export function construirLoja(scene: Scene): Loja {
  const mats = criarMateriais(scene);

  const tapetes = new Map<Estacao, Tapete>();
  const letreiros = new Map<Estacao, StandardMaterial>();

  piso(scene, mats, tapetes);
  paredes(scene, mats);
  balcao(scene, mats, letreiros);
  bancadaTecnica(scene, mats, letreiros);
  estoque(scene, mats, letreiros);
  decoracao(scene, mats);
  const pilhas = pilhasDeReparo(scene);

  return {
    atualizarPilhas: pilhas.atualizar,

    destacarZona(estacao) {
      for (const [id, tapete] of tapetes) {
        const ativo = id === estacao;
        tapete.material.emissiveColor = tapete.base.scale(ativo ? 0.85 : 0.32);
      }
      for (const [id, material] of letreiros) {
        const ativo = id === estacao;
        material.emissiveColor = cor(COR_ESTACAO[id]).scale(ativo ? 1.6 : 1.05);
      }
    },
  };
}

// ------------------------------------------------------------------ piso

function piso(scene: Scene, mats: Materiais, tapetes: Map<Estacao, Tapete>): void {
  const chao = CreateGround(
    "piso",
    { width: (LOJA.maxX - LOJA.minX) + 2, height: (LOJA.maxZ - LOJA.minZ) + 2 },
    scene
  );
  chao.position.set(0, 0, 0);
  chao.material = mats.piso;
  chao.freezeWorldMatrix();

  // Tapetes coloridos: a leitura mais rápida de "onde fica o quê".
  const areas: Array<{ id: Estacao; retangulos: Retangulo[] }> = [
    { id: "balcao", retangulos: [{ minX: -8.6, maxX: 1.6, minZ: -5.8, maxZ: -0.6 }] },
    {
      // Retângulos sem sobreposição: dois tapetes no mesmo plano brigariam.
      id: "estoque",
      retangulos: [
        { minX: -11, maxX: -8, minZ: -2, maxZ: 8 },
        { minX: -8, maxX: 0.6, minZ: 0.4, maxZ: 4.4 },
        { minX: -11, maxX: 2.6, minZ: 8.2, maxZ: 11.5 },
      ],
    },
    { id: "assistencia", retangulos: [{ minX: 3.8, maxX: 11, minZ: 7, maxZ: 11.5 }] },
  ];

  for (const area of areas) {
    const base = cor(COR_ESTACAO[area.id]);
    const material = new StandardMaterial(`matTapete-${area.id}`, scene);
    material.diffuseColor = base.scale(0.4);
    material.emissiveColor = base.scale(0.32);
    material.specularColor = Color3.Black();
    material.alpha = 0.35;

    area.retangulos.forEach((r, i) => {
      const c = centro(r);
      const tapete = CreateGround(
        `tapete-${area.id}-${i}`,
        { width: largura(r), height: profundidade(r) },
        scene
      );
      tapete.position.set(c.x, 0.02, c.z);
      tapete.material = material;
      tapete.isPickable = false;
      tapete.freezeWorldMatrix();
    });

    tapetes.set(area.id, { material, base });
  }
}

// --------------------------------------------------------------- paredes

function paredes(scene: Scene, mats: Materiais): void {
  const l = LOJA.maxX - LOJA.minX;
  const p = LOJA.maxZ - LOJA.minZ;
  const meiaAltura = 2.6;

  const parede = (
    nome: string,
    dim: { l: number; a: number; p: number },
    pos: { x: number; y: number; z: number }
  ) => {
    bloco(scene, `${nome}-baixa`, { ...dim, a: meiaAltura }, { ...pos, y: meiaAltura / 2 }, mats.paredeBaixa);
    bloco(
      scene,
      `${nome}-alta`,
      { ...dim, a: ALTURA_PAREDE - meiaAltura },
      { ...pos, y: meiaAltura + (ALTURA_PAREDE - meiaAltura) / 2 },
      mats.paredeAlta
    );
    bloco(scene, `${nome}-rodape`, { l: dim.l + 0.06, a: 0.35, p: dim.p + 0.06 }, { ...pos, y: 0.175 }, mats.rodape);
  };

  parede("paredeFundo", { l: l + 1, a: 0, p: 1 }, { x: 0, y: 0, z: LOJA.maxZ + 0.5 });
  parede("paredeEsq", { l: 1, a: 0, p: p + 1 }, { x: LOJA.minX - 0.5, y: 0, z: 0 });
  parede("paredeDir", { l: 1, a: 0, p: p + 1 }, { x: LOJA.maxX + 0.5, y: 0, z: 0 });

  // Frente: mureta baixa com vitrine de vidro, para a câmera enxergar por cima.
  const frenteEsq = { min: LOJA.minX - 0.5, max: PORTA.minX };
  const frenteDir = { min: PORTA.maxX, max: LOJA.maxX + 0.5 };
  for (const [nome, faixa] of [
    ["frenteEsq", frenteEsq],
    ["frenteDir", frenteDir],
  ] as const) {
    const larguraFaixa = faixa.max - faixa.min;
    const meio = (faixa.min + faixa.max) / 2;
    // Mureta baixa + vidro fino: a fila fica visível por cima da vitrine.
    bloco(scene, `${nome}-mureta`, { l: larguraFaixa, a: 0.9, p: 1 }, { x: meio, y: 0.45, z: LOJA.minZ - 0.5 }, mats.paredeBaixa);
    bloco(scene, `${nome}-peitoril`, { l: larguraFaixa, a: 0.14, p: 0.34 }, { x: meio, y: 0.97, z: LOJA.minZ - 0.62 }, mats.metalEscuro);
    const painel = CreateBox(`${nome}-vidro`, { width: larguraFaixa - 0.4, height: 3, depth: 0.08 }, scene);
    painel.position.set(meio, 2.5, LOJA.minZ - 0.5);
    painel.material = mats.vidro;
    painel.freezeWorldMatrix();
    bloco(scene, `${nome}-caixilho`, { l: larguraFaixa, a: 0.16, p: 0.28 }, { x: meio, y: 4.05, z: LOJA.minZ - 0.5 }, mats.metalEscuro);
  }

  // Batentes da porta + letreiro de entrada.
  for (const x of [PORTA.minX, PORTA.maxX]) {
    bloco(scene, `batente-${x}`, { l: 0.3, a: 4.2, p: 1.1 }, { x, y: 2.1, z: LOJA.minZ - 0.5 }, mats.metalEscuro);
  }
  // Faixa de neon rente à parede marcando a entrada (sem invadir o salão).
  bloco(
    scene,
    "verga-porta",
    { l: PORTA.maxX - PORTA.minX + 0.3, a: 0.12, p: 0.12 },
    { x: (PORTA.minX + PORTA.maxX) / 2, y: 4.24, z: LOJA.minZ - 0.06 },
    mats.neonLima
  );

  // Letreiro da loja na parede do fundo (voltado para a câmera).
  const letreiro = CreatePlane("letreiroLoja", { width: 11, height: 2.6 }, scene);
  letreiro.position.set(-4.5, 5.6, LOJA.maxZ - 0.06);
  letreiro.material = materialPlaca(
    scene,
    "letreiroLoja",
    "TECH STORE",
    "#0d1a22",
    PALETA.ciano,
    "informática · assistência"
  );
  letreiro.freezeWorldMatrix();

  bloco(scene, "letreiro-moldura", { l: 11.5, a: 0.18, p: 0.22 }, { x: -4.5, y: 4.2, z: LOJA.maxZ - 0.12 }, mats.neonCiano);
}

// --------------------------------------------------------------- balcão

function balcao(scene: Scene, mats: Materiais, letreiros: Map<Estacao, StandardMaterial>): void {
  const r = MOVEIS.balcao;
  const c = centro(r);

  blocoDoRetangulo(scene, "balcao-corpo", r, 1.05, 0, mats.madeira);
  blocoDoRetangulo(scene, "balcao-tampo", r, 0.16, 1.05, mats.branco, -0.35);
  // Friso ciano no tampo: a cor da função de vendas.
  bloco(scene, "balcao-friso", { l: largura(r) + 0.4, a: 0.1, p: 0.18 }, { x: c.x, y: 1.16, z: r.minZ - 0.16 }, mats.neonCiano);

  // Vitrine de vidro na face do cliente.
  const painel = CreateBox("balcao-vitrine", { width: largura(r) - 0.8, height: 0.72, depth: 0.06 }, scene);
  painel.position.set(c.x, 0.62, r.minZ - 0.03);
  painel.material = mats.vidro;
  painel.freezeWorldMatrix();

  // Produtos em exposição dentro da vitrine.
  const caixa = fabricaDeCaixas(scene);
  for (let i = 0; i < 4; i++) {
    caixa(
      CORES_PRODUTO[i % CORES_PRODUTO.length],
      new Vector3(r.minX + 1.2 + i * 1.7, 0.55, c.z - 0.25),
      new Vector3(0.9, 0.5, 0.5)
    );
  }

  // Terminal de vendas.
  bloco(scene, "pdv-base", { l: 1.1, a: 0.12, p: 0.7 }, { x: r.maxX - 1.6, y: 1.19, z: c.z }, mats.preto);
  const monitorPdv = bloco(
    scene,
    "pdv-monitor",
    { l: 1.2, a: 0.8, p: 0.1 },
    { x: r.maxX - 1.6, y: 1.66, z: c.z + 0.2 },
    mats.preto
  );
  monitorPdv.rotation.x = -0.18;
  const tela = CreatePlane("pdv-tela", { width: 1.05, height: 0.65 }, scene);
  tela.parent = monitorPdv;
  tela.position.set(0, 0, -0.06);
  tela.material = mats.telaCiano;

  // Maquininha e potinho de canetas: vida na bancada.
  bloco(scene, "pdv-pinpad", { l: 0.3, a: 0.1, p: 0.45 }, { x: r.maxX - 2.6, y: 1.18, z: c.z - 0.35 }, mats.metalEscuro);
  const potinho = CreateCylinder("balcao-potinho", { diameter: 0.32, height: 0.36 }, scene);
  potinho.position.set(r.minX + 0.7, 1.31, c.z + 0.4);
  potinho.material = mats.metal;
  potinho.freezeWorldMatrix();

  // Placa de bancada, e não suspensa: nada pode ficar na frente do atendente,
  // que trabalha logo atrás do balcão.
  const placa = CreatePlane("placaBalcao", { width: 2.8, height: 0.85 }, scene);
  placa.position.set(r.minX + 1.6, 1.92, r.minZ + 0.25);
  placa.material = materialPlaca(scene, "placaBalcao", "BALCÃO", "#0d1a22", PALETA.ciano);
  placa.freezeWorldMatrix();
  const molduraPlaca = bloco(
    scene,
    "placaBalcao-moldura",
    { l: 3, a: 0.12, p: 0.12 },
    { x: r.minX + 1.6, y: 1.42, z: r.minZ + 0.25 },
    neon(scene, "matPlacaBalcaoNeon", PALETA.ciano, 1.05)
  );
  letreiros.set("balcao", molduraPlaca.material as StandardMaterial);
  for (const dx of [-1.3, 1.3]) {
    const haste = CreateCylinder(`placaBalcao-haste-${dx}`, { diameter: 0.07, height: 0.5 }, scene);
    haste.position.set(r.minX + 1.6 + dx, 1.45, r.minZ + 0.25);
    haste.material = mats.metalEscuro;
    haste.freezeWorldMatrix();
  }
}

// ---------------------------------------------------------- assistência

function bancadaTecnica(
  scene: Scene,
  mats: Materiais,
  letreiros: Map<Estacao, StandardMaterial>
): void {
  const r = MOVEIS.bancada;
  const c = centro(r);

  // Bancada de metal: propositalmente diferente do balcão de madeira.
  blocoDoRetangulo(scene, "bancada-corpo", r, 0.95, 0, mats.metalEscuro);
  blocoDoRetangulo(scene, "bancada-tampo", r, 0.14, 0.95, mats.metal, -0.3);
  bloco(scene, "bancada-friso", { l: largura(r) + 0.3, a: 0.1, p: 0.18 }, { x: c.x, y: 1.06, z: r.minZ - 0.14 }, mats.neonMagenta);

  // Gavetas de peças.
  for (let i = 0; i < 3; i++) {
    bloco(
      scene,
      `bancada-gaveta-${i}`,
      { l: 1.5, a: 0.22, p: 0.06 },
      { x: r.minX + 1.4 + i * 1.9, y: 0.42, z: r.minZ - 0.05 },
      mats.metal
    );
  }

  // PC aberto em manutenção + placa e ferramentas.
  const gabinete = bloco(scene, "bancada-gabinete", { l: 1.1, a: 1.5, p: 1.9 }, { x: r.minX + 1.6, y: 1.84, z: c.z }, mats.preto);
  gabinete.rotation.z = 0.12;
  const painelLateral = CreatePlane("bancada-painel", { width: 1.7, height: 1.3 }, scene);
  painelLateral.position.set(r.minX + 2.5, 1.9, c.z - 0.2);
  painelLateral.rotation.y = -Math.PI / 2;
  painelLateral.material = mats.vidro;
  painelLateral.freezeWorldMatrix();
  const placaMae = CreateBox("bancada-placa", { width: 1.2, height: 0.05, depth: 1 }, scene);
  placaMae.position.set(r.minX + 3.5, 1.12, c.z - 0.1);
  placaMae.material = fosco(scene, "matPlacaMae", "#2f7d4f", { brilho: 0.35 });
  placaMae.freezeWorldMatrix();
  for (let i = 0; i < 5; i++) {
    const chip = CreateBox(`bancada-chip-${i}`, { width: 0.18, height: 0.08, depth: 0.3 }, scene);
    chip.position.set(r.minX + 3.1 + (i % 3) * 0.35, 1.19, c.z - 0.35 + Math.floor(i / 3) * 0.4);
    chip.material = mats.metalEscuro;
    chip.freezeWorldMatrix();
  }

  // Monitor de diagnóstico.
  const monitor = bloco(scene, "bancada-monitor", { l: 1.9, a: 1.2, p: 0.12 }, { x: r.maxX - 1.5, y: 1.75, z: c.z + 0.45 }, mats.preto);
  monitor.rotation.x = -0.12;
  const telaDiag = CreatePlane("bancada-tela", { width: 1.7, height: 1 }, scene);
  telaDiag.parent = monitor;
  telaDiag.position.set(0, 0, -0.07);
  telaDiag.material = mats.telaAmbar;

  // Painel de ferramentas na parede do fundo, logo atrás da bancada.
  const pegboard = bloco(
    scene,
    "bancada-pegboard",
    { l: largura(r) - 0.8, a: 2.4, p: 0.12 },
    { x: c.x, y: 3, z: r.maxZ - 0.1 },
    mats.madeiraEscura
  );
  pegboard.freezeWorldMatrix();
  const ferramenta = (nome: string, x: number, y: number, alturaF: number, diametro: number) => {
    const f = CreateCylinder(nome, { diameter: diametro, height: alturaF }, scene);
    f.position.set(x, y, r.maxZ - 0.22);
    f.material = mats.metal;
    f.freezeWorldMatrix();
  };
  for (let i = 0; i < 5; i++) {
    ferramenta(`ferramenta-${i}`, r.minX + 1.2 + i * 1.1, 3.2 + (i % 2) * 0.5, 0.9 + (i % 3) * 0.2, 0.1);
  }

  // Luminária de bancada.
  const braco = CreateCylinder("bancada-braco", { diameter: 0.09, height: 1.6 }, scene);
  braco.position.set(r.maxX - 0.8, 1.85, r.maxZ - 0.7);
  braco.rotation.z = 0.5;
  braco.material = mats.metalEscuro;
  braco.freezeWorldMatrix();
  const cupula = CreateCylinder("bancada-cupula", { diameterTop: 0.15, diameterBottom: 0.75, height: 0.5 }, scene);
  cupula.position.set(r.maxX - 1.3, 2.6, r.maxZ - 0.7);
  cupula.rotation.z = 0.5;
  cupula.material = mats.luminaria;
  cupula.freezeWorldMatrix();

  // Letreiro "ASSISTÊNCIA" na parede do fundo, acima do painel de ferramentas.
  const placa = CreatePlane("placaAssistencia", { width: 5, height: 1.4 }, scene);
  placa.position.set(c.x, 5.2, r.maxZ - 0.06);
  placa.material = materialPlaca(scene, "placaAssistencia", "ASSISTÊNCIA", "#0d1a22", PALETA.magenta);
  placa.freezeWorldMatrix();
  const moldura = bloco(
    scene,
    "placaAssistencia-moldura",
    { l: 5.4, a: 0.14, p: 0.14 },
    { x: c.x, y: 4.4, z: r.maxZ - 0.12 },
    neon(scene, "matPlacaAssistNeon", PALETA.magenta, 1.05)
  );
  letreiros.set("assistencia", moldura.material as StandardMaterial);
}

// ------------------------------------------------- pilhas da assistência

/**
 * Duas filas de aparelhos no chão, na frente da bancada: à esquerda o que ainda
 * espera técnico, à direita o que já está pronto para voltar ao balcão. É o
 * jeito de o jogador ver a fila da assistência sem abrir painel.
 */
function pilhasDeReparo(scene: Scene): { atualizar(estado: GameState): void } {
  const CAPACIDADE = 4;
  const criarFila = (nome: string, hex: string, xInicial: number): Mesh[] => {
    const material = fosco(scene, `mat-${nome}`, hex, { brilho: 0.5 });
    return Array.from({ length: CAPACIDADE }, (_, i) => {
      const caixa = CreateBox(nome + i, { width: 0.8, height: 0.28, depth: 0.62 }, scene);
      caixa.position.set(xInicial + i * 0.95, 0.16, MOVEIS.bancada.minZ - 0.5);
      caixa.rotation.y = (i % 2 === 0 ? 1 : -1) * 0.12;
      caixa.material = material;
      caixa.setEnabled(false);
      caixa.freezeWorldMatrix();
      return caixa;
    });
  };

  const aguardando = criarFila("reparoAguardando", PALETA.ambar, MOVEIS.bancada.minX + 0.6);
  const prontos = criarFila("reparoPronto", PALETA.lima, MOVEIS.bancada.minX + 4.6);

  const mostrar = (caixas: Mesh[], quantidade: number) => {
    caixas.forEach((caixa, i) => caixa.setEnabled(i < quantidade));
  };

  return {
    atualizar(estado) {
      let esperando = 0;
      let prontosAgora = 0;
      for (const reparo of estado.repairs) {
        if (reparo.status === "queued") esperando++;
        else if (reparo.status === "ready") prontosAgora++;
      }
      mostrar(aguardando, esperando);
      mostrar(prontos, prontosAgora);
    },
  };
}

// --------------------------------------------------------------- estoque

function estoque(scene: Scene, mats: Materiais, letreiros: Map<Estacao, StandardMaterial>): void {
  const caixa = fabricaDeCaixas(scene);

  prateleiraDeParede(scene, mats, caixa, MOVEIS.prateleiraFundo, "fundo");
  prateleiraDeParede(scene, mats, caixa, MOVEIS.prateleiraEsquerda, "esquerda");
  const moldura = ilhaDeEstoque(scene, mats, caixa, MOVEIS.ilhaEstoque);
  letreiros.set("estoque", moldura);

  // Ilha de vitrine perto da entrada: notebooks em exposição.
  const v = MOVEIS.vitrine;
  const cv = centro(v);
  blocoDoRetangulo(scene, "vitrine-corpo", v, 0.9, 0, mats.madeiraEscura);
  blocoDoRetangulo(scene, "vitrine-tampo", v, 0.12, 0.9, mats.branco, -0.2);
  for (let i = 0; i < 2; i++) {
    notebookAberto(scene, mats, `vitrine-note-${i}`, cv.x - 0.8 + i * 1.6, 1.02, cv.z, i % 2 === 0);
  }
}

type FabricaCaixa = (hex: string, pos: Vector3, escala: Vector3) => void;

/**
 * Ilha baixa: produtos vistos de cima, sem tapar quem está atrás. É aqui que o
 * atendente "pega" a mercadoria antes de levar ao balcão.
 */
function ilhaDeEstoque(
  scene: Scene,
  mats: Materiais,
  caixa: FabricaCaixa,
  r: Retangulo
): StandardMaterial {
  const c = centro(r);
  const l = largura(r);
  const p = profundidade(r);

  blocoDoRetangulo(scene, "ilha-corpo", r, 0.78, 0, mats.madeiraEscura);
  blocoDoRetangulo(scene, "ilha-tampo", r, 0.12, 0.78, mats.branco, -0.25);
  bloco(scene, "ilha-friso", { l: l + 0.2, a: 0.09, p: 0.16 }, { x: c.x, y: 0.88, z: r.minZ - 0.12 }, mats.neonLima);

  // Duas fileiras de produto sobre o tampo.
  const colunas = 5;
  for (let i = 0; i < colunas; i++) {
    const x = r.minX + 0.9 + (i * (l - 1.8)) / (colunas - 1);
    caixa(
      CORES_PRODUTO[(i * 3) % CORES_PRODUTO.length],
      new Vector3(x, 1.13, c.z - p / 4),
      new Vector3(0.75, 0.44, 0.55)
    );
    if (i % 2 === 0) {
      notebookAberto(scene, mats, `ilha-note-${i}`, x, 0.9, c.z + p / 4, i % 4 === 0);
    } else {
      caixa(
        CORES_PRODUTO[(i * 3 + 4) % CORES_PRODUTO.length],
        new Vector3(x, 1.13, c.z + p / 4),
        new Vector3(0.7, 0.44, 0.5)
      );
    }
  }

  // Placa de balcão baixa: identifica o estoque sem esconder o salão.
  const placa = CreatePlane("placaEstoque", { width: 2.6, height: 0.8 }, scene);
  placa.position.set(r.minX + 1.4, 1.55, r.minZ + 0.15);
  placa.material = materialPlaca(scene, "placaEstoque", "ESTOQUE", "#0d1a22", PALETA.lima);
  placa.freezeWorldMatrix();
  const moldura = bloco(
    scene,
    "placaEstoque-moldura",
    { l: 2.8, a: 0.12, p: 0.12 },
    { x: r.minX + 1.4, y: 1.08, z: r.minZ + 0.15 },
    neon(scene, "matPlacaEstoqueNeon", PALETA.lima, 1.05)
  );
  for (const dx of [-1.2, 1.2]) {
    const haste = CreateCylinder(`placaEstoque-haste-${dx}`, { diameter: 0.06, height: 0.75 }, scene);
    haste.position.set(r.minX + 1.4 + dx, 1.3, r.minZ + 0.15);
    haste.material = mats.metalEscuro;
    haste.freezeWorldMatrix();
  }
  return moldura.material as StandardMaterial;
}

/**
 * Prateleira alta encostada na parede. `orientacao` diz para que lado ela olha:
 * "fundo" abre para a câmera, "esquerda" abre para o meio do salão.
 */
function prateleiraDeParede(
  scene: Scene,
  mats: Materiais,
  caixa: FabricaCaixa,
  r: Retangulo,
  orientacao: "fundo" | "esquerda"
): void {
  const c = centro(r);
  const aoLongoDeX = orientacao === "fundo";
  const comprimento = aoLongoDeX ? largura(r) : profundidade(r);
  const espessura = aoLongoDeX ? profundidade(r) : largura(r);
  const nome = `prat-${orientacao}`;

  const dim = (comp: number, alt: number, esp: number) =>
    aoLongoDeX ? { l: comp, a: alt, p: esp } : { l: esp, a: alt, p: comp };
  const pos = (ao: number, y: number, desloc: number) =>
    aoLongoDeX ? { x: ao, y, z: c.z + desloc } : { x: c.x + desloc, y, z: ao };

  bloco(scene, `${nome}-base`, dim(comprimento, 0.3, espessura), pos(aoLongoDeX ? c.x : c.z, 0.15, 0), mats.metalEscuro);
  bloco(
    scene,
    `${nome}-costado`,
    dim(comprimento, 4.2, 0.2),
    pos(aoLongoDeX ? c.x : c.z, 2.1, (aoLongoDeX ? 1 : -1) * (espessura / 2 - 0.1)),
    mats.metal
  );

  const niveis = [0.85, 1.85, 2.85, 3.7];
  niveis.forEach((y, nivel) => {
    bloco(
      scene,
      `${nome}-nivel-${nivel}`,
      dim(comprimento - 0.2, 0.08, espessura - 0.2),
      pos(aoLongoDeX ? c.x : c.z, y, 0),
      mats.branco
    );
    const quantidade = Math.floor(comprimento / 1.6);
    const inicio = (aoLongoDeX ? c.x : c.z) - (comprimento - 1.6) / 2;
    for (let i = 0; i < quantidade; i++) {
      const ao = inicio + (i * (comprimento - 1.6)) / Math.max(1, quantidade - 1);
      const ponto = pos(ao, y, 0);
      if (nivel === 3) {
        monitorPequeno(scene, mats, `${nome}-mon-${i}`, ponto.x, y + 0.04, ponto.z, -1);
      } else if ((i + nivel) % 4 === 0 && aoLongoDeX) {
        notebookAberto(scene, mats, `${nome}-note-${nivel}-${i}`, ponto.x, y + 0.05, ponto.z, false);
      } else {
        const hex = CORES_PRODUTO[(i * 2 + nivel) % CORES_PRODUTO.length];
        caixa(
          hex,
          new Vector3(ponto.x, y + 0.36, ponto.z),
          aoLongoDeX ? new Vector3(1.1, 0.62, 0.7) : new Vector3(0.7, 0.62, 1.1)
        );
      }
    }
  });

  if (!aoLongoDeX) return;

  // Sinalização de corredor, presa na parede acima da prateleira.
  const setas = ["PEÇAS", "PERIFÉRICOS"];
  setas.forEach((texto, i) => {
    const placa = CreatePlane(`placaCorredor-${i}`, { width: 3.4, height: 0.9 }, scene);
    placa.position.set(c.x - 3.4 + i * 6.8, 4.75, r.maxZ - 0.08);
    placa.material = materialPlaca(scene, `placaCorredor-${i}`, texto, "#12242e", PALETA.branco);
    placa.freezeWorldMatrix();
  });
}

// ------------------------------------------------------------- pequenos

function monitorPequeno(
  scene: Scene,
  mats: Materiais,
  nome: string,
  x: number,
  y: number,
  z: number,
  frente: number
): void {
  const pe = CreateCylinder(`${nome}-pe`, { diameter: 0.3, height: 0.12 }, scene);
  pe.position.set(x, y + 0.06, z);
  pe.material = mats.metalEscuro;
  pe.freezeWorldMatrix();
  const corpo = CreateBox(`${nome}-corpo`, { width: 0.95, height: 0.6, depth: 0.08 }, scene);
  corpo.position.set(x, y + 0.45, z - frente * 0.05);
  corpo.material = mats.preto;
  corpo.freezeWorldMatrix();
  const tela = CreatePlane(`${nome}-tela`, { width: 0.82, height: 0.48 }, scene);
  tela.position.set(x, y + 0.45, z - frente * 0.11);
  if (frente > 0) tela.rotation.y = Math.PI;
  tela.material = mats.telaCiano;
  tela.freezeWorldMatrix();
}

function notebookAberto(
  scene: Scene,
  mats: Materiais,
  nome: string,
  x: number,
  y: number,
  z: number,
  ciano: boolean
): void {
  const base = CreateBox(`${nome}-base`, { width: 1, height: 0.06, depth: 0.7 }, scene);
  base.position.set(x, y + 0.03, z);
  base.material = mats.metal;
  base.freezeWorldMatrix();
  const tampa = CreateBox(`${nome}-tampa`, { width: 1, height: 0.62, depth: 0.05 }, scene);
  tampa.position.set(x, y + 0.32, z + 0.32);
  tampa.rotation.x = -0.32;
  tampa.material = mats.metal;
  tampa.freezeWorldMatrix();
  const tela = CreatePlane(`${nome}-tela`, { width: 0.86, height: 0.5 }, scene);
  tela.position.set(x, y + 0.33, z + 0.27);
  tela.rotation.x = -0.32;
  tela.rotation.y = Math.PI;
  tela.material = ciano ? mats.telaCiano : mats.telaLima;
  tela.freezeWorldMatrix();
}

// ------------------------------------------------------------ decoração

function decoracao(scene: Scene, mats: Materiais): void {
  // Luminárias suspensas: linhas de luz que também organizam a leitura.
  const trilhos: Array<{ x: number; z: number; l: number; material: StandardMaterial }> = [
    { x: -3, z: -7.6, l: 11, material: mats.luminaria },
    { x: -1.5, z: 0.6, l: 15, material: mats.luminaria },
    { x: 7, z: 5.4, l: 7, material: mats.luminaria },
    { x: -4.5, z: 8.8, l: 12, material: mats.luminaria },
  ];
  for (const t of trilhos) {
    bloco(scene, `luz-${t.x}-${t.z}`, { l: t.l, a: 0.22, p: 0.5 }, { x: t.x, y: 6.1, z: t.z }, t.material);
    bloco(scene, `luz-calha-${t.x}-${t.z}`, { l: t.l + 0.3, a: 0.18, p: 0.75 }, { x: t.x, y: 6.35, z: t.z }, mats.metalEscuro);
    for (const dx of [-t.l / 2 + 0.6, t.l / 2 - 0.6]) {
      const cabo = CreateCylinder(`luz-cabo-${t.x}-${t.z}-${dx}`, { diameter: 0.05, height: 1.2 }, scene);
      cabo.position.set(t.x + dx, 7, t.z);
      cabo.material = mats.metalEscuro;
      cabo.freezeWorldMatrix();
    }
  }

  planta(scene, mats, "plantaEsq", centro(MOVEIS.plantaEsquerda));
  planta(scene, mats, "plantaDir", centro(MOVEIS.plantaDireita));

  // Pilha de caixas de entrega.
  const cx = centro(MOVEIS.caixasEntrega);
  const pilha: Array<[number, number, number, number]> = [
    [-0.7, 0.6, -0.5, 1.2],
    [0.6, 0.55, 0.4, 1.1],
    [-0.2, 1.65, -0.1, 1],
    [0.5, 2.45, 0.5, 0.85],
  ];
  for (const [dx, y, dz, escala] of pilha) {
    const c = CreateBox(`entrega-${dx}-${y}`, { size: 1.2 * escala }, scene);
    c.position.set(cx.x + dx, y, cx.z + dz);
    c.rotation.y = dx * 0.4;
    c.material = mats.papelao;
    c.freezeWorldMatrix();
    const fita = CreateBox(`entrega-fita-${dx}-${y}`, { width: 0.2, height: 1.21 * escala, depth: 1.21 * escala }, scene);
    fita.position.copyFrom(c.position);
    fita.rotation.y = c.rotation.y;
    fita.material = mats.fita;
    fita.freezeWorldMatrix();
  }

  // Cartazes de promoção nas paredes.
  const cartazes: Array<{ nome: string; x: number; y: number; z: number; rotY: number; titulo: string; destaque: string; fundo: string; cor: string }> = [
    { nome: "cartaz1", x: LOJA.minX + 0.06, y: 3.6, z: -6, rotY: Math.PI / 2, titulo: "SSD NA PROMO", destaque: "-30%", fundo: "#132a35", cor: PALETA.lima },
    { nome: "cartaz2", x: LOJA.minX + 0.06, y: 3.6, z: 7, rotY: Math.PI / 2, titulo: "COMBO SETUP", destaque: "12x", fundo: "#2a1330", cor: PALETA.magenta },
    { nome: "cartaz3", x: LOJA.maxX - 0.06, y: 3.6, z: -4, rotY: -Math.PI / 2, titulo: "LIMPEZA", destaque: "R$99", fundo: "#13232f", cor: PALETA.ambar },
  ];
  for (const c of cartazes) {
    const plano = CreatePlane(c.nome, { width: 2.2, height: 2.9 }, scene);
    plano.position.set(c.x, c.y, c.z);
    plano.rotation.y = c.rotY;
    plano.material = materialCartaz(scene, c.nome, c.titulo, c.destaque, c.fundo, c.cor);
    plano.freezeWorldMatrix();
  }

  // Tapete de entrada.
  const tapete = CreateGround("tapeteEntrada", { width: 5, height: 2.4 }, scene);
  tapete.position.set((PORTA.minX + PORTA.maxX) / 2, 0.03, LOJA.minZ + 1.1);
  tapete.material = fosco(scene, "matTapeteEntrada", "#1d3d4a", { brilho: 0.3 });
  tapete.freezeWorldMatrix();

  // Cordão de balizadores guiando a fila até o balcão.
  for (let i = 0; i < 3; i++) {
    const z = -6.4 - i * 1.8;
    const poste = CreateCylinder(`baliza-${i}`, { diameter: 0.18, height: 1.1 }, scene);
    poste.position.set(-2.3, 0.55, z);
    poste.material = mats.metal;
    poste.freezeWorldMatrix();
    const topo = CreateSphere(`baliza-topo-${i}`, { diameter: 0.26, segments: 8 }, scene);
    topo.position.set(-2.3, 1.15, z);
    topo.material = mats.neonCiano;
    topo.freezeWorldMatrix();
  }

  // Cantinho de espera no meio do salão: dois pufes e uma mesinha baixa. Tudo
  // rasteiro, para não tapar quem circula atrás.
  const espera = centro(MOVEIS.esperaClientes);
  for (const [dx, dz] of [
    [-1.1, -0.6],
    [1.1, -0.2],
  ] as const) {
    const pufe = CreateCylinder(`pufe-${dx}`, { diameter: 1.1, height: 0.55, tessellation: 12 }, scene);
    pufe.position.set(espera.x + dx, 0.28, espera.z + dz);
    pufe.material = dx < 0 ? mats.vaso : mats.folha;
    pufe.freezeWorldMatrix();
  }
  const mesinha = CreateCylinder("mesinha", { diameter: 1.3, height: 0.12 }, scene);
  mesinha.position.set(espera.x, 0.62, espera.z + 0.9);
  mesinha.material = mats.branco;
  mesinha.freezeWorldMatrix();
  const peMesinha = CreateCylinder("mesinha-pe", { diameter: 0.28, height: 0.6 }, scene);
  peMesinha.position.set(espera.x, 0.3, espera.z + 0.9);
  peMesinha.material = mats.metalEscuro;
  peMesinha.freezeWorldMatrix();
  const revista = CreateBox("mesinha-revista", { width: 0.5, height: 0.05, depth: 0.36 }, scene);
  revista.position.set(espera.x + 0.15, 0.71, espera.z + 0.9);
  revista.rotation.y = 0.4;
  revista.material = mats.neonCiano;
  revista.freezeWorldMatrix();

  // Aro decorativo de neon acima da entrada.
  const aro = CreateTorus("aroEntrada", { diameter: 4.6, thickness: 0.14, tessellation: 28 }, scene);
  aro.position.set((PORTA.minX + PORTA.maxX) / 2, 2.3, LOJA.minZ + 0.15);
  aro.material = mats.neonMagenta;
  aro.freezeWorldMatrix();
}

function planta(scene: Scene, mats: Materiais, nome: string, pos: { x: number; z: number }): void {
  const vaso = CreateCylinder(`${nome}-vaso`, { diameterTop: 0.95, diameterBottom: 0.7, height: 0.9 }, scene);
  vaso.position.set(pos.x, 0.45, pos.z);
  vaso.material = mats.vaso;
  vaso.freezeWorldMatrix();

  const folhas: Array<[number, number, number, number]> = [
    [0, 1.3, 0, 1.5],
    [0.35, 1.85, 0.2, 1.1],
    [-0.4, 1.7, -0.25, 1],
    [0.1, 2.35, -0.3, 0.85],
  ];
  folhas.forEach(([dx, y, dz, escala], i) => {
    const folha = CreateSphere(`${nome}-folha-${i}`, { diameter: escala, segments: 8 }, scene);
    folha.position.set(pos.x + dx, y, pos.z + dz);
    folha.scaling.y = 0.75;
    folha.material = i % 2 === 0 ? mats.folha : mats.folhaClara;
    folha.freezeWorldMatrix();
  });
}


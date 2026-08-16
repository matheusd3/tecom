// materials.ts — paleta e fábricas de material/textura da loja.
//
// Nada de asset externo: cada textura é desenhada em canvas na hora. Assim o
// jogo continua sendo um único bundle, sem download de imagem.

import type { Scene } from "@babylonjs/core/scene";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Color3 } from "@babylonjs/core/Maths/math.color";

/** Paleta da loja: alegre, mas ainda na família ciano/magenta/lima da marca. */
export const PALETA = {
  fundoCena: "#0b1218",
  // O piso desceu um tom de propósito. Ele era quase tão claro quanto as caixas
  // de mercadoria e os móveis brancos, e nessa faixa de valor as silhuetas se
  // perdiam vistas de cima — em cena low-poly quem separa as formas é o
  // contraste de valor, não o detalhe da geometria.
  pisoClaro: "#bad0db",
  pisoEscuro: "#74a3b7",
  rejunte: "#6a94a6",
  paredeBaixa: "#2f4a58",
  paredeAlta: "#4b7286",
  rodape: "#1c2f3a",
  teto: "#16242e",
  madeira: "#c98a4b",
  madeiraEscura: "#8d5a2b",
  metal: "#93a7b4",
  metalEscuro: "#5a6c78",
  ciano: "#00e5ff",
  magenta: "#ff2e97",
  lima: "#b6ff3a",
  ambar: "#ffc857",
  vermelho: "#ff5468",
  branco: "#e4eff5",
  preto: "#101820",
  vidro: "#bfe9f5",
} as const;

export const COR_ESTACAO: Record<
  "balcao" | "prateleira" | "assistencia" | "almoxarifado" | "bebedouro" | "cafe",
  string
> = {
  balcao: PALETA.ciano,
  prateleira: PALETA.lima,
  assistencia: PALETA.magenta,
  almoxarifado: PALETA.ambar,
  bebedouro: PALETA.ciano,
  // Âmbar quente para o café não ser confundido com o bebedouro ciano: as duas
  // estações ficam lado a lado no cantinho de espera.
  cafe: "#d98a3a",
};

/** Cores das caixas de produto nas prateleiras. */
export const CORES_PRODUTO = [
  "#ff8a3d",
  "#57d2ff",
  "#b6ff3a",
  "#ff5fa8",
  "#ffd75e",
  "#8f7bff",
  "#3ee6b0",
  "#ff6b6b",
];

export function cor(hex: string): Color3 {
  return Color3.FromHexString(hex);
}

interface OpcoesMaterial {
  /** Brilho próprio, para neon e telas. 0 = nada. */
  brilho?: number;
  especular?: number;
  alpha?: number;
  /** Materiais que mudam em tempo real (destaque de zona) não podem congelar. */
  mutavel?: boolean;
}

/** Material opaco padrão da cena. */
export function fosco(
  scene: Scene,
  nome: string,
  hex: string,
  opcoes: OpcoesMaterial = {}
): StandardMaterial {
  const m = new StandardMaterial(nome, scene);
  const base = cor(hex);
  m.diffuseColor = base;
  m.specularColor = new Color3(opcoes.especular ?? 0.06, opcoes.especular ?? 0.06, opcoes.especular ?? 0.06);
  m.emissiveColor = base.scale(opcoes.brilho ?? 0.07);
  if (opcoes.alpha !== undefined) m.alpha = opcoes.alpha;
  if (!opcoes.mutavel) m.freeze();
  return m;
}

/** Material que ignora a luz e só emite cor: letreiros, luminárias, telas. */
export function neon(
  scene: Scene,
  nome: string,
  hex: string,
  intensidade = 1,
  alpha = 1
): StandardMaterial {
  const m = new StandardMaterial(nome, scene);
  m.disableLighting = true;
  m.diffuseColor = Color3.Black();
  m.specularColor = Color3.Black();
  m.emissiveColor = cor(hex).scale(intensidade);
  m.alpha = alpha;
  m.freeze();
  return m;
}

/** Vidro de vitrine: translúcido, com um leve brilho. */
export function vidro(scene: Scene, nome: string, alpha = 0.13): StandardMaterial {
  const m = new StandardMaterial(nome, scene);
  m.diffuseColor = cor(PALETA.vidro);
  m.emissiveColor = cor(PALETA.vidro).scale(0.08);
  m.specularColor = new Color3(0.8, 0.9, 1);
  m.specularPower = 96;
  m.alpha = alpha;
  m.backFaceCulling = false;
  m.freeze();
  return m;
}

// ------------------------------------------------------------- texturas

function contexto(textura: DynamicTexture): CanvasRenderingContext2D {
  return textura.getContext() as unknown as CanvasRenderingContext2D;
}

/** Piso de azulejo: xadrez em dois tons com rejunte e alguns azulejos de cor. */
export function materialPiso(scene: Scene): StandardMaterial {
  const lado = 512;
  const textura = new DynamicTexture("texPiso", { width: lado, height: lado }, scene, true);
  const ctx = contexto(textura);
  const celulas = 8;
  const passo = lado / celulas;

  ctx.fillStyle = PALETA.pisoClaro;
  ctx.fillRect(0, 0, lado, lado);

  for (let linha = 0; linha < celulas; linha++) {
    for (let coluna = 0; coluna < celulas; coluna++) {
      const par = (linha + coluna) % 2 === 0;
      // Um punhado de azulejos coloridos quebra a monotonia do xadrez.
      const destaque = (linha * 3 + coluna * 5) % 11 === 0;
      ctx.fillStyle = destaque ? "#8fe3d6" : par ? PALETA.pisoClaro : PALETA.pisoEscuro;
      ctx.fillRect(coluna * passo, linha * passo, passo, passo);
    }
  }

  ctx.strokeStyle = PALETA.rejunte;
  ctx.lineWidth = 3;
  for (let i = 0; i <= celulas; i++) {
    const p = i * passo;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, lado);
    ctx.moveTo(0, p);
    ctx.lineTo(lado, p);
    ctx.stroke();
  }
  textura.update();

  const m = new StandardMaterial("matPiso", scene);
  m.diffuseTexture = textura;
  m.specularColor = new Color3(0.12, 0.14, 0.16);
  m.specularPower = 64;
  m.emissiveColor = new Color3(0.05, 0.055, 0.06);
  textura.uScale = 4;
  textura.vScale = 3;
  m.freeze();
  return m;
}

/** Placa/letreiro com texto — usada em sinalização e cartazes. */
export function materialPlaca(
  scene: Scene,
  nome: string,
  texto: string,
  hexFundo: string,
  hexTexto: string,
  subtitulo?: string
): StandardMaterial {
  const largura = 512;
  const altura = 256;
  const textura = new DynamicTexture(`tex-${nome}`, { width: largura, height: altura }, scene, true);
  const ctx = contexto(textura);

  ctx.fillStyle = hexFundo;
  ctx.fillRect(0, 0, largura, altura);
  ctx.strokeStyle = hexTexto;
  ctx.lineWidth = 10;
  ctx.strokeRect(14, 14, largura - 28, altura - 28);

  ctx.fillStyle = hexTexto;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 86px Orbitron, Segoe UI, sans-serif";
  ctx.fillText(texto, largura / 2, subtitulo ? altura / 2 - 26 : altura / 2, largura - 60);
  if (subtitulo) {
    ctx.font = "600 44px Inter, Segoe UI, sans-serif";
    ctx.fillText(subtitulo, largura / 2, altura / 2 + 54, largura - 60);
  }
  textura.update();

  const m = new StandardMaterial(`mat-${nome}`, scene);
  m.diffuseTexture = textura;
  m.emissiveColor = new Color3(0.55, 0.55, 0.55);
  m.specularColor = Color3.Black();
  m.freeze();
  return m;
}

/** Cartaz de promoção: fundo em faixa diagonal + preço. */
export function materialCartaz(
  scene: Scene,
  nome: string,
  titulo: string,
  destaque: string,
  hexFundo: string,
  hexDestaque: string
): StandardMaterial {
  const largura = 320;
  const altura = 420;
  const textura = new DynamicTexture(`tex-${nome}`, { width: largura, height: altura }, scene, true);
  const ctx = contexto(textura);

  ctx.fillStyle = hexFundo;
  ctx.fillRect(0, 0, largura, altura);
  ctx.fillStyle = hexDestaque;
  ctx.beginPath();
  ctx.moveTo(0, altura * 0.42);
  ctx.lineTo(largura, altura * 0.3);
  ctx.lineTo(largura, altura * 0.72);
  ctx.lineTo(0, altura * 0.84);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#0d1a22";
  ctx.textAlign = "center";
  ctx.font = "bold 130px Orbitron, Segoe UI, sans-serif";
  ctx.fillText(destaque, largura / 2, altura * 0.63, largura - 30);

  ctx.fillStyle = "#f4fbff";
  ctx.font = "bold 46px Inter, Segoe UI, sans-serif";
  ctx.fillText(titulo, largura / 2, altura * 0.22, largura - 30);
  textura.update();

  const m = new StandardMaterial(`mat-${nome}`, scene);
  m.diffuseTexture = textura;
  m.emissiveColor = new Color3(0.5, 0.5, 0.5);
  m.specularColor = Color3.Black();
  m.freeze();
  return m;
}

/** Ícone flutuante acima do cliente: o que ele quer, legível de longe. */
export function materialIcone(
  scene: Scene,
  nome: string,
  tipo: "produto" | "reparo" | "feliz" | "bravo",
  hexFundo: string
): StandardMaterial {
  const lado = 256;
  const textura = new DynamicTexture(`tex-${nome}`, { width: lado, height: lado }, scene, true);
  const ctx = contexto(textura);

  ctx.clearRect(0, 0, lado, lado);
  ctx.fillStyle = hexFundo;
  ctx.beginPath();
  ctx.arc(lado / 2, lado / 2, lado / 2 - 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#0d1a22";
  ctx.lineWidth = 12;
  ctx.stroke();

  ctx.strokeStyle = "#0d1a22";
  ctx.fillStyle = "#0d1a22";
  ctx.lineWidth = 14;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (tipo === "produto") {
    // Notebook aberto, de perfil.
    ctx.beginPath();
    ctx.moveTo(70, 96);
    ctx.lineTo(186, 96);
    ctx.lineTo(186, 152);
    ctx.lineTo(70, 152);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(52, 172);
    ctx.lineTo(204, 172);
    ctx.stroke();
  } else if (tipo === "reparo") {
    // Chave inglesa na diagonal.
    ctx.beginPath();
    ctx.moveTo(96, 168);
    ctx.lineTo(170, 94);
    ctx.stroke();
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(84, 180, 30, Math.PI * 0.15, Math.PI * 1.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(180, 84, 26, Math.PI * 1.15, Math.PI * 0.55);
    ctx.stroke();
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 130px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(tipo === "feliz" ? "♥" : "☁", lado / 2, 170);
  }
  textura.update();
  textura.hasAlpha = true;

  const m = new StandardMaterial(`mat-${nome}`, scene);
  m.diffuseTexture = textura;
  m.diffuseTexture.hasAlpha = true;
  m.useAlphaFromDiffuseTexture = true;
  m.emissiveColor = new Color3(0.75, 0.75, 0.75);
  m.specularColor = Color3.Black();
  m.backFaceCulling = false;
  m.freeze();
  return m;
}

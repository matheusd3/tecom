// layout.ts — a planta baixa da loja.
//
// Um único lugar define onde ficam os móveis, o que bloqueia o caminho e onde
// o jogador consegue interagir. Cena, colisão e clientes leem daqui, então
// mover um balcão não deixa a colisão desatualizada.
//
// Eixos: X cresce para a direita da tela, Z cresce para o fundo da loja.
// A câmera olha da frente (Z negativo) para o fundo (Z positivo).

export interface Retangulo {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface Ponto {
  x: number;
  z: number;
}

export type Estacao = "balcao" | "estoque" | "assistencia";

// A loja é propositalmente mais funda do que larga: os painéis da interface
// ocupam as laterais da tela, então o que sobra para a cena é uma janela alta.
/** Área interna útil (as paredes ficam nas bordas). */
export const LOJA = { minX: -11, maxX: 11, minZ: -11.5, maxZ: 11.5 };

export const ALTURA_PAREDE = 7;

/** Vão da porta de entrada na parede da frente. */
export const PORTA = { minX: 5, maxX: 9, z: -11.5 };

// ---------------------------------------------------------------- móveis

// Regra de composição desta câmera: móvel alto esconde o chão logo atrás dele.
// Por isso tudo que é alto (prateleiras, bancada) fica encostado nas paredes e
// o miolo da loja só tem móveis baixos — é lá que as pessoas circulam.
export const MOVEIS = {
  /** Balcão de vendas: o jogador atende por trás (Z maior). */
  balcao: { minX: -8, maxX: 1, minZ: -5, maxZ: -3 } as Retangulo,
  /** Ilha de vitrine ao lado da entrada. */
  vitrine: { minX: 3, maxX: 6.5, minZ: -5, maxZ: -3.4 } as Retangulo,
  /** Ilha baixa de estoque no meio do salão. */
  ilhaEstoque: { minX: -7, maxX: -1, minZ: 2.2, maxZ: 3.6 } as Retangulo,
  /** Prateleira alta encostada na parede esquerda. */
  prateleiraEsquerda: { minX: -11, maxX: -9.6, minZ: -2, maxZ: 8 } as Retangulo,
  /** Prateleira alta encostada na parede do fundo. */
  prateleiraFundo: { minX: -11, maxX: 2, minZ: 10.4, maxZ: 11.5 } as Retangulo,
  /** Bancada da assistência, no canto do fundo à direita. */
  bancada: { minX: 4.5, maxX: 11, minZ: 9.6, maxZ: 11.5 } as Retangulo,
  /** Pilha de caixas de entrega. */
  caixasEntrega: { minX: 9.4, maxX: 11, minZ: 0.4, maxZ: 2.6 } as Retangulo,
  /** Cantinho de espera (pufes e mesinha) no meio do salão. */
  esperaClientes: { minX: 6, maxX: 8.8, minZ: 0.5, maxZ: 2.6 } as Retangulo,
  plantaEsquerda: { minX: -11, maxX: -9.6, minZ: -11.5, maxZ: -10.1 } as Retangulo,
  plantaDireita: { minX: 9.6, maxX: 11, minZ: -11.5, maxZ: -10.1 } as Retangulo,
};

/** Tudo que o atendente não atravessa: paredes + móveis. */
export const COLISORES: Retangulo[] = [
  // Paredes (com folga para fora da área útil).
  { minX: -17, maxX: 17, minZ: 11.5, maxZ: 13 },
  { minX: -17, maxX: -15.5, minZ: -13, maxZ: 13 },
  { minX: 15.5, maxX: 17, minZ: -13, maxZ: 13 },
  { minX: -17, maxX: PORTA.minX, minZ: -13, maxZ: -11.5 },
  { minX: PORTA.maxX, maxX: 17, minZ: -13, maxZ: -11.5 },
  ...Object.values(MOVEIS),
];

// ---------------------------------------------------------------- zonas

/**
 * Onde o atendente precisa estar para usar cada estação. Todas ficam em
 * corredores livres, do lado do móvel que a colisão deixa alcançável.
 */
export const ZONAS: Array<{ id: Estacao; retangulos: Retangulo[]; rotulo: string }> = [
  {
    id: "balcao",
    rotulo: "Balcão de vendas",
    retangulos: [{ minX: -8, maxX: 1.5, minZ: -3, maxZ: -0.8 }],
  },
  {
    id: "estoque",
    rotulo: "Estoque",
    retangulos: [
      { minX: -8, maxX: 0, minZ: 0.2, maxZ: 1.3 },
      { minX: -9.5, maxX: -8.2, minZ: -2, maxZ: 8 },
      { minX: -9.5, maxX: 2, minZ: 8.3, maxZ: 9.5 },
    ],
  },
  {
    id: "assistencia",
    rotulo: "Assistência técnica",
    retangulos: [{ minX: 4.5, maxX: 11, minZ: 7.4, maxZ: 8.7 }],
  },
];

// ---------------------------------------------------------------- pessoas

export const RAIO_JOGADOR = 0.85;
export const VELOCIDADE_JOGADOR = 9.5;
export const INICIO_JOGADOR: Ponto = { x: -4, z: -1.6 };

/** Ponto onde o cliente entra e para onde volta ao sair. */
export const ENTRADA: Ponto = { x: 7, z: -11 };

/** Fila em frente ao balcão; o índice 0 é quem está sendo atendido. */
export const FILA: Ponto[] = [
  { x: -4, z: -6.5 },
  { x: -4, z: -8.7 },
  { x: -4, z: -10.6 },
  { x: -1.6, z: -10.6 },
];

/**
 * Onde o cliente espera depois de entregar o aparelho. Fica no cantinho de
 * espera, no meio do salão: cliente nenhum entra na área da assistência — quem
 * leva e busca o aparelho é o atendente.
 */
export const ESPERA_REPARO: Ponto[] = [
  { x: 5.2, z: 1.5 },
  { x: 5.2, z: 3.2 },
  { x: 7.6, z: 3.6 },
];

// ---------------------------------------------------------------- consultas

export function centro(r: Retangulo): Ponto {
  return { x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2 };
}

export function largura(r: Retangulo): number {
  return r.maxX - r.minX;
}

export function profundidade(r: Retangulo): number {
  return r.maxZ - r.minZ;
}

export function dentro(p: Ponto, r: Retangulo): boolean {
  return p.x >= r.minX && p.x <= r.maxX && p.z >= r.minZ && p.z <= r.maxZ;
}

/**
 * Tira o personagem de dentro dos móveis empurrando-o pela saída mais curta.
 * Andar e depois resolver (em vez de cancelar o passo) é o que faz o boneco
 * deslizar pela parede e contornar quinas em vez de grudar nelas.
 */
export function resolverColisoes(p: Ponto, raio: number): void {
  // Poucas passadas bastam: um empurrão pode encostar em outro móvel.
  for (let passada = 0; passada < 3; passada++) {
    let ajustou = false;

    for (const r of COLISORES) {
      const maisProximoX = Math.min(Math.max(p.x, r.minX), r.maxX);
      const maisProximoZ = Math.min(Math.max(p.z, r.minZ), r.maxZ);
      const dx = p.x - maisProximoX;
      const dz = p.z - maisProximoZ;
      const distancia2 = dx * dx + dz * dz;
      if (distancia2 >= raio * raio) continue;

      if (distancia2 > 1e-6) {
        const distancia = Math.sqrt(distancia2);
        const empurrao = raio - distancia;
        p.x += (dx / distancia) * empurrao;
        p.z += (dz / distancia) * empurrao;
      } else {
        // Centro dentro do retângulo: sai pela face mais perto.
        const paraEsquerda = p.x - r.minX;
        const paraDireita = r.maxX - p.x;
        const paraFrente = p.z - r.minZ;
        const paraFundo = r.maxZ - p.z;
        const menor = Math.min(paraEsquerda, paraDireita, paraFrente, paraFundo);
        if (menor === paraEsquerda) p.x = r.minX - raio;
        else if (menor === paraDireita) p.x = r.maxX + raio;
        else if (menor === paraFrente) p.z = r.minZ - raio;
        else p.z = r.maxZ + raio;
      }
      ajustou = true;
    }

    if (!ajustou) return;
  }
}

export function estacaoEm(p: Ponto): Estacao | null {
  for (const zona of ZONAS) {
    if (zona.retangulos.some((r) => dentro(p, r))) return zona.id;
  }
  return null;
}

export function rotuloDaEstacao(estacao: Estacao): string {
  return ZONAS.find((z) => z.id === estacao)?.rotulo ?? estacao;
}

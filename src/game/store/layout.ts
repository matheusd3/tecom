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

/**
 * Estações de trabalho. "prateleira" é a mercadoria exposta, de onde sai a
 * venda; "almoxarifado" é a sala dos fundos, onde a compra chega e de onde se
 * repõe a prateleira.
 */
export type Estacao = "balcao" | "prateleira" | "assistencia" | "almoxarifado" | "bebedouro" | "cafe";

// A loja é propositalmente mais funda do que larga: os painéis da interface
// ocupam as laterais da tela, então o que sobra para a cena é uma janela alta.
/** Área interna útil (as paredes ficam nas bordas). */
export const LOJA = { minX: -11, maxX: 11, minZ: -11.5, maxZ: 11.5 };

export const ALTURA_PAREDE = 7;

/** Vão da porta de entrada na parede da frente. */
export const PORTA = { minX: 5, maxX: 9, z: -11.5 };

/**
 * Almoxarifado: sala nos fundos, atrás da assistência. É onde a mercadoria
 * comprada chega. Da prateleira sai o que se vende; daqui sai o que repõe a
 * prateleira, e alguém precisa carregar de um lado para o outro.
 */
export const ALMOXARIFADO = { minX: 2.6, maxX: 11, minZ: 11.5, maxZ: 15.4 };

/** Passagem entre o salão e o almoxarifado, na parede do fundo. */
export const PASSAGEM = { minX: 3.2, maxX: 5.4 };

// ---------------------------------------------------------------- móveis

// Regra de composição desta câmera: móvel alto esconde o chão logo atrás dele.
// Por isso tudo que é alto (prateleiras, bancada) fica encostado nas paredes e
// o miolo da loja só tem móveis baixos — é lá que as pessoas circulam.
export const MOVEIS = {
  /** Balcão de vendas: o jogador atende por trás (Z maior). */
  balcao: { minX: -8, maxX: 1, minZ: -5, maxZ: -3 } as Retangulo,
  /** Ilha de vitrine ao lado da entrada. */
  vitrine: { minX: 3, maxX: 6.5, minZ: -5, maxZ: -3.4 } as Retangulo,
  /** Prateleira alta encostada na parede esquerda. */
  prateleiraEsquerda: { minX: -11, maxX: -9.6, minZ: -2, maxZ: 8 } as Retangulo,
  /** Prateleira alta encostada na parede do fundo. */
  prateleiraFundo: { minX: -11, maxX: 2, minZ: 10.4, maxZ: 11.5 } as Retangulo,
  /**
   * Bancada da assistência, no canto do fundo à direita. Ela para antes da
   * parede: a faixa que sobra atrás é onde o técnico trabalha, como em loja de
   * verdade — cliente e atendente ficam do lado de cá.
   */
  bancada: { minX: 5.6, maxX: 11, minZ: 8.8, maxZ: 10.2 } as Retangulo,
  /** Estante do almoxarifado: a mercadoria comprada empilhada nos fundos. */
  estanteAlmoxarifado: { minX: 2.6, maxX: 11, minZ: 14.2, maxZ: 15.4 } as Retangulo,
  /** Cantinho de espera (pufes e mesinha) no meio do salão. */
  esperaClientes: { minX: 6, maxX: 8.8, minZ: 0.5, maxZ: 2.6 } as Retangulo,
  /**
   * Ponto de água encostado na parede da direita. Ele ganhou pegada em vez de
   * altura: nesta câmera o que se lê é a silhueta no chão, e passar de ~1,3
   * apagaria o piso atrás. Por isso é largo, fundo e baixo.
   */
  bebedouro: { minX: 9.2, maxX: 11, minZ: -0.6, maxZ: 3.4 } as Retangulo,
  /**
   * Ponto de café da espera, à esquerda dos pufes. Junto com o bebedouro ele
   * fecha o cantinho de espera, e a mesma regra de altura vale aqui.
   */
  cafe: { minX: 2.9, maxX: 4.6, minZ: 0, maxZ: 3.2 } as Retangulo,
  plantaEsquerda: { minX: -11, maxX: -9.6, minZ: -11.5, maxZ: -10.1 } as Retangulo,
  plantaDireita: { minX: 9.6, maxX: 11, minZ: -11.5, maxZ: -10.1 } as Retangulo,
};

/**
 * Tudo que o atendente não atravessa: paredes + móveis.
 *
 * As paredes são derivadas de LOJA de propósito. Quando a planta encolheu, os
 * colisores ficaram para trás nas medidas antigas e dava para andar para fora
 * das paredes desenhadas — agora eles não têm como divergir.
 */
const FOLGA_PAREDE = 2;
export const COLISORES: Retangulo[] = [
  // Laterais do salão. A da direita segue até o fundo do almoxarifado.
  { minX: LOJA.minX - FOLGA_PAREDE, maxX: LOJA.minX, minZ: LOJA.minZ - FOLGA_PAREDE, maxZ: LOJA.maxZ + FOLGA_PAREDE },
  { minX: LOJA.maxX, maxX: LOJA.maxX + FOLGA_PAREDE, minZ: LOJA.minZ - FOLGA_PAREDE, maxZ: ALMOXARIFADO.maxZ + FOLGA_PAREDE },
  // A frente é fechada inteira, inclusive o vão da porta: o cliente entra por
  // ali porque clientes não colidem, mas o atendente não sai da loja.
  { minX: LOJA.minX - FOLGA_PAREDE, maxX: LOJA.maxX + FOLGA_PAREDE, minZ: LOJA.minZ - FOLGA_PAREDE, maxZ: LOJA.minZ },
  // Parede do fundo do salão, partida no vão que leva ao almoxarifado.
  { minX: LOJA.minX - FOLGA_PAREDE, maxX: PASSAGEM.minX, minZ: LOJA.maxZ, maxZ: LOJA.maxZ + 0.6 },
  { minX: PASSAGEM.maxX, maxX: LOJA.maxX + FOLGA_PAREDE, minZ: LOJA.maxZ, maxZ: LOJA.maxZ + 0.6 },
  // Almoxarifado: parede da esquerda e do fundo.
  { minX: ALMOXARIFADO.minX - FOLGA_PAREDE, maxX: ALMOXARIFADO.minX, minZ: LOJA.maxZ, maxZ: ALMOXARIFADO.maxZ + FOLGA_PAREDE },
  { minX: ALMOXARIFADO.minX - FOLGA_PAREDE, maxX: ALMOXARIFADO.maxX + FOLGA_PAREDE, minZ: ALMOXARIFADO.maxZ, maxZ: ALMOXARIFADO.maxZ + FOLGA_PAREDE },
  ...Object.values(MOVEIS),
];

// ---------------------------------------------------------------- zonas

/**
 * A estação é medida pela distância ao MÓVEL, não por um retângulo desenhado à
 * mão no chão. Retângulo fixo tem um defeito cruel: encostar no móvel é
 * justamente o gesto natural do jogador, e é ali que a borda da zona acabava —
 * o atendente ficava colado na bancada sem conseguir largar o aparelho.
 */
export const ALCANCE_ESTACAO = 1.7;

const ESTACOES: Array<{ id: Estacao; rotulo: string; moveis: Retangulo[] }> = [
  { id: "balcao", rotulo: "Balcão de vendas", moveis: [MOVEIS.balcao] },
  {
    id: "prateleira",
    rotulo: "Prateleiras",
    moveis: [MOVEIS.prateleiraEsquerda, MOVEIS.prateleiraFundo],
  },
  { id: "assistencia", rotulo: "Assistência técnica", moveis: [MOVEIS.bancada] },
  { id: "almoxarifado", rotulo: "Almoxarifado", moveis: [MOVEIS.estanteAlmoxarifado] },
  { id: "bebedouro", rotulo: "Bebedouro", moveis: [MOVEIS.bebedouro] },
  { id: "cafe", rotulo: "Café da espera", moveis: [MOVEIS.cafe] },
];

// ---------------------------------------------------------------- pessoas

export const RAIO_JOGADOR = 0.85;
export const VELOCIDADE_JOGADOR = 9.5;
export const INICIO_JOGADOR: Ponto = { x: -4, z: -1.6 };

/** Ponto onde o cliente entra e para onde volta ao sair. */
export const ENTRADA: Ponto = { x: 7, z: -11 };

/**
 * Fila em frente ao balcão; o índice 0 é quem está sendo atendido.
 *
 * Eram quatro vagas, e o teto da fila (`GameWorld.tetoDaFila`) passa de quatro
 * no dia 7 — ou já no dia 5 com o Segundo balcão, a melhoria vendida
 * justamente como "a fila comporta mais 2 clientes". Do quinto cliente em
 * diante todos recebiam a MESMA vaga e ficavam um dentro do outro.
 *
 * As três primeiras são a coluna colada no balcão e definem a forma da fila;
 * as demais dobram pela frente da loja em fileiras que recuam. Todas foram
 * conferidas contra `MOVEIS` com raio de pessoa de 0,85 — a vaga em
 * (-8,8; -10,6) caía dentro da `plantaEsquerda` e virou (-8,4; -10,6).
 */
export const FILA: Ponto[] = [
  // Cabeça da fila: a coluna que encosta no balcão.
  { x: -4, z: -6.5 },
  { x: -4, z: -8.7 },
  { x: -4, z: -10.6 },
  // Primeira fileira, rente à parede da frente, para os dois lados.
  { x: -1.6, z: -10.6 },
  { x: 0.8, z: -10.6 },
  { x: 3.2, z: -10.6 },
  { x: -6.4, z: -10.6 },
  { x: -8.4, z: -10.6 },
  // Segunda fileira.
  { x: -1.6, z: -8.4 },
  { x: 0.8, z: -8.4 },
  { x: 3.2, z: -8.4 },
  { x: -6.4, z: -8.4 },
  { x: -8.8, z: -8.4 },
  // Terceira fileira, já perto do balcão.
  { x: -1.6, z: -6.3 },
  { x: 0.8, z: -6.3 },
  { x: 3.2, z: -6.3 },
  { x: -6.4, z: -6.3 },
  { x: -8.8, z: -6.3 },
];

/**
 * Vaga da fila por posição, sem nunca repetir ponto.
 *
 * O acesso era `FILA[Math.min(i, FILA.length - 1)]`, e o `Math.min` é o bug:
 * ele não "limita", ele empilha — todo excedente ganha a última vaga.
 *
 * As 18 vagas desenhadas cobrem o teto da fila até o dia 46 (dia 40 com o
 * Segundo balcão), bem além dos 30 dias do arco. O transbordo abaixo é rede de
 * segurança, não desenho: `tetoDaFila` cresce sem limite e nenhuma lista
 * desenhada basta sozinha para sempre.
 */
export function vagaDaFila(indice: number): Ponto {
  const vaga = FILA[indice];
  if (vaga) return vaga;
  const extra = indice - FILA.length;
  const colunas = 8;
  const volta = Math.floor(extra / colunas);
  return {
    x: -8.4 + (extra % colunas) * 2.4 + volta * 0.35,
    z: -11.15 + volta * 0.18,
  };
}

/**
 * Onde o cliente espera depois de entregar o aparelho. Fica no cantinho de
 * espera, no meio do salão: cliente nenhum entra na área da assistência — quem
 * leva e busca o aparelho é o atendente.
 */
export const ESPERA_REPARO: Ponto[] = [
  // As três originais: sentar no pufe e encostar no café é o desenho do canto.
  { x: 5.2, z: 1.5 },
  { x: 5.2, z: 3.2 },
  { x: 7.6, z: 3.6 },
  // Vagas novas, pelo mesmo motivo da fila: eram três, e o quarto aparelho em
  // espera colocava o dono dentro de quem já estava lá.
  { x: 5.2, z: 5.2 },
  { x: 7.6, z: 5.6 },
  { x: 9.8, z: 5.6 },
  { x: 1.4, z: 4.0 },
  { x: 1.4, z: 6.0 },
];

/** Mesma regra da fila: quem passa das vagas desenhadas ganha ponto só dele. */
export function vagaDeEspera(indice: number): Ponto {
  const vaga = ESPERA_REPARO[indice];
  if (vaga) return vaga;
  const extra = indice - ESPERA_REPARO.length;
  return { x: 1.4 + (extra % 5) * 2.2, z: 7.8 + Math.floor(extra / 5) * 0.4 };
}

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

/** Distância do ponto até a borda do retângulo (0 se estiver dentro). */
export function distanciaAte(p: Ponto, r: Retangulo): number {
  const dx = Math.max(r.minX - p.x, 0, p.x - r.maxX);
  const dz = Math.max(r.minZ - p.z, 0, p.z - r.maxZ);
  return Math.hypot(dx, dz);
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

/** A estação mais perto do atendente, se ele estiver ao alcance de alguma. */
export function estacaoEm(p: Ponto): Estacao | null {
  let escolhida: Estacao | null = null;
  let menorDistancia = ALCANCE_ESTACAO;

  for (const estacao of ESTACOES) {
    for (const movel of estacao.moveis) {
      const distancia = distanciaAte(p, movel);
      if (distancia <= menorDistancia) {
        menorDistancia = distancia;
        escolhida = estacao.id;
      }
    }
  }

  return escolhida;
}

export function rotuloDaEstacao(estacao: Estacao): string {
  return ESTACOES.find((e) => e.id === estacao)?.rotulo ?? estacao;
}

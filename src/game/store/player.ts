// player.ts — o atendente controlado pelo jogador.
//
// Movimento em corredor: WASD/setas, velocidade constante e colisão por
// retângulo resolvida eixo a eixo. Não há física — quando um eixo esbarra, só
// aquele eixo é cancelado, então o boneco desliza pela parede em vez de travar.

import {
  INICIO_JOGADOR,
  RAIO_JOGADOR,
  VELOCIDADE_JOGADOR,
  estacaoEm,
  resolverColisoes,
  type Estacao,
  type Ponto,
} from "./layout";
import { PALETA } from "./materials";
import type { FabricaDePessoas, Personagem, TipoCarga } from "./characters";

export interface Jogador {
  personagem: Personagem;
  posicao: Ponto;
  estacao: Estacao | null;
  carga: TipoCarga | null;
  atualizar(deltaSeconds: number): void;
  definirCarga(tipo: TipoCarga | null, hex?: string): void;
  dispose(): void;
}

interface Ganchos {
  /** Chamado quando o atendente entra ou sai de uma estação. */
  aoMudarEstacao(estacao: Estacao | null): void;
  /** Chamado quando ele aperta E dentro de uma estação. */
  aoInteragir(estacao: Estacao): void;
}

const TECLAS_MOVIMENTO: Record<string, { x: number; z: number }> = {
  KeyW: { x: 0, z: 1 },
  ArrowUp: { x: 0, z: 1 },
  KeyS: { x: 0, z: -1 },
  ArrowDown: { x: 0, z: -1 },
  KeyA: { x: -1, z: 0 },
  ArrowLeft: { x: -1, z: 0 },
  KeyD: { x: 1, z: 0 },
  ArrowRight: { x: 1, z: 0 },
};

const TECLAS_ACAO = new Set(["KeyE", "Space"]);

/** O jogo não pode roubar o teclado de quem está digitando um preço. */
function digitando(alvo: EventTarget | null): boolean {
  const el = alvo as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
}

export function criarJogador(fabrica: FabricaDePessoas, ganchos: Ganchos): Jogador {
  const personagem = fabrica.criar({
    nome: "Atendente",
    roupa: PALETA.ciano,
    calca: "#1f3440",
    pele: "#f2c6a0",
    cabelo: "#2b1d14",
    jogador: true,
  });

  const posicao: Ponto = { ...INICIO_JOGADOR };
  personagem.raiz.position.set(posicao.x, 0, posicao.z);
  personagem.raiz.rotation.y = Math.PI; // começa de frente para o balcão

  const pressionadas = new Set<string>();
  let estacaoAtual: Estacao | null = estacaoEm(posicao);
  let cargaAtual: TipoCarga | null = null;

  const aoPressionar = (e: KeyboardEvent) => {
    if (digitando(e.target) || e.ctrlKey || e.altKey || e.metaKey) return;
    if (TECLAS_MOVIMENTO[e.code]) {
      pressionadas.add(e.code);
      e.preventDefault();
      return;
    }
    if (TECLAS_ACAO.has(e.code)) {
      // Espaço com um botão focado dispararia o botão: melhor segurar o evento.
      e.preventDefault();
      if (!e.repeat && estacaoAtual) ganchos.aoInteragir(estacaoAtual);
    }
  };

  const aoSoltar = (e: KeyboardEvent) => {
    pressionadas.delete(e.code);
  };

  // Ao trocar de aba o navegador não entrega o keyup: sem isso o boneco anda
  // sozinho para sempre.
  const aoPerderFoco = () => pressionadas.clear();

  window.addEventListener("keydown", aoPressionar);
  window.addEventListener("keyup", aoSoltar);
  window.addEventListener("blur", aoPerderFoco);

  const jogador: Jogador = {
    personagem,
    posicao,
    estacao: estacaoAtual,
    carga: cargaAtual,

    atualizar(dt) {
      let dx = 0;
      let dz = 0;
      for (const codigo of pressionadas) {
        const direcao = TECLAS_MOVIMENTO[codigo];
        if (!direcao) continue;
        dx += direcao.x;
        dz += direcao.z;
      }

      const magnitude = Math.hypot(dx, dz);
      let velocidade = 0;

      if (magnitude > 0) {
        // Anda primeiro, resolve depois: o empurrão devolve só o componente
        // que entrou no móvel, e o que sobra vira deslizamento.
        const passo = VELOCIDADE_JOGADOR * dt;
        posicao.x += (dx / magnitude) * passo;
        posicao.z += (dz / magnitude) * passo;
        resolverColisoes(posicao, RAIO_JOGADOR);

        personagem.olharPara(dx / magnitude, dz / magnitude);
        velocidade = VELOCIDADE_JOGADOR;
      }

      personagem.raiz.position.x = posicao.x;
      personagem.raiz.position.z = posicao.z;
      personagem.animar(dt, velocidade);

      const estacao = estacaoEm(posicao);
      if (estacao !== estacaoAtual) {
        estacaoAtual = estacao;
        jogador.estacao = estacao;
        personagem.destacar(estacao !== null);
        ganchos.aoMudarEstacao(estacao);
      }
    },

    definirCarga(tipo, hex) {
      cargaAtual = tipo;
      jogador.carga = tipo;
      personagem.definirCarga(tipo, hex);
    },

    dispose() {
      window.removeEventListener("keydown", aoPressionar);
      window.removeEventListener("keyup", aoSoltar);
      window.removeEventListener("blur", aoPerderFoco);
      personagem.dispose();
    },
  };

  personagem.destacar(estacaoAtual !== null);
  return jogador;
}

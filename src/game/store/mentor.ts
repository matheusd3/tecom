// mentor.ts — o Seu Zé, antigo dono, na loja.
//
// Ele fica atrás do balcão os três primeiros dias e vai embora depois de se
// despedir. Não é `seller-1` (esse é o boneco do jogador) e não entra em
// `state.employees`: não tem salário, não conta na folha e não aparece na
// contratação. É o contrato 1 da Fase 6, e ele existe porque a alternativa —
// cadastrar o Zé como funcionário — faria a folha do dia 1 cobrar de um
// personagem que está ali de graça, ensinando.
//
// Quem decide se ele está na loja é o `GameWorld` (`zeEstaNaLoja`), pelo passo
// de despedida já visto. Assim o save não precisa de regra extra: quem
// recarrega no dia 5 volta com a loja sem o Zé, sem nenhuma variável de
// sessão para consultar.

import { MOVEIS } from "./layout";
import type { Ponto } from "./layout";
import { PALETA } from "./materials";
import type { FabricaDePessoas, Personagem } from "./characters";

export interface Mentor {
  /** Chamado a cada quadro; cria, anima e descarta o boneco conforme o estado. */
  atualizar(deltaSeconds: number, naLoja: boolean): void;
  dispose(): void;
}

/**
 * Posto do Seu Zé: atrás do balcão, na ponta esquerda.
 *
 * Os auxiliares ocupam a ponta direita (`postoDeVendedor` conta a partir de
 * `balcao.maxX`), então começar pela esquerda garante que ninguém divida lugar
 * com ele por mais gente que o jogador contrate.
 */
const POSTO: Ponto = { x: MOVEIS.balcao.minX + 1.2, z: MOVEIS.balcao.maxZ + 1.2 };

/** De frente para a fila, igual ao resto de quem atende. */
const GIRO = Math.PI;

export function criarMentor(fabrica: FabricaDePessoas): Mentor {
  let personagem: Personagem | null = null;

  const criar = (): Personagem => {
    const pessoa = fabrica.criar({
      nome: "Seu Zé",
      // Fora do uniforme da casa de propósito: âmbar é atendimento e magenta é
      // bancada. Ele não é equipe — é o dono antigo, e tem de se ler como
      // outra coisa já na silhueta.
      roupa: PALETA.metalEscuro,
      calca: "#3b4a54",
      pele: "#d99a6c",
      cabelo: "#d8dee2",
    });
    pessoa.raiz.position.set(POSTO.x, 0, POSTO.z);
    pessoa.raiz.rotation.y = GIRO;
    return pessoa;
  };

  return {
    atualizar(deltaSeconds, naLoja) {
      if (!naLoja) {
        // Aposentou. O boneco sai da cena e não volta nesta partida.
        personagem?.dispose();
        personagem = null;
        return;
      }
      personagem ??= criar();
      // Parado no posto: velocidade zero mantém a respiração da animação sem
      // o passo de caminhada.
      personagem.animar(deltaSeconds, 0);
    },

    dispose() {
      personagem?.dispose();
      personagem = null;
    },
  };
}

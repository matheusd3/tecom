// bebado.ts — o bêbado do bairro, atrapalhando no meio do salão.
//
// Ele é o primeiro motivo de andar pela loja que NÃO é carregar coisa. Todo o
// resto — buscar produto, levar aparelho, repor prateleira, trocar galão — é
// logística: pegar num lugar e largar em outro. Aqui o jogador anda para
// resolver uma pessoa, e isso muda o ritmo do turno.
//
// Ele segue a regra dos clientes, não a do jogador: não colide (FASE3 §5.4).
// Cliente atravessa móvel porque a alternativa seria encavalar a fila na
// porta; o mesmo vale para quem só está perambulando.
//
// Quem decide se ele está na loja é o `GameWorld` (`temBebado`). Aqui só existe
// o corpo, o passeio e a posição — quem confere se o jogador chegou perto o
// bastante é a cena, porque é ela que sabe onde o jogador está.

import type { Ponto } from "./layout";
import { PALETA } from "./materials";
import type { FabricaDePessoas, Personagem } from "./characters";

export interface BebadoVisual {
  atualizar(deltaSeconds: number, naLoja: boolean): void;
  /** Onde ele está agora, ou nada quando não está na loja. */
  posicao(): Ponto | null;
  dispose(): void;
}

/**
 * Por onde ele perambula. Todos conferidos contra `MOVEIS` com raio de pessoa
 * de 0,85: são chão livre no miolo do salão, longe do balcão e da bancada.
 */
const PASSEIO: Ponto[] = [
  { x: -2.0, z: 1.0 },
  { x: 1.2, z: 4.2 },
  { x: -5.4, z: 5.0 },
  { x: -1.0, z: 7.2 },
  { x: -6.6, z: 1.6 },
  { x: 2.0, z: 6.6 },
];

/** Devagar: ele não tem pressa, e é isso que irrita a fila. */
const VELOCIDADE = 2.1;
const TOLERANCIA = 0.3;

export function criarBebado(fabrica: FabricaDePessoas): BebadoVisual {
  let personagem: Personagem | null = null;
  let posicao: Ponto = { ...PASSEIO[0] };
  let alvo = 1;
  /** Tempo parado no ponto atual antes de cambalear para o próximo. */
  let parado = 0;

  const criar = (): Personagem => {
    const pessoa = fabrica.criar({
      nome: "?",
      // Sujo e apagado, fora da paleta de neon da loja: ele não pertence ali,
      // e a silhueta tem de dizer isso antes de qualquer texto.
      roupa: "#6b5f4a",
      calca: "#4a4238",
      pele: "#c98f68",
      cabelo: "#3a332b",
    });
    posicao = { ...PASSEIO[Math.floor(Math.random() * PASSEIO.length)] };
    pessoa.raiz.position.set(posicao.x, 0, posicao.z);
    // Balão de bravo: o jogador precisa achá-lo no meio da multidão.
    pessoa.definirPedido("bravo");
    return pessoa;
  };

  return {
    atualizar(deltaSeconds, naLoja) {
      if (!naLoja) {
        personagem?.dispose();
        personagem = null;
        return;
      }
      if (!personagem) personagem = criar();

      const destino = PASSEIO[alvo % PASSEIO.length];
      const dx = destino.x - posicao.x;
      const dz = destino.z - posicao.z;
      const distancia = Math.hypot(dx, dz);

      if (distancia <= TOLERANCIA) {
        // Para, gingando, e só depois escolhe outro canto para incomodar.
        parado += deltaSeconds;
        personagem.animar(deltaSeconds, 0);
        if (parado > 2.5) {
          parado = 0;
          alvo = (alvo + 1 + Math.floor(Math.random() * 2)) % PASSEIO.length;
        }
      } else {
        const passo = Math.min(VELOCIDADE * deltaSeconds, distancia);
        posicao.x += (dx / distancia) * passo;
        posicao.z += (dz / distancia) * passo;
        personagem.olharPara(dx / distancia, dz / distancia);
        personagem.animar(deltaSeconds, VELOCIDADE);
      }

      personagem.raiz.position.x = posicao.x;
      personagem.raiz.position.z = posicao.z;
    },

    posicao() {
      return personagem ? { ...posicao } : null;
    },

    dispose() {
      personagem?.dispose();
      personagem = null;
    },
  };
}

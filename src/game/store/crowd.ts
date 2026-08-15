// crowd.ts — os clientes do GameWorld ganham corpo dentro da loja.
//
// Esta camada é só espelho: ela lê a lista de clientes da simulação e move
// bonecos até o lugar certo (fila do balcão, espera da assistência, porta de
// saída). Nada aqui altera a economia — quem decide continua sendo o núcleo.

import type { Customer, GameState } from "../types";
import {
  ENTRADA,
  ESPERA_REPARO,
  FILA,
  type Ponto,
} from "./layout";
import {
  CORES_CLIENTE,
  PELES,
  type FabricaDePessoas,
  type Personagem,
} from "./characters";

interface ClienteVisual {
  personagem: Personagem;
  posicao: Ponto;
  alvo: Ponto;
  /** Sai de cena depois de andar até a porta. */
  saindo: boolean;
}

export interface Multidao {
  /** Reflete o estado atual da simulação (chamado a cada quadro). */
  sincronizar(estado: GameState): void;
  atualizar(deltaSeconds: number): void;
  dispose(): void;
}

const VELOCIDADE_CLIENTE = 4.2;

/** Cor estável por cliente: o mesmo cliente nunca troca de camiseta. */
function semente(id: string): number {
  let valor = 0;
  for (let i = 0; i < id.length; i++) valor = (valor * 31 + id.charCodeAt(i)) >>> 0;
  return valor;
}

export function criarMultidao(fabrica: FabricaDePessoas): Multidao {
  const clientes = new Map<string, ClienteVisual>();

  const criar = (cliente: Customer): ClienteVisual => {
    const s = semente(cliente.id);
    const paleta = CORES_CLIENTE[s % CORES_CLIENTE.length];
    const personagem = fabrica.criar({
      nome: cliente.name,
      roupa: paleta.roupa,
      calca: paleta.calca,
      cabelo: paleta.cabelo,
      pele: PELES[(s >>> 3) % PELES.length],
    });
    const posicao: Ponto = { ...ENTRADA };
    personagem.raiz.position.set(posicao.x, 0, posicao.z);
    return { personagem, posicao, alvo: { ...ENTRADA }, saindo: false };
  };

  return {
    sincronizar(estado) {
      const emCena = Array.from(estado.customers.values());
      const vistos = new Set<string>();

      // A fila respeita a ordem de chegada; o cliente priorizado vai para a
      // frente, que é a posição colada no balcão.
      const aguardando = emCena
        .filter((c) => c.status === "waiting")
        .sort((a, b) => a.arrivalTime - b.arrivalTime);
      const selecionado = estado.selectedCustomerId;
      const ordemFila = selecionado
        ? [
            ...aguardando.filter((c) => c.id === selecionado),
            ...aguardando.filter((c) => c.id !== selecionado),
          ]
        : aguardando;

      // Quem já entregou o aparelho sai da fila e senta no cantinho de espera.
      const esperando = emCena.filter(
        (c) => c.status === "repairing" || c.status === "beingServed"
      );

      const destinos = new Map<string, Ponto>();
      ordemFila.forEach((c, i) => {
        destinos.set(c.id, FILA[Math.min(i, FILA.length - 1)]);
      });
      esperando.forEach((c, i) => {
        destinos.set(c.id, ESPERA_REPARO[Math.min(i, ESPERA_REPARO.length - 1)]);
      });

      for (const cliente of emCena) {
        vistos.add(cliente.id);
        let visual = clientes.get(cliente.id);
        if (!visual) {
          visual = criar(cliente);
          clientes.set(cliente.id, visual);
        }

        const saindo = cliente.status === "leaving";
        visual.saindo = saindo;
        visual.alvo = saindo ? ENTRADA : (destinos.get(cliente.id) ?? ENTRADA);

        if (saindo) {
          visual.personagem.definirPedido(null);
          visual.personagem.definirPaciencia(null);
          visual.personagem.definirCarga(null);
        } else if (cliente.status === "waiting") {
          visual.personagem.definirPedido(cliente.needsProduct ? "produto" : "reparo");
          visual.personagem.definirPaciencia(cliente.patience / 100);
          // Quem traz um aparelho aparece com ele na mão até entregar no balcão.
          visual.personagem.definirCarga(cliente.needsService ? "aparelho" : null, "#b9c7d1");
        } else {
          // Aparelho já entregue: ele espera no salão, sem relógio correndo.
          visual.personagem.definirPedido("reparo");
          visual.personagem.definirPaciencia(null);
          visual.personagem.definirCarga(null);
        }
      }

      for (const [id, visual] of clientes) {
        if (vistos.has(id)) continue;
        visual.personagem.dispose();
        clientes.delete(id);
      }
    },

    atualizar(dt) {
      for (const visual of clientes.values()) {
        const dx = visual.alvo.x - visual.posicao.x;
        const dz = visual.alvo.z - visual.posicao.z;
        const distancia = Math.hypot(dx, dz);
        let velocidade = 0;

        if (distancia > 0.08) {
          const passo = Math.min(VELOCIDADE_CLIENTE * dt, distancia);
          visual.posicao.x += (dx / distancia) * passo;
          visual.posicao.z += (dz / distancia) * passo;
          visual.personagem.olharPara(dx / distancia, dz / distancia);
          velocidade = VELOCIDADE_CLIENTE;
        } else if (!visual.saindo) {
          // Parado na fila: de frente para o balcão.
          visual.personagem.olharPara(0, 1);
        }

        visual.personagem.raiz.position.x = visual.posicao.x;
        visual.personagem.raiz.position.z = visual.posicao.z;
        visual.personagem.animar(dt, velocidade);
      }
    },

    dispose() {
      for (const visual of clientes.values()) visual.personagem.dispose();
      clientes.clear();
    },
  };
}

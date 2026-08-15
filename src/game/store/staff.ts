// staff.ts — a equipe contratada ganha corpo na loja.
//
// Quem o jogador contrata precisa aparecer: o atendente auxiliar fica atrás do
// balcão e o técnico na bancada. `seller-1` fica de fora porque esse é o
// próprio personagem controlado pelo jogador.

import type { Employee, GameState } from "../types";
import { MOVEIS, centro, type Ponto } from "./layout";
import { CORES_CLIENTE, PELES, type FabricaDePessoas, type Personagem } from "./characters";
import { PALETA } from "./materials";

/** O vendedor inicial é o boneco do jogador; não pode ter um clone parado. */
const ID_DO_JOGADOR = "seller-1";

export interface Equipe {
  atualizar(deltaSeconds: number): void;
  dispose(): void;
}

interface Posto {
  ponto: Ponto;
  /** Para onde o funcionário olha parado (radianos em Y). */
  giro: number;
}

/** Vagas atrás do balcão, à direita do jogador. */
function postoDeVendedor(indice: number): Posto {
  const balcao = MOVEIS.balcao;
  return { ponto: { x: balcao.maxX - 1.2 - indice * 2, z: balcao.maxZ + 1.2 }, giro: Math.PI };
}

/** Vagas na frente da bancada técnica. */
function postoDeTecnico(indice: number): Posto {
  const bancada = centro(MOVEIS.bancada);
  return { ponto: { x: bancada.x - 2 + indice * 2, z: MOVEIS.bancada.minZ - 1.3 }, giro: 0 };
}

export function criarEquipe(fabrica: FabricaDePessoas, world: { getState(): GameState }): Equipe {
  const visuais = new Map<string, Personagem>();

  const criar = (employee: Employee, indice: number): Personagem => {
    const tecnico = employee.role === "technician";
    const paleta = CORES_CLIENTE[(indice + (tecnico ? 5 : 1)) % CORES_CLIENTE.length];
    return fabrica.criar({
      nome: employee.name,
      // Uniforme da casa: técnico de magenta, atendimento de âmbar. Assim
      // ninguém confunde a equipe com um cliente na fila.
      roupa: tecnico ? PALETA.magenta : PALETA.ambar,
      calca: paleta.calca,
      pele: PELES[indice % PELES.length],
      cabelo: paleta.cabelo,
    });
  };

  return {
    atualizar(deltaSeconds) {
      const funcionarios = Array.from(world.getState().employees.values()).filter(
        (employee) => employee.id !== ID_DO_JOGADOR
      );
      const presentes = new Set(funcionarios.map((employee) => employee.id));

      for (const [id, personagem] of visuais) {
        if (presentes.has(id)) continue;
        personagem.dispose();
        visuais.delete(id);
      }

      let vendedores = 0;
      let tecnicos = 0;
      for (const [indice, employee] of funcionarios.entries()) {
        let personagem = visuais.get(employee.id);
        if (!personagem) {
          personagem = criar(employee, indice);
          visuais.set(employee.id, personagem);
        }

        const posto =
          employee.role === "technician"
            ? postoDeTecnico(tecnicos++)
            : postoDeVendedor(vendedores++);

        personagem.raiz.position.x = posto.ponto.x;
        personagem.raiz.position.z = posto.ponto.z;
        personagem.raiz.rotation.y = posto.giro;
        personagem.animar(deltaSeconds, 0);
        // Técnico ocupado aparece com o aparelho na mão: é o sinal de que o
        // conserto está rodando sem precisar abrir painel nenhum.
        personagem.definirCarga(
          employee.role === "technician" && employee.isBusy ? "aparelho" : null
        );
      }
    },

    dispose() {
      for (const personagem of visuais.values()) personagem.dispose();
      visuais.clear();
    },
  };
}

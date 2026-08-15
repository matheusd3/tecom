// staff.ts — a equipe contratada ganha corpo na loja.
//
// Quem o jogador contrata precisa aparecer e precisa TRABALHAR na tela: o
// técnico fica na bancada e o atendente auxiliar caminha entre o balcão e a
// assistência levando e buscando aparelhos. `seller-1` fica de fora porque é o
// próprio personagem controlado pelo jogador.
//
// A logística em si é do GameWorld (`runSupportAttendant`), que resolve a tarefa
// num instante e marca o funcionário como ocupado. Aqui a viagem é encenada no
// tempo certo para o jogador ver o aparelho saindo do balcão e chegando na
// bancada, em vez de aparecer do nada.

import type { Employee, GameState } from "../types";
import { MOVEIS, centro, type Ponto } from "./layout";
import { CORES_CLIENTE, PELES, type FabricaDePessoas, type Personagem } from "./characters";
import { PALETA } from "./materials";

/** O vendedor inicial é o boneco do jogador; não pode ter um clone parado. */
const ID_DO_JOGADOR = "seller-1";

const VELOCIDADE_AUXILIAR = 5.2;
/** Distância para considerar que chegou no ponto. */
const TOLERANCIA = 0.25;

export interface Equipe {
  atualizar(deltaSeconds: number): void;
  dispose(): void;
}

interface Posto {
  ponto: Ponto;
  /** Para onde o funcionário olha parado (radianos em Y). */
  giro: number;
}

type Etapa = "parado" | "indo" | "voltando";

interface Membro {
  personagem: Personagem;
  posicao: Ponto;
  etapa: Etapa;
  /** Carrega na ida (levar aparelho) ou na volta (trazer reparo pronto). */
  levaNaIda: boolean;
  ocupadoAntes: boolean;
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

/** Onde o auxiliar entrega e retira aparelhos. */
function pontoDaBancada(): Ponto {
  const bancada = centro(MOVEIS.bancada);
  return { x: bancada.x + 2.4, z: MOVEIS.bancada.minZ - 1.3 };
}

export function criarEquipe(fabrica: FabricaDePessoas, world: { getState(): GameState }): Equipe {
  const membros = new Map<string, Membro>();

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

  /** Anda em direção ao alvo; devolve true quando chegou. */
  const caminhar = (membro: Membro, alvo: Ponto, dt: number): boolean => {
    const dx = alvo.x - membro.posicao.x;
    const dz = alvo.z - membro.posicao.z;
    const distancia = Math.hypot(dx, dz);
    if (distancia <= TOLERANCIA) {
      membro.personagem.animar(dt, 0);
      return true;
    }
    const passo = Math.min(VELOCIDADE_AUXILIAR * dt, distancia);
    membro.posicao.x += (dx / distancia) * passo;
    membro.posicao.z += (dz / distancia) * passo;
    membro.personagem.olharPara(dx / distancia, dz / distancia);
    membro.personagem.animar(dt, VELOCIDADE_AUXILIAR);
    return false;
  };

  return {
    atualizar(deltaSeconds) {
      const estado = world.getState();
      const funcionarios = Array.from(estado.employees.values()).filter(
        (employee) => employee.id !== ID_DO_JOGADOR
      );
      const presentes = new Set(funcionarios.map((employee) => employee.id));

      for (const [id, membro] of membros) {
        if (presentes.has(id)) continue;
        membro.personagem.dispose();
        membros.delete(id);
      }

      let vendedores = 0;
      let tecnicos = 0;
      for (const [indice, employee] of funcionarios.entries()) {
        const tecnico = employee.role === "technician";
        const posto = tecnico ? postoDeTecnico(tecnicos++) : postoDeVendedor(vendedores++);

        let membro = membros.get(employee.id);
        if (!membro) {
          membro = {
            personagem: criar(employee, indice),
            posicao: { ...posto.ponto },
            etapa: "parado",
            levaNaIda: true,
            ocupadoAntes: false,
          };
          membro.personagem.raiz.rotation.y = posto.giro;
          membros.set(employee.id, membro);
        }

        if (tecnico) {
          // Técnico não sai da bancada: o conserto acontece ali.
          membro.posicao.x = posto.ponto.x;
          membro.posicao.z = posto.ponto.z;
          membro.personagem.raiz.rotation.y = posto.giro;
          membro.personagem.animar(deltaSeconds, 0);
          // Aparelho na mão enquanto conserta: dá para ver o trabalho rodando.
          membro.personagem.definirCarga(employee.isBusy ? "aparelho" : null);
        } else {
          // O núcleo marca o auxiliar como ocupado no instante em que resolve a
          // tarefa; essa borda é o gatilho da viagem até a bancada.
          if (employee.isBusy && !membro.ocupadoAntes && membro.etapa === "parado") {
            membro.etapa = "indo";
            membro.levaNaIda = !(estado.supportTask ?? "").includes("devolveu");
            membro.personagem.definirCarga(membro.levaNaIda ? "aparelho" : null);
          }
          membro.ocupadoAntes = employee.isBusy;

          if (membro.etapa === "indo") {
            if (caminhar(membro, pontoDaBancada(), deltaSeconds)) {
              membro.etapa = "voltando";
              // Deixou o aparelho lá, ou pegou o que estava pronto.
              membro.personagem.definirCarga(membro.levaNaIda ? null : "aparelho");
            }
          } else if (membro.etapa === "voltando") {
            if (caminhar(membro, posto.ponto, deltaSeconds)) {
              membro.etapa = "parado";
              membro.personagem.definirCarga(null);
              membro.personagem.raiz.rotation.y = posto.giro;
            }
          } else {
            membro.posicao.x = posto.ponto.x;
            membro.posicao.z = posto.ponto.z;
            membro.personagem.raiz.rotation.y = posto.giro;
            membro.personagem.animar(deltaSeconds, 0);
          }
        }

        membro.personagem.raiz.position.x = membro.posicao.x;
        membro.personagem.raiz.position.z = membro.posicao.z;
      }
    },

    dispose() {
      for (const membro of membros.values()) membro.personagem.dispose();
      membros.clear();
    },
  };
}

// save.ts — a partida sobrevive ao fechar da aba.
//
// Camada de armazenamento apenas. Quem sabe montar e desmontar o retrato é o
// `GameWorld` (`criarInstantaneo` / `restaurar`), porque o estado do turno é
// privado dele. Aqui só tratamos do `localStorage` e das formas que ele tem de
// falhar — e ele tem várias.
//
// QUANDO SE SALVA: no fechamento do dia, não durante o turno. O turno é de
// 120 s e a cena 3D é espelho do estado (clientes andando, auxiliar no meio de
// uma viagem, item no braço do jogador) — nada disso está no `GameState`, e
// restaurar meio trajeto custaria muito mais do que vale perder, no pior caso,
// dois minutos de turno. O fechamento é onde o jogador decide, e é o ponto
// natural de retomada.

import type { GameWorld } from "./GameWorld";
import type { InstantaneoJogo } from "./types";
import { VERSAO_SAVE } from "./types";

const CHAVE = "seu-micro:save";

/** Resumo mostrado na tela inicial antes de decidir continuar. */
export interface ResumoDoSave {
  dia: number;
  caixa: number;
  salvoEm: number;
  melhorias: number;
}

/**
 * O `localStorage` não existe em todo lugar e nem sempre deixa escrever: em
 * navegação anônima do Safari ele existe e estoura na primeira escrita, e com
 * cookies bloqueados o simples acesso à propriedade já lança. Por isso todo
 * uso passa por aqui, e a ausência dele nunca derruba o jogo — só desliga o
 * save.
 */
function deposito(): Storage | null {
  try {
    const alvo = window.localStorage;
    const teste = "seu-micro:teste";
    alvo.setItem(teste, "1");
    alvo.removeItem(teste);
    return alvo;
  } catch {
    return null;
  }
}

export function saveDisponivel(): boolean {
  return deposito() !== null;
}

/**
 * Grava o retrato. Devolve `false` em vez de lançar: perder o save é ruim, mas
 * derrubar o turno do jogador por causa disso é pior.
 */
export function salvar(world: GameWorld): boolean {
  const alvo = deposito();
  if (!alvo) return false;
  try {
    alvo.setItem(CHAVE, JSON.stringify(world.criarInstantaneo()));
    return true;
  } catch {
    // Cota estourada é o caso realista aqui: `state.sales` e `state.repairs`
    // crescem a partida inteira e nunca encolhem.
    return false;
  }
}

/** Lê o retrato bruto. JSON podre ou versão antiga contam como "não há save". */
export function carregar(): InstantaneoJogo | null {
  const alvo = deposito();
  if (!alvo) return null;
  try {
    const cru = alvo.getItem(CHAVE);
    if (!cru) return null;
    const dados = JSON.parse(cru) as InstantaneoJogo;
    if (!dados || dados.versao !== VERSAO_SAVE) return null;
    return dados;
  } catch {
    return null;
  }
}

/**
 * O suficiente para a tela inicial oferecer a retomada sem montar a partida.
 * Devolve `null` quando não há nada válido guardado.
 */
export function resumoDoSave(): ResumoDoSave | null {
  const dados = carregar();
  if (!dados?.estado || typeof dados.estado.day !== "number") return null;
  return {
    dia: dados.estado.day,
    caixa: dados.estado.cash ?? 0,
    salvoEm: dados.salvoEm ?? 0,
    melhorias: dados.estado.upgrades?.length ?? 0,
  };
}

export function apagar(): void {
  try {
    deposito()?.removeItem(CHAVE);
  } catch {
    // Nada a fazer: se não dá para apagar, o save antigo será sobrescrito no
    // próximo fechamento de dia.
  }
}

/**
 * "Há 3 minutos", "ontem". Curto de propósito: é uma linha de apoio embaixo do
 * botão de continuar, não um relatório.
 */
export function tempoDesde(instante: number): string {
  const segundos = Math.max(0, Math.round((Date.now() - instante) / 1000));
  if (segundos < 60) return "agora há pouco";
  const minutos = Math.round(segundos / 60);
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.round(horas / 24);
  return dias === 1 ? "ontem" : `há ${dias} dias`;
}

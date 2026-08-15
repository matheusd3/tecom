// GameCanvas.tsx — integração Babylon + React.
// React = moldura, Babylon = tela, GameWorld = a simulação.
//
// Regras de segurança (manus-adaptations.md):
//  - O Engine é criado uma única vez; o ref de guarda protege contra o
//    duplo-mount do StrictMode em desenvolvimento.
//  - engine.dispose() e remoção de todos os listeners no unmount.
//  - Render loop preso ao ciclo de vida do componente.
//  - window.resize tratado.

import { useCallback, useEffect, useRef, useState } from "react";
import { Engine } from "@babylonjs/core/Engines/engine";
import { createGameScene, type Estacao, type GameHandle } from "@/game/scene";
import type { GameWorld } from "@/game/GameWorld";
import type {
  ActionResult,
  GameState,
  Opportunity,
  ProductType,
  EmployeeRole,
  ShiftReport,
} from "@/game/types";
import { GameUI, type Capacidades } from "./GameUI";

interface Instantaneo {
  gameState: GameState | null;
  opportunities: Opportunity[];
  shiftReport: ShiftReport | null;
}

/** Frequência de sincronização entre a simulação e o React. */
const INTERVALO_SYNC_MS = 250;

const FALHA_SEM_NUCLEO: ActionResult = {
  ok: false,
  message: "Ação indisponível: o núcleo do jogo ainda não expõe esse método.",
};

// Ponte com os métodos do turno. O contrato está em PHASE2_TASKS.md; enquanto o
// Codex termina de publicá-los, a interface detecta o que existe em vez de
// quebrar a compilação. Os casts por `unknown` são propositais: eles continuam
// válidos qualquer que seja a assinatura final declarada no GameWorld.
type MetodoSemArgs = (() => unknown) | undefined;
type MetodoComId = ((id: string) => unknown) | undefined;

function metodo(world: GameWorld, nome: string): unknown {
  return (world as unknown as Record<string, unknown>)[nome];
}

function temMetodo(world: GameWorld | null, nome: string): boolean {
  return !!world && typeof metodo(world, nome) === "function";
}

function chamarSemArgs(world: GameWorld | null, nome: string): void {
  if (!world) return;
  const fn = metodo(world, nome) as MetodoSemArgs;
  if (typeof fn === "function") fn.call(world);
}

function chamarComId(world: GameWorld | null, nome: string, id: string): void {
  if (!world) return;
  const fn = metodo(world, nome) as MetodoComId;
  if (typeof fn === "function") fn.call(world, id);
}

function lerRelatorio(world: GameWorld | null): ShiftReport | null {
  if (!world) return null;
  const fn = metodo(world, "getShiftReport") as
    | (() => ShiftReport | null | undefined)
    | undefined;
  if (typeof fn !== "function") return null;
  return fn.call(world) ?? null;
}

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startedRef = useRef(false);
  const worldRef = useRef<GameWorld | null>(null);

  const [instantaneo, setInstantaneo] = useState<Instantaneo>({
    gameState: null,
    opportunities: [],
    shiftReport: null,
  });
  const [capacidades, setCapacidades] = useState<Capacidades>({
    iniciarTurno: false,
    selecionarCliente: false,
    relatorio: false,
  });
  const [erro, setErro] = useState<string | null>(null);
  /** Estação onde o atendente está parado na loja 3D. */
  const [estacao, setEstacao] = useState<Estacao | null>(null);

  /** Copia o estado atual da simulação para o React. */
  const sincronizar = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    setInstantaneo({
      gameState: world.getState(),
      opportunities: [...world.getOpportunities()],
      shiftReport: lerRelatorio(world),
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || startedRef.current) return;
    startedRef.current = true;

    let engineCriado: Engine | null = null;
    try {
      engineCriado = new Engine(canvas, true, {
        preserveDrawingBuffer: true,
        stencil: true,
        adaptToDeviceRatio: true,
      });
    } catch (e) {
      setErro(
        `Não foi possível iniciar o WebGL: ${e instanceof Error ? e.message : String(e)}`
      );
    }

    if (!engineCriado) {
      startedRef.current = false;
      return;
    }

    const engine = engineCriado;
    let descartado = false;
    let handle: GameHandle | null = null;

    createGameScene(engine, canvas)
      .then((h) => {
        // O componente pode ter sido desmontado antes da cena ficar pronta.
        if (descartado) {
          h.dispose();
          return;
        }
        handle = h;
        worldRef.current = h.world;
        // Só em desenvolvimento: dá acesso à cena pelo console para inspecionar
        // posição do atendente, colisão e estado do turno sem instrumentar o jogo.
        if (import.meta.env.DEV) {
          (window as unknown as Record<string, unknown>).__jogo = h;
        }
        h.aoMudarEstacao(setEstacao);
        h.aoInteragir((estacaoAtual) => {
          // Chegar ao balcão chama o próximo da fila: a mesma seleção que o
          // painel da direita faz, agora pelo posicionamento do atendente.
          if (estacaoAtual !== "balcao") return;
          const proximo = Array.from(h.world.getState().customers.values())
            .filter((cliente) => cliente.status === "waiting")
            .sort((a, b) => a.arrivalTime - b.arrivalTime)[0];
          if (proximo) {
            chamarComId(h.world, "selectCustomer", proximo.id);
            sincronizar();
          }
        });
        setCapacidades({
          iniciarTurno: temMetodo(h.world, "startShift"),
          selecionarCliente: temMetodo(h.world, "selectCustomer"),
          relatorio: temMetodo(h.world, "getShiftReport"),
        });
        sincronizar();

        engine.runRenderLoop(() => {
          // Limite de 0,25 s evita saltos gigantes quando a aba fica em segundo plano.
          const dt = Math.min(engine.getDeltaTime() / 1000, 0.25);
          h.update(dt);
          h.scene.render();
        });
      })
      .catch((e: unknown) => {
        setErro(
          `Falha ao criar a cena: ${e instanceof Error ? e.message : String(e)}`
        );
      });

    const aoRedimensionar = () => engine.resize();
    window.addEventListener("resize", aoRedimensionar);

    const sync = window.setInterval(sincronizar, INTERVALO_SYNC_MS);

    return () => {
      descartado = true;
      window.clearInterval(sync);
      window.removeEventListener("resize", aoRedimensionar);
      engine.stopRenderLoop();
      handle?.dispose();
      engine.dispose();
      worldRef.current = null;
      startedRef.current = false;
    };
  }, [sincronizar]);

  // ---- Ações da interface ligadas aos métodos públicos do GameWorld ----

  const iniciarTurno = useCallback(() => {
    chamarSemArgs(worldRef.current, "startShift");
    sincronizar();
  }, [sincronizar]);

  const selecionarCliente = useCallback(
    (id: string) => {
      chamarComId(worldRef.current, "selectCustomer", id);
      sincronizar();
    },
    [sincronizar]
  );

  const vender = useCallback(
    (id: string, preco: number): ActionResult => {
      const world = worldRef.current;
      if (!world) return FALHA_SEM_NUCLEO;
      const resultado = world.sellToCustomer(id, preco);
      sincronizar();
      return resultado;
    },
    [sincronizar]
  );

  const aceitarReparo = useCallback(
    (id: string): ActionResult => {
      const world = worldRef.current;
      if (!world) return FALHA_SEM_NUCLEO;
      const resultado = world.acceptRepair(id);
      sincronizar();
      return resultado;
    },
    [sincronizar]
  );

  const recusar = useCallback(
    (id: string): ActionResult => {
      const world = worldRef.current;
      if (!world) return FALHA_SEM_NUCLEO;
      const resultado = world.declineCustomer(id);
      sincronizar();
      return resultado;
    },
    [sincronizar]
  );

  const alternarPausa = useCallback(() => {
    worldRef.current?.togglePause();
    sincronizar();
  }, [sincronizar]);

  const mudarVelocidade = useCallback(
    (velocidade: number) => {
      worldRef.current?.setTimeSpeed(velocidade);
      sincronizar();
    },
    [sincronizar]
  );

  const comprarEstoque = useCallback(
    (tipo: ProductType, quantidade: number) => {
      const ok = worldRef.current?.buyStock(tipo, quantidade) ?? false;
      sincronizar();
      return ok;
    },
    [sincronizar]
  );

  const definirPreco = useCallback(
    (tipo: ProductType, preco: number) => {
      const ok = worldRef.current?.setProductPrice(tipo, preco) ?? false;
      sincronizar();
      return ok;
    },
    [sincronizar]
  );

  const contratar = useCallback(
    (funcao: EmployeeRole, nome: string) => {
      const ok = worldRef.current?.hireEmployee(funcao, nome) ?? false;
      sincronizar();
      return ok;
    },
    [sincronizar]
  );

  const limparOportunidades = useCallback(() => {
    worldRef.current?.clearOpportunities();
    sincronizar();
  }, [sincronizar]);

  const reiniciar = useCallback(() => {
    worldRef.current?.reset();
    sincronizar();
  }, [sincronizar]);

  return (
    <>
      <canvas ref={canvasRef} className="game-canvas" />
      {erro ? (
        <div className="erro-fatal">
          <h1>Falha ao iniciar o jogo</h1>
          <pre>{erro}</pre>
          <button className="btn" onClick={() => window.location.reload()}>
            Tentar novamente
          </button>
        </div>
      ) : (
        <GameUI
          gameState={instantaneo.gameState}
          opportunities={instantaneo.opportunities}
          shiftReport={instantaneo.shiftReport}
          capacidades={capacidades}
          estacao={estacao}
          onStartShift={iniciarTurno}
          onSelectCustomer={selecionarCliente}
          onSell={vender}
          onAcceptRepair={aceitarReparo}
          onDecline={recusar}
          onTogglePause={alternarPausa}
          onTimeSpeedChange={mudarVelocidade}
          onBuyStock={comprarEstoque}
          onSetPrice={definirPreco}
          onHire={contratar}
          onClearOpportunities={limparOportunidades}
          onReset={reiniciar}
        />
      )}
    </>
  );
}

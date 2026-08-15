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
import { createGameScene, type GameHandle, type PlayerStation } from "@/game/scene";
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
  playerStation: PlayerStation;
  carriedProductName?: string;
  mapAction: ActionResult | null;
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
  const handleRef = useRef<GameHandle | null>(null);
  const mapActionRef = useRef<ActionResult | null>(null);

  const [instantaneo, setInstantaneo] = useState<Instantaneo>({
    gameState: null,
    opportunities: [],
    shiftReport: null,
    playerStation: "loja",
    mapAction: null,
  });
  const [capacidades, setCapacidades] = useState<Capacidades>({
    iniciarTurno: false,
    selecionarCliente: false,
    relatorio: false,
  });
  const [erro, setErro] = useState<string | null>(null);

  /** Copia o estado atual da simulação para o React. */
  const sincronizar = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    setInstantaneo({
      gameState: world.getState(),
      opportunities: [...world.getOpportunities()],
      shiftReport: lerRelatorio(world),
      playerStation: handleRef.current?.getPlayerStation() ?? "loja",
      carriedProductName: (() => {
        const type = handleRef.current?.getCarriedProduct();
        if (type) return world.getState().products.get(type)?.name;
        const repairCustomerId = handleRef.current?.getCarriedRepairCustomerId();
        return repairCustomerId ? `aparelho de ${world.getState().customers.get(repairCustomerId)?.name ?? "cliente"}` : undefined;
      })(),
      mapAction: mapActionRef.current,
    });
  }, []);

  /** A interação por teclado usa o cliente priorizado — ou o primeiro da fila. */
  const interagirComEstacao = useCallback(() => {
    const world = worldRef.current;
    const handle = handleRef.current;
    if (!world || !handle) return;
    const state = world.getState();
    const carriedRepairCustomerId = handle.getCarriedRepairCustomerId();
    const selectedCustomer = state.selectedCustomerId
      ? state.customers.get(state.selectedCustomerId)
      : undefined;
    const customer = carriedRepairCustomerId
      ? state.customers.get(carriedRepairCustomerId)
      : selectedCustomer?.status === "waiting"
      ? selectedCustomer
      : Array.from(state.customers.values()).find((item) => item.status === "waiting");
    const readyRepair = state.repairs.find((repair) => repair.status === "ready");
    let result: ActionResult;

    const station = handle.getPlayerStation();

    // A bancada pode ter um reparo pronto mesmo sem alguém aguardando na fila.
    if (station === "assistencia" && !carriedRepairCustomerId && readyRepair) {
      result = world.collectCompletedRepair(readyRepair.customerId);
      if (result.ok) handle.pickUpRepair(readyRepair.customerId);
    } else if (!customer) {
      result = { ok: false, message: "Não há ninguém esperando para atender." };
    } else if (station === "estoque") {
      if (!customer.needsProduct) {
        result = { ok: false, message: "Este cliente precisa ir para a bancada técnica, não para a prateleira." };
      } else if (handle.getCarriedProduct()) {
        result = { ok: false, message: "Você já está carregando um produto. Leve-o até o balcão." };
      } else if ((state.products.get(customer.needsProduct)?.stock ?? 0) <= 0) {
        result = { ok: false, message: "Não há estoque desse produto na prateleira." };
      } else {
        world.selectCustomer(customer.id);
        handle.pickUpProduct(customer.needsProduct);
        result = { ok: true, message: `Você pegou ${state.products.get(customer.needsProduct)?.name ?? "o produto"}. Vá ao balcão.` };
      }
    } else if (station === "balcao") {
      if (carriedRepairCustomerId) {
        result = world.returnRepairToCustomer(carriedRepairCustomerId);
        if (result.ok) handle.putDownProduct();
      } else if (customer.needsService && customer.status === "waiting") {
        result = world.receiveRepair(customer.id);
        if (result.ok) handle.pickUpRepair(customer.id);
      } else if (!customer.needsProduct) {
        result = { ok: false, message: "Receba o aparelho deste cliente no balcão antes de levá-lo à assistência." };
      } else if (handle.getCarriedProduct() !== customer.needsProduct) {
        result = { ok: false, message: "Pegue o produto pedido nas prateleiras antes de fechar a venda." };
      } else {
        const product = state.products.get(customer.needsProduct);
        const price = product ? Math.min(product.sellingPrice, customer.budget) : 0;
        result = world.sellToCustomer(customer.id, price);
        if (result.ok) handle.putDownProduct();
      }
    } else if (station === "assistencia") {
      if (carriedRepairCustomerId) {
        result = world.acceptRepair(carriedRepairCustomerId);
        if (result.ok) handle.putDownProduct();
      } else if (!customer.needsService) {
        result = { ok: false, message: "Este cliente quer comprar: pegue o item na prateleira." };
      } else {
        result = { ok: false, message: "Receba o aparelho no balcão e traga-o até esta bancada." };
      }
    } else {
      result = { ok: false, message: "Aproxime-se do balcão, das prateleiras ou da bancada para usar E." };
    }

    mapActionRef.current = result;
    sincronizar();
  }, [sincronizar]);

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
        handleRef.current = h;
        worldRef.current = h.world;
        // Só em desenvolvimento: dá acesso à cena pelo console para inspecionar
        // posição do atendente, colisão e estado do turno sem instrumentar o jogo.
        if (import.meta.env.DEV) {
          (window as unknown as Record<string, unknown>).__jogo = h;
        }
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
      handleRef.current = null;
      startedRef.current = false;
    };
  }, [sincronizar]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.key.toLowerCase() !== "e") return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
      event.preventDefault();
      interagirComEstacao();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [interagirComEstacao]);

  // ---- Ações da interface ligadas aos métodos públicos do GameWorld ----

  const iniciarTurno = useCallback(() => {
    mapActionRef.current = null;
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
      const handle = handleRef.current;
      if (!world || !handle) return FALHA_SEM_NUCLEO;
      const customer = world.getState().customers.get(id);
      if (!customer?.needsProduct) {
        return { ok: false, message: "Este cliente precisa da assistência técnica." };
      }
      if (handle.getPlayerStation() === "estoque") {
        if (handle.getCarriedProduct()) {
          return { ok: false, message: "Você já pegou o produto. Agora leve-o até o balcão." };
        }
        if ((world.getState().products.get(customer.needsProduct)?.stock ?? 0) <= 0) {
          return { ok: false, message: "Não há estoque desse produto na prateleira." };
        }
        world.selectCustomer(id);
        handle.pickUpProduct(customer.needsProduct);
        const result = { ok: true, message: `Você pegou o produto. Agora volte ao balcão para vender.` };
        mapActionRef.current = result;
        sincronizar();
        return result;
      }
      if (handle.getPlayerStation() !== "balcao") {
        return { ok: false, message: "Vá às prateleiras para pegar o produto ou ao balcão para vender." };
      }
      if (handle.getCarriedProduct() !== customer.needsProduct) {
        return { ok: false, message: "Vá às prateleiras e clique em Vender para pegar o produto pedido." };
      }
      const resultado = world.sellToCustomer(id, preco);
      if (resultado.ok) handle.putDownProduct();
      sincronizar();
      return resultado;
    },
    [sincronizar]
  );

  const aceitarReparo = useCallback(
    (id: string): ActionResult => {
      const world = worldRef.current;
      const handle = handleRef.current;
      if (!world || !handle) return FALHA_SEM_NUCLEO;
      if (handle.getPlayerStation() === "balcao") {
        const resultado = world.receiveRepair(id);
        if (resultado.ok) handle.pickUpRepair(id);
        sincronizar();
        return resultado;
      }
      if (handle.getPlayerStation() !== "assistencia") {
        return { ok: false, message: "No balcão, receba o aparelho. Na bancada, entregue-o ao técnico." };
      }
      if (handle.getCarriedRepairCustomerId() !== id) {
        return { ok: false, message: "Traga o aparelho recebido no balcão até a bancada." };
      }
      const resultado = world.acceptRepair(id);
      if (resultado.ok) handle.putDownProduct();
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
          playerStation={instantaneo.playerStation}
          carriedProductName={instantaneo.carriedProductName}
          mapAction={instantaneo.mapAction}
          capacidades={capacidades}
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

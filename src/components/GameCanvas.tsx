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
import { GameUI, type Capacidades, type PedidoDesconto } from "./GameUI";

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
  /** Venda abaixo da vitrine esperando o "pode fechar" do jogador. */
  const [pedidoDesconto, setPedidoDesconto] = useState<PedidoDesconto | null>(null);

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
    // Se o cliente desistiu enquanto o desconto esperava resposta, o pedido
    // morre com ele — senão o botão fecharia uma venda com quem já saiu.
    setPedidoDesconto((atual) => {
      if (!atual) return atual;
      const cliente = world.getState().customers.get(atual.customerId);
      return cliente?.status === "waiting" ? atual : null;
    });
  }, []);

  /** A interação por teclado usa o cliente priorizado — ou o primeiro da fila. */
  const interagirComEstacao = useCallback(() => {
    const world = worldRef.current;
    const handle = handleRef.current;
    if (!world || !handle) return;
    const state = world.getState();
    const carriedRepairCustomerId = handle.getCarriedRepairCustomerId();
    const carriedProduct = handle.getCarriedProduct();
    // A fila é a ordem de chegada; o cliente priorizado no painel vem antes.
    const aguardando = Array.from(state.customers.values()).filter(
      (item) => item.status === "waiting"
    );
    const selectedCustomer = state.selectedCustomerId
      ? state.customers.get(state.selectedCustomerId)
      : undefined;
    // Quem a tecla E atende: primeiro o que já está na mão, depois quem quer
    // justamente o produto carregado, e só então a frente da fila. Sem isso o E
    // tentava vender a caixa que está na mão para quem pediu outra coisa.
    const customer = carriedRepairCustomerId
      ? state.customers.get(carriedRepairCustomerId)
      : carriedProduct
      ? aguardando.find((item) => item.needsProduct === carriedProduct) ?? aguardando[0]
      : selectedCustomer?.status === "waiting"
      ? selectedCustomer
      : aguardando[0];
    const readyRepair = state.repairs.find((repair) => repair.status === "ready");
    let result: ActionResult;

    const station = handle.getPlayerStation();

    // A bancada não depende da fila: lá dentro há reparo pronto para retirar,
    // aparelho para entregar ao técnico e conserto para ajudar a terminar.
    if (station === "assistencia") {
      if (carriedRepairCustomerId) {
        result = world.acceptRepair(carriedRepairCustomerId);
        if (result.ok) handle.putDownProduct();
      } else if (readyRepair) {
        result = world.collectCompletedRepair(readyRepair.customerId);
        if (result.ok) handle.pickUpRepair(readyRepair.customerId);
      } else {
        result = world.helpRepair();
      }
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
      } else if (carriedProduct !== customer.needsProduct) {
        // De mãos vazias, o E no balcão prioriza esse cliente e diz o que buscar.
        world.selectCustomer(customer.id);
        const nome = state.products.get(customer.needsProduct)?.name ?? "o produto";
        result = carriedProduct
          ? { ok: false, message: `Você está com outro item na mão. ${customer.name} quer ${nome}.` }
          : { ok: false, message: `${customer.name} quer ${nome}: pegue nas prateleiras e volte.` };
      } else {
        const product = state.products.get(customer.needsProduct);
        const preco = product?.sellingPrice ?? 0;
        if (product && customer.budget < preco) {
          // Vender abaixo da vitrine é decisão do dono da loja, não do atendente.
          setPedidoDesconto({
            customerId: customer.id,
            customerName: customer.name,
            produto: product.name,
            precoVitrine: preco,
            precoCliente: customer.budget,
          });
          result = {
            ok: false,
            message: `${customer.name} não paga o preço de vitrine. Aprove ou recuse o desconto.`,
          };
        } else {
          result = world.sellToCustomer(customer.id, preco);
          if (result.ok) handle.putDownProduct();
        }
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

  /**
   * O pedido pode vir de dois lugares: do próprio jogador (item na mão, no
   * balcão) ou do atendente auxiliar, que não fecha desconto sozinho. Os dois
   * usam o mesmo cartão; só muda quem executa a venda depois do "aprovar".
   */
  const pedidoDoAuxiliar = instantaneo.gameState?.pendingDiscount;
  const pedidoVisivel: PedidoDesconto | null =
    pedidoDesconto ??
    (pedidoDoAuxiliar
      ? {
          customerId: pedidoDoAuxiliar.customerId,
          customerName: pedidoDoAuxiliar.customerName,
          produto: pedidoDoAuxiliar.productName,
          precoVitrine: pedidoDoAuxiliar.showcasePrice,
          precoCliente: pedidoDoAuxiliar.customerPrice,
          pedidoPor: pedidoDoAuxiliar.askedBy,
        }
      : null);

  const aprovarDesconto = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    // Quem está com o produto na mão fecha a venda; senão quem pediu foi o
    // auxiliar, e é ele quem entrega no balcão.
    const resultado = pedidoDesconto
      ? vender(pedidoDesconto.customerId, pedidoDesconto.precoCliente)
      : world.approveDiscount();
    mapActionRef.current = resultado;
    setPedidoDesconto(null);
    sincronizar();
  }, [pedidoDesconto, vender, sincronizar]);

  const recusarDesconto = useCallback(() => {
    const world = worldRef.current;
    if (pedidoDesconto) {
      setPedidoDesconto(null);
      mapActionRef.current = {
        ok: true,
        message: "Desconto recusado. O item continua na sua mão.",
      };
    } else if (world) {
      mapActionRef.current = world.declineDiscount();
    }
    sincronizar();
  }, [pedidoDesconto, sincronizar]);

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
          pedidoDesconto={pedidoVisivel}
          onAprovarDesconto={aprovarDesconto}
          onRecusarDesconto={recusarDesconto}
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

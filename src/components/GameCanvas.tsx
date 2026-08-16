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
import { GOLES_BEBEDOURO } from "@/game/types";
import type {
  ActionResult,
  GameState,
  OfertaDeMelhoria,
  Opportunity,
  ProductType,
  EmployeeRole,
  ShiftReport,
  Upgrade,
} from "@/game/types";
import { GameUI, type Capacidades, type PedidoDesconto } from "./GameUI";
import { Soundtrack } from "@/audio/Soundtrack";

interface Instantaneo {
  gameState: GameState | null;
  opportunities: Opportunity[];
  upgradesOferecidos: OfertaDeMelhoria[];
  shiftReport: ShiftReport | null;
  playerStation: PlayerStation;
  /** Nomes do que está nos braços, do primeiro pego ao último. */
  carregando: string[];
  /** Quantos itens cabem hoje — muda com a linha do carrinho de atendimento. */
  capacidade: number;
  mapAction: ActionResult | null;
}

/** Frequência de sincronização entre a simulação e o React. */
const INTERVALO_SYNC_MS = 250;

const FALHA_SEM_NUCLEO: ActionResult = {
  ok: false,
  message: "Ação indisponível: o núcleo do jogo ainda não expõe esse método.",
};

/**
 * O `GameWorld` já recusa tudo com o turno pausado, mas quem tira produto da
 * prateleira e galão do almoxarifado é esta ponte — ela mexe direto no
 * `GameHandle`. Por isso a barreira precisa existir dos dois lados.
 */
const TURNO_PAUSADO = (): ActionResult => ({
  ok: false,
  message: "Turno pausado: retome o relógio para atender a loja.",
});

function turnoPausado(world: GameWorld | null): boolean {
  const state = world?.getState();
  return !!state && state.isPaused && state.phase === "active";
}

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
  const soundtrackRef = useRef<Soundtrack | null>(null);

  const [instantaneo, setInstantaneo] = useState<Instantaneo>({
    gameState: null,
    opportunities: [],
    upgradesOferecidos: [],
    shiftReport: null,
    playerStation: "loja",
    carregando: [],
    capacidade: 1,
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
  const [musicaAtiva, setMusicaAtiva] = useState(false);
  const [volumeMusica, setVolumeMusica] = useState(65);

  /** Copia o estado atual da simulação para o React. */
  const sincronizar = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    setInstantaneo({
      gameState: world.getState(),
      opportunities: [...world.getOpportunities()],
      upgradesOferecidos: world.getUpgradesOferecidos(),
      shiftReport: lerRelatorio(world),
      playerStation: handleRef.current?.getPlayerStation() ?? "loja",
      carregando: (handleRef.current?.getCarried() ?? []).map((item) => {
        const estado = world.getState();
        if (item.tipo === "produto") return estado.products.get(item.produto!)?.name ?? "produto";
        if (item.tipo === "caixa") return `caixa de ${estado.products.get(item.produto!)?.name ?? "mercadoria"}`;
        if (item.tipo === "galao") return "galão de água";
        return `aparelho de ${estado.customers.get(item.customerId ?? "")?.name ?? "cliente"}`;
      }),
      capacidade: world.capacidadeDeCarga(),
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
    if (turnoPausado(world)) {
      mapActionRef.current = TURNO_PAUSADO();
      sincronizar();
      return;
    }
    // A partir da linha do carrinho o atendente leva mais de um item, então
    // "o que está na mão" virou uma pilha e cada estação escolhe QUAL item
    // usar — não dá mais para assumir que só existe um.
    const carregados = handle.getCarried();
    const espaco = handle.espacoLivre();
    const produtosNaMao = carregados
      .filter((item) => item.tipo === "produto" && item.produto)
      .map((item) => item.produto as ProductType);
    const aparelhoNaMao = carregados.find((item) => item.tipo === "aparelho")?.customerId;
    const carriedRestock = handle.getCarriedRestock();
    const carriedGallon = handle.getCarriedGallon();
    const nomeDe = (tipo?: ProductType) =>
      (tipo && state.products.get(tipo)?.name) || "o produto";

    // A fila é a ordem de chegada; o cliente priorizado no painel vem antes.
    const aguardando = Array.from(state.customers.values()).filter(
      (item) => item.status === "waiting"
    );
    const selectedCustomer = state.selectedCustomerId
      ? state.customers.get(state.selectedCustomerId)
      : undefined;
    const readyRepair = state.repairs.find((repair) => repair.status === "ready");
    let result: ActionResult;

    const station = handle.getPlayerStation();

    // A bancada não depende da fila: lá dentro há reparo pronto para retirar,
    // aparelho para entregar ao técnico e conserto para ajudar a terminar.
    if (station === "bebedouro") {
      if (!carriedGallon) result = { ok: false, message: "Pegue um galão cheio no almoxarifado." };
      else { result = world.abastecerBebedouro(); if (result.ok) handle.putDownItem({ tipo: "galao" }); }
    } else if (station === "assistencia") {
      if (aparelhoNaMao) {
        result = world.acceptRepair(aparelhoNaMao);
        if (result.ok) handle.putDownItem({ tipo: "aparelho", customerId: aparelhoNaMao });
      } else if (readyRepair && espaco <= 0) {
        result = { ok: false, message: "Braços cheios: entregue o que está carregando antes de retirar o aparelho pronto." };
      } else if (readyRepair) {
        result = world.collectCompletedRepair(readyRepair.customerId);
        if (result.ok) handle.pickUpRepair(readyRepair.customerId);
      } else {
        result = world.helpRepair();
      }
    } else if (station === "almoxarifado") {
      // Sala dos fundos: aqui só se pega caixa para abastecer a prateleira.
      if (aparelhoNaMao) {
        result = { ok: false, message: "Aparelho de cliente não fica no almoxarifado: leve-o à bancada." };
      } else if (carriedGallon) {
        handle.putDownItem({ tipo: "galao" }); result = { ok: true, message: "Galão devolvido à estante." };
      } else if (carriedRestock) {
        handle.putDownItem({ tipo: "caixa" });
        result = { ok: true, message: "Caixa devolvida à estante." };
      } else if (carregados.length) {
        // Caixa e galão são carga pesada: ocupam os dois braços, senão a linha
        // do carrinho viraria também um upgrade de reposição — e esse papel já
        // é do Carrinho de carga.
        result = { ok: false, message: "Caixa e galão pedem os dois braços. Entregue o que está carregando primeiro." };
      } else {
        // Aqui saem as duas cargas da sala dos fundos: a caixa de mercadoria e
        // o galão de água. Bebedouro seco fura a fila da reposição — sem água
        // a equipe inteira perde ânimo, e repor prateleira pode esperar.
        const paraRepor = world.produtoParaRepor();
        const galaoUtil = state.nivelDoBebedouro < GOLES_BEBEDOURO;
        if (state.nivelDoBebedouro === 0 || (!paraRepor && galaoUtil)) {
          handle.pickUpGallon();
          result = { ok: true, message: "Galão cheio nas mãos. Leve-o ao bebedouro." };
        } else if (!paraRepor) {
          result = { ok: false, message: "Almoxarifado vazio. Compre mercadoria no painel de estoque." };
        } else {
          handle.pickUpRestock(paraRepor);
          result = { ok: true, message: `Caixa de ${nomeDe(paraRepor)} nas mãos. Leve até a prateleira.` };
        }
      }
    } else if (station === "prateleira") {
      if (carriedRestock) {
        result = world.restockShelf(carriedRestock);
        if (result.ok) handle.putDownItem({ tipo: "caixa" });
      } else if (carriedGallon) {
        result = { ok: false, message: "Galão de água não vai na prateleira: leve-o ao bebedouro." };
      } else {
        // O próximo cliente cujo produto ainda NÃO está na pilha. Descontar o
        // que já foi pego é o que permite montar duas vendas na mesma volta
        // sem pegar duas vezes a mesma coisa.
        const jaPegos = [...produtosNaMao];
        const alvo = aguardando.find((cliente) => {
          if (!cliente.needsProduct) return false;
          const i = jaPegos.indexOf(cliente.needsProduct);
          if (i >= 0) { jaPegos.splice(i, 1); return false; }
          return (state.products.get(cliente.needsProduct)?.stock ?? 0) > 0;
        });

        if (alvo?.needsProduct && espaco > 0) {
          world.selectCustomer(alvo.id);
          handle.pickUpProduct(alvo.needsProduct);
          const sobra = espaco - 1;
          result = {
            ok: true,
            message: `Você pegou ${nomeDe(alvo.needsProduct)} para ${alvo.name}. ${
              sobra > 0 ? `Ainda cabem ${sobra}.` : "Braços cheios: vá ao balcão."
            }`,
          };
        } else if (produtosNaMao.length) {
          // Devolver é o jeito de destravar os braços quando a venda não sai
          // (cliente dispensado, desconto recusado, item errado). Vem depois de
          // pegar, porque com capacidade sobrando buscar é o gesto natural.
          const devolvido = produtosNaMao[produtosNaMao.length - 1];
          handle.putDownItem({ tipo: "produto", produto: devolvido });
          if (handle.getCarried().length === 0) world.clearSelectedCustomer();
          result = { ok: true, message: `${nomeDe(devolvido)} devolvido à prateleira.` };
        } else if (aparelhoNaMao) {
          result = { ok: false, message: "Isso é o aparelho de um cliente: leve-o à bancada técnica." };
        } else if (!aguardando.length) {
          result = { ok: false, message: "Não há ninguém esperando para atender." };
        } else if (espaco <= 0) {
          result = { ok: false, message: "Braços cheios: leve ao balcão o que já pegou." };
        } else {
          result = { ok: false, message: "Ninguém na fila espera produto que esteja na prateleira." };
        }
      }
    } else if (station === "balcao") {
      // Reparo pronto na mão volta para o dono antes de qualquer outra coisa.
      const paraDevolver = carregados.find(
        (item) =>
          item.tipo === "aparelho" &&
          state.repairs.some((repair) => repair.customerId === item.customerId && repair.status === "returning")
      );
      // Entre os que esperam, o primeiro cujo produto está na pilha.
      const comprador = aguardando.find(
        (cliente) => cliente.needsProduct && produtosNaMao.includes(cliente.needsProduct)
      );
      const paraReceber = aguardando.find((cliente) => cliente.needsService);
      const orientar = selectedCustomer?.status === "waiting" ? selectedCustomer : aguardando[0];

      if (paraDevolver?.customerId) {
        result = world.returnRepairToCustomer(paraDevolver.customerId);
        if (result.ok) handle.putDownItem({ tipo: "aparelho", customerId: paraDevolver.customerId });
      } else if (comprador?.needsProduct) {
        const product = state.products.get(comprador.needsProduct);
        const preco = product?.sellingPrice ?? 0;
        if (product && comprador.budget < preco) {
          // Vender abaixo da vitrine é decisão do dono da loja, não do atendente.
          setPedidoDesconto({
            customerId: comprador.id,
            customerName: comprador.name,
            produto: product.name,
            precoVitrine: preco,
            precoCliente: comprador.budget,
          });
          result = {
            ok: false,
            message: `${comprador.name} não paga o preço de vitrine. Aprove ou recuse o desconto.`,
          };
        } else {
          const vendido = comprador.needsProduct;
          result = world.sellToCustomer(comprador.id, preco);
          if (result.ok) handle.putDownItem({ tipo: "produto", produto: vendido });
        }
      } else if (paraReceber && espaco > 0) {
        result = world.receiveRepair(paraReceber.id);
        if (result.ok) handle.pickUpRepair(paraReceber.id);
      } else if (paraReceber) {
        result = { ok: false, message: "Braços cheios: entregue o que está carregando para receber o aparelho." };
      } else if (!orientar) {
        result = { ok: false, message: "Não há ninguém esperando para atender." };
      } else if (orientar.needsProduct) {
        // De braços vazios, o E no balcão prioriza esse cliente e diz o que buscar.
        world.selectCustomer(orientar.id);
        result = {
          ok: false,
          message: `${orientar.name} quer ${nomeDe(orientar.needsProduct)}: pegue nas prateleiras e volte.`,
        };
      } else {
        result = { ok: false, message: "Receba o aparelho deste cliente no balcão antes de levá-lo à assistência." };
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

  useEffect(() => () => soundtrackRef.current?.dispose(), []);

  const alternarMusica = useCallback(() => {
    const soundtrack = soundtrackRef.current ?? new Soundtrack();
    soundtrackRef.current = soundtrack;
    if (soundtrack.isPlaying) {
      soundtrack.stop();
      setMusicaAtiva(false);
      return;
    }
    soundtrack.setVolume(volumeMusica / 100);
    void soundtrack.start().then(() => setMusicaAtiva(true));
  }, [volumeMusica]);

  const mudarVolumeMusica = useCallback((volume: number) => {
    setVolumeMusica(volume);
    soundtrackRef.current?.setVolume(volume / 100);
  }, []);

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
      if (turnoPausado(world)) return TURNO_PAUSADO();
      const customer = world.getState().customers.get(id);
      if (!customer?.needsProduct) {
        return { ok: false, message: "Este cliente precisa da assistência técnica." };
      }
      const naPilha = handle.getCarried();
      const jaTem = naPilha.some(
        (item) => item.tipo === "produto" && item.produto === customer.needsProduct
      );
      if (handle.getPlayerStation() === "prateleira") {
        if (jaTem) {
          return { ok: false, message: "Você já pegou o produto dele. Agora leve-o até o balcão." };
        }
        if ((world.getState().products.get(customer.needsProduct)?.stock ?? 0) <= 0) {
          return { ok: false, message: "Não há estoque desse produto na prateleira." };
        }
        // Sem espaço, um clique troca: devolve o último produto e pega o certo.
        // Com a cesta ou o carrinho há espaço, e aí ele só soma na pilha.
        const trocou = handle.espacoLivre() <= 0;
        if (trocou) {
          const ultimo = [...naPilha].reverse().find((item) => item.tipo === "produto");
          if (!ultimo) {
            return { ok: false, message: "Braços cheios com carga que não é venda: entregue-a primeiro." };
          }
          handle.putDownItem({ tipo: "produto", produto: ultimo.produto });
        }
        world.selectCustomer(id);
        handle.pickUpProduct(customer.needsProduct);
        const nome = world.getState().products.get(customer.needsProduct)?.name ?? "o produto";
        const result = {
          ok: true,
          message: trocou
            ? `Você trocou pelo ${nome}. Agora volte ao balcão para vender.`
            : `Você pegou ${nome}. Agora volte ao balcão para vender.`,
        };
        mapActionRef.current = result;
        sincronizar();
        return result;
      }
      if (handle.getPlayerStation() !== "balcao") {
        return { ok: false, message: "Vá às prateleiras para pegar o produto ou ao balcão para vender." };
      }
      if (!jaTem) {
        return { ok: false, message: "Vá às prateleiras e clique em Vender para pegar o produto pedido." };
      }
      const resultado = world.sellToCustomer(id, preco);
      if (resultado.ok) handle.putDownItem({ tipo: "produto", produto: customer.needsProduct });
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
           tipo: pedidoDoAuxiliar.kind,
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
      if (turnoPausado(world)) return TURNO_PAUSADO();
      if (handle.getPlayerStation() === "balcao") {
        if (handle.espacoLivre() <= 0) {
          return { ok: false, message: "Braços cheios: entregue o que está carregando para receber o aparelho." };
        }
        const resultado = world.receiveRepair(id);
        if (resultado.ok) handle.pickUpRepair(id);
        sincronizar();
        return resultado;
      }
      if (handle.getPlayerStation() !== "assistencia") {
        return { ok: false, message: "No balcão, receba o aparelho. Na bancada, entregue-o ao técnico." };
      }
      if (!handle.getCarried().some((item) => item.tipo === "aparelho" && item.customerId === id)) {
        return { ok: false, message: "Traga o aparelho recebido no balcão até a bancada." };
      }
      const resultado = world.acceptRepair(id);
      if (resultado.ok) handle.putDownItem({ tipo: "aparelho", customerId: id });
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

  const moverNoCelular = useCallback((x: number, z: number) => {
    handleRef.current?.setMobileMovement(x, z);
  }, []);

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

  const comprarUpgrade = useCallback((id: Upgrade["id"]): ActionResult => {
    const resultado = worldRef.current?.comprarUpgrade(id) ?? FALHA_SEM_NUCLEO;
    mapActionRef.current = resultado;
    sincronizar();
    return resultado;
  }, [sincronizar]);

  const executarOportunidade = useCallback((o: Opportunity): ActionResult => {
    const acao = o.acao;
    const world = worldRef.current;
    if (!world || !acao) return { ok: false, message: "Essa recomendação não tem ação disponível." };
    let ok = false;
    if (acao.tipo === "reporPrateleira" && acao.produto) return world.restockShelf(acao.produto, acao.quantidade);
    if (acao.tipo === "comprarEstoque" && acao.produto) ok = world.buyStock(acao.produto, acao.quantidade ?? 5);
    if (acao.tipo === "ajustarPreco" && acao.produto) ok = world.setProductPrice(acao.produto, acao.preco ?? 0);
    if (acao.tipo === "contratar" && acao.funcao) ok = world.hireEmployee(acao.funcao, `Consultor ${acao.funcao}`);
    const resultado = { ok, message: ok ? "Recomendação aplicada." : "Não foi possível aplicar esta recomendação agora." };
    mapActionRef.current = resultado;
    sincronizar();
    return resultado;
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
          upgradesOferecidos={instantaneo.upgradesOferecidos}
          shiftReport={instantaneo.shiftReport}
          playerStation={instantaneo.playerStation}
          carregando={instantaneo.carregando}
          capacidade={instantaneo.capacidade}
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
          musicaAtiva={musicaAtiva}
          volumeMusica={volumeMusica}
          onToggleMusic={alternarMusica}
          onMusicVolumeChange={mudarVolumeMusica}
          onBuyStock={comprarEstoque}
          onSetPrice={definirPreco}
          onHire={contratar}
          onUpgrade={comprarUpgrade}
          onOpportunityAction={executarOportunidade}
          onClearOpportunities={limparOportunidades}
          onReset={reiniciar}
          onMobileMove={moverNoCelular}
          onMobileInteract={interagirComEstacao}
        />
      )}
    </>
  );
}

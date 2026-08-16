// GameUI.tsx — interface da Fase 2: preparação → turno de 120 s → fechamento.
// Sem dependências de UI externas: só React + styles.css.
//
// Regra da divisão de trabalho: nenhuma regra econômica mora aqui. Este arquivo
// só lê o estado publicado pelo GameWorld e chama os métodos dele.

import { useEffect, useState } from "react";
import type { PlayerStation } from "@/game/scene";
import type {
  ActionResult,
  Customer,
  CustomerStatus,
  EmployeeRole,
  GamePhase,
  GameState,
  MotivoDaOferta,
  OfertaDeMelhoria,
  Opportunity,
  Product,
  ProductType,
  ShiftReport,
  Upgrade,
} from "@/game/types";

/** O que o núcleo já expõe. Enquanto o Codex termina, a interface se adapta. */
export interface Capacidades {
  iniciarTurno: boolean;
  selecionarCliente: boolean;
  relatorio: boolean;
}

/**
 * Cliente que não paga o preço de vitrine. O atendente não decide sozinho
 * baixar preço: quem aprova o desconto é o dono da loja.
 */
export interface PedidoDesconto {
  customerId: string;
  customerName: string;
  produto: string;
  precoVitrine: number;
  precoCliente: number;
  /** Preenchido quando quem pediu foi o atendente auxiliar. */
  pedidoPor?: string;
  tipo?: "discount" | "premium";
}

interface GameUIProps {
  gameState: GameState | null;
  opportunities: Opportunity[];
  upgradesOferecidos: OfertaDeMelhoria[];
  shiftReport: ShiftReport | null;
  capacidades: Capacidades;
  /** Onde o atendente está parado na loja 3D. */
  playerStation: PlayerStation;
  /** O que ele está carregando nos braços, do primeiro pego ao último. */
  carregando: string[];
  /** Quantos itens cabem — muda com a linha do carrinho de atendimento. */
  capacidade: number;
  /** Resposta da última interação feita pela tecla E dentro da loja. */
  mapAction: ActionResult | null;
  /** Desconto esperando aprovação do jogador, se houver. */
  pedidoDesconto: PedidoDesconto | null;
  onAprovarDesconto: () => void;
  onRecusarDesconto: () => void;
  onStartShift: () => void;
  onSelectCustomer: (id: string) => void;
  onSell: (id: string, preco: number) => ActionResult;
  onAcceptRepair: (id: string) => ActionResult;
  onDecline: (id: string) => ActionResult;
  onTogglePause: () => void;
  onTimeSpeedChange: (velocidade: number) => void;
  musicaAtiva: boolean;
  volumeMusica: number;
  onToggleMusic: () => void;
  onMusicVolumeChange: (volume: number) => void;
  onBuyStock: (tipo: ProductType, quantidade: number) => boolean;
  onSetPrice: (tipo: ProductType, preco: number) => boolean;
  onHire: (funcao: EmployeeRole, nome: string) => boolean;
  onUpgrade: (id: Upgrade["id"]) => ActionResult;
  onOpportunityAction: (opportunity: Opportunity) => ActionResult;
  onClearOpportunities: () => void;
  onReset: () => void;
  onMobileMove: (x: number, z: number) => void;
  onMobileInteract: () => void;
}

type AbaLateral = "estoque" | "equipe" | "consultor";
type Aviso = { texto: string; tipo: "ok" | "erro" } | null;

const VELOCIDADES = [0.5, 1, 2, 4];
const LOTES = [5, 10, 20];

const SALARIOS: Record<EmployeeRole, number> = {
  seller: 2000,
  technician: 2500,
  manager: 3000,
  consultant: 1800,
};

/** Espelha o teto do núcleo; o vendedor inicial é o jogador e não conta. */
const LIMITE_EQUIPE: Record<EmployeeRole, number> = {
  seller: 2,
  technician: 3,
  manager: 1,
  consultant: 1,
};

const FUNCOES: Record<EmployeeRole, string> = {
  seller: "Vendedor",
  technician: "Técnico",
  manager: "Gerente",
  consultant: "Consultor",
};

const STATUS_CLIENTE: Record<CustomerStatus, string> = {
  waiting: "aguardando",
  beingServed: "em atendimento",
  repairing: "em reparo",
  leaving: "saindo",
};

const URGENCIA: Record<Customer["urgency"], string> = {
  low: "tranquilo",
  medium: "com pressa",
  high: "urgente",
};

const ROTULO_ESTACAO: Record<PlayerStation, string> = {
  balcao: "no balcão",
  prateleira: "nas prateleiras",
  almoxarifado: "no almoxarifado",
  assistencia: "na bancada técnica",
  bebedouro: "no bebedouro",
  cafe: "no ponto de café",
  loja: "andando pela loja",
};

/**
 * Anel de progresso do conserto — a "bolinha carregando" da bancada. SVG e não
 * canvas: o traço fica nítido em qualquer densidade de tela e o preenchimento é
 * um `stroke-dashoffset` só.
 */
function AnelDeConserto({ fracao, segundos }: { fracao: number; segundos: number }) {
  const raio = 15;
  const volta = 2 * Math.PI * raio;
  return (
    <div className="conserto" title="Tempo restante do conserto na bancada">
      <svg className="conserto__anel" viewBox="0 0 36 36" aria-hidden="true">
        <circle className="conserto__trilho" cx="18" cy="18" r={raio} />
        <circle
          className="conserto__arco"
          cx="18"
          cy="18"
          r={raio}
          strokeDasharray={volta}
          strokeDashoffset={volta * (1 - Math.max(0, Math.min(1, fracao)))}
        />
      </svg>
      <div className="conserto__texto">
        <strong className="conserto__segundos">{segundos}s</strong>
        <span className="conserto__rotulo">conserto</span>
      </div>
    </div>
  );
}

/** Abaixo disso o painel lateral vira gaveta por cima da loja (ver styles.css). */
const LARGURA_GAVETA = 820;

function telaEstreita(): boolean {
  return typeof window !== "undefined" && window.innerWidth <= LARGURA_GAVETA;
}

/** Para onde levar o item que está por cima da pilha. */
function destinoDaCarga(nome: string): string {
  if (nome.startsWith("aparelho")) return "leve à bancada";
  if (nome.startsWith("caixa")) return "leve à prateleira";
  if (nome.startsWith("galão")) return "leve ao bebedouro";
  if (nome.startsWith("pacote")) return "leve ao ponto de café";
  return "leve ao balcão";
}

/** Por que cada cartão do fechamento está na oferta de hoje. */
const SELO_DA_OFERTA: Record<MotivoDaOferta, string> = {
  consultor: "o consultor recomenda",
  sorteio: "sorteada",
  acessivel: "cabe no caixa",
};

/** Chegar numa estação abre o painel que serve para agir ali. */
const ABA_DA_ESTACAO: Partial<Record<PlayerStation, AbaLateral>> = {
  prateleira: "estoque",
  almoxarifado: "estoque",
  assistencia: "equipe",
  bebedouro: "equipe",
  cafe: "equipe",
};

// A função aparece logo abaixo do nome no painel, então o nome gerado não
// repete o cargo.
const NOMES_CONTRATACAO = [
  "Ana Ribeiro",
  "Bruno Salles",
  "Carla Nogueira",
  "Diego Prado",
  "Elisa Tavares",
  "Fábio Menezes",
  "Gabi Rocha",
  "Henrique Lima",
];

function nomeParaContratacao(indice: number): string {
  const base = NOMES_CONTRATACAO[indice % NOMES_CONTRATACAO.length];
  const volta = Math.floor(indice / NOMES_CONTRATACAO.length);
  return volta > 0 ? `${base} ${volta + 1}` : base;
}

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const formatarMoeda = (valor: number) => moeda.format(valor);

/** O núcleo pode ainda não ter preenchido o campo; a tela não pode quebrar. */
const numero = (valor: number | undefined, padrao = 0) =>
  typeof valor === "number" && Number.isFinite(valor) ? valor : padrao;

const faseDe = (fase: GamePhase | undefined): GamePhase => fase ?? "planning";

/**
 * Espelha o teto do núcleo (2,5× o valor de mercado). Serve só para o campo e a
 * mensagem: quem recusa o preço continua sendo o GameWorld.
 */
const tetoDePreco = (produto: Product) => Math.round(produto.basePrice * 2.5 * 100) / 100;

function relogioTurno(segundos: number): string {
  const total = Math.max(0, Math.ceil(segundos));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const ICONES = {
  dinheiro: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  grafico: "M3 17l6-6 4 4 8-8M15 7h6v6",
  equipe:
    "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
  caixa: "M21 8v13H3V8M1 3h22v5H1zM10 12h4",
  alerta:
    "M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z",
  raio: "M13 2 3 14h9l-1 8 10-12h-9l1-8z",
  chave: "M14.7 6.3a4 4 0 0 0 5 5l-9.6 9.6a2 2 0 0 1-2.8 0l-2.2-2.2a2 2 0 0 1 0-2.8z",
  relogio: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2",
  estrela:
    "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  play: "M5 3l14 9-14 9V3z",
  pause: "M6 4h4v16H6zM14 4h4v16h-4z",
  musica: "M9 18V5l11-2v13M9 18a3 3 0 1 1-2-2.83M20 16a3 3 0 1 1-2-2.83V3",
} as const;

function Icone({ d }: { d: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

export function GameUI(props: GameUIProps) {
  const { gameState, opportunities, shiftReport, capacidades } = props;
  const estacao = props.playerStation;

  const [aba, setAba] = useState<AbaLateral>("estoque");
  const [lote, setLote] = useState(5);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [rascunhoPreco, setRascunhoPreco] = useState<
    Partial<Record<ProductType, string>>
  >({});
  const [selecaoLocal, setSelecaoLocal] = useState<string | null>(null);
  const [confirmarReinicio, setConfirmarReinicio] = useState(false);
  // No celular deitado o painel é uma gaveta sobre a loja, então ele nasce
  // fechado: aberto, tapa metade de uma tela de 375px de altura. No desktop ele
  // nasce aberto, que é onde ele cabe ao lado da loja.
  const [painelRecolhido, setPainelRecolhido] = useState(telaEstreita);
  // O fechamento pode ser dispensado para o jogador repor estoque antes de
  // abrir o dia seguinte: o núcleo vai direto de "summary" para o turno novo.
  const [resumoFechado, setResumoFechado] = useState(false);

  const diaDoRelatorio = shiftReport?.day;
  useEffect(() => {
    setResumoFechado(false);
  }, [diaDoRelatorio]);

  useEffect(() => {
    const alvo = ABA_DA_ESTACAO[estacao];
    if (!alvo) return;
    setAba(alvo);
    // Chegar numa estação é o momento em que o painel serve para algo: se ele
    // estava fechado, reabre sozinho em vez de esconder a ação disponível.
    // No celular NÃO: lá ele é gaveta sobre a loja, e abrir sozinho toda vez
    // que o atendente encosta numa prateleira taparia o jogo.
    if (!telaEstreita()) setPainelRecolhido(false);
  }, [estacao]);

  // Girar o celular ou redimensionar a janela troca o papel do painel: gaveta
  // fechada em tela estreita, coluna aberta em tela larga.
  useEffect(() => {
    const aoRedimensionar = () => setPainelRecolhido(telaEstreita());
    window.addEventListener("resize", aoRedimensionar);
    return () => window.removeEventListener("resize", aoRedimensionar);
  }, []);

  // A resposta da tecla E vem do GameCanvas e usa o mesmo aviso dos botões.
  const acaoNoMapa = props.mapAction;
  useEffect(() => {
    if (!acaoNoMapa) return;
    setAviso({ texto: acaoNoMapa.message, tipo: acaoNoMapa.ok ? "ok" : "erro" });
  }, [acaoNoMapa]);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 2600);
    return () => window.clearTimeout(t);
  }, [aviso]);

  useEffect(() => {
    if (!confirmarReinicio) return;
    const t = window.setTimeout(() => setConfirmarReinicio(false), 4000);
    return () => window.clearTimeout(t);
  }, [confirmarReinicio]);

  if (!gameState) {
    return (
      <div className="ui-root">
        <div className="aviso">Iniciando a loja…</div>
      </div>
    );
  }

  // O GameWorld muta o mesmo objeto de estado a cada quadro, então as listas
  // são derivadas a cada render — memorizá-las mostraria dados velhos.
  const produtos = Array.from(gameState.products.values());
  const funcionarios = Array.from(gameState.employees.values());
  const clientes = Array.from(gameState.customers.values());
  // O vendedor da casa é o próprio jogador: ele não ocupa vaga de contratação.
  const contratados = (funcao: EmployeeRole) =>
    funcionarios.filter((f) => f.role === funcao && f.id !== "seller-1").length;
  const vagasAuxiliar = LIMITE_EQUIPE.seller - contratados("seller");
  const vagasTecnico = LIMITE_EQUIPE.technician - contratados("technician");
  const vagasGerente = LIMITE_EQUIPE.manager - contratados("manager");
  const vagasConsultor = LIMITE_EQUIPE.consultant - contratados("consultant");

  const fase = faseDe(gameState.phase);
  const dia = numero(gameState.day, 1);
  const duracao = numero(gameState.shiftDuration, 120);
  const restante = numero(gameState.shiftTimeRemaining, duracao);
  const meta = numero(gameState.dailyGoal);
  const reputacao = numero(gameState.reputation, 50);

  const naLoja = clientes.filter((c) => c.status !== "leaving");
  const aguardando = naLoja.filter((c) => c.status === "waiting");
  const emReparo = naLoja.filter((c) => c.status === "repairing");

  // Conserto na bancada agora. Só o que está sendo trabalhado: o que espera
  // técnico livre já aparece como caixa no chão da assistência.
  const conserto = (() => {
    const emAndamento = gameState.repairs.find(
      (reparo) => reparo.status === "inProgress" && reparo.endTime !== undefined
    );
    if (!emAndamento?.endTime) return null;
    const total = Math.max(0.001, emAndamento.endTime - emAndamento.startTime);
    const falta = Math.max(0, emAndamento.endTime - gameState.time);
    return { fracao: Math.min(1, 1 - falta / total), segundos: Math.ceil(falta) };
  })();

  // Seleção: manda o núcleo; se ele ainda não expõe, a tela mantém o foco.
  // Só fica no balcão quem ainda dá para atender — depois da venda o cliente
  // vira "leaving" e o posto precisa liberar para o próximo da fila.
  const idPreferido = gameState.selectedCustomerId ?? selecaoLocal ?? undefined;
  const preferido = idPreferido ? gameState.customers.get(idPreferido) : undefined;
  const selecionado =
    preferido && preferido.status === "waiting" ? preferido : aguardando[0];
  const idSelecionado = selecionado?.id;

  // Filtro de exibição (não é contabilidade): o turno começou em
  // time - (duracao - restante), então dá para mostrar o que já entrou hoje.
  // A meta do núcleo é comparada com a RECEITA do turno, então a barra usa
  // receita — mostrar lucro aqui contradiria o relatório de fechamento.
  const inicioDoTurno = gameState.time - (duracao - restante);
  const receitaDoTurno =
    gameState.sales
      .filter((v) => v.timestamp >= inicioDoTurno)
      .reduce((s, v) => s + v.price, 0) +
    gameState.repairs
      .filter((r) => r.completed && r.startTime >= inicioDoTurno)
      .reduce((s, r) => s + r.price, 0);
  const progressoMeta = meta > 0 ? Math.min(100, (receitaDoTurno / meta) * 100) : 0;

  const selecionar = (id: string) => {
    setSelecaoLocal(id);
    if (capacidades.selecionarCliente) props.onSelectCustomer(id);
  };

  const aplicarResultado = (r: ActionResult) => {
    setAviso({ texto: r.message, tipo: r.ok ? "ok" : "erro" });
  };

  const vender = (cliente: Customer, preco: number) => {
    aplicarResultado(props.onSell(cliente.id, preco));
  };

  const comprar = (tipo: ProductType, nome: string, custo: number) => {
    const ok = props.onBuyStock(tipo, lote);
    setAviso(
      ok
        ? { texto: `+${lote} ${nome} por ${formatarMoeda(custo)}`, tipo: "ok" }
        : {
            texto: `Caixa insuficiente: ${nome} x${lote} custa ${formatarMoeda(custo)}`,
            tipo: "erro",
          }
    );
  };

  const aplicarPreco = (produto: Product) => {
    const texto = (rascunhoPreco[produto.type] ?? "").replace(",", ".");
    const valor = Number(texto);
    if (!texto || !Number.isFinite(valor)) {
      setAviso({ texto: "Informe um preço válido.", tipo: "erro" });
      return;
    }
    if (props.onSetPrice(produto.type, valor)) {
      setRascunhoPreco((atual) => ({ ...atual, [produto.type]: undefined }));
      setAviso({ texto: `${produto.name} agora custa ${formatarMoeda(valor)}`, tipo: "ok" });
    } else {
      setAviso({
        texto: `Preço recusado: fica entre ${formatarMoeda(produto.costPrice)} e ${formatarMoeda(
          tetoDePreco(produto)
        )} — acima disso ninguém compra.`,
        tipo: "erro",
      });
    }
  };

  const contratar = (funcao: EmployeeRole) => {
    const nome = nomeParaContratacao(funcionarios.length);
    const entrada = SALARIOS[funcao];
    const ok = props.onHire(funcao, nome);
    setAviso(
      ok
        ? { texto: `${nome} contratado(a) por ${formatarMoeda(entrada)}`, tipo: "ok" }
        : {
            texto: `Contratação exige ${formatarMoeda(entrada)} em caixa (1 salário).`,
            tipo: "erro",
          }
    );
  };

  const reiniciar = () => {
    if (!confirmarReinicio) {
      setConfirmarReinicio(true);
      return;
    }
    setConfirmarReinicio(false);
    setRascunhoPreco({});
    setSelecaoLocal(null);
    props.onReset();
    setAviso({ texto: "Jogo reiniciado.", tipo: "ok" });
  };

  const emTurno = fase === "active";

  return (
    <div className={`ui-root fase-${fase} ${painelRecolhido ? "ui-root--painel-recolhido" : ""}`}>
      <div className="aviso-orientacao" role="status">
        <span className="aviso-orientacao__icone">↻</span>
        <strong>Gire o celular</strong>
        <span>Este jogo foi preparado para usar na horizontal.</span>
      </div>
      {/* ---------- Barra superior ---------- */}
      <header className="topbar">
        <div className="marca">
          <div className="marca__selo">$</div>
          <div>
            <h1 className="marca__titulo">TECH STORE TYCOON</h1>
            <p className="marca__relogio">
              {/* No fechamento o núcleo já incrementou o dia, então quem manda
                  no rótulo é o dia do relatório. */}
              Dia {fase === "summary" ? (shiftReport?.day ?? dia) : dia} ·{" "}
              {fase === "planning"
                ? "preparação"
                : fase === "active"
                  ? "turno em andamento"
                  : "fechamento"}
            </p>
          </div>
        </div>

        {emTurno && (
          <div className="cronometro">
            <span className="cronometro__rotulo">
              <Icone d={ICONES.relogio} /> Turno
            </span>
            <strong
              className={`cronometro__valor ${restante <= 20 ? "valor--negativo" : ""}`}
            >
              {relogioTurno(restante)}
            </strong>
            <div className="barra barra--turno">
              <div
                className="barra__preenchimento"
                style={{ width: `${duracao > 0 ? (restante / duracao) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Quanto falta para o conserto sair. Vive no HUD e não na bancada
            porque a bancada é o canto mais apertado desta câmera fixa: o
            jogador, o técnico e a placa disputam os mesmos 40 pixels, e o
            número ficava sempre atrás de alguém. */}
        {conserto && <AnelDeConserto fracao={conserto.fracao} segundos={conserto.segundos} />}

        <div className="topbar__resumo">
          <div className="resumo-item">
            <span className="resumo-item__rotulo">Caixa</span>
            <span
              className={`resumo-item__valor ${
                gameState.cash < 0 ? "valor--negativo" : "valor--positivo"
              }`}
            >
              {formatarMoeda(gameState.cash)}
            </span>
          </div>
          <div className="resumo-item">
            <span className="resumo-item__rotulo">Meta do dia</span>
            <span className="resumo-item__valor valor--ciano">
              {formatarMoeda(receitaDoTurno)}
              <small className="resumo-item__alvo"> / {formatarMoeda(meta)}</small>
            </span>
          </div>
          <div className="resumo-item">
            <span className="resumo-item__rotulo">Reputação</span>
            <span className="resumo-item__valor valor--alerta">
              {Math.round(reputacao)}
            </span>
          </div>
        </div>

        <div className="controles-tempo">
          <div className="controle-musica">
            <button
              className={`btn btn--pequeno ${props.musicaAtiva ? "btn--ativo" : ""}`}
              onClick={props.onToggleMusic}
              title="Trilha original synth-rock retrô"
            >
              <Icone d={ICONES.musica} /> {props.musicaAtiva ? "Trilha" : "Som"}
            </button>
            {props.musicaAtiva && (
              <input
                className="controle-musica__volume"
                type="range"
                aria-label="Volume da trilha sonora"
                min="0"
                max="100"
                value={props.volumeMusica}
                onChange={(event) => props.onMusicVolumeChange(Number(event.target.value))}
              />
            )}
          </div>
          {/* Fora do turno não há relógio para pausar: o botão sumir evita
              um controle morto na barra. */}
          {emTurno && (
            <button className="btn" onClick={props.onTogglePause}>
              <Icone d={gameState.isPaused ? ICONES.play : ICONES.pause} />
              {gameState.isPaused ? "Retomar" : "Pausar"}
            </button>
          )}
          {VELOCIDADES.map((v) => (
            <button
              key={v}
              className={`btn btn--pequeno ${
                gameState.timeSpeed === v ? "btn--ativo" : ""
              }`}
              onClick={() => props.onTimeSpeedChange(v)}
            >
              {v}x
            </button>
          ))}
        </div>
      </header>

      {/* ---------- Barra de meta ---------- */}
      <div className="faixa-meta">
        <div className="faixa-meta__barra">
          <div
            className={`faixa-meta__preenchimento ${
              progressoMeta >= 100 ? "faixa-meta__preenchimento--ok" : ""
            }`}
            style={{ width: `${progressoMeta}%` }}
          />
        </div>
        <span className="faixa-meta__texto">
          {meta > 0
            ? `Receita do turno ${formatarMoeda(receitaDoTurno)} de ${formatarMoeda(meta)}`
            : "Meta do dia ainda não definida pelo núcleo"}
        </span>
      </div>

      {/* ---------- Controles da loja 3D ---------- */}
      <div className="controles-jogo">
        <span className="controles-jogo__grupo">
          <span className="tecla">W</span>
          <span className="tecla">A</span>
          <span className="tecla">S</span>
          <span className="tecla">D</span>
          andar
        </span>
        <span className="controles-jogo__grupo">
          <span className="tecla">E</span>
          interagir
        </span>
        <span className={`estacao-chip estacao-chip--${estacao}`}>
          {ROTULO_ESTACAO[estacao]}
        </span>
        {/* Carregando algo, o próximo passo é o que mais importa na tela. Com
            o carrinho a pilha tem mais de um item, então mostra a contagem e o
            destino do que está por cima. */}
        {props.carregando.length > 0 && (
          <span className="carga-atual">
            carregando{" "}
            {props.capacidade > 1 && (
              <strong>
                {props.carregando.length}/{props.capacidade}
              </strong>
            )}{" "}
            <strong>{props.carregando.join(", ")}</strong> ·{" "}
            {destinoDaCarga(props.carregando[props.carregando.length - 1])}
          </span>
        )}
      </div>

      {/* Controles exibidos apenas em telas de toque. O teclado continua
          funcionando normalmente em computadores. */}
      <div className="controles-toque" aria-label="Controles do jogo">
        <div className="direcional" aria-label="Mover personagem">
          <button className="direcional__botao direcional__cima" aria-label="Andar para frente"
            onPointerDown={() => props.onMobileMove(0, 1)} onPointerUp={() => props.onMobileMove(0, 0)} onPointerLeave={() => props.onMobileMove(0, 0)} onPointerCancel={() => props.onMobileMove(0, 0)}>▲</button>
          <button className="direcional__botao direcional__esquerda" aria-label="Andar para a esquerda"
            onPointerDown={() => props.onMobileMove(-1, 0)} onPointerUp={() => props.onMobileMove(0, 0)} onPointerLeave={() => props.onMobileMove(0, 0)} onPointerCancel={() => props.onMobileMove(0, 0)}>◀</button>
          <button className="direcional__botao direcional__direita" aria-label="Andar para a direita"
            onPointerDown={() => props.onMobileMove(1, 0)} onPointerUp={() => props.onMobileMove(0, 0)} onPointerLeave={() => props.onMobileMove(0, 0)} onPointerCancel={() => props.onMobileMove(0, 0)}>▶</button>
          <button className="direcional__botao direcional__baixo" aria-label="Andar para trás"
            onPointerDown={() => props.onMobileMove(0, -1)} onPointerUp={() => props.onMobileMove(0, 0)} onPointerLeave={() => props.onMobileMove(0, 0)} onPointerCancel={() => props.onMobileMove(0, 0)}>▼</button>
        </div>
        <button className="botao-interagir" onClick={props.onMobileInteract}>INTERAGIR</button>
      </div>

      {/* ---------- Palco central ---------- */}
      <main className="palco">
        {!emTurno && (
          <section className="palco__card">
            <p className="palco__etiqueta">Dia {dia}</p>
            <h2 className="palco__titulo">
              {fase === "summary" ? "Preparar o próximo dia" : "Preparação"}
            </h2>
            <p className="palco__texto">
              Ajuste preços, reponha estoque e contrate quem for preciso no
              painel à esquerda. Quando abrir a loja, os clientes chegam sem
              esperar: cada um é uma decisão sua.
            </p>
            <div className="palco__kpis">
              <div className="kpi">
                <span className="kpi__rotulo">Meta de lucro</span>
                <strong className="kpi__valor valor--ciano">
                  {formatarMoeda(meta)}
                </strong>
              </div>
              <div className="kpi">
                <span className="kpi__rotulo">Caixa</span>
                <strong className="kpi__valor valor--positivo">
                  {formatarMoeda(gameState.cash)}
                </strong>
              </div>
              <div className="kpi">
                <span className="kpi__rotulo">Reputação</span>
                <strong className="kpi__valor valor--alerta">
                  {Math.round(reputacao)}/100
                </strong>
              </div>
              <div className="kpi">
                <span className="kpi__rotulo">Duração</span>
                <strong className="kpi__valor">{relogioTurno(duracao)}</strong>
              </div>
            </div>
            <button
              className="btn btn--gigante"
              onClick={props.onStartShift}
              disabled={!capacidades.iniciarTurno}
              title={
                capacidades.iniciarTurno
                  ? "Abrir a loja e começar o turno"
                  : "startShift() ainda não existe no GameWorld"
              }
            >
              Abrir a loja · turno de {relogioTurno(duracao)}
            </button>
            {!capacidades.iniciarTurno && (
              <p className="palco__aviso">
                O núcleo ainda não expõe <code>startShift()</code>. Assim que o
                Codex publicar o método, este botão liga sozinho.
              </p>
            )}
          </section>
        )}

        {/* Aprovar desconto é a decisão mais urgente na tela: vem antes do posto. */}
        {emTurno && props.pedidoDesconto ? (
          <AprovacaoDeDesconto
            pedido={props.pedidoDesconto}
            onAprovar={props.onAprovarDesconto}
            onRecusar={props.onRecusarDesconto}
          />
        ) : (
          emTurno &&
          (selecionado ? (
            <PostoAtendimento
              cliente={selecionado}
              produto={
                selecionado.needsProduct
                  ? gameState.products.get(selecionado.needsProduct)
                  : undefined
              }
              onVender={vender}
              onAceitarReparo={(id) => aplicarResultado(props.onAcceptRepair(id))}
              onRecusar={(id) => aplicarResultado(props.onDecline(id))}
            />
          ) : null)
        )}
      </main>

      {/* ---------- Painel esquerdo: preparação ----------
          Recolhível: durante o turno o que importa é a loja, e o painel come
          um quarto da largura. Recolhido ele vira uma faixa fina com as
          iniciais, para o jogador não perder de onde reabrir. */}
      <aside
        className={`painel painel--esquerda ${emTurno ? "painel--discreto" : ""} ${
          painelRecolhido ? "painel--recolhido" : ""
        }`}
      >
        <button
          className="painel__alternar"
          onClick={() => setPainelRecolhido((atual) => !atual)}
          title={painelRecolhido ? "Abrir o painel" : "Recolher o painel e ver a loja inteira"}
          aria-expanded={!painelRecolhido}
        >
          {painelRecolhido ? "»" : "«"}
        </button>

        <div className="abas">
          {(["estoque", "equipe", "consultor"] as AbaLateral[]).map((valor) => (
            <div className="aba" key={valor}>
              <button
                className={`btn btn--largo ${aba === valor ? "btn--ativo" : ""}`}
                onClick={() => {
                  // Clicar numa aba com o painel fechado é pedido para abrir.
                  if (painelRecolhido) setPainelRecolhido(false);
                  setAba(valor);
                }}
                title={valor === "estoque" ? "Estoque" : valor === "equipe" ? "Equipe" : "Consultor"}
              >
                <span className="aba__nome">
                  {valor === "estoque" ? "Estoque" : valor === "equipe" ? "Equipe" : "Consultor"}
                </span>
                {/* Recolhido sobra só o ícone: inicial não serve, "Estoque" e
                    "Equipe" começam com a mesma letra. */}
                <span className="aba__icone" aria-hidden="true">
                  <Icone
                    d={valor === "estoque" ? ICONES.caixa : valor === "equipe" ? ICONES.equipe : ICONES.alerta}
                  />
                </span>
              </button>
              {valor === "consultor" && opportunities.length > 0 && (
                <span className="aba__contador">{opportunities.length}</span>
              )}
            </div>
          ))}
        </div>

        {aba === "estoque" && (
          <section className="card">
            <div className="card__cabecalho">
              <h2 className="card__titulo">
                <Icone d={ICONES.caixa} /> Estoque e preços
              </h2>
            </div>
            <div className="lote">
              <span>Lote de compra:</span>
              {LOTES.map((q) => (
                <button
                  key={q}
                  className={`btn btn--pequeno ${lote === q ? "btn--ativo" : ""}`}
                  onClick={() => setLote(q)}
                >
                  {q}
                </button>
              ))}
            </div>
            {produtos.map((p) => {
              const custoLote = p.costPrice * lote;
              const rascunho = rascunhoPreco[p.type];
              return (
                <div className="produto-item" key={p.id}>
                  <div className="produto">
                    <div>
                      <div className="produto__nome">{p.name}</div>
                      <div className="produto__meta">
                        custo {formatarMoeda(p.costPrice)} · margem{" "}
                        {formatarMoeda(p.sellingPrice - p.costPrice)} · vendidos{" "}
                        {p.unitsSold} · demanda {Math.round(p.demand)}%
                      </div>
                      <div className="barra">
                        <div
                          className="barra__preenchimento"
                          style={{ width: `${Math.min(100, p.demand)}%` }}
                        />
                      </div>
                    </div>
                    {/* Dois números porque são dois lugares: o que está à
                        venda e o que ainda precisa ser trazido dos fundos. */}
                    <span className="produto__estoque">
                      <strong
                        className={p.stock < 2 ? "valor--negativo" : "valor--ciano"}
                        title="Na prateleira, pronto para vender"
                      >
                        {p.stock}
                      </strong>
                      <small
                        className={p.storage > 0 ? "valor--alerta" : ""}
                        title="No almoxarifado, esperando reposição"
                      >
                        +{p.storage}
                      </small>
                    </span>
                    <button
                      className="btn btn--pequeno"
                      onClick={() => comprar(p.type, p.name, custoLote)}
                      disabled={gameState.cash < custoLote}
                      title={`Comprar ${lote} por ${formatarMoeda(custoLote)}`}
                    >
                      +{lote}
                    </button>
                  </div>
                  <div className="produto__preco">
                    <span className="linha__rotulo">Preço R$</span>
                    <input
                      className="entrada"
                      type="number"
                      min={p.costPrice}
                      step="1"
                      value={rascunho ?? p.sellingPrice.toFixed(2)}
                      onChange={(e) =>
                        setRascunhoPreco((atual) => ({
                          ...atual,
                          [p.type]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") aplicarPreco(p);
                      }}
                    />
                    <button
                      className="btn btn--pequeno"
                      disabled={rascunho === undefined}
                      onClick={() => aplicarPreco(p)}
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              );
            })}
            <p className="nota">
              A compra sai do caixa na hora. O preço de vitrine é o ponto de
              partida da negociação no balcão.
            </p>
          </section>
        )}

        {aba === "equipe" && (
          <>
            <section className="card">
              <div className="card__cabecalho">
                <h2 className="card__titulo">
                  <Icone d={ICONES.equipe} /> Equipe
                </h2>
                <span className="linha__valor valor--ciano">
                  ânimo {Math.round(gameState.employeeHappinessAvg)}%
                </span>
              </div>
              {funcionarios.map((f) => (
                <div className="funcionario" key={f.id}>
                  <div>
                    <p className="funcionario__nome">{f.name}</p>
                    <p className="funcionario__funcao">
                      {FUNCOES[f.role]} · {formatarMoeda(f.salary)}/mês
                    </p>
                  </div>
                  <div className="funcionario__direita">
                    <span
                      className={`etiqueta ${
                        f.isBusy ? "etiqueta--ocupado" : "etiqueta--livre"
                      }`}
                    >
                      {f.isBusy ? "ocupado" : "livre"}
                    </span>
                    <p className="funcionario__funcao">
                      hab. {Math.round(f.skill)}% · ânimo {Math.round(f.happiness)}%
                    </p>
                  </div>
                </div>
              ))}
              <div className="acoes">
                <button
                  className="btn btn--largo"
                  onClick={() => contratar("seller")}
                  disabled={vagasAuxiliar === 0}
                  title={
                    vagasAuxiliar === 0
                      ? `A loja comporta ${LIMITE_EQUIPE.seller} auxiliares`
                      : `Contratar por ${formatarMoeda(SALARIOS.seller * 2)}`
                  }
                >
                  + Atendente auxiliar ({vagasAuxiliar}/{LIMITE_EQUIPE.seller})
                </button>
                <button
                  className="btn btn--largo"
                  onClick={() => contratar("technician")}
                  disabled={vagasTecnico === 0}
                  title={
                    vagasTecnico === 0
                      ? `A bancada comporta ${LIMITE_EQUIPE.technician} técnicos`
                      : `Contratar por ${formatarMoeda(SALARIOS.technician * 2)}`
                  }
                >
                  + Técnico ({vagasTecnico}/{LIMITE_EQUIPE.technician})
                </button>
                <button className="btn btn--largo" onClick={() => contratar("manager")} disabled={vagasGerente === 0} title={vagasGerente === 0 ? "A loja já tem gerente" : `Contratar por ${formatarMoeda(SALARIOS.manager)}`}>
                  + Gerente ({vagasGerente}/{LIMITE_EQUIPE.manager})
                </button>
                <button className="btn btn--largo" onClick={() => contratar("consultant")} disabled={vagasConsultor === 0} title={vagasConsultor === 0 ? "A loja já tem consultor" : `Contratar por ${formatarMoeda(SALARIOS.consultant)}`}>
                  + Consultor ({vagasConsultor}/{LIMITE_EQUIPE.consultant})
                </button>
              </div>
              <p className="nota">
                A loja comporta {LIMITE_EQUIPE.seller} auxiliares e{" "}
                {LIMITE_EQUIPE.technician} técnicos. O auxiliar fica no balcão:
                fecha venda pelo preço de vitrine, repõe prateleira quando sobra
                tempo e leva/busca aparelho na assistência — assim você pode
                ficar na bancada. O gerente aprova descontos pequenos e todo ágio;
                o consultor libera as recomendações completas.
              </p>
              {gameState.supportTask && (
                <p className="nota valor--positivo">→ {gameState.supportTask}</p>
              )}
            </section>

            <section className="card">
              <div className="card__cabecalho">
                <h2 className="card__titulo">
                  <Icone d={ICONES.dinheiro} /> Finanças
                </h2>
              </div>
              <div className="linha">
                <span className="linha__rotulo">Caixa</span>
                <span
                  className={`linha__valor ${
                    gameState.cash < 0 ? "valor--negativo" : "valor--positivo"
                  }`}
                >
                  {formatarMoeda(gameState.cash)}
                </span>
              </div>
              <div className="linha">
                <span className="linha__rotulo">Receita acumulada</span>
                <span className="linha__valor">
                  {formatarMoeda(gameState.totalRevenue)}
                </span>
              </div>
              <div className="linha">
                <span className="linha__rotulo">Despesas acumuladas</span>
                <span className="linha__valor">
                  {formatarMoeda(gameState.totalExpenses)}
                </span>
              </div>
              <div className="linha">
                <span className="linha__rotulo">Folha mensal</span>
                <span className="linha__valor valor--alerta">
                  {formatarMoeda(funcionarios.reduce((s, f) => s + f.salary, 0))}
                </span>
              </div>
            </section>

            <button
              className={`btn btn--largo ${confirmarReinicio ? "btn--magenta" : ""}`}
              onClick={reiniciar}
            >
              {confirmarReinicio
                ? "Confirmar reinício? (perde o progresso)"
                : "Reiniciar jogo"}
            </button>
          </>
        )}

        {aba === "consultor" && (
          <>
            {!funcionarios.some((f) => f.role === "consultant") && (
              <div className="card"><p className="vazio">Contrate um consultor para receber análise completa, estimativas e ações rápidas. Enquanto isso, ele libera um alerta grave por turno.</p></div>
            )}
            {opportunities.length === 0 ? (
              <div className="card">
                <p className="vazio">
                  Sem apontamentos por enquanto. O consultor analisa o turno
                  enquanto você atende.
                </p>
              </div>
            ) : (
              <>
                <button className="btn btn--largo" onClick={props.onClearOpportunities}>
                  Limpar oportunidades
                </button>
                {opportunities.map((o) => (
                  <OportunidadeCard key={o.id} oportunidade={o} onAcao={(opportunity) => {
                    const resultado = props.onOpportunityAction(opportunity);
                    setAviso({ texto: resultado.message, tipo: resultado.ok ? "ok" : "erro" });
                    return resultado;
                  }} />
                ))}
              </>
            )}
          </>
        )}
      </aside>

      {/* ---------- Painel direito: fila ----------
          Loja vazia não tem fila para mostrar, e um painel com três zeros e um
          "ninguém na loja" só ocupava um terço da tela por cima do salão. Ele
          aparece com o primeiro cliente e some com o último. */}
      {naLoja.length > 0 && (
        <aside className="painel painel--direita">
          <div className="card card--magenta">
            <div className="card__cabecalho">
              <h2 className="card__titulo">
                <Icone d={ICONES.raio} /> Fila
              </h2>
              <span className="linha__valor">{aguardando.length}</span>
            </div>
            <div className="linha">
              <span className="linha__rotulo">Em reparo</span>
              <span className="linha__valor valor--ciano">{emReparo.length}</span>
            </div>
            <div className="linha">
              <span className="linha__rotulo">Perdidos (total)</span>
              <span className="linha__valor valor--negativo">
                {gameState.missedSales + gameState.missedRepairs}
              </span>
            </div>
          </div>

          {naLoja.map((c) => (
            <CartaoFila
              key={c.id}
              cliente={c}
              selecionado={c.id === idSelecionado}
              produto={c.needsProduct ? gameState.products.get(c.needsProduct) : undefined}
              onSelecionar={selecionar}
            />
          ))}
        </aside>
      )}

      {/* ---------- Fechamento ---------- */}
      {fase === "summary" && !resumoFechado && (
        <ModalFechamento
          relatorio={shiftReport}
          temRelatorio={capacidades.relatorio}
          podeContinuar={capacidades.iniciarTurno}
          caixa={gameState.cash}
          melhorias={props.upgradesOferecidos}
          upgrades={gameState.upgrades}
          onComprar={props.onUpgrade}
          proximoDia={dia}
          onContinuar={props.onStartShift}
          onPreparar={() => setResumoFechado(true)}
        />
      )}

      {aviso && (
        <div className={`aviso ${aviso.tipo === "ok" ? "aviso--ok" : "aviso--erro"}`}>
          {aviso.texto}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */

function PostoAtendimento({
  cliente,
  produto,
  onVender,
  onAceitarReparo,
  onRecusar,
}: {
  cliente: Customer;
  produto?: Product;
  onVender: (cliente: Customer, preco: number) => void;
  onAceitarReparo: (id: string) => void;
  onRecusar: (id: string) => void;
}) {
  const paciencia = Math.round(cliente.patience);
  const classePaciencia =
    paciencia > 60 ? "ok" : paciencia > 30 ? "alerta" : "critico";
  const precoVitrine = produto?.sellingPrice ?? 0;
  const semEstoque = produto ? produto.stock <= 0 : false;

  // O valor de fechamento é calculado, não digitado. Havia um campo de texto
  // aqui e ele era teatro: o preço certo é sempre um só — a vitrine quando o
  // cliente paga, o orçamento dele quando não paga (desconto) e o orçamento
  // também quando ele topa pagar bem acima (ágio). Digitar qualquer outra
  // coisa só rendia recusa do núcleo.
  const abaixoDaVitrine = cliente.budget < precoVitrine;
  // Mesma faixa de 8% que o núcleo usa para separar venda direta de ágio.
  const acimaDaVitrine = cliente.budget > precoVitrine * 1.08;
  const precoFechamento = abaixoDaVitrine || acimaDaVitrine ? cliente.budget : precoVitrine;
  const diferenca =
    precoVitrine > 0 ? Math.round(((precoFechamento - precoVitrine) / precoVitrine) * 100) : 0;
  const rotuloVenda = abaixoDaVitrine
    ? `Aprovar ${formatarMoeda(precoFechamento)}`
    : acimaDaVitrine
      ? `Aprovar ágio ${formatarMoeda(precoFechamento)}`
      : `Vender por ${formatarMoeda(precoFechamento)}`;

  return (
    <section className={`palco__card posto posto--${cliente.urgency}`}>
      <header className="posto__topo">
        <div>
          <p className="palco__etiqueta">No balcão</p>
          <h2 className="palco__titulo">{cliente.name}</h2>
        </div>
        <span className={`urgencia urgencia--${cliente.urgency}`}>
          {URGENCIA[cliente.urgency]}
        </span>
      </header>

      {cliente.story && <p className="posto__historia">“{cliente.story}”</p>}

      <div className="posto__paciencia">
        <div className="barra barra--paciencia">
          <div
            className={`barra__preenchimento barra__preenchimento--${classePaciencia}`}
            style={{ width: `${paciencia}%` }}
          />
        </div>
        <span className="posto__paciencia-texto">paciência {paciencia}%</span>
      </div>

      {cliente.needsProduct && (
        <>
          {/* Uma linha em vez de quatro caixas: o cartão fica pequeno e a loja
              continua à vista atrás dele. */}
          <dl className="ficha">
            <div className="ficha__item">
              <dt>Quer</dt>
              <dd>{produto?.name ?? cliente.needsProduct}</dd>
            </div>
            <div className="ficha__item">
              <dt>Vitrine</dt>
              <dd className="valor--ciano">{formatarMoeda(precoVitrine)}</dd>
            </div>
            <div className="ficha__item">
              <dt>Paga até</dt>
              <dd
                className={
                  cliente.budget >= precoVitrine ? "valor--positivo" : "valor--negativo"
                }
              >
                {formatarMoeda(cliente.budget)}
              </dd>
            </div>
            <div className="ficha__item">
              <dt>Prateleira</dt>
              <dd className={semEstoque ? "valor--negativo" : ""}>
                {produto?.stock ?? 0}
              </dd>
            </div>
          </dl>

          <div className="posto__acoes">
            <button
              className="btn btn--sucesso btn--fechar"
              disabled={semEstoque}
              title={semEstoque ? "Sem estoque na prateleira" : undefined}
              onClick={() => onVender(cliente, precoFechamento)}
            >
              {rotuloVenda}
              {diferenca !== 0 && (
                <span className={`posto__variacao ${diferenca > 0 ? "valor--positivo" : "valor--negativo"}`}>
                  {diferenca > 0 ? "+" : ""}
                  {diferenca}% da vitrine
                </span>
              )}
            </button>
            <button className="btn" onClick={() => onRecusar(cliente.id)}>
              Dispensar
            </button>
          </div>
        </>
      )}

      {cliente.needsService && (
        <>
          <dl className="ficha">
            <div className="ficha__item">
              <dt>Precisa de</dt>
              <dd>Assistência técnica</dd>
            </div>
            <div className="ficha__item">
              <dt>Situação</dt>
              <dd>{STATUS_CLIENTE[cliente.status]}</dd>
            </div>
          </dl>
          <div className="posto__acoes">
            <button
              className="btn btn--gigante btn--sucesso"
              onClick={() => onAceitarReparo(cliente.id)}
            >
              Receber aparelho
            </button>
            <button className="btn" onClick={() => onRecusar(cliente.id)}>
              Dispensar
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function AprovacaoDeDesconto({
  pedido,
  onAprovar,
  onRecusar,
}: {
  pedido: PedidoDesconto;
  onAprovar: () => void;
  onRecusar: () => void;
}) {
  const agio = pedido.tipo === "premium";
  const desconto = pedido.precoVitrine - pedido.precoCliente;
  const percentual =
    pedido.precoVitrine > 0 ? (desconto / pedido.precoVitrine) * 100 : 0;

  return (
    <section className="palco__card aprovacao">
      <header className="posto__topo">
        <div>
          <p className="palco__etiqueta">Precisa da sua aprovação</p>
          <h2 className="palco__titulo">{agio ? "Ágio" : "Desconto"} no {pedido.produto}</h2>
        </div>
        <span className="urgencia urgencia--high">{agio ? "+" : "-"}{Math.round(Math.abs(percentual))}%</span>
      </header>

      <p className="palco__texto">
        {pedido.pedidoPor
          ? `${pedido.pedidoPor} está no balcão com ${pedido.customerName}, ${agio ? "que aceita pagar acima da vitrine" : "que não paga o preço de vitrine"}, e espera seu aval.`
          : `${pedido.customerName} ${agio ? "aceita pagar acima da vitrine" : "não paga o preço de vitrine"}. O atendente está com o item na mão, esperando você decidir.`}
      </p>

      <div className="posto__pedido">
        <div className="kpi">
          <span className="kpi__rotulo">Preço de vitrine</span>
          <strong className="kpi__valor">{formatarMoeda(pedido.precoVitrine)}</strong>
        </div>
        <div className="kpi">
          <span className="kpi__rotulo">O cliente paga</span>
          <strong className="kpi__valor valor--alerta">
            {formatarMoeda(pedido.precoCliente)}
          </strong>
        </div>
        <div className="kpi">
          <span className="kpi__rotulo">{agio ? "Você ganha a mais" : "Você abre mão de"}</span>
          <strong className={`kpi__valor ${agio ? "valor--positivo" : "valor--negativo"}`}>
            {formatarMoeda(Math.abs(desconto))}
          </strong>
        </div>
      </div>

      <div className="posto__acoes">
        <button className="btn btn--gigante btn--sucesso" onClick={onAprovar}>
          Aprovar por {formatarMoeda(pedido.precoCliente)}
        </button>
        <button className="btn" onClick={onRecusar}>
          {agio ? "Manter vitrine" : "Manter preço"}
        </button>
      </div>
    </section>
  );
}

function CartaoFila({
  cliente,
  selecionado,
  produto,
  onSelecionar,
}: {
  cliente: Customer;
  selecionado: boolean;
  produto?: Product;
  onSelecionar: (id: string) => void;
}) {
  const paciencia = Math.round(cliente.patience);
  const classePaciencia =
    paciencia > 60 ? "ok" : paciencia > 30 ? "alerta" : "critico";
  const atendivel = cliente.status === "waiting";

  return (
    <button
      className={`cliente cliente--botao ${selecionado ? "cliente--selecionado" : ""}`}
      onClick={() => onSelecionar(cliente.id)}
      disabled={!atendivel}
    >
      <span className="cliente__topo">
        <span className="cliente__nome">{cliente.name}</span>
        <span className={`urgencia urgencia--${cliente.urgency}`}>
          {URGENCIA[cliente.urgency]}
        </span>
      </span>
      <span className="cliente__detalhe">
        {cliente.needsProduct
          ? `Quer ${produto?.name ?? cliente.needsProduct} · até ${formatarMoeda(cliente.budget)}`
          : "Traz um equipamento para reparo"}
      </span>
      <span className="cliente__detalhe">{STATUS_CLIENTE[cliente.status]}</span>
      <span className="barra barra--paciencia">
        <span
          className={`barra__preenchimento barra__preenchimento--${classePaciencia}`}
          style={{ width: `${paciencia}%` }}
        />
      </span>
    </button>
  );
}

function OportunidadeCard({ oportunidade, onAcao }: { oportunidade: Opportunity; onAcao: (opportunity: Opportunity) => ActionResult }) {
  const gravidade =
    oportunidade.severity === "high"
      ? "Urgente"
      : oportunidade.severity === "medium"
        ? "Atenção"
        : "Ideia";

  return (
    <article className={`oportunidade oportunidade--${oportunidade.severity}`}>
      <div className="oportunidade__topo">
        <h3 className="oportunidade__titulo">
          <Icone d={ICONES.alerta} /> {oportunidade.title}
        </h3>
        <span className={`gravidade gravidade--${oportunidade.severity}`}>
          {gravidade}
        </span>
      </div>
      <p className="oportunidade__descricao">{oportunidade.description}</p>
      <div className="linha">
        <span className="linha__rotulo">Impacto estimado</span>
        <span className="linha__valor valor--positivo">
          {formatarMoeda(oportunidade.potentialProfit)}
        </span>
      </div>
      <p className="oportunidade__acao">→ {oportunidade.recommendation}</p>
      {oportunidade.acao && <button className="btn" onClick={() => onAcao(oportunidade)}>{oportunidade.acao.rotulo}</button>}
    </article>
  );
}

function ModalFechamento({
  relatorio,
  temRelatorio,
  podeContinuar,
  proximoDia,
  caixa,
  melhorias,
  upgrades,
  onComprar,
  onContinuar,
  onPreparar,
}: {
  relatorio: ShiftReport | null;
  temRelatorio: boolean;
  podeContinuar: boolean;
  proximoDia: number;
  caixa: number;
  melhorias: OfertaDeMelhoria[];
  upgrades: Upgrade["id"][];
  onComprar: (id: Upgrade["id"]) => ActionResult;
  onContinuar: () => void;
  onPreparar: () => void;
}) {
  return (
    <div className="fechamento">
      <section className="fechamento__card">
        <p className="palco__etiqueta">Fim do turno</p>
        <h2 className="palco__titulo">
          {relatorio
            ? relatorio.goalReached
              ? `Dia ${relatorio.day}: meta batida`
              : `Dia ${relatorio.day}: meta não batida`
            : "Turno encerrado"}
        </h2>

        {relatorio ? (
          <>
            <div className="fechamento__kpis">
              <div className="kpi">
                <span className="kpi__rotulo">Receita</span>
                <strong className="kpi__valor valor--ciano">
                  {formatarMoeda(relatorio.revenue)}
                </strong>
              </div>
              <div className="kpi">
                <span className="kpi__rotulo">Lucro</span>
                <strong
                  className={`kpi__valor ${
                    relatorio.profit < 0 ? "valor--negativo" : "valor--positivo"
                  }`}
                >
                  {formatarMoeda(relatorio.profit)}
                </strong>
              </div>
              <div className="kpi">
                <span className="kpi__rotulo">Meta</span>
                <strong className="kpi__valor">{formatarMoeda(relatorio.goal)}</strong>
              </div>
              <div className="kpi">
                <span className="kpi__rotulo">Vendas</span>
                <strong className="kpi__valor">{relatorio.sales}</strong>
              </div>
              <div className="kpi">
                <span className="kpi__rotulo">Reparos</span>
                <strong className="kpi__valor">{relatorio.repairs}</strong>
              </div>
              <div className="kpi">
                <span className="kpi__rotulo">Clientes perdidos</span>
                <strong className="kpi__valor valor--negativo">
                  {relatorio.customersLost}
                </strong>
              </div>
              {/* A folha sai do caixa no fechamento; dinheiro que some sem
                  aparecer é justamente o que o CLAUDE.md proíbe. */}
              <div className="kpi">
                <span className="kpi__rotulo">Folha do dia</span>
                <strong className={`kpi__valor ${relatorio.folha > 0 ? "valor--negativo" : ""}`}>
                  {relatorio.folha > 0 ? `-${formatarMoeda(relatorio.folha)}` : "sem equipe"}
                </strong>
              </div>
              <div className="kpi">
                <span className="kpi__rotulo">Reputação</span>
                <strong
                  className={`kpi__valor ${
                    relatorio.reputationChange < 0
                      ? "valor--negativo"
                      : "valor--positivo"
                  }`}
                >
                  {relatorio.reputationChange >= 0 ? "+" : ""}
                  {Math.round(relatorio.reputationChange)}
                </strong>
              </div>
            </div>

            {/* O núcleo publica o que aconteceu de marcante no turno — inclusive
                o que ficou pendente na assistência. */}
            {relatorio.highlights && relatorio.highlights.length > 0 && (
              <ul className="fechamento__destaques">
                {relatorio.highlights.map((destaque, i) => (
                  <li key={i}>{destaque}</li>
                ))}
              </ul>
            )}

            {relatorio.topOpportunity && (
              <article className="oportunidade oportunidade--high fechamento__dica">
                <div className="oportunidade__topo">
                  <h3 className="oportunidade__titulo">
                    <Icone d={ICONES.estrela} /> {relatorio.topOpportunity.title}
                  </h3>
                </div>
                <p className="oportunidade__descricao">
                  {relatorio.topOpportunity.description}
                </p>
                <p className="oportunidade__acao">
                  → {relatorio.topOpportunity.recommendation}
                </p>
              </article>
            )}
            {melhorias.length > 0 ? (
              <div className="fechamento__melhorias">
                <p className="palco__etiqueta">Escolha uma melhoria permanente</p>
                <div className="fechamento__kpis">
                  {melhorias.map((melhoria) => (
                    <article className={`kpi kpi--oferta kpi--oferta-${melhoria.motivo}`} key={melhoria.id}>
                      {/* O selo diz por que este cartão está aqui: sem isso as
                          três opções parecem sorteio puro e a recomendação do
                          consultor se perde no meio. */}
                      <span className="oferta__selo">{SELO_DA_OFERTA[melhoria.motivo]}</span>
                      <strong className="kpi__valor">{melhoria.nome}</strong>
                      <span className="kpi__rotulo">{melhoria.descricao}</span>
                      {melhoria.justificativa && (
                        <span className="oferta__motivo">{melhoria.justificativa}</span>
                      )}
                      <span className="kpi__rotulo">{formatarMoeda(melhoria.custo)}</span>
                      <button className="btn" disabled={caixa < melhoria.custo} title={caixa < melhoria.custo ? "Caixa insuficiente" : undefined} onClick={() => onComprar(melhoria.id)}>Comprar</button>
                    </article>
                  ))}
                </div>
              </div>
            ) : upgrades.length > 0 ? <p className="palco__texto">Melhoria do dia: instalada.</p> : null}
          </>
        ) : (
          <p className="palco__texto">
            {temRelatorio
              ? "O núcleo não devolveu números para este turno."
              : "O relatório do turno ainda não está disponível no GameWorld (getShiftReport)."}
          </p>
        )}

        <div className="fechamento__acoes">
          <button className="btn btn--gigante" onClick={onPreparar}>
            Repor estoque antes
          </button>
          <button
            className="btn btn--gigante btn--sucesso"
            onClick={onContinuar}
            disabled={!podeContinuar}
          >
            Abrir o dia {proximoDia}
          </button>
        </div>
      </section>
    </div>
  );
}

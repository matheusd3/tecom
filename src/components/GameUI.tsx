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
  Opportunity,
  Product,
  ProductType,
  ShiftReport,
} from "@/game/types";

/** O que o núcleo já expõe. Enquanto o Codex termina, a interface se adapta. */
export interface Capacidades {
  iniciarTurno: boolean;
  selecionarCliente: boolean;
  relatorio: boolean;
}

interface GameUIProps {
  gameState: GameState | null;
  opportunities: Opportunity[];
  shiftReport: ShiftReport | null;
  capacidades: Capacidades;
  /** Onde o atendente está parado na loja 3D. */
  playerStation: PlayerStation;
  /** O que ele está carregando na mão, se estiver carregando algo. */
  carriedProductName?: string;
  /** Resposta da última interação feita pela tecla E dentro da loja. */
  mapAction: ActionResult | null;
  onStartShift: () => void;
  onSelectCustomer: (id: string) => void;
  onSell: (id: string, preco: number) => ActionResult;
  onAcceptRepair: (id: string) => ActionResult;
  onDecline: (id: string) => ActionResult;
  onTogglePause: () => void;
  onTimeSpeedChange: (velocidade: number) => void;
  onBuyStock: (tipo: ProductType, quantidade: number) => boolean;
  onSetPrice: (tipo: ProductType, preco: number) => boolean;
  onHire: (funcao: EmployeeRole, nome: string) => boolean;
  onClearOpportunities: () => void;
  onReset: () => void;
}

type AbaLateral = "estoque" | "equipe" | "consultor";
type Aviso = { texto: string; tipo: "ok" | "erro" } | null;

const VELOCIDADES = [0.5, 1, 2, 4];
const LOTES = [5, 10, 20];

const SALARIOS: Record<EmployeeRole, number> = {
  seller: 2000,
  technician: 2500,
  manager: 3000,
};

const FUNCOES: Record<EmployeeRole, string> = {
  seller: "Vendedor",
  technician: "Técnico",
  manager: "Gerente",
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
  estoque: "nas prateleiras",
  assistencia: "na bancada técnica",
  loja: "andando pela loja",
};

/** Chegar numa estação abre o painel que serve para agir ali. */
const ABA_DA_ESTACAO: Partial<Record<PlayerStation, AbaLateral>> = {
  estoque: "estoque",
  assistencia: "equipe",
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
  const [oferta, setOferta] = useState<string | null>(null);
  const [selecaoLocal, setSelecaoLocal] = useState<string | null>(null);
  const [confirmarReinicio, setConfirmarReinicio] = useState(false);
  // O fechamento pode ser dispensado para o jogador repor estoque antes de
  // abrir o dia seguinte: o núcleo vai direto de "summary" para o turno novo.
  const [resumoFechado, setResumoFechado] = useState(false);

  const diaDoRelatorio = shiftReport?.day;
  useEffect(() => {
    setResumoFechado(false);
  }, [diaDoRelatorio]);

  useEffect(() => {
    const alvo = ABA_DA_ESTACAO[estacao];
    if (alvo) setAba(alvo);
  }, [estacao]);

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

  const fase = faseDe(gameState.phase);
  const dia = numero(gameState.day, 1);
  const duracao = numero(gameState.shiftDuration, 120);
  const restante = numero(gameState.shiftTimeRemaining, duracao);
  const meta = numero(gameState.dailyGoal);
  const reputacao = numero(gameState.reputation, 50);

  const naLoja = clientes.filter((c) => c.status !== "leaving");
  const aguardando = naLoja.filter((c) => c.status === "waiting");
  const emReparo = naLoja.filter((c) => c.status === "repairing");

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
    setOferta(null);
    if (capacidades.selecionarCliente) props.onSelectCustomer(id);
  };

  const aplicarResultado = (r: ActionResult) => {
    setAviso({ texto: r.message, tipo: r.ok ? "ok" : "erro" });
    if (r.ok) setOferta(null);
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

  const aplicarPreco = (tipo: ProductType, nome: string, custoUnitario: number) => {
    const texto = (rascunhoPreco[tipo] ?? "").replace(",", ".");
    const valor = Number(texto);
    if (!texto || !Number.isFinite(valor)) {
      setAviso({ texto: "Informe um preço válido.", tipo: "erro" });
      return;
    }
    if (props.onSetPrice(tipo, valor)) {
      setRascunhoPreco((atual) => ({ ...atual, [tipo]: undefined }));
      setAviso({ texto: `${nome} agora custa ${formatarMoeda(valor)}`, tipo: "ok" });
    } else {
      setAviso({
        texto: `Preço recusado: precisa ser no mínimo o custo (${formatarMoeda(custoUnitario)}).`,
        tipo: "erro",
      });
    }
  };

  const contratar = (funcao: EmployeeRole) => {
    const nome = nomeParaContratacao(funcionarios.length);
    const entrada = SALARIOS[funcao] * 2;
    const ok = props.onHire(funcao, nome);
    setAviso(
      ok
        ? { texto: `${nome} contratado(a) por ${formatarMoeda(entrada)}`, tipo: "ok" }
        : {
            texto: `Contratação exige ${formatarMoeda(entrada)} em caixa (2 salários).`,
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
    <div className={`ui-root fase-${fase}`}>
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
        {/* Carregando algo, o próximo passo é o que mais importa na tela. */}
        {props.carriedProductName && (
          <span className="carga-atual">
            carregando <strong>{props.carriedProductName}</strong> ·{" "}
            {props.carriedProductName.startsWith("aparelho")
              ? "leve à bancada"
              : "leve ao balcão"}
          </span>
        )}
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

        {emTurno &&
          (selecionado ? (
            <PostoAtendimento
              cliente={selecionado}
              produto={
                selecionado.needsProduct
                  ? gameState.products.get(selecionado.needsProduct)
                  : undefined
              }
              oferta={oferta}
              onOferta={setOferta}
              onVender={vender}
              onAceitarReparo={(id) => aplicarResultado(props.onAcceptRepair(id))}
              onRecusar={(id) => aplicarResultado(props.onDecline(id))}
            />
          ) : (
            <section className="palco__card palco__card--vazio">
              <h2 className="palco__titulo">Balcão livre</h2>
              <p className="palco__texto">
                Ninguém esperando agora. Aproveite para repor estoque — o próximo
                cliente entra a qualquer momento.
              </p>
            </section>
          ))}
      </main>

      {/* ---------- Painel esquerdo: preparação ---------- */}
      <aside className={`painel painel--esquerda ${emTurno ? "painel--discreto" : ""}`}>
        <div className="abas">
          {(["estoque", "equipe", "consultor"] as AbaLateral[]).map((valor) => (
            <div className="aba" key={valor}>
              <button
                className={`btn btn--largo ${aba === valor ? "btn--ativo" : ""}`}
                onClick={() => setAba(valor)}
              >
                {valor === "estoque"
                  ? "Estoque"
                  : valor === "equipe"
                    ? "Equipe"
                    : "Consultor"}
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
                    <span
                      className={`produto__estoque ${
                        p.stock < 2 ? "valor--negativo" : "valor--ciano"
                      }`}
                    >
                      {p.stock}
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
                        if (e.key === "Enter") aplicarPreco(p.type, p.name, p.costPrice);
                      }}
                    />
                    <button
                      className="btn btn--pequeno"
                      disabled={rascunho === undefined}
                      onClick={() => aplicarPreco(p.type, p.name, p.costPrice)}
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
                <button className="btn btn--largo" onClick={() => contratar("seller")}>
                  + Atendente auxiliar ({formatarMoeda(SALARIOS.seller * 2)})
                </button>
                <button
                  className="btn btn--largo"
                  onClick={() => contratar("technician")}
                >
                  + Técnico ({formatarMoeda(SALARIOS.technician * 2)})
                </button>
              </div>
              <p className="nota">
                Um atendente auxiliar leva aparelhos à assistência e devolve
                reparos prontos automaticamente. Técnico assume o conserto.
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
                  <OportunidadeCard key={o.id} oportunidade={o} />
                ))}
              </>
            )}
          </>
        )}
      </aside>

      {/* ---------- Painel direito: fila ---------- */}
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

        {naLoja.length === 0 ? (
          <div className="card card--magenta">
            <p className="vazio">
              {emTurno
                ? "Ninguém na loja neste instante."
                : "A loja abre quando você iniciar o turno."}
            </p>
          </div>
        ) : (
          naLoja.map((c) => (
            <CartaoFila
              key={c.id}
              cliente={c}
              selecionado={c.id === idSelecionado}
              produto={c.needsProduct ? gameState.products.get(c.needsProduct) : undefined}
              onSelecionar={selecionar}
            />
          ))
        )}
      </aside>

      {/* ---------- Fechamento ---------- */}
      {fase === "summary" && !resumoFechado && (
        <ModalFechamento
          relatorio={shiftReport}
          temRelatorio={capacidades.relatorio}
          podeContinuar={capacidades.iniciarTurno}
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
  oferta,
  onOferta,
  onVender,
  onAceitarReparo,
  onRecusar,
}: {
  cliente: Customer;
  produto?: Product;
  oferta: string | null;
  onOferta: (valor: string | null) => void;
  onVender: (cliente: Customer, preco: number) => void;
  onAceitarReparo: (id: string) => void;
  onRecusar: (id: string) => void;
}) {
  const paciencia = Math.round(cliente.patience);
  const classePaciencia =
    paciencia > 60 ? "ok" : paciencia > 30 ? "alerta" : "critico";
  const precoVitrine = produto?.sellingPrice ?? 0;
  const valorOferta = Number((oferta ?? String(precoVitrine)).replace(",", "."));
  const ofertaValida = Number.isFinite(valorOferta) && valorOferta > 0;
  const semEstoque = produto ? produto.stock <= 0 : false;

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
          <div className="posto__pedido">
            <div className="kpi">
              <span className="kpi__rotulo">Quer levar</span>
              <strong className="kpi__valor">
                {produto?.name ?? cliente.needsProduct}
              </strong>
            </div>
            <div className="kpi">
              <span className="kpi__rotulo">Preço de vitrine</span>
              <strong className="kpi__valor valor--ciano">
                {formatarMoeda(precoVitrine)}
              </strong>
            </div>
            <div className="kpi">
              <span className="kpi__rotulo">Aceita pagar até</span>
              <strong
                className={`kpi__valor ${
                  cliente.budget >= precoVitrine ? "valor--positivo" : "valor--negativo"
                }`}
              >
                {formatarMoeda(cliente.budget)}
              </strong>
            </div>
            <div className="kpi">
              <span className="kpi__rotulo">Em estoque</span>
              <strong
                className={`kpi__valor ${semEstoque ? "valor--negativo" : ""}`}
              >
                {produto?.stock ?? 0}
              </strong>
            </div>
          </div>

          <div className="posto__oferta">
            <span className="linha__rotulo">Fechar por R$</span>
            <input
              className="entrada"
              type="number"
              step="1"
              min={0}
              value={oferta ?? precoVitrine.toFixed(2)}
              onChange={(e) => onOferta(e.target.value)}
            />
            <button
              className="btn btn--pequeno"
              onClick={() => onOferta(cliente.budget.toFixed(2))}
              title="Igualar ao limite do cliente"
            >
              = orçamento
            </button>
          </div>

          <div className="posto__acoes">
            <button
              className="btn btn--gigante btn--sucesso"
              disabled={!ofertaValida}
              onClick={() => onVender(cliente, valorOferta)}
            >
              Vender por {formatarMoeda(ofertaValida ? valorOferta : 0)}
            </button>
            <button className="btn" onClick={() => onRecusar(cliente.id)}>
              Dispensar
            </button>
          </div>
        </>
      )}

      {cliente.needsService && (
        <>
          <div className="posto__pedido">
            <div className="kpi">
              <span className="kpi__rotulo">Precisa de</span>
              <strong className="kpi__valor">Assistência técnica</strong>
            </div>
            <div className="kpi">
              <span className="kpi__rotulo">Situação</span>
              <strong className="kpi__valor">{STATUS_CLIENTE[cliente.status]}</strong>
            </div>
          </div>
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

function OportunidadeCard({ oportunidade }: { oportunidade: Opportunity }) {
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
    </article>
  );
}

function ModalFechamento({
  relatorio,
  temRelatorio,
  podeContinuar,
  proximoDia,
  onContinuar,
  onPreparar,
}: {
  relatorio: ShiftReport | null;
  temRelatorio: boolean;
  podeContinuar: boolean;
  proximoDia: number;
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

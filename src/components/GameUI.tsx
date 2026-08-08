// GameUI.tsx — dashboard do jogo sobreposto ao canvas Babylon.
// Sem dependências de UI externas: só React + styles.css.

import { useEffect, useState } from "react";
import type {
  Customer,
  CustomerStatus,
  EmployeeRole,
  GameState,
  Opportunity,
  ProductType,
} from "@/game/types";

interface GameUIProps {
  gameState: GameState | null;
  opportunities: Opportunity[];
  onTogglePause: () => void;
  onTimeSpeedChange: (velocidade: number) => void;
  onBuyStock: (tipo: ProductType, quantidade: number) => boolean;
  onSetPrice: (tipo: ProductType, preco: number) => boolean;
  onHire: (funcao: EmployeeRole, nome: string) => boolean;
  onSellToCustomer: (clienteId: string, preco: number) => { ok: boolean; message: string };
  onAcceptRepair: (clienteId: string) => { ok: boolean; message: string };
  onDeclineCustomer: (clienteId: string) => { ok: boolean; message: string };
  onClearOpportunities: () => void;
  onReset: () => void;
}

type Aba = "painel" | "oportunidades";
type Aviso = { texto: string; tipo: "ok" | "erro" } | null;

const VELOCIDADES = [0.5, 1, 2, 4];
const LOTES = [5, 10, 20];

// Escala de tempo do GameWorld: 1 dia de jogo = 8 minutos = 480 s.
const SEGUNDOS_POR_DIA = 480;
const SEGUNDOS_POR_HORA = SEGUNDOS_POR_DIA / 24;

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

export function GameUI({
  gameState,
  opportunities,
  onTogglePause,
  onTimeSpeedChange,
  onBuyStock,
  onSetPrice,
  onHire,
  onSellToCustomer,
  onAcceptRepair,
  onDeclineCustomer,
  onClearOpportunities,
  onReset,
}: GameUIProps) {
  const [aba, setAba] = useState<Aba>("painel");
  const [lote, setLote] = useState(5);
  const [aviso, setAviso] = useState<Aviso>(null);
  // Preço em edição por produto; enquanto houver rascunho, o campo não é
  // sobrescrito pelas atualizações da simulação.
  const [rascunhoPreco, setRascunhoPreco] = useState<Partial<Record<ProductType, string>>>({});
  const [confirmarReinicio, setConfirmarReinicio] = useState(false);

  // O aviso some sozinho depois de 2,5 s.
  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 2500);
    return () => window.clearTimeout(t);
  }, [aviso]);

  // A confirmação de reinício expira sozinha para não ficar armada por engano.
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

  const dia = Math.floor(gameState.time / SEGUNDOS_POR_DIA) + 1;
  const segundosNoDia = gameState.time % SEGUNDOS_POR_DIA;
  const hora = Math.floor(segundosNoDia / SEGUNDOS_POR_HORA);
  // Sem os minutos o relógio só mudaria a cada 20 s reais em 1x.
  const minuto = Math.floor(((segundosNoDia % SEGUNDOS_POR_HORA) / SEGUNDOS_POR_HORA) * 60);

  const naLoja = clientes.filter((c) => c.status !== "leaving");
  const aguardandoVenda = naLoja.filter(
    (c) => c.status === "waiting" && c.needsProduct
  ).length;
  const aguardandoReparo = naLoja.filter(
    (c) => c.status === "waiting" && c.needsService
  ).length;
  const clientePendente = naLoja.find((c) => c.status === "waiting");

  const reparosAbertos = gameState.repairs.filter((r) => !r.completed);
  const reparosConcluidos = gameState.repairs.filter((r) => r.completed);
  const lucroReparos = reparosConcluidos.reduce((s, r) => s + r.profit, 0);
  const lucroVendas = gameState.sales.reduce((s, v) => s + v.profit, 0);
  const folha = funcionarios.reduce((s, f) => s + f.salary, 0);
  const ultimasVendas = gameState.sales.slice(-5).reverse();

  const comprar = (tipo: ProductType, nome: string, custo: number) => {
    const ok = onBuyStock(tipo, lote);
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
    const ok = onSetPrice(tipo, valor);
    if (ok) {
      setRascunhoPreco((atual) => ({ ...atual, [tipo]: undefined }));
      setAviso({
        texto: `${nome} agora custa ${formatarMoeda(valor)}`,
        tipo: "ok",
      });
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
    const ok = onHire(funcao, nome);
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
    onReset();
    setAviso({ texto: "Jogo reiniciado.", tipo: "ok" });
  };

  const registrarResultado = (resultado: { ok: boolean; message: string }) => {
    setAviso({ texto: resultado.message, tipo: resultado.ok ? "ok" : "erro" });
  };

  return (
    <div className="ui-root">
      {/* ---------- Barra superior ---------- */}
      <header className="topbar">
        <div className="marca">
          <div className="marca__selo">$</div>
          <div>
            <h1 className="marca__titulo">TECH STORE TYCOON</h1>
            <p className="marca__relogio">
              Dia {dia} · {String(hora).padStart(2, "0")}:
              {String(minuto).padStart(2, "0")} ·{" "}
              {gameState.isPaused ? "pausado" : `${gameState.timeSpeed}x`}
            </p>
          </div>
        </div>

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
            <span className="resumo-item__rotulo">Na loja</span>
            <span className="resumo-item__valor valor--ciano">{naLoja.length}</span>
          </div>
          <div className="resumo-item">
            <span className="resumo-item__rotulo">Alertas</span>
            <span className="resumo-item__valor valor--alerta">
              {opportunities.length}
            </span>
          </div>
        </div>

        <div className="controles-tempo">
          <button className="btn" onClick={onTogglePause}>
            <Icone d={gameState.isPaused ? ICONES.play : ICONES.pause} />
            {gameState.isPaused ? "Retomar" : "Pausar"}
          </button>
          {VELOCIDADES.map((v) => (
            <button
              key={v}
              className={`btn btn--pequeno ${
                gameState.timeSpeed === v ? "btn--ativo" : ""
              }`}
              onClick={() => onTimeSpeedChange(v)}
            >
              {v}x
            </button>
          ))}
        </div>
      </header>

      {/* Cada chegada exige uma decisão. O relógio pausa até o jogador escolher. */}
      <main className="mesa-atendimento">
        {clientePendente ? (
          <AtendimentoCard
            cliente={clientePendente}
            produto={
              clientePendente.needsProduct
                ? gameState.products.get(clientePendente.needsProduct)
                : undefined
            }
            onSell={(preco) => registrarResultado(onSellToCustomer(clientePendente.id, preco))}
            onAcceptRepair={() => registrarResultado(onAcceptRepair(clientePendente.id))}
            onDecline={() => registrarResultado(onDeclineCustomer(clientePendente.id))}
          />
        ) : (
          <div className="mesa-atendimento__vazia">
            <strong>{gameState.isPaused ? "Tudo resolvido." : "Loja aberta."}</strong>
            <span>{gameState.isPaused ? "Retome o relógio para receber o próximo cliente." : "Aguardando o próximo cliente."}</span>
          </div>
        )}
      </main>

      {/* ---------- Painel esquerdo ---------- */}
      <aside className="painel painel--esquerda">
        <div className="abas">
          <div className="aba">
            <button
              className={`btn btn--largo ${aba === "painel" ? "btn--ativo" : ""}`}
              onClick={() => setAba("painel")}
            >
              Painel
            </button>
          </div>
          <div className="aba">
            <button
              className={`btn btn--largo ${
                aba === "oportunidades" ? "btn--ativo" : ""
              }`}
              onClick={() => setAba("oportunidades")}
            >
              Oportunidades
            </button>
            {opportunities.length > 0 && (
              <span className="aba__contador">{opportunities.length}</span>
            )}
          </div>
        </div>

        {aba === "painel" && (
          <>
            {/* Finanças */}
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
                <span className="linha__rotulo">Receita do mês</span>
                <span className="linha__valor valor--positivo">
                  {formatarMoeda(gameState.monthlyRevenue)}
                </span>
              </div>
              <div className="linha">
                <span className="linha__rotulo">Despesas do mês</span>
                <span className="linha__valor valor--negativo">
                  {formatarMoeda(gameState.monthlyExpenses)}
                </span>
              </div>
              <div className="linha">
                <span className="linha__rotulo">Resultado do mês</span>
                <span
                  className={`linha__valor ${
                    gameState.monthlyRevenue - gameState.monthlyExpenses < 0
                      ? "valor--negativo"
                      : "valor--positivo"
                  }`}
                >
                  {formatarMoeda(
                    gameState.monthlyRevenue - gameState.monthlyExpenses
                  )}
                </span>
              </div>
              <hr className="separador" />
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
                  {formatarMoeda(folha)}
                </span>
              </div>
              <p className="nota">
                O mês fecha a cada 30 dias de jogo: os salários saem do caixa e
                os totais do mês voltam a zero.
              </p>
            </section>

            {/* Vendas */}
            <section className="card">
              <div className="card__cabecalho">
                <h2 className="card__titulo">
                  <Icone d={ICONES.grafico} /> Vendas
                </h2>
              </div>
              <div className="linha">
                <span className="linha__rotulo">Vendas fechadas</span>
                <span className="linha__valor valor--positivo">
                  {gameState.sales.length}
                </span>
              </div>
              <div className="linha">
                <span className="linha__rotulo">Lucro em vendas</span>
                <span className="linha__valor valor--positivo">
                  {formatarMoeda(lucroVendas)}
                </span>
              </div>
              <div className="linha">
                <span className="linha__rotulo">Vendas perdidas</span>
                <span className="linha__valor valor--alerta">
                  {gameState.missedSales}
                </span>
              </div>
              {ultimasVendas.length > 0 && (
                <>
                  <hr className="separador" />
                  {ultimasVendas.map((venda, i) => (
                    <div className="linha" key={`${venda.id}-${i}`}>
                      <span className="linha__rotulo">
                        {gameState.products.get(venda.productType)?.name ??
                          venda.productType}
                      </span>
                      <span className="linha__valor valor--ciano">
                        {formatarMoeda(venda.price)}{" "}
                        <span className="valor--positivo">
                          (+{formatarMoeda(venda.profit)})
                        </span>
                      </span>
                    </div>
                  ))}
                  <p className="nota">
                    Últimas vendas: preço cobrado e lucro depois do custo.
                  </p>
                </>
              )}
            </section>

            {/* Assistência técnica */}
            <section className="card">
              <div className="card__cabecalho">
                <h2 className="card__titulo">
                  <Icone d={ICONES.chave} /> Assistência técnica
                </h2>
              </div>
              <div className="linha">
                <span className="linha__rotulo">Na fila</span>
                <span className="linha__valor valor--alerta">
                  {aguardandoReparo}
                </span>
              </div>
              <div className="linha">
                <span className="linha__rotulo">Ordens em andamento</span>
                <span className="linha__valor valor--ciano">
                  {reparosAbertos.length}
                </span>
              </div>
              <div className="linha">
                <span className="linha__rotulo">Ordens concluídas</span>
                <span className="linha__valor valor--positivo">
                  {reparosConcluidos.length}
                </span>
              </div>
              <div className="linha">
                <span className="linha__rotulo">Lucro em reparos</span>
                <span className="linha__valor valor--positivo">
                  {formatarMoeda(lucroReparos)}
                </span>
              </div>
              <div className="linha">
                <span className="linha__rotulo">Reparos perdidos</span>
                <span className="linha__valor valor--negativo">
                  {gameState.missedRepairs}
                </span>
              </div>
            </section>

            {/* Equipe */}
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
                      hab. {Math.round(f.skill)}% · ânimo{" "}
                      {Math.round(f.happiness)}%
                    </p>
                  </div>
                </div>
              ))}
              <div className="acoes">
                <button
                  className="btn btn--largo"
                  onClick={() => contratar("seller")}
                  title={`Custo de entrada: ${formatarMoeda(SALARIOS.seller * 2)}`}
                >
                  + Vendedor ({formatarMoeda(SALARIOS.seller * 2)})
                </button>
                <button
                  className="btn btn--largo"
                  onClick={() => contratar("technician")}
                  title={`Custo de entrada: ${formatarMoeda(SALARIOS.technician * 2)}`}
                >
                  + Técnico ({formatarMoeda(SALARIOS.technician * 2)})
                </button>
              </div>
              <p className="nota">
                A contratação cobra dois salários adiantados e aumenta a folha
                mensal em {formatarMoeda(SALARIOS.seller)} (vendedor) ou{" "}
                {formatarMoeda(SALARIOS.technician)} (técnico).
              </p>
            </section>

            {/* Estoque e preços */}
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
                const margem = p.sellingPrice - p.costPrice;
                const rascunho = rascunhoPreco[p.type];
                return (
                  <div className="produto-item" key={p.id}>
                    <div className="produto">
                      <div>
                        <div className="produto__nome">{p.name}</div>
                        <div className="produto__meta">
                          custo {formatarMoeda(p.costPrice)} · margem{" "}
                          {formatarMoeda(margem)} · vendidos {p.unitsSold} ·
                          demanda {Math.round(p.demand)}%
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
                          if (e.key === "Enter") {
                            aplicarPreco(p.type, p.name, p.costPrice);
                          }
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
                A compra sai do caixa na hora e entra como despesa do mês. O
                preço não pode ficar abaixo do custo.
              </p>
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

        {aba === "oportunidades" && (
          <>
            {opportunities.length === 0 ? (
              <div className="card">
                <p className="vazio">
                  Nenhuma oportunidade detectada agora. O consultor reavalia a
                  loja a cada 20 segundos de jogo.
                </p>
              </div>
            ) : (
              <>
                <button className="btn btn--largo" onClick={onClearOpportunities}>
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

      {/* ---------- Painel direito ---------- */}
      <aside className="painel painel--direita">
        <div className="card card--magenta">
          <div className="card__cabecalho">
            <h2 className="card__titulo">
              <Icone d={ICONES.raio} /> Clientes na loja
            </h2>
            <span className="linha__valor">{naLoja.length}</span>
          </div>
          <div className="linha">
            <span className="linha__rotulo">Fila do balcão</span>
            <span className="linha__valor valor--ciano">{aguardandoVenda}</span>
          </div>
          <div className="linha">
            <span className="linha__rotulo">Fila da assistência</span>
            <span className="linha__valor valor--alerta">{aguardandoReparo}</span>
          </div>
          <div className="linha">
            <span className="linha__rotulo">Satisfação média</span>
            <span className="linha__valor">
              {Math.round(gameState.customerSatisfactionAvg)}%
            </span>
          </div>
        </div>

        {naLoja.length === 0 ? (
          <div className="card card--magenta">
            <p className="vazio">Loja vazia. Aguardando movimento…</p>
          </div>
        ) : (
          naLoja
            .slice(0, 10)
            .map((c) => (
              <ClienteCard
                key={c.id}
                cliente={c}
                agora={gameState.time}
                precoPedido={
                  c.needsProduct
                    ? gameState.products.get(c.needsProduct)?.sellingPrice
                    : undefined
                }
                nomeProduto={
                  c.needsProduct
                    ? gameState.products.get(c.needsProduct)?.name
                    : undefined
                }
              />
            ))
        )}
      </aside>

      {aviso && (
        <div className={`aviso ${aviso.tipo === "ok" ? "aviso--ok" : "aviso--erro"}`}>
          {aviso.texto}
        </div>
      )}
    </div>
  );
}

function AtendimentoCard({
  cliente,
  produto,
  onSell,
  onAcceptRepair,
  onDecline,
}: {
  cliente: Customer;
  produto?: { name: string; sellingPrice: number; costPrice: number; stock: number };
  onSell: (preco: number) => void;
  onAcceptRepair: () => void;
  onDecline: () => void;
}) {
  const venda = Boolean(cliente.needsProduct && produto);
  const precoCheio = produto?.sellingPrice ?? 0;
  const desconto = Math.min(precoCheio, cliente.budget);
  const podeDarDesconto = venda && desconto < precoCheio && desconto >= (produto?.costPrice ?? Infinity);
  const podeCobrarCheio = venda && precoCheio <= cliente.budget && (produto?.stock ?? 0) > 0;
  const semEstoque = venda && (produto?.stock ?? 0) === 0;

  return (
    <section className="atendimento-card">
      <p className="atendimento-card__etiqueta">ATENDIMENTO PENDENTE · RELÓGIO PAUSADO</p>
      <h2>{cliente.name}</h2>
      {venda ? (
        <>
          <p>Quer comprar <strong>{produto?.name}</strong>. Orçamento: <strong>{formatarMoeda(cliente.budget)}</strong>.</p>
          <div className="atendimento-card__numeros">
            <span>Preço da vitrine <b>{formatarMoeda(precoCheio)}</b></span>
            <span>Custo <b>{formatarMoeda(produto?.costPrice ?? 0)}</b></span>
            <span>Estoque <b>{produto?.stock}</b></span>
          </div>
          {semEstoque && <p className="atendimento-card__aviso">Você não tem esse produto em estoque.</p>}
          {!semEstoque && !podeCobrarCheio && !podeDarDesconto && (
            <p className="atendimento-card__aviso">O orçamento não cobre nem o custo. Esta venda não é viável.</p>
          )}
          <div className="atendimento-card__acoes">
            <button className="btn btn--ativo" disabled={!podeCobrarCheio} onClick={() => onSell(precoCheio)}>
              Vender por {formatarMoeda(precoCheio)}
            </button>
            <button className="btn" disabled={!podeDarDesconto} onClick={() => onSell(desconto)}>
              Negociar por {formatarMoeda(desconto)}
            </button>
            <button className="btn btn--magenta" onClick={onDecline}>Recusar</button>
          </div>
        </>
      ) : (
        <>
          <p>Precisa de <strong>reparo</strong>. A decisão é sua: assumir a ordem ou dispensar o cliente.</p>
          <p className="atendimento-card__detalhe">Valor estimado do serviço varia com a habilidade do técnico disponível.</p>
          <div className="atendimento-card__acoes">
            <button className="btn btn--ativo" onClick={onAcceptRepair}>Aceitar reparo</button>
            <button className="btn btn--magenta" onClick={onDecline}>Recusar</button>
          </div>
        </>
      )}
    </section>
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

function ClienteCard({
  cliente,
  agora,
  precoPedido,
  nomeProduto,
}: {
  cliente: Customer;
  agora: number;
  precoPedido?: number;
  nomeProduto?: string;
}) {
  const espera = Math.max(0, Math.round(agora - cliente.arrivalTime));
  const paciencia = Math.round(cliente.patience);
  const classePaciencia =
    paciencia > 60
      ? "valor--positivo"
      : paciencia > 30
        ? "valor--alerta"
        : "valor--negativo";
  const semOrcamento =
    precoPedido !== undefined && precoPedido > cliente.budget;

  return (
    <article className="cliente">
      <div className="cliente__topo">
        <h3 className="cliente__nome">{cliente.name}</h3>
        <span className={`linha__valor ${classePaciencia}`}>{paciencia}%</span>
      </div>
      {cliente.needsProduct && (
        <p className="cliente__detalhe">
          Quer comprar: <strong>{nomeProduto ?? cliente.needsProduct}</strong>
          {precoPedido !== undefined && ` por ${formatarMoeda(precoPedido)}`}
        </p>
      )}
      {cliente.needsService && (
        <p className="cliente__detalhe">
          Precisa de: <strong>reparo</strong>
        </p>
      )}
      {cliente.needsProduct && (
        <p className={`cliente__detalhe ${semOrcamento ? "valor--negativo" : ""}`}>
          Orçamento: <strong>{formatarMoeda(cliente.budget)}</strong>
          {semOrcamento && " — acima do orçamento"}
        </p>
      )}
      <p className="cliente__detalhe">
        {STATUS_CLIENTE[cliente.status]} há <strong>{espera}s</strong> de jogo
      </p>
    </article>
  );
}

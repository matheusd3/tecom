// GameUI.tsx - Interface do jogo sobreposta ao canvas Babylon

import { useState, useEffect } from "react";
import { GameState, Opportunity } from "@/game/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  Users,
  Package,
  AlertCircle,
  Zap,
  TrendingUp,
  Pause,
  Play,
} from "lucide-react";

interface GameUIProps {
  gameState: GameState | null;
  opportunities: Opportunity[];
  onTimeSpeedChange: (speed: number) => void;
  onTogglePause: () => void;
}

export function GameUI({
  gameState,
  opportunities,
  onTimeSpeedChange,
  onTogglePause,
}: GameUIProps) {
  const [selectedTab, setSelectedTab] = useState<"dashboard" | "opportunities">(
    "dashboard"
  );

  if (!gameState) return null;

  const gameHours = Math.floor(gameState.time / 60);
  const gameDays = Math.floor(gameHours / 24);
  const gameMonths = Math.floor(gameDays / 30);

  const formatCurrency = (value: number) => {
    return `R$ ${value.toFixed(2).replace(".", ",")}`;
  };

  return (
    <div className="fixed inset-0 pointer-events-none">
      {/* Top Bar - Controles e Status */}
      <div className="absolute top-0 left-0 right-0 pointer-events-auto bg-gradient-to-b from-black/80 to-transparent p-4">
        <div className="flex justify-between items-start">
          {/* Logo e Título */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-500 rounded-lg flex items-center justify-center font-orbitron font-bold text-black">
              $
            </div>
            <div>
              <h1 className="font-orbitron font-bold text-xl text-cyan-400">
                SHOP TYCOON
              </h1>
              <p className="text-xs text-gray-400">
                Dia {gameDays} | Mês {gameMonths}
              </p>
            </div>
          </div>

          {/* Controles de Tempo */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onTogglePause}
              className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
            >
              {gameState.isPaused ? (
                <>
                  <Play className="w-4 h-4 mr-1" /> Play
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4 mr-1" /> Pause
                </>
              )}
            </Button>
            <select
              value={gameState.timeSpeed}
              onChange={(e) => onTimeSpeedChange(parseFloat(e.target.value))}
              className="px-3 py-1 bg-gray-900 border border-cyan-500/50 rounded text-cyan-400 text-sm font-mono"
            >
              <option value="0.5">0.5x</option>
              <option value="1">1x</option>
              <option value="2">2x</option>
              <option value="4">4x</option>
            </select>
          </div>
        </div>
      </div>

      {/* Left Panel - Dashboard Principal */}
      <div className="absolute left-0 top-24 bottom-0 w-96 pointer-events-auto overflow-y-auto bg-gradient-to-r from-black/90 to-black/70 border-r border-cyan-500/20 p-4 space-y-4">
        {/* Tabs */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={selectedTab === "dashboard" ? "default" : "outline"}
            onClick={() => setSelectedTab("dashboard")}
            className="flex-1"
          >
            Dashboard
          </Button>
          <Button
            size="sm"
            variant={selectedTab === "opportunities" ? "default" : "outline"}
            onClick={() => setSelectedTab("opportunities")}
            className="flex-1 relative"
          >
            Oportunidades
            {opportunities.length > 0 && (
              <Badge className="absolute -top-2 -right-2 bg-magenta-500">
                {opportunities.length}
              </Badge>
            )}
          </Button>
        </div>

        {selectedTab === "dashboard" && (
          <>
            {/* Finanças */}
            <Card className="bg-gray-900/50 border-cyan-500/30 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-orbitron font-bold text-cyan-400 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" /> Finanças
                </h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Caixa:</span>
                  <span
                    className={`font-mono font-bold ${
                      gameState.cash < 0 ? "text-red-400" : "text-green-400"
                    }`}
                  >
                    {formatCurrency(gameState.cash)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Receita (mês):</span>
                  <span className="font-mono text-green-400">
                    {formatCurrency(gameState.monthlyRevenue)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Despesas (mês):</span>
                  <span className="font-mono text-red-400">
                    {formatCurrency(gameState.monthlyExpenses)}
                  </span>
                </div>
              </div>
            </Card>

            {/* Vendas */}
            <Card className="bg-gray-900/50 border-cyan-500/30 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-orbitron font-bold text-cyan-400 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Vendas
                </h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total vendido:</span>
                  <span className="font-mono font-bold text-green-400">
                    {gameState.sales.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Vendas perdidas:</span>
                  <span className="font-mono font-bold text-yellow-400">
                    {gameState.missedSales}
                  </span>
                </div>
              </div>
            </Card>

            {/* Funcionários */}
            <Card className="bg-gray-900/50 border-cyan-500/30 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-orbitron font-bold text-cyan-400 flex items-center gap-2">
                  <Users className="w-4 h-4" /> Funcionários
                </h3>
              </div>
              <div className="space-y-2 text-sm">
                {Array.from(gameState.employees.values()).map((emp) => (
                  <div key={emp.id} className="flex justify-between items-center">
                    <div>
                      <p className="text-gray-300 text-xs">{emp.name}</p>
                      <p className="text-gray-500 text-xs">{emp.role}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-cyan-400 text-xs font-mono">
                        {emp.skill}%
                      </p>
                      <p
                        className={`text-xs font-mono ${
                          emp.happiness > 70
                            ? "text-green-400"
                            : emp.happiness > 40
                              ? "text-yellow-400"
                              : "text-red-400"
                        }`}
                      >
                        {emp.happiness}% 😊
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Estoque */}
            <Card className="bg-gray-900/50 border-cyan-500/30 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-orbitron font-bold text-cyan-400 flex items-center gap-2">
                  <Package className="w-4 h-4" /> Estoque
                </h3>
              </div>
              <div className="space-y-1 text-xs">
                {Array.from(gameState.products.values()).map((prod) => (
                  <div key={prod.id} className="flex justify-between">
                    <span className="text-gray-400">{prod.name}:</span>
                    <span
                      className={`font-mono font-bold ${
                        prod.stock < 2 ? "text-red-400" : "text-cyan-400"
                      }`}
                    >
                      {prod.stock}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}

        {selectedTab === "opportunities" && (
          <div className="space-y-3">
            {opportunities.length === 0 ? (
              <Card className="bg-gray-900/50 border-cyan-500/30 p-4 text-center text-gray-400 text-sm">
                Nenhuma oportunidade detectada. Ótimo trabalho!
              </Card>
            ) : (
              opportunities.map((opp) => (
                <Card
                  key={opp.id}
                  className={`bg-gray-900/50 border p-4 ${
                    opp.severity === "high"
                      ? "border-red-500/50"
                      : opp.severity === "medium"
                        ? "border-yellow-500/50"
                        : "border-cyan-500/30"
                  }`}
                >
                  <div className="flex items-start gap-2 mb-2">
                    <AlertCircle
                      className={`w-4 h-4 flex-shrink-0 mt-1 ${
                        opp.severity === "high"
                          ? "text-red-400"
                          : opp.severity === "medium"
                            ? "text-yellow-400"
                            : "text-cyan-400"
                      }`}
                    />
                    <div className="flex-1">
                      <h4 className="font-orbitron font-bold text-sm text-white">
                        {opp.title}
                      </h4>
                      <p className="text-xs text-gray-400 mt-1">
                        {opp.description}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Lucro potencial:</span>
                      <span className="text-green-400 font-mono">
                        {formatCurrency(opp.potentialProfit)}
                      </span>
                    </div>
                    <p className="text-cyan-400 italic">
                      💡 {opp.recommendation}
                    </p>
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </div>

      {/* Right Panel - Clientes Atuais */}
      <div className="absolute right-0 top-24 bottom-0 w-80 pointer-events-auto overflow-y-auto bg-gradient-to-l from-black/90 to-black/70 border-l border-magenta-500/20 p-4">
        <h3 className="font-orbitron font-bold text-magenta-400 mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4" /> Clientes Ativos
        </h3>
        <div className="space-y-3">
          {Array.from(gameState.customers.values())
            .filter((c) => !c.departureTime)
            .slice(0, 8)
            .map((customer) => (
              <Card
                key={customer.id}
                className="bg-gray-900/50 border-magenta-500/30 p-3"
              >
                <div className="flex justify-between items-start mb-2">
                  <p className="font-orbitron font-bold text-sm text-magenta-400">
                    {customer.name}
                  </p>
                  <Badge
                    className={`text-xs ${
                      customer.patience > 70
                        ? "bg-green-900/50 text-green-400"
                        : customer.patience > 40
                          ? "bg-yellow-900/50 text-yellow-400"
                          : "bg-red-900/50 text-red-400"
                    }`}
                  >
                    {Math.round(customer.patience)}%
                  </Badge>
                </div>
                <div className="text-xs text-gray-400 space-y-1">
                  {customer.needsProduct && (
                    <p>
                      Procura: <span className="text-cyan-400">{customer.needsProduct}</span>
                    </p>
                  )}
                  {customer.needsService && (
                    <p>
                      Serviço: <span className="text-cyan-400">{customer.needsService}</span>
                    </p>
                  )}
                  <p>
                    Orçamento:{" "}
                    <span className="text-green-400 font-mono">
                      {formatCurrency(customer.budget)}
                    </span>
                  </p>
                </div>
              </Card>
            ))}
        </div>
      </div>
    </div>
  );
}

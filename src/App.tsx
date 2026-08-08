import { Component, type ErrorInfo, type ReactNode } from "react";
import GameCanvas from "./components/GameCanvas";

interface EstadoLimite {
  erro: Error | null;
}

/**
 * Evita tela branca: qualquer exceção de render vira uma mensagem legível.
 * Substitui o ErrorBoundary externo que o export do Manus importava.
 */
class LimiteDeErro extends Component<{ children: ReactNode }, EstadoLimite> {
  state: EstadoLimite = { erro: null };

  static getDerivedStateFromError(erro: Error): EstadoLimite {
    return { erro };
  }

  componentDidCatch(erro: Error, info: ErrorInfo): void {
    console.error("Erro na interface do jogo:", erro, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.erro) {
      return (
        <div className="erro-fatal">
          <h1>Falha na interface</h1>
          <pre>{this.state.erro.message}</pre>
          <button className="btn" onClick={() => window.location.reload()}>
            Recarregar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <LimiteDeErro>
      <GameCanvas />
    </LimiteDeErro>
  );
}

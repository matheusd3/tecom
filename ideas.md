# Computer Shop Tycoon - Design & Mechanics

## Design Philosophy: Modern Business Dashboard with Retro-Futuristic Flair

**Theme Name:** Neon Commerce Tycoon  
**Very Brief Intro:** Um jogo de gerenciamento que combina a estética de dashboards corporativos modernos com toques de retro-futurismo dos anos 80/90. A interface é funcional e intuitiva, mas com personalidade visual marcante através de cores vibrantes, tipografia ousada e elementos geométricos.

**Design Movement:** Synthwave meets Modern UI Design  
**Core Principles:**
1. **Funcionalidade em Primeiro Lugar:** Interface clara, legível e responsiva que prioriza a experiência do jogador
2. **Contraste Vibrante:** Cores neon contra fundos escuros para criar visual memorável e energético
3. **Tipografia Hierárquica:** Fontes ousadas para títulos, claras para dados
4. **Feedback Visual Imediato:** Cada ação do jogador gera resposta visual clara

**Color Philosophy:**
- **Primária:** Ciano vibrante (#00D9FF) - representa tecnologia e inovação
- **Secundária:** Magenta (#FF006E) - destaca oportunidades e eventos importantes
- **Terciária:** Verde lima (#39FF14) - sucesso, vendas completadas
- **Fundo:** Cinza escuro quase preto (#0F1419) - reduz fadiga ocular
- **Acentos:** Amarelo ouro (#FFD700) - avisos e atenção

**Layout Paradigm:**
- Dashboard central com 4 quadrantes principais (Vendas, Manutenção, Finanças, Oportunidades)
- Painel lateral esquerdo para navegação e status rápido
- Área de notificações e alertas no topo
- Rodapé com controles de tempo e velocidade do jogo

**Signature Elements:**
1. **Cartões Flutuantes:** Elementos com sombra neon e bordas brilhantes
2. **Indicadores Animados:** Gráficos em tempo real com animações suaves
3. **Notificações Pulsantes:** Alertas de oportunidades com efeito de pulso

**Interaction Philosophy:**
- Cliques imediatos com feedback visual
- Drag-and-drop para organização de tarefas
- Modais deslizantes para detalhes
- Transições suaves entre estados

**Animation:**
- Transições de 200-300ms para mudanças de estado
- Efeitos de glow em elementos interativos ao hover
- Animações de entrada em cascata para listas
- Pulsação suave para alertas críticos

**Typography System:**
- **Display:** Orbitron (Google Fonts) - títulos e números grandes
- **Body:** Inter - texto de corpo e dados
- **Mono:** Courier New - valores de dinheiro e IDs

**Brand Essence:**
*Um simulador de negócios que transforma a gestão de uma loja de informática em uma experiência viciante e educativa, mostrando oportunidades que você não vê.*

Personalidade: Estratégico, Inteligente, Energético

**Brand Voice:**
- Headlines: "Seu negócio está crescendo! 📈" ou "Atenção: Cliente insatisfeito detectado"
- CTAs: "Fechar venda", "Reparar equipamento", "Contratar funcionário"
- Microcopy: Evitar genéricos; usar frases como "Você deixou passar uma oportunidade de venda" ou "Seu técnico está ocioso"

**Wordmark & Logo:**
Um símbolo geométrico: um circuito em forma de loja/casa com linhas neon formando um sinal de dólar no centro. Cores: ciano + magenta.

**Signature Brand Color:** Ciano vibrante (#00D9FF)

---

## Mecânicas do Jogo

### 1. **Sistema de Tempo**
- Tempo real acelerado (1 dia do jogo = 30 segundos)
- Controles de velocidade (1x, 2x, 4x)
- Pausa disponível
- Ciclo dia/noite visual

### 2. **Núcleo de Vendas**
- Clientes aparecem aleatoriamente na loja
- Cada cliente tem necessidade específica (notebook, mouse, teclado, etc.)
- Preço base + margem de lucro configurável
- Taxa de conversão baseada em: preço, estoque, atendimento do vendedor
- Satisfação do cliente afeta recomendações

### 3. **Sistema de Manutenção**
- Clientes trazem equipamentos para reparo
- Diferentes tipos de falhas com dificuldades variadas
- Tempo de reparo baseado em habilidade do técnico
- Peças de reposição consomem estoque
- Receita por serviço de manutenção

### 4. **Gestão de Funcionários**
- Vendedores (aumentam taxa de conversão)
- Técnicos (reduzem tempo de reparo)
- Gerente (melhora eficiência geral)
- Salários mensais
- Treinamento para aumentar habilidades
- Satisfação afeta produtividade

### 5. **Sistema Financeiro**
- Fluxo de caixa em tempo real
- Despesas: salários, aluguel, eletricidade
- Receitas: vendas, serviços de manutenção
- Empréstimos disponíveis
- Investimentos em estoque e equipamentos

### 6. **Consultor de Oportunidades** ⭐ (Feature Principal)
- IA que analisa o estado da loja
- Identifica oportunidades perdidas:
  - "Você teve 5 clientes procurando por notebooks mas estava sem estoque"
  - "Seu técnico ficou ocioso por 2 horas - contrate outro"
  - "Você poderia ter ganhado R$ 500 se tivesse negociado melhor"
- Sugere ações:
  - "Aumente o preço de mouses em 15%"
  - "Contrate um segundo técnico"
  - "Faça promoção de serviços de manutenção"
- Relatório diário/semanal/mensal
- Pontuação de eficiência geral

### 7. **Objetivos & Progressão**
- Objetivos semanais (ex: vender 10 notebooks)
- Metas de receita mensal
- Desafios especiais (ex: "Atenda 50 clientes sem deixar ninguém insatisfeito")
- Sistema de estrelas (1-5) baseado em performance
- Desbloqueio de novos produtos/serviços

### 8. **Eventos Aleatórios**
- Promoção de fornecedor (estoque com desconto)
- Cliente VIP (compra grande)
- Equipamento quebrado (precisa reparar)
- Funcionário doente (não vem trabalhar)
- Concorrente abre loja perto (reduz clientes)

---

## Fluxo de Jogo

1. **Início:** Pequena loja com 1 vendedor, 1 técnico, estoque básico
2. **Early Game:** Aprender mecânicas, fazer primeiras vendas
3. **Mid Game:** Expandir funcionários, aumentar estoque, otimizar processos
4. **Late Game:** Maximizar lucros, aceitar desafios, competir por eficiência

---

## Vitória/Derrota

- **Derrota:** Falência (caixa negativo por muito tempo)
- **Vitória:** Não há fim - é um simulador infinito com objetivos progressivos
- **Ranking:** Baseado em lucro total, eficiência, satisfação de clientes

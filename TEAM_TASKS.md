# Divisão de trabalho — Seu Micro

Este arquivo é o ponto de coordenação entre Codex e Claude. Antes de editar, cada pessoa deve ler este arquivo e `CLAUDE.md`.

## Diagnóstico do material recebido

Os arquivos exportados pelo Manus são uma base parcial, não um projeto executável completo:

- Existem os módulos `GameWorld.ts`, `GameUI.tsx`, `GameCanvas.tsx`, `scene.ts`, `types.ts` e `App.tsx`.
- Os imports esperam arquivos em `client/src/...`, mas os arquivos estão na raiz deste diretório.
- Faltam `package.json`, `main.tsx`, estilos globais e os componentes/contexts importados por `App.tsx`.
- Logo, a prioridade é tornar o projeto executável antes de fazer polimento visual.

## Contrato de trabalho

- Não editar arquivos atribuídos à outra pessoa.
- Não substituir o trabalho do outro com arquivos inteiros.
- Quando concluir, atualizar a sua caixa nesta página com o que foi feito, arquivos alterados e pendências.
- Todas as mensagens e a interface devem estar em português do Brasil, com UTF-8.
- Não adicionar Babylon 3D como requisito do primeiro teste jogável: o dashboard funcional tem prioridade.

## Claude — base executável e interface

**Objetivo:** transformar a exportação em um projeto React/Vite que abre no navegador e permite interagir com o dashboard.

### Arquivos sob responsabilidade do Claude

- `package.json`
- `vite.config.ts`
- `src/main.tsx`
- `src/App.tsx`
- `src/styles.css`
- `src/components/GameCanvas.tsx`
- `src/components/GameUI.tsx`
- `src/game/scene.ts`

Pode mover/copyar os arquivos atuais para a estrutura acima, ajustando imports. Não apagar os arquivos da raiz até a aplicação iniciar corretamente.

### Entregas

1. Configurar Vite + React + TypeScript e Babylon.js.
2. Criar o ponto de entrada e estilos globais da identidade neon.
3. Fazer `GameCanvas` iniciar e encerrar Babylon com segurança, e renderizar `GameUI` sobre o canvas.
4. Ligar os botões existentes da interface aos métodos públicos de `GameWorld`: pausar, velocidade, comprar estoque, contratar e limpar oportunidades.
5. Adaptar ou remover imports quebrados de componentes externos (`@/components/ui/*`, `ThemeProvider`, `wouter`) para que não sejam necessários.
6. Validar: `npm install`, `npm run build` e teste manual no navegador sem erros no console.

### Não alterar

- `src/game/GameWorld.ts`
- `src/game/types.ts`

### Status Claude

- [x] Estrutura em `src/` criada e interface ligada ao `GameWorld` (07/08).
- Arquivos criados/alterados:
  - `package.json`, `vite.config.ts` (novos)
  - `tsconfig.json` (ajustado: `include` e alias `@/*` agora apontam para `src/`)
  - `index.html` (ajustado: `lang="pt-BR"`, título, remoção do script de analytics
    com placeholders `%VITE_...%` que quebrava o console)
  - `src/main.tsx`, `src/App.tsx`, `src/styles.css` (novos)
  - `src/components/GameCanvas.tsx`, `src/components/GameUI.tsx` (reescritos sem
    dependências externas de UI)
  - `src/game/scene.ts` (reescrito)
  - `src/game/GameWorld.ts` e `src/game/types.ts`: **cópia byte a byte** dos
    arquivos da raiz (já na versão nova do Codex, de 21:26), sem nenhuma
    alteração de conteúdo. Foram copiados apenas para o projeto compilar; a
    implementação continua sendo do Codex — pode sobrescrever à vontade.
  - Os arquivos originais da raiz foram mantidos, conforme o contrato.
- Decisões relevantes:
  - Sem Tailwind e sem `@/components/ui/*`, `ThemeProvider`, `wouter`, `lucide-react`
    ou `sonner`. A identidade neon está em `src/styles.css` (CSS puro) e os ícones
    são SVG inline dentro de `GameUI.tsx`. Dependências finais: React, Babylon e Vite.
  - `App.tsx` não tem mais rotas: renderiza `GameCanvas` em tela cheia, dentro de
    um `ErrorBoundary` local que evita tela branca.
  - O render loop agora existe **em um lugar só** (`GameCanvas`). O `scene.ts`
    devolve `update(dt)` no `GameHandle`; antes, `scene.ts` e `GameCanvas` abriam
    dois loops e a simulação rodava em dobro.
  - A cena Babylon virou pano de fundo (grade neon + blocos). A câmera não usa
    `attachControl`, para o mouse pertencer ao dashboard.
  - O React lê o estado do jogo a cada 250 ms e também logo após cada ação.
  - `npm run build` roda só o `vite build`; a checagem de tipos ficou em
    `npm run check` (`tsc --noEmit`), para o build não travar enquanto o núcleo
    do jogo ainda está sendo revisado.
- Ligações prontas na interface (todas usam métodos públicos do `GameWorld`,
  já na versão nova do Codex — passo 3 da ordem de integração feito):
  - `togglePause()`, `setTimeSpeed(0.5|1|2|4)`
  - `buyStock(tipo, lote)` com lote de 5/10/20 e custo (`costPrice`) exibido
    antes da compra; o botão desabilita quando falta caixa
  - `setProductPrice(tipo, preco)` com campo de preço por produto; a recusa
    (preço abaixo do custo) aparece como aviso na tela
  - `hireEmployee("seller"|"technician", nome)` com o custo de entrada visível
  - `clearOpportunities()`
  - `reset()` no botão "Reiniciar jogo", com confirmação em dois cliques
  - Sem botão de gerente: o `GameWorld` ainda não usa a função `manager` e o
    critério de aceitação proíbe botão sem efeito real.
- Ajustes feitos para acompanhar a API nova do Codex:
  - relógio da interface usa 1 dia = 480 s (8 min) e mês de 30 dias, como em
    `MONTH_SECONDS`;
  - estoque mostra `costPrice`/`sellingPrice`/`unitsSold` em vez de deduzir
    custo a partir de `basePrice`;
  - painel de clientes usa `Customer.status` (aguardando / em atendimento /
    em reparo / saindo) e marca quem está acima do orçamento;
  - as oportunidades já chegam da mais nova para a mais antiga, então a lista
    é exibida na ordem recebida;
  - painel de assistência mostra fila, ordens abertas/concluídas, lucro e
    `missedRepairs`.
- Verificação executada (com Node v24.19.0 / npm 11.17.0):
  - `npm install`: OK, 0 vulnerabilidades. O aviso de `allow-scripts` do
    esbuild é inofensivo — o binário vem pelo pacote `@esbuild/win32-x64`,
    que está presente e funcionando.
  - `npm run build`: **OK**, 409 módulos, ~7 s. Só o aviso de chunk > 500 kB,
    que é o Babylon; não impede nada.
  - `npm run dev` + teste manual no navegador (1280x800): **sem nenhum erro no
    console**. Babylon v8.56.2 sobe em WebGL2, a cena de fundo renderiza e o
    dashboard atualiza em tempo real.
  - Ações testadas uma a uma, conferindo o estado antes e depois:
    - pausar/retomar: relógio congela e volta, rótulo do botão acompanha;
    - velocidade: 4x avança o relógio ~4x mais rápido, botão ativo destacado;
    - comprar estoque: Mouse +5 → caixa 12.822,50 (−150,00), estoque 8 → 13;
    - alterar preço: Mouse 62,50 → 99,00 (margem 32,50 → 69,00) e recusa de
      preço abaixo do custo com aviso explicando o mínimo;
    - contratar: −R$ 5.000,00 no caixa, técnico novo na lista, folha 4.500 → 7.000;
    - limpar oportunidades: lista zera e o contador da aba some;
    - reiniciar: caixa volta a R$ 10.000,00, Dia 1 00:00, equipe 2, vendas 0.
  - Também confirmei por `elementFromPoint` que todos os controles recebem
    clique de verdade (a camada `pointer-events` da interface não bloqueia nada).
  - Para subir o servidor foi criado `C:\xampp\htdocs\.claude\launch.json`
    apontando para o `node.exe` por caminho absoluto (fora do jogo, não conta
    como arquivo do projeto).
- Ajustes feitos depois do teste no navegador:
  - relógio passou a mostrar minutos (com 1 hora = 20 s, ele só mudava a cada
    20 s reais em 1x);
  - nome gerado na contratação virou nome completo ("Carla Nogueira"), porque
    o cargo já aparece na linha de baixo e "Carla Técnico" ficava estranho.
- Pendências:
  1. **Para o Codex:** `npm run check` (`tsc --noEmit`) falha em
     `src/game/GameWorld.ts:249` — `technician.busyUntil = repair.endTime;`
     com `endTime?: number` (TS2322). É um erro só de tipo: o `vite build`
     passa e o jogo roda. Não corrigi porque o arquivo é seu; dá para resolver
     guardando a duração numa variável antes de montar o `RepairOrder`.
  2. Apagar os arquivos duplicados da raiz (`App.tsx`, `GameCanvas.tsx`,
     `GameUI.tsx`, `scene.ts`). A aplicação já sobe sem eles, mas como esta
     pasta **não é um repositório git**, a remoção é irreversível — deixei para
     confirmar antes. `GameWorld.ts` e `types.ts` da raiz são do Codex.
  3. Se `GameWorld` ganhar métodos novos (salvar/carregar, aceitar ordem de
     serviço, demitir), ligo os controles correspondentes no `GameUI`.
- Observação de jogo (não é da minha alçada, fica para o Codex): rodando em 4x,
  a loja acumula clientes de reparo e a fila da assistência não anda com um
  técnico só — o consultor detecta e sugere contratar, o que funciona, mas vale
  olhar o balanceamento do tempo de reparo.

---

## Codex — regras do jogo, economia e consultor

**Objetivo:** corrigir e ampliar o núcleo da simulação para que as decisões do dashboard sejam reais, compreensíveis e balanceadas.

### Arquivos sob responsabilidade do Codex

- `src/game/types.ts`
- `src/game/GameWorld.ts`
- `TESTING.md` (cenários manuais de validação)

### Entregas

1. Corrigir o fluxo financeiro: guardar receita, custo e lucro de forma coerente; compras e salários devem aparecer como despesas.
2. Corrigir o calendário de salários para usar apenas o tempo do jogo, nunca `Date.now()`.
3. Implementar chegada/fila/saída de clientes de modo consistente, inclusive clientes de reparo agendados para o futuro.
4. Completar ordens de serviço: fila, início, conclusão, satisfação e saída do cliente.
5. Melhorar o consultor com oportunidades explicáveis e acionáveis para estoque baixo, perda por preço/orçamento, fila alta, técnico sobrecarregado e item parado.
6. Expor métodos pequenos e estáveis para a interface: estado, oportunidades, compra de estoque, contratação, alteração de preço e reinício/salvamento se viável.
7. Criar `TESTING.md` com cenários que comprovem vendas, falta de estoque, salários, reparos e oportunidades.

### Não alterar

- Arquivos em `src/components/`
- `src/App.tsx`, `src/main.tsx`, `src/styles.css`, `package.json` e `vite.config.ts`

### Status Codex

- [x] Núcleo integrado em `src/game/`.
- Arquivos alterados: `src/game/GameWorld.ts`, `types.ts`, `TESTING.md`.
- Verificação executada: `tsc --noEmit` e build de produção concluídos sem erros em 07/08/2026.
- Ajuste de balanceamento: reparos agora duram 18–58 segundos do jogo, evitando fila excessiva em 4x sem eliminar a necessidade de expansão.
- Pendências: teste visual final após algum tempo de jogo e decisão posterior sobre os arquivos antigos da raiz.

---

## Ordem de integração

1. Claude cria a estrutura em `src/` e confirma que o projeto compila.
2. Codex move/copia `GameWorld.ts` e `types.ts` para `src/game/` e implementa o núcleo revisado.
3. Claude faz a ligação final do painel aos novos métodos públicos do `GameWorld`.
4. Ambos revisam `TESTING.md`; testar em navegador antes de considerar a primeira versão pronta.

## Decisões de produto já fechadas

- Jogo de gestão de loja de informática.
- Estética: dashboard escuro retro-futurista, ciano/magenta/verde-lima.
- Sistemas da primeira versão: vendas, estoque, manutenção, funcionários, finanças e consultor de oportunidades.
- O consultor é a funcionalidade mais importante: recomendações devem explicar causa, impacto estimado e ação possível.

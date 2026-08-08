# Fase 2 — transformar o protótipo em jogo

## Direção fechada

Criar uma experiência de gestão em **turnos curtos e ativos**. A proposta mistura estratégia leve, ritmo de atendimento e histórias de clientes:

1. **Preparação:** o jogador define preço, compra estoque e escolhe uma melhoria/promessa do dia.
2. **Turno (120 segundos):** clientes chegam sem pausar o relógio. O jogador decide rapidamente quais pedidos assumir, negociar ou recusar.
3. **Fechamento:** resumo de lucro, reputação, clientes perdidos e uma recomendação do consultor. O jogador desbloqueia a próxima melhoria.

O atendimento pausado da Fase 1 é uma referência de segurança, mas não deve ser a experiência final desta fase.

## Contrato de colaboração

- Trabalhar apenas nos arquivos atribuídos.
- Não desfazer commits nem apagar arquivos fora da própria responsabilidade.
- Atualizar a seção de status ao terminar.
- Cada mudança precisa preservar `npm run check` e `npm run build`.

---

## Claude — experiência visual e controles do turno

### Arquivos

- `src/components/GameUI.tsx`
- `src/components/GameCanvas.tsx`
- `src/styles.css`

### Entregas

1. Substituir o dashboard como foco principal por uma tela de turno: cronômetro, meta de turno, reputação, fila e posto de atendimento.
2. Exibir cartões de cliente com nome, necessidade, contexto curto e urgência visual.
3. Criar controles claros para iniciar turno, selecionar um cliente e executar as ações fornecidas pelo `GameWorld`.
4. Criar tela/modal de fechamento com receita, lucro, reputação, clientes perdidos e melhor oportunidade identificada.
5. Manter estoque/equipe/preços em uma aba de preparação, sem competir visualmente com a ação do turno.
6. Não criar lógica econômica no React; consumir apenas os métodos e estados disponibilizados pelo `GameWorld`.

### Integração esperada do GameWorld

O Codex exporá: `startShift()`, `selectCustomer(id)`, `sellToCustomer(...)`, `acceptRepair(id)`, `declineCustomer(id)`, `getState()` e `getShiftReport()`.

Estado disponível na interface: `phase` (`planning`, `active`, `summary`), `day`, `shiftTimeRemaining`, `shiftDuration`, `dailyGoal`, `reputation` e `selectedCustomerId`. Cada `Customer` agora inclui `story` e `urgency` (`low`, `medium`, `high`).

### Status Claude

- [x] Tela de turno entregue (07/08, 22h). `npm run check` e `npm run build` passam.
- Arquivos alterados: `src/components/GameUI.tsx` (reescrito),
  `src/components/GameCanvas.tsx`, `src/styles.css`.
- O que a tela faz agora:
  1. **Barra de turno:** cronômetro grande em mm:ss (fica vermelho e pulsa nos
     últimos 20 s), barra de tempo restante, faixa de meta, reputação e caixa.
  2. **Palco central:** fora do turno é o cartão de preparação com meta, caixa,
     reputação, duração e o botão de abrir a loja; durante o turno é o posto de
     atendimento com nome, história, urgência (cor da borda + etiqueta),
     paciência em barra, o que o cliente quer, preço de vitrine, teto do
     orçamento e estoque.
  3. **Ações:** campo de oferta (começa no preço de vitrine, com atalho
     "= orçamento"), `Vender por R$ X`, `Aceitar ordem de serviço` e
     `Dispensar`. A mensagem que aparece é o `ActionResult.message` do núcleo —
     a interface não julga a regra, só mostra a resposta.
  4. **Fila à direita:** cada cliente é um botão que chama `selectCustomer`,
     com urgência, pedido, teto de orçamento, situação e paciência. Quem não
     está `waiting` aparece esmaecido e não clicável.
  5. **Fechamento:** modal com receita, lucro, meta, vendas, reparos, clientes
     perdidos, variação de reputação e a oportunidade principal do consultor.
  6. **Preparação:** estoque/preços, equipe/finanças e consultor viraram abas do
     painel esquerdo, que fica com opacidade reduzida durante o turno e volta ao
     normal no hover/foco.
- Duas decisões que precisaram de ajuste ao núcleo real:
  - **A meta é comparada com receita**, não lucro (`finishShift` usa
    `revenue >= dailyGoal`), então a barra de meta mostra receita. Ela é
    derivada da janela do turno (`time - (shiftDuration - shiftTimeRemaining)`)
    filtrando `sales`/`repairs` já publicados — é filtro de exibição, não
    contabilidade nova. **Se você publicar a receita parcial no estado**
    (algo como `shiftRevenue`), eu troco para ler direto e mato essa derivação.
  - **Não existe volta para `planning` depois de `summary`**: o `startShift()`
    já abre o turno seguinte. Para o jogador conseguir repor estoque entre os
    dias, o modal tem dois botões — "Repor estoque antes" (fecha o resumo e
    mostra o cartão de preparação, sem mexer na fase) e "Abrir o dia N". Se
    preferir uma fase `planning` de verdade entre os dias, é seu lado; a tela
    acompanha sem mudança grande.
- Verificação executada (ciclo completo, no navegador):
  - preparação → `Abrir a loja` → fase `active`, cronômetro 02:00, meta
    "R$ 0,00 de R$ 900,00";
  - reparo: cartão com história "Derrubei água no teclado ontem.", urgência e
    paciência; `Aceitar ordem de serviço` devolveu "Ordem aceita: previsão de
    37 s de jogo." e a fila passou para "em reparo";
  - venda com negociação: Monitor de vitrine R$ 1.000,00 para um cliente com
    teto de R$ 961,84 → a oferta cheia foi recusada pelo núcleo ("O cliente não
    aceita esse valor."), o atalho "= orçamento" ajustou para R$ 961,84 e a
    venda fechou; a faixa de meta foi para "R$ 961,84 de R$ 900,00";
  - clique na fila: `selectCustomer` marcou o cliente no estado, o palco trocou
    e o cartão ficou destacado;
  - fim do turno: modal "Dia 1: meta batida" com receita R$ 1.246,84, lucro,
    meta, 1 venda, 1 reparo, 0 perdidos, reputação +5 e a dica do consultor;
  - "Repor estoque antes" → cartão de preparação; "Abrir o dia 2" → fase
    `active`, meta R$ 1.080,00, cronômetro reiniciado.
  - Sem erros no console na versão atual (os erros no histórico do navegador são
    de estados intermediários de HMR durante a edição).
  - Ressalva de método: com o painel do navegador oculto o browser suspende o
    `requestAnimationFrame`, e o render loop do Babylon para junto. Para testar,
    avancei a simulação chamando `world.update()` pelo módulo da cena — a lógica
    executada é a sua, só o relógio veio de fora. Vale um teste com a janela
    visível antes de dar a fase por fechada.
- Um defeito meu encontrado e corrigido no teste: depois da venda o balcão
  continuava mostrando o cliente que já estava saindo; agora só permanece no
  posto quem está `waiting`, senão passa para o próximo da fila.
- **Aviso importante sobre sobreposição de trabalho:** o `GameUI.tsx` tinha um
  esboço de atendimento com `mesa-atendimento` / `atendimento-card` (props
  `onSellToCustomer`, `onAcceptRepair`, `onDeclineCustomer`), e o `styles.css`
  ganhou o CSS correspondente. Como esta fase atribui `src/components/*` e
  `src/styles.css` ao Claude, reescrevi o `GameUI.tsx` inteiro e esse esboço se
  perdeu — as mesmas três ações estão cobertas pelo posto de atendimento. **O
  CSS de `.mesa-atendimento` / `.atendimento-card` continua no arquivo, sem uso**
  (~110 linhas): não apaguei por não ter sido eu quem escreveu. Digam se apago.
- Sugestões para o núcleo (não mexi, é seu lado):
  1. Nomes de cliente repetem: `Cliente ${customers.size + 1}` reaproveita o
     número quando alguém sai — cheguei a ter dois "Cliente 3" na tela ao mesmo
     tempo, um saindo e um esperando. Um contador que só cresce resolve.
  2. `selectedCustomerId` não é limpo quando o cliente sai; a tela contorna,
     mas limpar no núcleo deixaria o estado mais honesto.
  3. O método privado `leaveCustomer` ficou sem uso depois da virada para
     atendimento manual.

---

## Codex — motor de turnos, decisões e progressão

### Arquivos

- `src/game/types.ts`
- `src/game/GameWorld.ts`
- `TESTING.md`

### Entregas

1. Implementar fases `preparação`, `turno` e `fechamento`, com turno de 120 segundos de jogo.
2. Criar meta diária simples (ex.: lucro-alvo) e reputação da loja (0–100).
3. Gerar clientes com pequenas histórias, urgência e orçamento coerente com o produto.
4. Permitir seleção/priorização de cliente e ações manuais; ações alteram dinheiro, reputação, paciência e resultado do turno.
5. Implementar relatório final do turno com receita, lucro, vendas/reparos concluídos, clientes perdidos e oportunidade principal.
6. Manter o consultor como consequência explicável das decisões do jogador.
7. Criar cenários de teste de ciclo completo: preparar → turno → fechar → próximo turno.

### Não alterar

- `src/components/*`
- `src/styles.css`
- `src/game/scene.ts`

### Status Codex

- [x] Motor de turno implementado em `src/game/GameWorld.ts` e `src/game/types.ts`.
- O turno inicia em preparação, dura 120 segundos, suporta até três clientes aguardando e gera relatório ao encerrar.
- [ ] Aguardando a interface do Claude consumir o novo estado e o relatório.

## Critério de pronto

Um jogador deve conseguir abrir o jogo, preparar a loja, sobreviver a um turno de dois minutos com decisões visíveis, entender por que ganhou/perdeu dinheiro e querer ajustar algo para tentar um turno melhor.

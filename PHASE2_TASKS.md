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

- [ ] Não iniciado.

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

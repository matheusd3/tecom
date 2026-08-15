# Cenários de validação do núcleo

## Ciclo completo

1. **Preparação → turno:** abrir o jogo, ajustar um preço ou comprar estoque e clicar em **Abrir a loja**. Confirmar o cronômetro em 02:00, meta, reputação e caixa visíveis.
2. **Fila com pressão:** esperar até três clientes. Confirmar que urgência alta reduz a paciência mais depressa e que selecionar um cartão muda o posto de atendimento.
3. **Venda e negociação:** atender um pedido com orçamento suficiente. A venda deve aumentar caixa, receita do turno e lucro, além de consumir uma unidade. Para orçamento abaixo da vitrine, vender pelo teto do cliente; ofertas abaixo do custo precisam ser recusadas.
4. **Reparo:** aceitar uma ordem e avançar o relógio. O técnico fica ocupado e a receita/lucro entram apenas ao concluir. Um segundo reparo enquanto o técnico está ocupado deve informar o bloqueio.
5. **Consequência de recusa:** dispensar um cliente. Confirmar uma venda/reparo perdido, a mensagem de consequência e queda de reputação (maior para urgência alta).
6. **Consequência de espera:** deixar um cliente aguardando até a paciência zerar. Confirmar que ele sai, conta como perdido e reduz reputação; o cliente selecionado não pode continuar no balcão depois de sair.
7. **Evento TechTok:** iniciar novos turnos até aparecer **Nina do TechTok** (ou criar o estado em teste). Fechar uma venda com ela e confirmar a mensagem de postagem, +4 de reputação e destaque no relatório. Se ela sair, a penalidade deve ser -7.
8. **Eventos de caos:** no turno com **Cupom vazou**, os dois próximos compradores devem ter orçamento menor e história do cupom. No turno com **Pico de energia**, o primeiro reparo deve receber 18 s extras e a mensagem do estabilizador.
9. **Fechamento → próximo dia:** deixar o cronômetro chegar a zero com alguém ainda na fila. Conferir receita, lucro (já descontando custo dos itens), clientes perdidos e reputação; quem ficou esperando precisa sair no fechamento, sem atravessar magicamente para o próximo dia. Abrir o dia seguinte e confirmar nova meta e cronômetro reiniciado.

## Regressões

1. **Compra:** comprar estoque; confirmar redução imediata do caixa e aumento de despesas, sem alteração em receita.
2. **Salários:** avançar até o mês seguinte; confirmar uma única cobrança de todos os salários e que ela usa o tempo do jogo.
3. **Pausa:** pausar; confirmar que tempo, fila, paciência, reparos e caixa não são alterados.
4. **Identidade:** deixar clientes entrarem e saírem por mais de uma fila. Os nomes exibidos devem permanecer únicos durante a sessão, mesmo quando a fila é limpa.

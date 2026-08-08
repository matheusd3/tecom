# Cenários de validação do núcleo

1. **Atendimento manual:** iniciar o jogo, retomar o relógio e esperar um cliente. Confirmar que o relógio pausa automaticamente e a mesa de atendimento mostra o pedido, orçamento, custo e estoque.
2. **Venda:** clicar em `Vender` para um cliente com orçamento suficiente e confirmar que caixa e receita aumentam pelo preço escolhido; estoque diminui em uma unidade.
3. **Negociação:** para um cliente cujo orçamento seja menor que o preço de vitrine, mas maior que o custo, confirmar que o botão `Negociar` fecha a venda pelo orçamento do cliente. Ofertas abaixo do custo devem ficar indisponíveis.
4. **Recusa e estoque:** recusar um cliente ou atender um pedido sem estoque; confirmar que o cliente sai, a venda perdida aumenta e o consultor sugere reposição quando aplicável.
5. **Reparo manual:** aceitar um reparo na mesa de atendimento; confirmar que um técnico fica ocupado, a ordem entra em andamento e a receita só aparece ao concluir.
6. **Compra:** comprar estoque; confirmar redução imediata do caixa e aumento de despesas, sem alteração em receita.
7. **Fila técnica:** aceitar um reparo e avançar o tempo; quando o técnico estiver ocupado, confirmar que outro reparo não pode ser aceito e que a contratação de técnico resolve o bloqueio.
8. **Salários:** avançar até o mês seguinte; confirmar uma única cobrança de todos os salários e que a cobrança usa o tempo do jogo, inclusive com o navegador aberto por muito tempo.
9. **Pausa:** pausar; confirmar que tempo, fila, paciência, reparos e caixa não são alterados.

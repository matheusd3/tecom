# Cenários de validação do núcleo

1. **Venda:** iniciar o jogo, esperar por um cliente de produto com orçamento suficiente e confirmar que caixa e receita aumentam pelo preço de venda; estoque diminui em uma unidade.
2. **Estoque:** definir o estoque de um item procurado como zero e confirmar que o cliente sai, `missedSales` aumenta e o consultor sugere reposição.
3. **Preço:** definir preço superior ao orçamento de um cliente; confirmar venda perdida e recomendação para rever preço após acumular perdas.
4. **Compra:** comprar estoque; confirmar redução imediata do caixa e aumento de despesas, sem alteração em receita.
5. **Reparo:** esperar cliente de assistência; confirmar técnico ocupado, ordem pendente e, ao finalizar, receita e satisfação atualizadas.
6. **Fila técnica:** com técnico ocupado, acumular dois pedidos de reparo; confirmar a oportunidade de contratar técnico.
7. **Salários:** avançar até o mês seguinte; confirmar uma única cobrança de todos os salários e que a cobrança usa o tempo do jogo, inclusive com o navegador aberto por muito tempo.
8. **Pausa:** pausar; confirmar que tempo, fila, paciência, reparos e caixa não são alterados.

# Contexto do projeto — Tech Store Tycoon

## Objetivo

Criar um jogo web de gerenciamento de uma loja de informática. O jogador administra vendas, estoque, manutenção de eletrônicos, funcionários e finanças. Um consultor de negócios deve identificar problemas e oportunidades que o jogador talvez não perceba.

## Direção visual

- Nome de trabalho: **Tech Store Tycoon**
- Estilo: **Neon Commerce Tycoon**
- Dashboard retro-futurista inspirado nos anos 80/90.
- Fundo escuro (`#0F1419`) com destaques em ciano, magenta e verde-lima.
- Interface clara e funcional: informações importantes devem ser compreendidas rapidamente.

## Estado relatado pela ferramenta anterior (Manus)

O Manus informou que iniciou uma implementação com Babylon.js e que já havia:

- Uma cena 3D renderizada com fundo escuro.
- Um dashboard HTML sobreposto ao canvas.
- Controles de pausar/reproduzir e velocidade do tempo.
- Abas de Dashboard e Oportunidades.
- Painéis para finanças, vendas, funcionários, estoque e clientes ativos.
- Clientes gerados aleatoriamente.
- Lógica de vendas, margem influenciada por habilidade e reparos.
- Geração de oportunidades de negócio.

**Importante:** no diretório atual não há arquivos do projeto. Portanto, isso deve ser tratado como especificação de reconstrução, não como código existente a ser alterado.

## Mecânicas essenciais

### Ciclo de jogo

1. O tempo avança em dias/horários e clientes chegam à loja.
2. O jogador vende produtos disponíveis ou registra equipamentos para manutenção.
3. Vendas e reparos atualizam caixa, reputação, estoque e satisfação.
4. Custos recorrentes (aluguel, salários, contas) são cobrados.
5. O consultor apresenta alertas e oportunidades acionáveis.

### Produtos e estoque

- Categorias iniciais: notebooks, desktops, periféricos, peças e acessórios.
- Cada produto deve ter custo, preço de venda, estoque, demanda e margem.
- Compra de estoque deve ter prazo de reposição e risco de excesso/parado.

### Vendas

- Clientes chegam com orçamento, necessidade e paciência.
- A chance de conversão considera preço, estoque, reputação e habilidade do atendente.
- Registrar receita, custo, lucro, itens vendidos e cliente perdido.

### Assistência técnica

- Ordens de serviço com equipamento, defeito, urgência, orçamento, peças necessárias e prazo.
- Diagnóstico deve poder revelar custo/tempo antes de aceitar o reparo.
- Atrasos, erro técnico e falta de peças afetam satisfação e reputação.

### Funcionários

- Funções: atendimento, técnico e gerente (pode começar com um único funcionário por função).
- Atributos: salário, habilidade, velocidade, atendimento e confiabilidade.
- Contratar/demitir deve ter efeito financeiro e operacional evidente.

### Finanças

- Caixa, receita, custos, lucro, despesas fixas e histórico por dia.
- Evitar números sem explicação: mostrar de onde vem cada alteração relevante.

### Consultor de oportunidades

Esse sistema é o diferencial. Ele deve encontrar padrões e recomendar ações concretas, por exemplo:

- "Você perdeu 6 vendas de SSD por falta de estoque. Repor 20 unidades pode gerar lucro estimado de R$ X."
- "Reparos de tela têm alta margem, mas estão atrasando por falta de técnico."
- "O notebook A está parado há muitos dias; faça promoção ou reduza a próxima compra."
- "Seu preço está acima da concorrência/demanda; teste redução de preço."
- "Clientes estão saindo por espera alta; contrate atendimento ou reduza velocidade do jogo."

Cada oportunidade deve conter: causa observada, impacto estimado, prioridade e uma ação que o jogador possa executar.

## Escopo recomendado para primeira versão jogável

1. Projeto web local com uma tela única responsiva.
2. Dashboard e loop de tempo funcionando.
3. Produtos, estoque, chegada de clientes e vendas.
4. Ordens de serviço e reparos básicos.
5. Caixa, custos diários e indicadores principais.
6. Painel de oportunidades baseado em regras simples e transparentes.
7. Controles para comprar estoque, ajustar preço e contratar funcionário.
8. Salvar/carregar estado no navegador.

Não é necessário começar com 3D. Uma interface 2D bem acabada e uma simulação sólida têm prioridade. Babylon.js pode ser adicionado depois apenas se uma cena de loja realmente melhorar a experiência.

## Critérios de aceitação

- O jogador entende sua situação financeira em poucos segundos.
- Há decisões com trade-offs claros entre caixa, equipe, estoque, preço e reputação.
- O consultor mostra recomendações úteis, explicáveis e acionáveis.
- Não há telas ou botões decorativos sem efeito real.
- A sessão pode ser salva e retomada no mesmo navegador.

## Próximo passo para quem assumir

Inspecione o diretório antes de iniciar. Como ele está vazio neste momento, crie a base do projeto e implemente a primeira versão jogável conforme o escopo acima. Ao terminar cada recurso, verifique no navegador se a interação e os indicadores realmente atualizam.

# Fase 5 — a equipe passa a fazer falta

Continuação da Fase 4. Antes de mexer, leia a seção 5 do `FASE3_MELHORIAS.md`
(armadilhas da cena) e a seção 6 (como testar com o painel do navegador oculto —
ganhou três itens novos sobre medição de layout).

O tema desta fase é um só: **hoje o jogador dá conta da loja sozinho**, e por
isso contratar é decoração. Tudo aqui existe para transformar a equipe em
decisão — e para tirar da frente o que virou clique repetido.

---

## 1. Diagnóstico: por que ninguém precisa contratar

Não é impressão de quem joga, são três números do código:

- **A folha quase nunca é cobrada.** `processPayroll` dispara a cada
  `MONTH_SECONDS = 14_400` s de jogo. Com `SHIFT_DURATION = 120`, isso é **um
  desconto a cada 120 turnos**. Contratar custa `salary * 2` uma vez e depois é
  de graça para sempre.
- **O gerente não existe.** `EmployeeRole` tem `"manager"`, `LIMITE_EQUIPE` dá
  uma vaga — e não há uma única linha que leia esse papel. Contratar gerente
  hoje é queimar R$ 6.000 por nada.
- **A demanda não passa de uma pessoa.** A fila tem teto de 3 (5 com
  `segundoBalcao`) e o cliente nasce a cada 7–15 s. Em 120 s isso é uma carga
  que um atendente com carrinho cobre andando.

E a linha do carrinho de atendimento, que entrou na fase passada, **piorou
isso**: ela aumentou de propósito a vazão de uma pessoa só. Ela não está errada
— só precisa de uma demanda que a alcance.

---

## 2. Ritmo: a fila tem de passar do que uma pessoa aguenta

Duas alavancas, e as duas precisam andar juntas. Só encher a fila deixa o jogo
injusto; só cobrar a folha deixa o jogo pobre.

### 2.1 A folha passa a pesar todo dia

Trocar a cobrança mensal por **cobrança no fechamento de cada turno**:
`salary / 30` por funcionário (o salário é mensal, o turno é um dia).

Com isso, um técnico de R$ 2.500 custa ~R$ 83 por dia contra uma meta que começa
em R$ 900. Três contratados são ~R$ 250/dia: dá para sentir, não quebra.

Como a despesa virou recorrente, o custo de entrada cai de `salary * 2` para
`salary * 1` — senão contratar no começo fica proibitivo duas vezes.

O relatório de fechamento precisa mostrar essa linha separada. Número que sai do
caixa sem aparecer é exatamente o que o `CLAUDE.md` proíbe.

### 2.2 A demanda cresce com o dia

- Teto da fila: `3 + floor(dia / 3)`, somando o `segundoBalcao` como hoje.
- Intervalo de chegada: interpolar de 7–15 s no dia 1 até 4–9 s no dia 8.
- A reputação continua influenciando, e `letreiroRua` continua acelerando.

**Critério de pronto do ritmo:** por volta do **dia 4**, um jogador competente
jogando sozinho deve perder cliente por espera. Não "pode perder" — deve. É esse
o momento em que contratar deixa de ser opcional.

---

## 3. Aprovação de preço: um cartão, valor preenchido, dois sentidos

Hoje o desconto abre um cartão e o jogador ainda decide o valor. Na prática ele
sempre aprova, então é um clique a mais sem decisão.

**Como fica:** o cartão chega com o **valor já preenchido** e o jogador só
aprova ou recusa. E passa a valer nos dois sentidos:

- **Cliente paga menos que a vitrine** → cartão de desconto (é o que já existe,
  via `pendingDiscount`).
- **Cliente aceitaria pagar mais que a vitrine** → cartão de ágio, com o valor
  que ele topa. Aprovar rende mais; a reputação sente se virar hábito.

O segundo caso é novidade e é o que dá sal à decisão: sempre aprovar deixa de
ser a resposta certa.

Reaproveitar a estrutura que já existe (`DiscountRequest`, `approveDiscount`,
`declineDiscount`, o cartão do `GameUI`), generalizando o nome — é o mesmo fluxo
com o sinal invertido.

---

## 4. O consultor sai do painel e vira contratação

Hoje o consultor é uma aba sempre ligada, de graça. Ele passa a ser **um cargo
que se contrata** (`EmployeeRole` ganha `"consultant"`).

- **Não é personagem na cena.** Ele não anda pela loja, não ocupa espaço, não
  precisa de boneco. É um serviço.
- Sem consultor contratado, a aba **continua existindo**, mas mostra só o convite
  para contratar — e um único alerta grave por turno, de graça.
  Isso não é generosidade: sem nenhuma pista, quem está começando não descobre
  que existe reposição de prateleira.
- Com consultor contratado, volta tudo o que ele faz hoje: dicas de preço, o que
  comprar, e os botões que executam a recomendação.

Melhoria comprável no catálogo: **"consultor sênior"**, que aumenta o número de
apontamentos por turno e melhora a estimativa de lucro.

---

## 5. O gerente entra — e esse é personagem

`EmployeeRole` já tem `"manager"` e ninguém lê. Passa a valer:

- **É personagem na cena**, com boneco próprio (usar `criarEquipe` em
  `store/staff.ts`, que já monta e movimenta a equipe).
- **Aprova preço sozinho.** Com gerente contratado, o cartão da seção 3 deixa de
  parar o jogo: ele decide segundo uma regra simples e visível (aprova desconto
  até X% e ágio sempre), e o jogador vê no feed o que foi aprovado. É a mesma
  troca do bebedouro automático — paga-se para eliminar uma chatice.
- **Deixa os atendentes mais rápidos**: reduz o `busyUntil` do vendedor e do
  auxiliar em ~20%.
- Vaga continua sendo uma só.

**Cuidado com a cena:** o gerente andando pelo salão obedece a mesma regra de
oclusão de todo mundo, e a colisão sai de `layout.ts`. Não escreva colisor à
mão.

---

## 6. Melhorias que deixam a equipe mais inteligente

O campo `skill` já existe em `Employee` e mal muda o jogo. Duas melhorias novas
para o catálogo, na camada 2 ou 3 (ver `tier` e `requer` em
`CATALOGO_MELHORIAS`):

| melhoria | efeito | resolve |
|---|---|---|
| Treinamento da bancada | +15 de `skill` em todo técnico, atual e futuro | `reparo` |
| Manual de atendimento | +15 de `skill` em vendedor e gerente; gerente passa a aprovar melhor | `movimento` ou `fila` |

`skill` já entra no preço do reparo, na duração e na satisfação — então subir
`skill` já tem efeito, só falta a alavanca para o jogador puxar.

---

## 7. Café da espera passa a acabar

Hoje `cafeDaEspera` é comprado uma vez e vale para sempre. Ele vira um consumível
como a água: o pacote de café acaba e alguém repõe pegando no almoxarifado.

**A decisão de design que importa aqui:** o galão de água é **exclusivo do
jogador** de propósito, e essa regra é o que faz aquela mecânica existir. O café
tem de ser o contrário — **qualquer auxiliar pode repor**.

Se os dois fossem tarefa exclusiva do jogador, a Fase 5 entregaria duas idas ao
almoxarifado em vez de uma decisão. Sendo o café delegável, ele vira exatamente
o argumento que falta para contratar: sozinho, o jogador escolhe entre repor o
café e atender a fila; com equipe, não escolhe.

Melhoria comprável: **"cafeteira automática"**, o par do bebedouro automático.

Reaproveitar o caminho do galão: `TipoCarga` ganha o pacote, `Estacao` ganha o
ponto de café, o móvel entra em `MOVEIS` (a colisão vem de graça) e o núcleo
ganha `nivelDoCafe` + `reporCafe()`.

---

## 8. Pendências herdadas da Fase 4

- **Ícone de cansaço na cena.** A seção 2 da Fase 4 pedia gotinha sobre a cabeça
  de quem está abaixo de 40 de ânimo. A mecânica está pronta (`cansar()`, o
  ritmo 25% mais lento, o corte em 20), mas `store/staff.ts` não desenha nada —
  o ânimo só aparece no painel. O mecanismo é o mesmo do balão de pedido
  (`definirPedido`), com outra textura.

---

## 9. Contratos desta base que NÃO podem quebrar sem conversa

Coisas que entraram nas últimas sessões e que é fácil desfazer sem perceber:

1. **Pausa é pausa.** Dez métodos do `GameWorld` chamam `this.pausado()` e
   recusam com o turno pausado, e a mesma barreira existe no `GameCanvas`,
   porque é ele que mexe direto nas mãos do jogador. Precisa dos dois lados.
2. **A carga do jogador é pilha, não slot.** `getCarried()`, `espacoLivre()` e
   `putDownItem(filtro)` são o caminho certo; `putDownProduct()` esvazia tudo e
   quase nunca é o que se quer.
3. **A oferta de melhoria tem três papéis** (consultor, sorteio, cabe no caixa) e
   camadas liberadas por dia. Melhoria nova precisa de `tier` e `resolve`.
4. **Nada acima de ~1,3 de altura no meio do salão** (armadilha 1 do FASE3).
5. **Letreiro de estação precisa de material próprio**, senão acende o de outra
   estação junto.

---

## 10. Ordem sugerida

1. Folha por turno + demanda que cresce (seção 2) — é o que dá sentido a tudo
   que vem depois, e dá para sentir na hora.
2. Gerente de verdade (seção 5), porque é o primeiro cargo que compensa.
3. Cartão de aprovação com valor preenchido e ágio (seção 3), já com o gerente
   podendo assumir.
4. Consultor como contratação (seção 4).
5. Café consumível (seção 7) e as melhorias de `skill` (seção 6).
6. Ícone de cansaço (seção 8).

`npm run check` e `npm run build` a cada etapa, e um turno completo jogado no
navegador antes de dar por pronto.

---

## 11. Critério de pronto da fase

- No **dia 4**, jogando sozinho e bem, o jogador perde cliente por espera.
- Contratar o primeiro atendente muda isso de forma perceptível no mesmo dia.
- O relatório de fechamento mostra a folha do dia como linha própria.
- Com gerente contratado, nenhum cartão de preço interrompe o turno, e o feed
  diz o que ele aprovou.
- Sem consultor contratado, a aba explica como contratar e ainda dá um alerta
  grave por turno.
- O café acaba dentro de um turno movimentado, e um auxiliar livre repõe sozinho.

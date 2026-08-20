# Fase 6 — o jogo passa a ter fim

Antes de mexer, leia a seção 5 do `FASE3_MELHORIAS.md` (armadilhas da cena) e a
seção 6 (como testar com o painel oculto), a seção 9 do `FASE5_EQUIPE.md`
(contratos que não podem quebrar) e a seção 1 do `FASE4_BEBEDOURO.md`.

O tema desta fase é um só: **o jogo acaba de conteúdo no dia 15 e não avisa.**
Tudo aqui existe para dar começo, meio e fim — e para que as ideias novas
entrem como degraus de uma escada, não como mais sorteio.

---

## 1. Diagnóstico medido — o que estamos consertando

Simulação headless do `GameWorld` (esbuild + node, sem navegador), 5 partidas de
40 dias, pilotadas por um jogador ideal: teleporta, atende no instante em que
dá, repõe de graça, aprova todo desconto, compra a melhoria recomendada e
contrata quando sobra caixa.

| Medida | Resultado |
|---|---|
| Catálogo de melhorias esgotado | **dia 15, em 5 de 5 partidas** |
| Meta batida entre os dias 25 e 40 | 0 a 1 partida de 5 |
| Caixa no dia 40 falhando a meta quase todo dia | **R$ 424 mil** — nunca ficou negativo |
| Lucro por turno depois do dia 13 | oscila em torno de R$ 2.500, sem tendência |
| Meta por turno | `900 + 180 × (dia − 1)`, uma reta sem teto |

Três conclusões, e nenhuma é opinião:

1. **Do dia 15 em diante o fechamento oferece uma tela vazia.** São 14
   melhorias e uma oferta por dia.
2. **A meta virou decoração.** Ela cruza o lucro típico por volta do dia 13 e
   nunca mais é alcançada — e falhar não custa nada, porque o caixa continua
   subindo.
3. **O jogador real vai pior que a medição.** A simulação teleporta; quem joga
   anda com WASD e carrega no máximo 4 itens. O dia em que a meta fica
   inalcançável de verdade é *antes* do 13.

**Regra que sai daí, e que vale para tudo nesta fase:** evento novo que não
sobe degrau não conta. Adicionar cinco eventos sorteados a um jogo que já tem
três deixa os dias 1 a 15 mais variados e continua acabando no dia 15.

---

## 2. Seu Zé — o antigo dono

Seu Zé não é o jogador. É o velho dono, que está passando a loja adiante e fica
os primeiros dias ensinando antes de ir embora.

Essa escolha resolve três problemas de uma vez:

- **O tutorial vira uma pessoa**, não uma caixa de texto. Quem ensina a atender
  é alguém que atende há trinta anos, e as instruções saem como fala dele.
- **O arco ganha abertura e relógio.** O dia em que o Seu Zé vai embora é uma
  data marcada desde o começo — o tutorial tem fim declarado, e o jogo tem um
  "agora é com você".
- **Sobra uma voz para o consultor.** Depois que sai, ele continua aparecendo de
  vez em quando como freguês. É a fresta por onde o jogo comenta o que está
  acontecendo sem virar painel.

### A história — decidida em 20/08/2026

**Ele está se aposentando.** Não é doença nem fracasso: é idade e hora. Isso
importa para o tom — o Seu Zé não está fugindo da loja, está entregando uma
coisa que deu certo por trinta anos. Ele ensina com orgulho, não com pena, e é
por isso que o tutorial pode ser afetuoso sem ser triste.

**Ele deixa três coisas, e cada uma é mecânica, não só enfeite.** Essa é a
regra: história em jogo de simulação que não vira número não é história, é
texto de abertura que o jogador pula.

| O que ele deixa | O que isso É no jogo |
|---|---|
| **A dívida** | Parcela fixa cobrada no fechamento, antes do lucro. É a razão de a meta existir e o caminho da derrota da seção 4: atrasar tem aviso, acumular tira a loja. |
| **O fornecedor de confiança** | Preço de custo melhor que o do mercado, por relação e não por contrato — vale enquanto a reputação segurar. É a primeira coisa que o jogador perde por jogar mal, e perde de um jeito que dá para ver. |
| **O filho que não quis o negócio** | O rosto da derrota. É ele quem aparece quando a dívida aperta, oferecendo comprar a loja de volta por pouco. Aceitar é desistir; recusar é assumir mais um mês. |

O filho resolve um problema que a seção 4 deixou em aberto: derrota em jogo de
loja costuma ser uma tela de "você faliu", que não dói. Uma pessoa batendo na
porta com uma oferta ruim dói, e ainda dá ao jogador a chance de recusar.

**A loja já se chama Seu Micro, e o nome é dele.** "Seu Zé", "Seu Micro" — é o
mesmo "seu". A loja tem o nome do dono.

E é isso que fecha o tutorial: no último dia, antes de ir embora, ele pede que
o jogador **mantenha o nome**. Não é escolha de menu nem opção de configuração —
é um pedido, e o jogo o trata como pedido. O letreiro na parede do fundo
(`props.ts`) passa a ser a coisa que o jogador está segurando pelos trinta dias
seguintes, e a vitória da seção 4 é o letreiro continuar lá.

### Por que essa história resolve o arco

Ela não é pano de fundo: ela **é** a estrutura que faltava.

- A dívida dá à meta diária um motivo que "bater a meta" nunca teve.
- O fornecedor dá à reputação uma consequência visível — hoje reputação é um
  número que sobe e desce sem morder.
- O filho dá cara à derrota.
- O nome dá cara à vitória.

Ou seja: o começo, o meio e o fim do jogo saem todos da mesma pessoa, e não de
quatro sistemas independentes que por acaso terminam no dia 30.

### Contrato da cena

Seu Zé é um `Personagem` como qualquer outro (`characters.ts`) e mora no posto
atrás do balcão. **Ele não é `seller-1`** — esse é o boneco do jogador
(`staff.ts`, `ID_DO_JOGADOR`). Ele também não entra em `state.employees`: não
tem salário, não conta na folha, não aparece na contratação. É um NPC com posto
fixo enquanto durar o tutorial.

---

## 3. O tutorial — Seu Zé mostra, o jogador faz

Formato: **nunca explica o que o jogador ainda não precisa.** Cada passo aparece
quando a situação que ele resolve acontece pela primeira vez.

| Quando | O que Seu Zé faz |
|---|---|
| Loja abre no dia 1 | Aponta o balcão e manda o jogador atender o primeiro cliente com `E` |
| Prateleira zera pela primeira vez | Manda buscar no almoxarifado e mostra a viagem |
| Primeiro aparelho de conserto | Leva junto até a bancada, uma vez só |
| Bebedouro esvazia | Explica que cliente com sede vai embora mais rápido |
| Primeiro fechamento | Lê o relatório junto e explica a oferta de melhoria |
| Último dia dele | Se despede e **pede que o jogador mantenha o nome da loja**. Fim do tutorial, começo do arco. |

Regras que não podem ser quebradas:

- **Passo que o jogador já fez sozinho não aparece.** Quem descobriu o `E`
  antes de mandarem não leva aula sobre o `E`.
- **O tutorial PARA o relógio.** ⚠️ Corrigido em 20/08/2026, jogando: as falas
  do Seu Zé caem no meio do turno, e ler enquanto a paciência da fila corre é
  ler com prejuízo. A regra anterior ("o tutorial não pausa") vinha de uma
  leitura errada do contrato 1 da Fase 5 — aquele contrato protege a pausa do
  JOGADOR de ser burlada, e não impede o jogo de parar o próprio relógio.

  As duas pausas passaram a ser coisas diferentes (`pausadoPeloJogo`). O jogo
  só desfaz a que ele mesmo fez: se o jogador já tinha pausado, a pausa
  continua sendo dele e responder o cartão não devolve o relógio. Encostar no
  botão de pausa também transfere a posse — a partir daí o jogo não retoma
  sozinho. E as ações que respondem aos cartões continuam valendo com o relógio
  parado pelo jogo, senão os botões apareceriam mortos e pareceria travamento.
- **Tem como pular.** Quem já jogou não passa por isso de novo — e o estado de
  "já vi o tutorial" vai no save, não em variável de sessão.

---

## 4. O arco — o que fecha o jogo

Substituir a meta que sobe para sempre por uma temporada com data de fim.

- **Duração alvo: 30 dias.** Cabe no save (~230 KB medidos no dia 30) e é o
  dobro do conteúdo que existe hoje.
- **Objetivo declarado no dia 1**, pelo Seu Zé, em dinheiro ou em reputação —
  não em "sobreviva".
- **Vitória** no dia 30 com o objetivo cumprido — dívida quitada e reputação
  70 ou mais. E a vitória tem imagem: o letreiro do Seu Micro continua na
  parede, que é exatamente o que o Seu Zé pediu ao sair.
- **Fim sem objetivo:** chegou ao dia 30 de pé, mas com dívida em aberto ou a
  freguesia perdida. A loja é sua e o pedido não foi cumprido — é o final mais
  comum de uma primeira partida, e é de propósito.
- **Derrota que morde:** hoje o caixa nunca fica negativo em 40 dias. A causa
  é a **dívida do Seu Zé** (seção 2): parcela cobrada no fechamento, antes do
  lucro. Atrasar dá aviso; acumular traz o filho dele à porta com uma oferta
  ruim pela loja. O jogador vê chegando, tem dois ou três dias para reagir e
  pode recusar a oferta para ganhar mais um mês. Derrota que chega sem aviso é
  bug, não desafio — e derrota que é só uma tela de "você faliu" não dói.

A meta diária continua existindo, mas passa a ser o degrau do mês, não uma reta
infinita: ela para de subir no dia 10 (`900 + min(dia-1, 9) × 180` = R$ 2.520),
que é onde o lucro típico medido estaciona.

### Sintonia medida — 20/08/2026 ✅ FEITO

A dívida é de **R$ 130.000 em cinco parcelas crescentes** (10, 14, 22, 34 e 50
mil), nos dias 6, 12, 18, 24 e 30. Crescentes por medição, não por gosto: o
caixa do jogador nos dias de vencimento é 24k, 27k, 96k, 163k e 249k — quase
parado até o dia 12 e explodindo depois, porque do dia 15 em diante o catálogo
de melhorias acaba e nada mais consome dinheiro. Parcela fixa contra essa curva
é sufoco no começo e decoração no fim.

Com as parcelas crescentes, o caixa que sobra depois de cada uma vira 9k, 29k,
67k, 112k e 145k — aperto de verdade na primeira e pressão até o fim.

Os quatro finais em 6 partidas por faixa, com o jogador headless ignorando uma
fração dos clientes:

| Descuido | Resultado | Reputação média |
|---|---|---|
| 0% | 6 vitórias | 97 |
| 15% | 6 fins sem objetivo | 36 |
| 30% | 6 fins sem objetivo | 9 |
| 40% | 5 sem objetivo, 1 derrota por dívida | 4 |
| 55% | 5 derrotas por dívida, 1 sem objetivo | 2 |
| 70% | 6 derrotas por dívida | 0 |

O filho aparece em 2 de 6 partidas aos 40% de descuido e em 6 de 6 aos 55%.

**Ponto de atenção para a próxima sintonia:** a reputação cai muito rápido —
97 com jogo perfeito, 36 perdendo 15% dos clientes. Na prática o limiar de 70
exige menos de ~7% de clientes perdidos, o que faz da vitória um objetivo duro.
É comportamento herdado (`loseCustomer`), não introduzido pelo arco, mas é o
primeiro número a mexer se a temporada ficar frustrante demais.

---

## 5. A escada dos eventos

Cinco ideias novas, ordenadas por degrau. Cada uma destrava a seguinte — é isso
que separa "mais conteúdo" de "conteúdo que dura".

### 5.1 A blogueira — degrau 1 ✅ FEITO 20/08/2026

Chega com o celular quebrado e pede o conserto de graça. Aceitar custa tempo de
bancada e peça; recusar não custa nada hoje.

**É a primeira decisão do jogo cuja consequência não cabe em 120 segundos** —
hoje tudo resolve dentro do turno. Já existe o evento `influencer` ("TechTok na
fila") disparando em 28% dos turnos sem fazer quase nada: esta é a versão dele
com dente.

**Como ficou:** ela só entra com a bancada JÁ ocupada — é a regra que impede
"aceitar" de ser de graça. Aceitar não fatura nada e ocupa a bancada; o retorno
vem quando o aparelho fica PRONTO, em três dias de movimento extra
(`FATOR_DO_IMPULSO` = 0,62) e +8 de reputação. Recusar custa 6 de reputação na
hora. Enquanto ela espera resposta, nem o jogador nem o auxiliar podem receber
o aparelho: favor da casa não é decisão do balcão.

Medido em 5 partidas de 30 dias com jogador headless que contrata: sempre
aceitar dá 5 vitórias com reputação média 100 e 14 clientes perdidos; nunca
aceitar dá 5 vitórias com reputação 85 e 17 perdidos.

**A blogueira para o relógio uma vez só.** Na primeira aparição da partida a
regra dela é nova e precisa ser lida com calma. Da segunda em diante o relógio
correndo É o custo da decisão: ela só chega com a bancada cheia, e deliberar de
graça enquanto a fila congela tiraria justamente o que faz disso uma escolha.

**Ponto a observar jogando:** nessa medição aceitar sai melhor nas duas contas,
o que roça no "se aceitar for sempre certo, não é decisão". O custo existe e é
a bancada — só não morde um jogador que contratou técnicos suficientes. Com um
técnico só ele deve doer de verdade. É a primeira coisa a conferir na mão.

### 5.2 O bêbado — degrau 1 ✅ FEITO 20/08/2026

Entra, atrapalha, derruba a paciência de quem está na fila. Sai quando o
jogador chega perto e manda sair.

**Todo motivo de andar pela loja hoje é logística** — buscar, levar, repor. Ele
é o primeiro motivo de andar que não é carregar coisa. Barato de fazer e muda o
ritmo do turno.

**Como ficou:** enquanto ele está no salão a paciência da fila cai 1,8× mais
rápido — medido: 9,5 pontos perdidos em 10 s sem ele, 17,1 com ele. Some sozinho
em 45 s, ou quando o jogador chega a 2,2 de distância e aperta E (+2 de
reputação). Um por turno, e nunca nos últimos 45 s, quando não daria tempo de
atravessar a loja.

**Armadilha da cena:** cliente não colide, o jogador sim (`FASE3` §5.4). O
bêbado segue a regra dos clientes; a interação é por distância ao boneco, como
`estacaoEm` faz com os móveis. Quem mede a distância é a CENA
(`bebadoAoAlcance`), não o núcleo — o núcleo não sabe onde ninguém está.

O `E` resolve o bêbado ANTES de qualquer estação. Se o jogador atravessou a
loja até ele, é isso que a tecla tem de fazer; deixar a estação ganhar faria o
`E` "não funcionar" bem no momento em que ele parece mais óbvio.

### 5.3 O segurança — degrau 2 (a partir do dia ~10)

Contratação nova. Consome água e café como o resto da equipe, e **quando o
suprimento falha ele se distrai.**

Esta é a ideia mais forte da lista, e por um motivo estrutural: hoje bebedouro e
café são tarefa — você abastece porque tem que abastecer. Um funcionário cuja
atenção *depende* do abastecimento transforma uma tarefa chata numa linha de
suprimento com consequência, e reaproveita a Fase 4 inteira de graça.

### 5.4 O assalto — degrau 3 (a partir do dia ~15, frequência sobe com o caixa)

**Decisão com relógio, não briga.** O bandido entra e começa a contagem:

| Escolha | Custo |
|---|---|
| Botão de pânico | Perde o caixa da gaveta; o dia fecha mais cedo |
| Entregar | Perde mais dinheiro e cai reputação |
| O segurança intercepta | De graça — *se* ele estiver com água e café em dia |

Combate ficou de fora por decisão tomada: detecção de acerto, animação e uma
regra para quando o jogador perde a briga seriam a maior parte de trabalho da
fase, para uma coisa que aparece raramente, e mudariam o tom do jogo e a
classificação indicativa na Steam. Esta versão guarda a tensão inteira e faz o
segurança valer o salário.

### 5.5 O marketplace — degrau 4 (última parte do arco)

Vender fora da loja, no online.

**Regra inegociável: consome prateleira e consome o seu tempo.** Se virar renda
passiva, ele compete com a loja e esvazia o jogo justamente por dentro, onde
ele é bonito. É um segundo canal que disputa estoque com o balcão, não uma
torneira.

É a peça maior da lista e a última a entrar.

---

## 6. Ordem sugerida

1. História do Seu Zé escrita (seção 2) — sem isso o tutorial não tem voz.
2. Seu Zé na cena, com posto fixo e falas do tutorial (seção 3).
3. O arco: objetivo, vitória, derrota com aviso (seção 4).
4. Blogueira e bêbado (5.1 e 5.2) — degrau 1, os dois baratos.
5. Segurança (5.3), e só então assalto (5.4) — o assalto sem segurança é só
   perda.
6. Marketplace (5.5).

---

## 7. Contratos desta fase

1. **Seu Zé não é `seller-1` e não entra em `state.employees`.** Sem salário,
   sem folha, sem vaga de contratação.
2. **O tutorial PARA o relógio, e só o jogo desfaz a pausa que o jogo fez.**
   Contrato 1 da Fase 5 continua valendo para a pausa do jogador: ela nunca é
   burlada nem devolvida sem ele pedir. Ver a seção 3.
3. **"Já vi o tutorial" e o progresso do arco vão no save**, no
   `criarInstantaneo()`. Estado de tutorial em variável de sessão volta a
   ensinar tudo de novo a cada recarga.
4. **Save novo pede versão nova.** Campo novo no `GameState` sem subir
   `VERSAO_SAVE` faz o save antigo voltar com o campo `undefined` — e o
   `restaurar()` aceita, porque a validação olha formato, não completude.
5. **Evento novo não vira só mais uma linha do `rollShiftEvent`.** Cada um tem
   degrau (seção 5) e uma condição de entrada ligada ao dia ou ao caixa.

---

## 8. Critério de pronto da fase

- Uma partida chega ao dia 30 e **termina** — com vitória ou com derrota.
- Existe pelo menos um caminho de derrota que um jogador desatento percorre, e
  ele recebe aviso antes.
- O fechamento nunca mostra a tela de oferta vazia.
- Quem recarrega a página no meio do arco volta no lugar certo, sem rever o
  tutorial.

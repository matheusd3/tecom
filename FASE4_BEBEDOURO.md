# Fase 4 — ânimo da equipe, bebedouro do jogador e correção do rodízio de tarefas

Continuação depois da Fase 3 (commit `012a098`). Antes de mexer, leia a seção 5
do `FASE3_MELHORIAS.md`: as armadilhas da cena continuam valendo (regra de
oclusão da câmera, colisão derivada da planta, estação por distância ao móvel,
tecla `E` morando no `GameCanvas`).

---

## 1. Correção primeiro: os auxiliares tropeçam um no outro

Dois defeitos relatados jogando, os dois na distribuição de tarefas
(`GameWorld.runSupportAttendant` / `darTarefaAoAuxiliar`):

### 1.1 Com dois auxiliares, os dois fazem a MESMA tarefa

O laço dá uma tarefa por auxiliar livre, mas cada chamada de
`darTarefaAoAuxiliar` **relê o estado do zero**. Quando a tarefa não muda o
estado de imediato, o segundo auxiliar escolhe o mesmo alvo do primeiro e os
dois saem andando juntos para o mesmo lugar.

Onde isso acontece hoje:

- **`repor`**: `produtoParaRepor()` devolve o produto mais vazio. O auxiliar A
  repõe 5 unidades; se o produto continuar sendo o mais vazio, B repõe o mesmo.
- **`levarReparo`**: o guarda existente é `reparoJaEmMaos`, que só cobre o
  status `returning`. Vale conferir se dois auxiliares conseguem mirar o mesmo
  cliente entre `receiveRepair` e `acceptRepair`.
- **venda**: essa está protegida, porque `sellToCustomer` muda o cliente para
  `leaving` na hora.

**Como corrigir:** dar ao laço uma memória da rodada. Um `Set` de alvos já
tomados (id de cliente, tipo de produto, id de reparo) montado antes do laço e
consultado dentro de `darTarefaAoAuxiliar` resolve sem tocar nas regras. Cada
auxiliar tem que sair com uma tarefa **diferente**; se só existe uma tarefa
disponível, o segundo fica parado — e tudo bem.

### 1.2 O auxiliar fica parado com venda esperando no balcão

Provável causa: `atendivel()` exclui `customer.id === selectedCustomerId`. Essa
regra existe para o auxiliar não roubar o cliente que o jogador priorizou — mas
o `selectedCustomerId` é setado **automaticamente** em vários caminhos (o `E` do
jogador no balcão, o `E` na prateleira ao pegar produto, o clique no cartão da
fila) e **nunca é limpo** enquanto o cliente estiver aguardando. Resultado: com
um cliente só na fila, ele fica reservado para o jogador e o auxiliar cruza os
braços.

**Como corrigir:** a reserva precisa expirar. Sugestão: guardar o instante da
seleção e só respeitar a reserva por ~10 s (ou enquanto o jogador estiver
carregando justamente o produto daquele cliente). Passou disso, o auxiliar pode
atender. Vale também limpar `selectedCustomerId` quando o jogador larga o
produto na prateleira.

**Critério de pronto:** com dois auxiliares e três clientes na fila, ver os dois
saindo para tarefas diferentes; e, com um cliente só esperando e o jogador longe
do balcão, ver o auxiliar assumir a venda em vez de ficar parado.

---

## 2. Ânimo da equipe que cai de verdade

Hoje `Employee.happiness` é enfeite: sobe +1 na venda, +2 no reparo, e só cai
(−15) se a folha estourar. Aparece no painel e não muda nada no jogo.

**Regra central: o ânimo cai por TRABALHO, não por relógio.** Empregado parado
ficando cansado pune o jogador por um dia fraco; desgaste proporcional ao
movimento se equilibra sozinho — loja cheia custa mais manutenção.

- −0,6 de ânimo por tarefa concluída (venda, viagem de reparo, reposição) e por
  conserto terminado.
- Efeito visível, porque número que não muda nada é decoração:
  - abaixo de **40**: a equipe trabalha ~25% mais devagar (duração de reparo e
    `busyUntil` do auxiliar).
  - abaixo de **20**: o auxiliar para de assumir tarefa nova (continua o que já
    começou).
- Piso em 0, sem penalidade extra; nada de funcionário pedindo demissão.
- Na cena: gotinha/ícone de cansaço sobre a cabeça de quem está abaixo de 40. O
  `Personagem` já tem o balão de pedido (`definirPedido`) — é o mesmo mecanismo
  com outra textura.

---

## 3. Bebedouro que só o jogador reabastece

O objetivo é dar ao jogador uma tarefa que a automação **não pode** tirar dele.
Hoje contratar faz a loja se resolver sozinha; a sede escala com o tamanho da
equipe, então quanto mais gente, mais trabalho seu.

### 3.1 Mecânica

- Bebedouro fica no salão, à direita, perto do cantinho de espera
  (sugestão: `x ≈ 9.5`, `z ≈ 4`). É chão vazio hoje e fica no caminho entre o
  balcão e a bancada: desvio curto, mas real.
- Ele tem um **galão com nível** (sugestão: 8 goles). Cada funcionário bebe a
  cada ~25 s de turno, ganhando **+8 de ânimo**.
- Galão vazio: ninguém bebe e o ânimo só cai.
- **Reabastecer é exclusivo do jogador.** O galão cheio fica no **almoxarifado**:
  `E` lá pega o galão, `E` no bebedouro troca. Nenhum auxiliar aceita essa
  tarefa — é a regra que faz a mecânica existir.

### 3.2 Reaproveitamento (não invente sistema novo)

A carga já existe e é o caminho certo:

- `TipoCarga` em `store/characters.ts` ganha `"galao"` (hoje tem `produto`,
  `aparelho`, `caixa`), com escala e cor próprias.
- O `GameHandle` em `scene.ts` ganha `getCarriedGallon()` / `pickUpGallon()`,
  no mesmo formato de `getCarriedRestock()` / `pickUpRestock()`.
- `Estacao` em `store/layout.ts` ganha `"bebedouro"`, e o móvel entra em
  `MOVEIS` — **a colisão vem de graça**, não escreva colisor à mão.
- A ação da tecla `E` entra no `interagirComEstacao` do `GameCanvas`, junto das
  outras estações.
- No núcleo: `nivelDoBebedouro` no `GameState` e um `abastecerBebedouro():
  ActionResult`.

### 3.3 Altura importa

O bebedouro fica **no meio do salão**: pela regra de oclusão da câmera, nada ali
pode passar de ~1,3 de altura. Bebedouro de escritório tem mais ou menos isso —
mas confira antes de dar por pronto, olhando se ele não apagou o chão atrás.

### 3.4 Fecha com a Fase 3

Vale acrescentar uma melhoria comprável ao catálogo: **"bebedouro automático"**
(sugestão: R$ 2.000), que reabastece sozinho e tira a tarefa do jogador. É
exatamente o que uma boa árvore de upgrades faz — você paga para eliminar uma
chatice, e a decisão tem custo.

---

## 4. Números de partida (ajustar jogando)

| item | valor |
|---|---|
| goles por galão | 8 |
| intervalo entre goles por funcionário | ~25 s |
| ânimo por gole | +8 |
| ânimo por tarefa concluída | −0,6 |
| limiar "devagar" | 40 |
| limiar "para de aceitar tarefa" | 20 |

Com 3 a 5 funcionários num turno de 120 s isso dá cerca de um galão por turno:
lembra o jogador de existir sem virar babá.

---

## 5. Ordem sugerida

1. Correção do rodízio de tarefas (seção 1) — é bug, vem antes.
2. Ânimo caindo por trabalho + efeito no ritmo (seção 2), já visível no painel.
3. Bebedouro com galão e reabastecimento pelo jogador (seção 3).
4. Melhoria "bebedouro automático" no catálogo (3.4).

`npm run check` e `npm run build` a cada etapa, e um turno completo jogado no
navegador antes de dar por pronto. Se o painel do navegador estiver oculto, a
seção 6 do `FASE3_MELHORIAS.md` explica como capturar a tela.

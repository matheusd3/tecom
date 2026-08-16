# Fase 3 — melhorias entre dias, feedback na cena e consultor acionável

Documento de passagem. Escrito depois da sessão que construiu a loja 3D, o
almoxarifado e a logística de atendimento. Quem pegar daqui não precisa
reconstruir contexto: está tudo abaixo, inclusive as armadilhas que já custaram
retrabalho.

---

## 1. Onde o jogo está hoje

Turno de 120 s. O jogador controla um atendente em 3ª pessoa (WASD/setas, `E`
para interagir) dentro de uma loja 3D fixa. Tudo que é decisão econômica mora no
`GameWorld`; a cena e o React só leem e chamam métodos.

**Ciclo de venda:** cliente entra pela porta, anda até a fila do balcão (2,5 s de
travessia, ninguém pode ser atendido antes disso), o atendente pega o produto na
**prateleira**, leva ao **balcão** e fecha. Preço de vitrine é o padrão; se o
orçamento do cliente é menor, abre um cartão de aprovação — o atendente não
decide desconto sozinho.

**Ciclo de reparo:** `E` no balcão recebe o aparelho → o atendente carrega até a
**bancada** → técnico conserta (o jogador pode ajudar com `E`: −7 s, com 2 s de
intervalo) → `E` na bancada retira o pronto → `E` no balcão devolve e recebe. O
cliente nunca entra na assistência: ele espera no cantinho do salão.

**Ciclo de estoque:** a compra no painel chega no **almoxarifado** (sala nos
fundos). Só vende o que está na prateleira, então alguém busca a caixa lá dentro
(`E`) e despeja 5 unidades na prateleira (`E`).

**Equipe:** teto de 2 auxiliares e 3 técnicos (o vendedor inicial é o jogador e
não ocupa vaga). O auxiliar prioriza vender, depois logística de reparo, depois
reposição; ele pede aprovação quando o cliente não paga a vitrine.

**Diagnóstico honesto do que falta:** o turno é calmo demais. A fila trava em 3
clientes, o spawn é de 7–15 s e um turno inteiro fecha ~4 vendas. Com um auxiliar
contratado, a loja quase se resolve sozinha. E o dia 5 é igual ao dia 1 — não há
progressão. É isso que esta fase ataca.

---

## 2. Entrega principal: melhorias entre dias

O `PHASE2_TASKS.md` já previa "escolhe uma melhoria/promessa do dia" e isso nunca
foi feito. É o maior ganho por esforço porque reaproveita tudo que existe.

### 2.1 Contrato de estado (`src/game/types.ts`)

```ts
export type UpgradeId =
  | "segundoBalcao"
  | "bancadaRapida"
  | "carrinho"
  | "prateleiraGrande"
  | "letreiroRua"
  | "cafeDaEspera";

export interface Upgrade {
  id: UpgradeId;
  nome: string;
  descricao: string;      // o que muda, em uma frase
  custo: number;
  /** Melhorias que precisam existir antes desta (vazio = disponível de saída). */
  requer: UpgradeId[];
}

// em GameState:
upgrades: UpgradeId[];        // comprados, na ordem
upgradesOferecidos: UpgradeId[]; // as 3 opções do fechamento atual
```

### 2.2 Catálogo sugerido (preço e efeito)

Preços calibrados para o caixa inicial de R$ 10.000 e meta de R$ 900 + R$ 180/dia.

| id | nome | custo | efeito mecânico |
|---|---|---|---|
| `segundoBalcao` | Segundo balcão | 3.500 | fila passa de 3 para 5 clientes; abre um 2º ponto de atendimento no mapa |
| `bancadaRapida` | Bancada com bancada de testes | 3.000 | duração do reparo −25% |
| `carrinho` | Carrinho de carga | 1.800 | caixa de reposição passa de 5 para 10 unidades |
| `prateleiraGrande` | Prateleira dupla | 2.200 | teto de exposição por produto (hoje ilimitado) e +1 fileira visível |
| `letreiroRua` | Letreiro para a rua | 2.500 | spawn de cliente 7–15 s → 5–11 s |
| `cafeDaEspera` | Café na espera | 1.500 | paciência cai 25% mais devagar |

Regras: no fechamento o jogo oferece **3 opções sorteadas** entre as ainda não
compradas (respeitando `requer`); o jogador compra **no máximo uma por dia** e o
custo sai do caixa. Melhoria comprada é permanente.

### 2.3 API a publicar no `GameWorld`

```ts
public getUpgradesOferecidos(): Upgrade[];
public comprarUpgrade(id: UpgradeId): ActionResult;  // valida caixa, requisito e "uma por dia"
public temUpgrade(id: UpgradeId): boolean;
```

Onde os efeitos entram (todos já têm ponto de aplicação no código):

- `segundoBalcao`: limite da fila está em `generateCustomers` (`>= 3`).
- `bancadaRapida`: duração em `acceptRepair` e em `processRepairs`.
- `carrinho`: `GameWorld.CAIXA_DE_REPOSICAO` (hoje `static readonly 5`) passa a
  ser lido de um getter que considera o upgrade.
- `letreiroRua`: `CUSTOMER_SPAWN_MIN_SECONDS` / `MAX`.
- `cafeDaEspera`: `CUSTOMER_PATIENCE_PER_SECOND`.
- `prateleiraGrande`: novo teto em `restockShelf`.

`comprarUpgrade` deve ser chamável só na fase `summary` (ou `planning`), nunca
com o turno rodando.

### 2.4 Interface (`GameUI.tsx`)

No modal de fechamento, abaixo dos KPIs e antes dos botões: três cartões lado a
lado com nome, descrição, custo e um botão "Comprar". Desabilitar o que não cabe
no caixa, com o motivo no `title`. Depois de comprar, os três somem e entra uma
linha "Melhoria do dia: X". Reaproveitar `.palco__card` e `.kpi` — não inventar
CSS novo.

### 2.5 Cena (`src/game/store/`)

Só `segundoBalcao` e `prateleiraGrande` mexem no 3D. **Leia a seção 5 antes de
tocar em qualquer coordenada.**

- `segundoBalcao`: novo retângulo em `MOVEIS`, novos pontos de fila em `FILA`, e
  a estação `balcao` passa a ter dois móveis na lista de `ESTACOES`.
- `prateleiraGrande`: mais uma fileira de caixas em `prateleiraDeParede`.

O resto é invisível: não precisa de arte nova.

---

## 3. Entrega dois: a cena precisa reagir

Hoje todo o dinheiro acontece no HTML e o 3D fica mudo. Sem isso o jogo parece
cenário, não jogo. Tudo em `src/game/store/`, nada no `GameWorld`.

- **"+R$ 375" subindo do balcão** quando a venda fecha, e "+R$ 285" quando o
  reparo é devolvido. Plano com `DynamicTexture` (já existe `materialPlaca` para
  copiar), subindo ~1,5 unidade em 1 s e sumindo com alpha.
- **Reação do cliente ao sair:** coração/estrela em quem sai satisfeito, nuvem de
  raiva em quem sai por paciência zerada. O `Personagem` já tem o balão de pedido
  (`definirPedido`) — é o mesmo mecanismo com outra textura.
- **Caixa registradora piscando** no balcão por meio segundo na venda.
- **Alerta de paciência:** a barra sobre a cabeça já muda de cor; falta piscar
  abaixo de 20%.

A cena recebe isso comparando o estado entre quadros (ex.: `sales.length` cresceu
→ dispara o popup no balcão). Não precisa de evento novo no núcleo.

---

## 4. Entrega três: consultor com botão

O `CLAUDE.md` promete que o consultor é o diferencial, e hoje ele é uma lista de
avisos. Cada `Opportunity` ganha uma ação executável:

```ts
// em types.ts, dentro de Opportunity:
acao?: { rotulo: string; tipo: "reporPrateleira" | "comprarEstoque" | "ajustarPreco" | "contratar";
         produto?: ProductType; quantidade?: number; preco?: number; funcao?: EmployeeRole };
```

O `GameUI` renderiza um botão com `acao.rotulo` que chama o método correspondente
que **já existe** (`restockShelf`, `buyStock`, `setProductPrice`, `hireEmployee`)
e mostra o `ActionResult` no aviso. Nenhuma regra nova de economia.

---

## 5. Armadilhas que já custaram retrabalho — leia antes de mexer na cena

1. **Móvel alto esconde o chão atrás dele.** A câmera é fixa (`ArcRotateCamera`,
   alpha `-π/2`, beta `π/3.55`, raio 43). Um bloco de altura `h` esconde o piso
   de `z` até `z + 1,22·h`. Foi por isso que as gôndolas centrais viraram
   prateleiras de parede, que o painel de ferramentas virou trilho e que a
   divisória do almoxarifado é baixa (1,25). **Regra: no meio do salão, nada
   acima de ~1,3 de altura.**

2. **Colisão é derivada de `LOJA`/`MOVEIS`, não escrita à mão.** Já aconteceu de
   a planta encolher e os colisores ficarem nas medidas antigas — dava para andar
   através das paredes. Se criar móvel novo, ele entra em `MOVEIS` e a colisão
   vem de graça (`COLISORES` faz `...Object.values(MOVEIS)`).

3. **Estação é medida por distância ao móvel** (`estacaoEm`, `ALCANCE_ESTACAO =
   1,7`), não por retângulo desenhado no chão. A versão anterior usava retângulo
   e o jogador ficava colado na bancada sem conseguir interagir, porque a borda
   da zona terminava exatamente onde a colisão o parava.

4. **Clientes não colidem; o jogador sim.** É isso que deixa o cliente entrar
   pela porta enquanto a frente da loja é fechada para o atendente.

5. **A tecla `E` é do `GameCanvas`**, que é quem tem o `GameWorld`. O `player.ts`
   só anda e mostra o que está na mão. Não colocar um segundo handler de `E`.

6. **Movimento resolve colisão com empurrão** (`resolverColisoes`), não
   cancelando o eixo. Cancelar prendia o boneco nas quinas.

7. **Sempre `git log --all --oneline` e `git branch -a` antes de começar.** Já
   houve uma linha de 12 commits paralela sem branch nomeada que o `git log` do
   `master` não mostrava; a loja foi reconstruída por cima de uma base velha e
   precisou de merge.

---

## 6. Como testar com o painel do navegador oculto

O Chrome suspende o `requestAnimationFrame` quando o painel não está visível, e
`computer{screenshot}` falha. O que funciona:

1. `GameCanvas` expõe `window.__jogo` (só em DEV) com o `GameHandle`.
2. No console: `h.update(dt)` em laço para avançar a simulação, e
   `h.scene.render()` para desenhar.
3. Para ver a imagem: **`gl.readPixels`** (o `canvas.toDataURL` devolve buffer
   vazio nessa situação), jogar os pixels invertidos em um canvas 2D e enviar o
   dataURL por POST para um PHP temporário no XAMPP que grava o PNG.
4. **O primeiro `render()` depois do load sai vazio — capture duas vezes.** Vale
   também depois de cada recarga do HMR, não só do load inicial.
5. **Com o painel oculto o canvas fica 300×150** (tamanho padrão de `<canvas>`,
   porque o layout nunca roda) e a captura sai minúscula. Antes de capturar:
   `cv.style.width='1600px'; cv.style.height='900px'; engine.setSize(1600,900)`.
6. Para exercitar controles, despachar `KeyboardEvent` em `window`; o jogo ignora
   teclas quando o foco está em `input`/`textarea`. Para andar sem teclado,
   `handle.setMobileMovement(x, z)` seguido de `handle.update(1/60)` em laço — a
   posição do atendente se lê no `TransformNode` `pessoa-1`.
7. **Transição de CSS não avança com o painel oculto, e isso mente na medição.**
   Sem quadros não há animação, então uma propriedade em `transition` fica presa
   no valor inicial para sempre. Medindo o painel lateral recolhível,
   `offsetWidth` e `getComputedStyle().width` devolviam 54px (o estado fechado)
   mesmo com a classe já removida, a regra certa aplicada e `!important` inline —
   o que faz parecer erro de cascata e não é. O sintoma que denuncia: outras
   propriedades da *mesma regra* (`box-shadow`, `max-width`) aplicam normalmente
   e só a que está em `transition` não. Antes de medir layout:

   ```js
   document.querySelectorAll('.painel').forEach((p) => { p.style.transition = 'none'; });
   void document.body.offsetWidth; // força o reflow antes de ler
   ```
8. **`resize` não dispara de forma confiável** ao redimensionar o viewport com o
   painel oculto. Comportamento que dependa do evento (trocar layout ao girar o
   celular) não dá para verificar aqui — só o estado do carregamento inicial,
   recarregando a página já no tamanho desejado.
9. A camada HTML **não entra na captura**: o `readPixels` lê o buffer do WebGL, e
   a interface do React fica fora dele. Para conferir painel, cartão ou HUD, ler
   o DOM (`textContent`, `getBoundingClientRect`, `getComputedStyle`) em vez de
   procurar por imagem.

---

## 7. Critério de pronto

- Fechar o dia 1, escolher uma melhoria e **ver o efeito dela no dia 2** (fila
  maior, reparo mais rápido, caixa de 10, etc.).
- A melhoria comprada persiste nos dias seguintes e não reaparece na oferta.
- Não dá para comprar duas no mesmo fechamento nem com caixa insuficiente.
- Venda e reparo disparam número subindo na cena.
- Pelo menos duas oportunidades do consultor têm botão que resolve de verdade.
- `npm run check` e `npm run build` passando, e um turno completo jogado no
  navegador sem erro no console.

---

## 8. Divisão de arquivos sugerida

| área | arquivos |
|---|---|
| economia, upgrades, efeitos | `src/game/GameWorld.ts`, `src/game/types.ts` |
| tela de fechamento, cartões, botões do consultor | `src/components/GameUI.tsx`, `src/styles.css` |
| ponte e ações | `src/components/GameCanvas.tsx` |
| cena, popups, segundo balcão | `src/game/scene.ts`, `src/game/store/*` |

Ordem recomendada: catálogo e API no núcleo → tela de fechamento → efeitos
mecânicos um a um (cada um testável isolado) → feedback na cena → consultor.

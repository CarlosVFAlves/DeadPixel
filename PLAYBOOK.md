# Playbook — Dead Pixel

Diário de bordo do projeto: o que foi feito, **por que** foi feito assim e **como cada impasse foi resolvido**.
Atualizado ao fim de cada etapa. Para as regras do jogo, veja o `README.md`.

> **Como atualizar:** ao terminar uma etapa, acrescente (1) uma linha na *Linha do tempo*, (2) cada impasse novo na seção *Impasses e soluções* no formato **Sintoma → Causa → Solução → Como evitar**, (3) decisões de design na seção *Decisões*, e (4) rode `node tests/sim.js` antes de commitar.

---

## 1. Visão

Jogo 2D multiplayer estilo *Dead by Daylight*, com **foco em jogabilidade** (não em história/terror, como no protótipo *Retail Nightmare*).
O desenvolvimento é por **protótipos pequenos**, cada um isolando uma mecânica e deixando o resultado jogável no navegador (celular e PC).

Princípios herdados do protótipo anterior:
- HTML + canvas, **sem dependências**, gráficos (pixel art) e áudio **gerados por código**.
- **Celular primeiro** (joystick flutuante, botões grandes), teclado como alternativa.
- Lógica separada do desenho, para **testar sem navegador**.

## 2. Linha do tempo

| # | Etapa | O que entrou |
|---|---|---|
| 1 | **Pallet** | Arena fixa, 1 sobrevivente (jogador) × 1 assassino (IA). Derrubar o pallet com zona de impacto, atordoar, errar, pular pallet caído, assassino quebra/contorna, "mind game" (hesitação). Modo treino. |
| 1.1 | Artefato | Publicação como página única; canvas acompanha o contêiner (`ResizeObserver`). |
| 2 | **Geradores** | 7 geradores (5 bastam), conserto segurando AGIR, **skill checks**, 2 portões de saída. Assassino deixa de ser onisciente: vê, ouve, rastreia, patrulha e chuta geradores. Teclado robusto (foco do canvas). |
| 3 | **Jogar de assassino** | Novo papel + **IA do sobrevivente** (foge, usa pallets, conserta, escapa). Mecânica de **tropeço** quando o assassino leva pallet. Correção de personagem preso em pallet. |
| 4 | **Janelas e equipe** | 10 janelas animadas (abrir / pular / passar com calma / atravessar quebrando / assassino quebra), **4 sobreviventes** (você + 3 bots, ou 4 bots), **8 geradores**, **porta principal**, fim de partida por equipe. Reescrita do `game.js` para multi-sobrevivente. |

Marcos de qualidade: **98 checagens automáticas** em `tests/sim.js` (mapa, pallet, janelas, geradores, percepção, tropeço, IA, equipe, fuzz).

## 3. Arquitetura (resumo)

| Arquivo | Papel |
|---|---|
| `js/map.js` | Arena fixa 48×32: 5 casas, 2 muros com vão, 12 pallets, 10 janelas, 8 geradores, porta principal, 4 inícios. |
| `js/game.js` | **Todas as regras**, sem DOM (testável no Node): sobreviventes, assassino, pallets, janelas, geradores, porta, IA. |
| `js/render.js` | Pixel art por código, animações, zona de impacto, HUD. |
| `js/main.js` | Laço, menu/pausa/fim, entrada (toque e teclado). |
| `js/audio.js`, `js/font.js` | Sons sintetizados; fonte bitmap 5×7 com acentos. |
| `tests/sim.js` | Testes de simulação (rodam em ~45 s). |
| `tools/build-single.py` | Gera 1 HTML com todo o JS, para publicar como artefato. |

**Padrões que valem repetir**
- `CFG` único no topo de `game.js` com todos os números de "sensação" (velocidades, tempos, alcances, IA).
- Estados do assassino como máquina (`intro/chase/windup/lunge/recover/break/stun/stumble/kvault`).
- **Contexto de sobrevivente** (`use(sv)`): as funções por-sobrevivente leem `s`/`ai` do closure; o laço troca o contexto a cada sobrevivente. Evitou reescrever dezenas de funções ao passar de 1 para 4 sobreviventes.
- **Dijkstra em grade** com custos por modo (sobrevivente pula, assassino quebra). Um campo por objetivo, recalculado a cada ~0,15–0,4 s.
- Ações tipo "pular obstáculo" (pallet e janela) compartilham o mesmo mecanismo (`vault` com `kind`).

## 4. Decisões de design (e por quê)

- **Zona de impacto visível** (amarela, fica vermelha com o assassino dentro): ensina a mecânica sem texto. Queda de 0,22 s: o que vale é onde ele está *no impacto*.
- **Pallet cai sempre para longe de quem derruba**: sem escolha de lado, menos botões.
- **Hesitação do assassino (55%)**: cria o "mind game"; derrubar cedo gasta o pallet, tarde demais leva golpe.
- **Dano do vidro nunca mata** (só tira 1 de vida e denuncia a posição): faz a janela ser escolha arriscada sem punir demais.
- **Janela fechada é barreira só para o assassino**; sobrevivente tem 3 formas de passar (abrir, correr e quebrar, ou andar quando aberta). Dá custo/benefício claro: *tempo* (abrir) × *vida e barulho* (quebrar).
- **Tropeço em vez de só atordoar**: 0,9 s parado + 2,8 s cambaleando (55% da velocidade, rumo desviado, tombos). Mantém o controle na mão do jogador, mas imprevisível.
- **Assassino vence se menos da metade escapar** (0–1 de 4), como no jogo de referência.
- **Skill check**: no teclado usa **Espaço** (E já está segurado); no celular, **toque com outro dedo**.
- **"Andar" = Shift ou joystick leve**: necessário para a regra "passa tranquilamente pela janela" e vira mecânica de furtividade (ruído 1,4 contra 3,5).
- **Bots só fogem de longe se forem o mais próximo do assassino**: o resto continua trabalhando (senão ninguém conserta nada).

## 5. Impasses e soluções

Formato: **Sintoma → Causa → Solução → Como evitar.**

### 5.1 Ambiente e publicação
1. **Repositório vazio e escolha de stack.**
   - Causa: só existia o README do protótipo anterior (descrito na conversa).
   - Solução: mesma stack do protótipo (HTML + canvas, JS puro, tudo gerado por código), em arquivos separados.
2. **Testar a lógica sem navegador.**
   - Solução: `game.js` e `map.js` sem DOM; `tests/sim.js` carrega os arquivos com `vm` do Node e simula a 60 fps.
   - Evitar: não referenciar `document`/`window` nas regras.
3. **WASD "não funcionava" no artefato.**
   - Causa: `preventDefault()` no `pointerdown` impedia o iframe de receber foco, então o teclado não chegava.
   - Solução: não cancelar o `pointerdown` (o `touch-action: none` já evita rolagem), dar `tabIndex` ao canvas e chamar `focus()` ao clicar; aceitar `e.key` quando `e.code` vier vazio.
   - Evitar: em página embutida, sempre garantir foco explícito.
4. **Canvas do artefato com tamanho errado.**
   - Solução: dimensionar pelo **contêiner** (`ResizeObserver`), não pela janela.
5. **Mandei `pkill -f "tests/sim.js"` e matei meu próprio shell** (a linha de comando continha o padrão).
   - Solução: não usar `pkill -f` com texto presente no próprio comando; deixar o `timeout` encerrar o processo.
6. **Republicar o artefato foi barrado uma vez** pelo classificador (estado de compartilhamento mudou). Repetir a mesma chamada, como a mensagem pediu, resolveu. Vale lembrar que o link está como "qualquer pessoa com o link".

### 5.2 Física e colisão
7. **Personagem preso para sempre ao lado de um pallet que caiu.**
   - Sintoma: sobrevivente imóvel, "andando" sem sair do lugar (descoberto num log da IA).
   - Causa: ao cair, o pallet só empurrava quem tinha o *centro* dentro do tile; quem estava só *encostando* (círculo sobrepondo) ficava dentro de um sólido e `moveBy` rejeitava todo passo.
   - Solução: (a) empurrar por **sobreposição do círculo**, para o lado em que a pessoa estava; (b) rede de segurança `unstick()` a cada quadro, que solta quem estiver em sólido no ponto livre mais próximo.
   - Evitar: toda mudança de solidez em tempo de execução precisa tratar quem já está encostado.
8. **Vidro e pallet com vãos de 1 tile.** Raio 0,27/0,33 tile cabe; diagonais em quina foram proibidas quando um dos lados é sólido (`hardBlocked`), evitando cortar parede.
9. **Linha de visão através de janela.** Janela de vidro bloqueia movimento, **não** a visão: separei `solid()` de `blocksSight()`.

### 5.3 IA do assassino
10. **Assassino onisciente impedia consertar geradores** (sempre sabia onde você estava).
    - Solução: percepção por **visão** (LOS até 13 tiles), **audição** (ruído por ação: reparo 9, andar 3,5, correr, pular) e **rastro** (2,5 s). Sem perceber, **patrulha** geradores e **chuta** os que têm progresso; geradores concluídos e skill checks errados geram "pings".
11. **Teste "assassino hesita" falhava**: o teleporte do teste deixava o assassino em `recover`, que não percebe. Resetar o estado no teste.
12. **Assassino batia em parede nos testes** (bot ingênuo indo em linha reta) → exposto `g.pathVec()`; bot segue o caminho real e recalcula a cada 6 quadros (antes o teste levava mais de 2 min e estourava o limite).

### 5.4 IA do sobrevivente (a parte mais trabalhosa)
13. **Sobrevivente esperava num pallet que o assassino nem usava.**
    - Causa: escolhia o pallet mais próximo sem verificar se o caminho do assassino passava por ele.
    - Solução: só aceita pallet cujo **lado de cá/lado de lá** (campos de distância do assassino) mostra que o caminho mais curto até o outro lado atravessa o pallet (`fK[longe] - fK[pallet] ≥ 0,8` e vice-versa), e que ele chega lá antes.
14. **IA nunca conseguia derrubar o pallet** (0 atordoamentos em 24 partidas).
    - Causa: ponto de espera a 1,25 tile do pallet; com parada a 0,4 do alvo ficava a ~1,65, **fora** do alcance de derrubar (1,3).
    - Solução: ponto de espera a **0,95** (dentro do alcance) e parada a 0,3.
15. **IA "tremia" entre dois tiles ao chegar no destino.**
    - Causa: dentro do tile-alvo o campo (valor 0) manda sair para um vizinho; no vizinho manda voltar.
    - Solução: `steer(…, goal)`: se já está no tile do destino, vai **direto ao ponto**.
16. **IA perfeita demais ou fraca demais** → calibrar por medição (bot assassino de 24 partidas):
    - sem reação humana, o pallet era 100% certeiro → **tempo de reação** aleatório (0–0,22 s) e erro de posição (±0,3);
    - o bot atacava a 1,6 tile e errava um corredor em linha reta (cálculo: o bote só acerta se começar a ≤1,4) → bot passou a atacar a 1,35;
    - 21 s de sobrevivência média → `AI_SPEED 1,1` (10% mais rápido) → ~67–90 s com o bot de informação perfeita;
    - fugia de assassino **parado** a 14 tiles → só foge se ele estiver **se movendo** ou a < 7 tiles.
17. **Quatro bots fugiam juntos para o mesmo ponto e ninguém consertava (0 geradores em 300 s).**
    - Solução: só o **mais próximo** do assassino foge de longe; os outros continuam; na fuga cada um recebe um viés aleatório por tile e perde pontos por ficar a <5 tiles de um colega.
18. **Bots-assassino "perdiam tempo"**: o bot de teste quebrava toda janela por onde passava (E sempre apertado). Bot de teste só usa E para pallet/gerador.
19. **IA de teste que não terminava**: o bot ficava preso em estado `break` porque se mexia (mexer cancela quebrar) → o bot fica parado ao quebrar.

### 5.5 Regras que mudaram no meio
20. **De 1 para 4 sobreviventes**: todo o código assumia um `s` global.
    - Solução: reescrever `game.js` com lista `survivors` e **contexto trocável** (`use(sv)`); assassino escolhe alvo (mais próximo/percebido) e o golpe acerta qualquer um no alcance. Toda a suíte antiga continuou valendo com `bots: 0`.
21. **Testes quebraram com mudanças legítimas** (tempo do gerador 15→20 s; portões → porta). Testes passaram a ler `DP.CFG.REPAIR_T` em vez de números fixos; o teste do portão virou "energiza → abre → atravessa".
22. **Dead survivors "dentro de parede" no fuzz**: sobrevivente abatido parado sobre pallet caído contava como violação. A checagem agora ignora quem saiu da partida e quem está pulando.

### 5.6 Interface
23. **Skill check no teclado**: E já está segurado (consertando), então não dá para "apertar de novo" → usa **Espaço**; no celular, toque com outro dedo em qualquer lugar.
24. **Texto sobrepondo o HUD** (mensagens do topo sobre as 3 linhas do canto) → mensagens começam em `max(46, 20% da altura)`; textos longos quebram linha (`wrap`).
25. **Glifo `=` ausente** na fonte (dica "SETAS = BARULHO" saía com buraco) → adicionado.
26. **Janela pequena demais** em relação ao tile (vidro 10×4 px) → moldura de 16×12 e vidro de 12×8 com montante e brilho.
27. **Menu**: mini-cena sobrepunha o subtítulo → removida; seletor de papel entrou como dois botões lado a lado.

## 6. Como rodar, testar e publicar

```bash
python3 -m http.server 8000                 # abrir index.html no navegador / celular
node tests/sim.js                           # ~45 s, deve terminar com "tudo certo"
python3 tools/build-single.py saida.html    # HTML único para o artefato
```

Teste visual rápido (Chromium já instalado): carregar o HTML, apertar `T` (treino), manipular `window.__dp.game` e tirar screenshots.

**Ganchos de depuração:** `window.__dp.game` (estado completo), `__dp.buttons()`, `__dp.role`, `game.pathVec(e, x, y)`.

## 7. Parâmetros que mais mexem no jogo (`CFG` em `js/game.js`)

| Quero… | Mexer em |
|---|---|
| Pallet mais fácil/difícil | `ZONE_LEN`, `ZONE_W`, `FALL_T`, `STUN`, `RESPECT` |
| Tropeço mais/menos punitivo | `STUMBLE_T`, `STUMBLE_SPEED`, `TRIP_T` |
| Partida mais curta/longa | `REPAIR_T`, `TEAM_BONUS`, `DOOR_T`, `SKILL_*` |
| Assassino mais atento | `SIGHT`, `NOISE_*`, `TRACK`, `PATROL_SPEED` |
| Sobreviventes-IA mais difíceis | `AI_SPEED`, `AI_FLEE`, `AI_SENSE`, `AI_SKILL_ERR` |
| Janelas | `WIN_OPEN_T`, `WIN_BREAK_T`, `VAULT_RUN/WALK/CRASH/K`, `NOISE_CRASH` |

## 8. Pendências e ideias

- **Ainda não validado com pessoas**: equilíbrio da partida de 4 contra o assassino jogado por humano; modo "andar" no celular (joystick leve).
- Ganchos / resgate / sacrifício (hoje quem leva 2 golpes sai da partida).
- Cura entre sobreviventes; itens; mais um poder de assassino.
- **Multiplayer de verdade** (objetivo final): sincronizar o `game.js` (já sem DOM) num servidor autoritativo; os bots atuais viram placeholders para jogadores ausentes.
- Mapa procedural (o protótipo *Retail Nightmare* já tem um gerador), névoa de guerra/luz, mais tipos de janela e obstáculos, 8-bit "de verdade" (paleta fixa) se for o desejo.
- Dificuldade selecionável (`AI_*`) e placar por semente.

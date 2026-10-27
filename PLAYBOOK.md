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
| 4.1 | **Playtest 1** | Primeira rodada com uma pessoa jogando: ajuste do assassino-jogador, anti "barata tonta" dos bots, telemetria. Ver seção 4. |
| 6 | **Visão e paridade** | Névoa de guerra (raio + cone de lanterna + memória), bots e assassino-IA com os mesmos sentidos de uma pessoa (sem trapaças), seletor de dificuldade, tabela de tempos `ROUTES`, interruptor de visão no treino. |
| 7 | **Itens, rádio e stealth** | Sistema genérico de itens no chão (segurar E para pegar), **rádio detector** (pilha de 120 s, 3 faixas de proximidade, sem direção), **stealth do assassino** (Shift / botão ESPR., barra de energia, mais lento e silencioso, invisível ao rádio), bots que usam o rádio. |
| 8 | **Mapa grande** | `js/camp.js`: acampamento 144×96 gerado por semente (floresta, lago + cais, cabanas, estrada, portão), conectividade garantida; navegação otimizada (fila em arrays tipados, busca limitada); equipe **descobre** geradores e bots **exploram**; **mapa de campo** (M); seta para a saída. |
| 9 | **Polícia** | Telefone ao lado da estrada (liberado pela energia: 5 de 8 geradores), segurar AGIR 30 s liga, polícia chega em 150 s e **abre o portão por 120 s**; sem sair a tempo, ela vai embora e é preciso ligar de novo. Assassino chuta o telefone e vigia telefone/portão; bots ligam, esperam perto do estacionamento e correm quando abre. |
| 10 | **Carro e Barco** | 6 peças espalhadas (bateria, chave e combustível do carro; hélice, chave e combustível do barco), carregar 1 peça, instalar segurando AGIR (carro 35 s/peça, barco 40 s/peça), ligar o motor (10 s) ou empurrar o barco (15 s), embarcar (2 lugares) e partir; assassino **sabota** (tira a última peça); bots se dividem entre polícia, carro e barco. Correção de um bug antigo: o campo de destino dos bots era compartilhado. |
| 11 | **Ajuste fino** | Fusível 45 s, 3 golpes e 20 s de vantagem no acampamento, assassino-IA fácil 12% mais lento, modos da sala (partida / treino / treino na arena), telemetria por rota, legenda e botões da sala nas telas pequenas. |
| 12 | **Consolidação (v0.1)** | Mapa de campo também para o assassino, viatura da polícia, tela de fim com a rota usada, dicas de pausa, README/Playbook revisados, lista de pendências. |
| 12.1 | **Playtest 2** | Feedback do assassino no mapa grande: minimapa, visão maior, bots mais lentos, stealth menos lento, árvores sem "grudar", **armários** para se esconder, assassino-jogador nasce perto. |
| 12.2 | **Playtest 2b** | Botões claros (tecla em cada botão, legenda da ação, dica do skill check), tela COMO JOGAR, marcador "você" no minimapa deixa de ser vermelho, correção da saída do armário, armário redesenhado. |
| 12.3 | **Edição Luz (HD)** | Variante opcional (`python3 tools/build-single.py saida.html --hd` ou `?hd` na URL): caminho 1 da 10.10 (mesma grade de 16 px, mais luz). A versão padrão não muda. |
| 12.4 | **Playtest 3** | Visão só pela lanterna (raio ambiente 3) + telhados nas cabanas, som por distância, armário/veículo sempre desenhados, mapa que muda a cada partida (portão, praça, estacionamento, telefone, lago a leste/oeste, cais, carro, boat), ESPAÇO pula, SHIFT corre, assassino-IA desiste de loops. |
| 12.5 | **Cansaço da perseguição + folhas-molde** | Anti-loop por mecânica (cansaço → tropeço) em vez de a IA desistir; ferramenta que exporta folhas-molde de textura (`tools/export-sheets.js`) para repintura. |
| 5 | **A sala (lobby)** | Tela inicial *Dead Pixel* (Jogar / Personagens / Loja), sala com 4 vagas e assassino apagado, personagem principal, loja protótipo, fichas, histórico. |

Marcos de qualidade: **262 checagens automáticas** em `tests/sim.js` (mapa, pallet, janelas, geradores, percepção, tropeço, IA, equipe, fuzz).

## 3. Arquitetura (resumo)

| Arquivo | Papel |
|---|---|
| `js/map.js` | Arena fixa 48×32: 5 casas, 2 muros com vão, 12 pallets, 10 janelas, 8 geradores, porta principal, 4 inícios. |
| `js/game.js` | **Todas as regras**, sem DOM (testável no Node): sobreviventes, assassino, pallets, janelas, geradores, porta, IA. |
| `js/render.js` | Pixel art por código, animações, zona de impacto, HUD. |
| `js/lobby.js` | Telas de menu: início, sala (4 vagas + assassino apagado), personagens, loja. Cada tela: `layout(W,H)` + `draw`. |
| `js/main.js` | Laço, estados de tela (menu/sala/personagens/loja/jogo/pausa/fim), entrada, fichas, histórico e telemetria. |
| `js/audio.js`, `js/font.js` | Sons sintetizados; fonte bitmap 5×7 com acentos. |
| `tests/sim.js` | Testes de simulação (rodam em ~45 s). |
| `tools/build-single.py` | Gera 1 HTML com todo o JS, para publicar como artefato. |

**Padrões que valem repetir**
- `CFG` único no topo de `game.js` com todos os números de "sensação" (velocidades, tempos, alcances, IA).
- Estados do assassino como máquina (`intro/chase/windup/lunge/recover/break/stun/stumble/kvault`).
- **Contexto de sobrevivente** (`use(sv)`): as funções por-sobrevivente leem `s`/`ai` do closure; o laço troca o contexto a cada sobrevivente. Evitou reescrever dezenas de funções ao passar de 1 para 4 sobreviventes.
- **Dijkstra em grade** com custos por modo (sobrevivente pula, assassino quebra). Um campo por objetivo, recalculado a cada ~0,15–0,4 s.
- Ações tipo "pular obstáculo" (pallet e janela) compartilham o mesmo mecanismo (`vault` com `kind`).

## 4. Playtests: como transformamos opinião em mudança

**Método (vale para as próximas rodadas):** cada comentário vira *sintoma → hipótese → número medido → mudança → número depois*. Se não der para medir, fica anotado como "a validar" em vez de ser "consertado" por palpite. A partir da etapa 5 o jogo **registra cada partida** (`dp_log` no navegador, últimas 60) e `window.__dp.report()` devolve um resumo (vitórias, tempo médio, aproveitamento de golpes…) para colar na conversa.

### Playtest 1 — comentários e o que fizemos

| O que foi dito | Hipótese / medição | Mudança |
|---|---|---|
| **Assassino lento** | Assassino 4,55 contra sobreviventes-IA a 4,4: só **0,15 tile/s** de vantagem, impossível alcançar. | Assassino-jogador **4,75** e `AI_SPEED` 1,05 (os bots correm 4,2): vantagem de ~0,55. A velocidade da IA-assassino não mudou. |
| **Errar o golpe pune demais** | Recuperação de 0,85 s (erro) e 1,7 s (acerto) foi pensada para a IA. | Só para o assassino-jogador: erro **0,45 s**, acerto **1,2 s**, raio do golpe 0,78→**0,92**, ergue em 0,12 s, mira assistida (cone 1,0→**1,25 rad**, alcance 2,25→**2,8**) e o bote **corrige a direção** em até 5 rad/s. Teste: alvo a ~40° do olhar é acertado 6/6 vezes. |
| **Bots "barata tonta", presos no primeiro pallet** (o comportamento *não está errado*, só parece bobo) | O assassino lento deixava dar voltas no primeiro pallet sem risco. Medi no bot: 5,2 inversões de direção/min. | O principal remédio foi a velocidade/golpe acima. Além disso: **compromisso de plano** (só troca o alvo de fuga se o atual deixou de valer ou após 1,6 s) e **giro suave** (sem inverter de um quadro para o outro). Resultado honesto: inversões 5,2→4,6/min (pouco): a maioria acontece com o assassino colado ou pulando pallet/janela, ou seja, é a "dança" legítima do pallet. |
| **Humilhado pelos bots / não ganhei como sobrevivente** (fizemos 4 geradores; "fugir é mais habilidade", mas é divertido) | Uma rodada não basta para concluir. O bot assassino perfeito derrubava a equipe em ~230 s antes e ~90 s depois da mudança; uma pessoa será bem mais lenta. | `DOOR_T` 4→3 s. **Nenhuma mudança na IA-assassino ainda**: primeiro coletar números (telemetria) de algumas partidas. |
| **"Não senti necessidade de outras ferramentas"** | O ciclo atual (pallet, janela, gerador) já sustenta a diversão. | Decisão: **não adicionar itens/poderes agora**; investir em estrutura (lobby) e qualidade (ver pendências: 16 bits). |

**Lição:** o mesmo número servia a dois papéis diferentes (IA e pessoa). Separar constantes (`*_P`) permitiu ajustar o assassino-jogador sem mexer em quem joga contra ele.

## 5. Decisões de design (e por quê)

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
- **Sala (lobby), como pedido:** *Jogar* mostra **4 vagas de jogador** (você + 3 vagas "aguardando", que viram bots) e o **assassino apagado** (IA). Tocar no assassino liga/desliga o papel de assassino (as 4 vagas viram bots), preservando o modo que já existia. *Personagens* mostra **só o personagem principal** (Pixel). *Loja* é **só protótipo**: 6 cartas "em breve" e saldo de **fichas** (ganhas por partida), sem compra.
- **Fichas por partida** (sem treino): sobrevivente `10 + 5×geradores + 5×atordoamentos + 40 se escapar`; assassino `10 + 5×acertos + 20×abatidos + 30 se vencer`. Números provisórios, só para a loja ter sentido quando existir.
- **Sprites dos menus reutilizam o pixel art do jogo** (`uiSurvivor`/`uiKiller`, ampliação inteira), então qualquer skin futura aparece nos dois lugares.

## 6. Impasses e soluções

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

### 6.7 Etapa 5 (lobby e playtest 1)
28. **Como saber se o "barata tonta" melhorou?** Opinião não mede.
    - Solução: script de métricas (inversões de direção por minuto durante a fuga, % do tempo perto de pallet, aproveitamento de botes, tempo médio da partida) rodando o bot em N partidas **antes e depois** de cada mudança. Resultado real: a correção de plano mexeu pouco; a de velocidade/golpe mexeu muito.
29. **Telas de menu em celular e PC sem sobrepor nada.**
    - Solução: cada tela tem `layout(W,H)` que devolve retângulos; um **teste** confere 4 telas × 6 tamanhos de tela (nada fora da tela, nenhum botão sobre vaga/carta/assassino). Pegou na hora o caso das vagas altas demais no celular.
30. **Tabela do fim de jogo com rótulo encostando no valor** ("DURAÇÃO DA CAÇADA2:22"). Solução: rótulos curtos (até 20 caracteres), tabela de 168 px de largura e valores alinhados à direita.
31. **Sprite do assassino estourando a caixa no celular** (ampliação 2×). Solução: caixa mais alta (64 px) quando a ampliação é 2×, 38 px com 1×.
32. **Dica longa saindo da caixa** ("TOQUE: VOLTAR A SER SOBREVIVENTE"). Solução: textos curtos nos cartões e `wrap` por largura.
33. **Meu script de edição do playbook quebrou por aspas dentro de aspas** (nada foi gravado). Solução: scripts de edição em arquivo com textos entre aspas triplas; sempre conferir `git diff --stat` depois.

## 7. Como rodar, testar e publicar

```bash
python3 -m http.server 8000                 # abrir index.html no navegador / celular
node tests/sim.js                           # ~45 s, deve terminar com "tudo certo"
python3 tools/build-single.py saida.html    # HTML único para o artefato
```

Teste visual rápido (Chromium já instalado): carregar o HTML, apertar `T` (treino), manipular `window.__dp.game` e tirar screenshots.

**Ganchos de depuração:** `window.__dp.game` (estado completo), `__dp.buttons()`, `__dp.role`, `game.pathVec(e, x, y)`.

## 8. Parâmetros que mais mexem no jogo (`CFG` em `js/game.js`)

| Quero… | Mexer em |
|---|---|
| Assassino de pessoa mais/menos forte | `K_SPEED_P`, `RECOVER_MISS_P`, `RECOVER_HIT_P`, `HIT_R_P`, `AIM_CONE`, `AIM_RANGE`, `HOMING` |
| Pallet mais fácil/difícil | `ZONE_LEN`, `ZONE_W`, `FALL_T`, `STUN`, `RESPECT` |
| Tropeço mais/menos punitivo | `STUMBLE_T`, `STUMBLE_SPEED`, `TRIP_T` |
| Partida mais curta/longa | `REPAIR_T`, `TEAM_BONUS`, `DOOR_T`, `SKILL_*` |
| Assassino mais atento | `SIGHT`, `NOISE_*`, `TRACK`, `PATROL_SPEED` |
| Sobreviventes-IA mais difíceis | `AI_SPEED`, `AI_FLEE`, `AI_SENSE`, `AI_SKILL_ERR` |
| Janelas | `WIN_OPEN_T`, `WIN_BREAK_T`, `VAULT_RUN/WALK/CRASH/K`, `NOISE_CRASH` |

## 9. Pendências e ideias (estado da v0.1)

**Para decidir com o time (nada disso foi implementado):**
- **Evolução dos "bits" (16 bits) para skins e qualidade** — *discutir antes de implementar*, como combinado. Pontos a decidir: o que muda no pixel art; skins só trocam a paleta ou são sprites novos; tamanho do tile (16 → 24/32 px) e o custo disso para o mapa de 144×96 (a imagem estática passaria de 2304×1536 para até 4608×3072 px); custo de arte; se entra antes do multiplayer.
- **"Matar o assassino"** (4ª rota do pedido original) muda o gênero: fica para um protótipo à parte.
- **Multiplayer de verdade**: sincronizar o `game.js` (já sem DOM) num servidor autoritativo; os bots viram placeholders para jogadores ausentes.

**Falta validar com gente de verdade:** tempo de partida (meta 8–12 min), letalidade do assassino-IA, equilíbrio entre as rotas, conforto do joystick e dos botões no celular, legibilidade da floresta (as árvores agora têm copa redonda/pinheiro, mas continuam sendo tiles 1×1). Use `__dp.report()` no console depois de algumas partidas.

**Dívidas técnicas conhecidas**
- Arte: árvores e água são tiles simples; vegetação rasteira, reflexos, ambiente sonoro (vento, grilos, água) e passos na água não existem.
- IA: o assassino-IA conhece os geradores e se um veículo tem algo para sabotar (assimetria declarada); bots não se comunicam (só o que viram) e não montam estratégia de equipe além da divisão de rotas; ninguém usa a mão ocupada para trocar peças com colegas.
- Veículos: sem skill check, sem dano ao embarcar, sem animação de embarque; o barco só atravessa o lago e some.
- Telas: o HUD do assassino em telas muito baixas ainda sobrepõe texto da introdução.
- Rádios e peças não reaparecem; sem inventário além de 1 peça + 1 rádio.
- Ganchos / resgate / sacrifício, cura entre sobreviventes, mais poderes de assassino (ideias antigas).

## 10. Em discussão: direção "Friday the 13th" (rascunho, nada implementado)

**Pedidos do time:** (1) jogo mais para *Friday the 13th*; (2) **mapa grande**; (3) **rotas de fuga**: polícia, arrumar o carro, fugir de barco, matar o assassino; (4) **bots simulam um jogador** para a partida ficar fluida; (5) **ferramenta do sobrevivente que detecta o assassino por perto**, a menos que ele esteja em **stealth**; (6) **raio de visão dos sobreviventes é amplo demais** (veem o mapa todo e onde está todo mundo).

> Nota de originalidade: usar o jogo de referência como **inspiração** (acampamento, lago, rotas de fuga); nomes, personagens e marcas dele não entram no nosso jogo. Cenário e nomes próprios.

### 10.1 Princípio proposto: paridade de informação (bots como jogadores humanos)
Um bot só pode (a) dar as **mesmas entradas** que uma pessoa (já é assim: `ax, ay, act, drop...`), (b) usar os **mesmos sentidos** (visão com linha de vista e alcance; audição com alcance), (c) lembrar apenas o que **viu/ouviu** (última posição conhecida), e (d) variar de nível por **imperfeição humana** (tempo de reação, erros, indecisão), não por números trapaceados.

**Onde os bots hoje trapaceiam (medido no código):**
| Onde | Trapaça |
|---|---|
| Sobrevivente-IA | `AI_SENSE`=11 tiles **atravessa paredes**; depois de perder o assassino, ainda usa a posição **real** dele por ~4 s. |
| Sobrevivente-IA | `AI_SPEED`=1,05 (corre 5% mais) só para compensar ser burro; é balanceamento por estatística. |
| Assassino-IA | Rastreia a posição **real** do alvo por 2,5 s depois de perder; escolhe gerador sabendo **qual tem progresso** em qualquer lugar. |
| Jogo (pessoa) | **Sem névoa**: a tela mostra tudo, inclusive através de paredes (assassino e todos os sobreviventes dentro do quadro). |

### 10.2 Visão e névoa
Proposta: **círculo de visão** com **linha de vista** (paredes bloqueiam; janela de vidro não) + **cone de lanterna** + escuro fora disso; o que já foi visto fica "na memória" (gerador, item), jogadores só aparecem **em linha de vista**. O HUD de equipe mostra **estado** (vivo/ferido/fora), não **posição**. O protótipo *Retail Nightmare* já provou a técnica (gostaram da névoa por linha de visão). Custo estimado: máscara de visibilidade por raios (~180 raios) por quadro, barata. Assimetria a decidir: assassino enxerga mais longe? tem "sentir" (revela sobreviventes próximos por X s)?

### 10.3 Ferramenta de detecção + stealth do assassino
- **Detector (rádio de pilha):** item **encontrado** no mapa (não todo mundo começa com ele), **pilha finita** (decisão: ligar só quando precisa). Avisa **proximidade em 3 faixas** (longe/perto/muito perto) com som e pulsação na tela; **sem direção exata** (senão vira radar e anula o assassino).
- **Stealth do assassino ("espreita"):** segurando um botão, anda devagar (~60%), **raio de detecção cai para ~25%** (o detector só dispara a ~3 tiles) e o ruído diminui; **quebra ao atacar ou correr**; recarga/fôlego para não ficar o tempo todo. Funciona melhor no escuro (longe de lâmpadas/lanternas).
- Bots: reagem às faixas do detector como uma pessoa (hesitam, olham, fogem), com tempo de reação.
- Tensão com o playtest 1 ("não senti necessidade de outras ferramentas"): aquilo valia para o mapa pequeno e sem névoa. Com mapa grande e visão curta, saber "ele está perto" passa a ser necessidade real. Por isso sugiro entrar **depois** da névoa.

### 10.4 Mapa grande
- Hoje: 48×32 tiles (1.536). Alvo inicial sugerido: **96×64** (6.144); depois, se fizer sentido, ~160×110.
- **Custo medido** do cálculo de caminhos (Dijkstra por chamada, ~41 chamadas/s com 4 bots + IA): 48×32 = **0,38 ms** (~15 ms/s); 96×64 = ~1,5 ms (~62 ms/s); 160×110 = ~4,3 ms (~180 ms/s, **~18% de um núcleo** no PC, mais no celular).
- Plano de performance: **campos pré-calculados** para alvos fixos (geradores, portas, barco, carro: calculados uma vez), **grade grossa** (2×2) para planejar e a fina só para desviar, buscas **limitadas por raio**, e **espalhar** os cálculos dos bots em quadros diferentes.
- Layout: **desenhado à mão com prefabs** (as casas atuais viram "cabanas") + **itens e spawns sorteados** a cada partida; gerador procedural de mapa inteiro fica para depois (o do *Retail Nightmare* é de shopping, não serve direto).
- Mapa grande precisa de **motivo para andar**: objetivos espalhados, veículos e rotas distantes (próxima seção).

### 10.5 Rotas de fuga (escopo por rota)
| Rota | Ideia | O que precisa | Contra-jogada do assassino | Custo |
|---|---|---|---|---|
| **Polícia** | Restaurar energia (os **geradores viram fusíveis**) e **ligar para a polícia**; ela chega depois de T segundos e quem estiver vivo na área escapa. | Estado de energia, telefone interativo, **temporizador** de chegada. | Vigiar/cortar o telefone, caçar quem espera. | **Baixo** (reusa geradores e porta). |
| **Carro** | Achar **peças** (bateria, chave, combustível) e consertar; dirigir até a saída. | **Itens e inventário**, interação de conserto, entidade "carro" com assentos limitados. | Sabotar peças, esconder o carro, barulho do motor. | Médio. |
| **Barco** | Mesmo esquema de peças + **água** no mapa. | Itens, tiles de água, saída pelo lago. | Sabotar, interceptar no cais. | Médio-alto (só faz sentido em mapa grande). |
| **Matar o assassino** | Reunir equipamento e **derrotar** o assassino. | **Combate dos sobreviventes**, estado de "morte" do assassino, equilíbrio novo (hoje o jogo é só fuga). | — | **Alto** (muda o gênero do jogo). Sugiro tratar como protótipo separado, depois das outras. |

Pontos a decidir: a equipe **escolhe** uma rota ou cumpre várias? **Assentos limitados** (ex.: carro com 2) forçam decisões difíceis? Os **bots precisam de uma camada de planejamento** para escolher a rota (nova, mas combina com a ideia de simular jogador).

### 10.6 Ordem sugerida (cada etapa jogável e testável)
1. **Visão e paridade**: névoa + memória + bots sem trapaça (+ testes: "bot não reage a assassino atrás de parede"). Remove `AI_SPEED`.
2. **Detector + stealth** no mapa atual.
3. **Mapa grande (96×64)** com navegação otimizada + **rota Polícia**.
4. **Carro** (itens/inventário) e depois **Barco**.
5. **Matar o assassino**, como protótipo à parte.
6. Discussão pendente de **bits/skins** (pode ser feita antes da etapa 3, pois mexe no tamanho de tile).

### 10.7 Perguntas em aberto
- O **pallet** fica (reskin: tronco/armário/barricada) ou sai em favor de mecânicas mais "acampamento" (trancar portas, esconderijos)?
- Visão: o assassino enxerga **mais** que os sobreviventes? Tem "sentir"?
- Detector: item **encontrado** ou habilidade de todos? Só proximidade ou também direção vaga?
- Mapa: tamanho-alvo e se mantém **um** mapa bem desenhado ou vários.
- Quais rotas entram na primeira versão (sugestão: Polícia + Carro)?

### 10.9 Etapa 6 entregue: visão e paridade (como foi e o que sobrou)

**Decisões do time:** visão curta **na partida inteira**; no **treino** há interruptor (feito: botão VER TUDO / tecla V).

**Trapaças removidas (tabela da 10.1):**
| Antes | Agora |
|---|---|
| Bot sentia o assassino a 11 tiles através de paredes | Bot **vê** (raio 6 + cone 11, linha de vista) ou **ouve** (assassino andando: 6 tiles; golpe/quebra: 9) e a posição ouvida tem **erro de ~2,2 tiles** |
| Bot usava a posição real do assassino por ~4 s depois de perdê-lo | Usa a **última posição conhecida** (`ai.K`, "só lembra") |
| Bot decidia derrubar pallet olhando o estado real do assassino | Só decide pelo golpe do pallet se estiver **vendo** o assassino (`K.live`) |
| `AI_SPEED` +5% | Removido (e `AI_SENSE`, `AI_SEE`, `SIGHT`) |
| Assassino-IA seguia o alvo real por 2,5 s e sabia qual gerador tinha progresso | Segue **para onde o alvo ia** (última posição + velocidade, até 1,2 s); só conhece o progresso dos geradores que **já viu** (`k.genMem`); só ouvir = posição aproximada e vai "buscar" |

**Dificuldade:** `diff = {time, bot, kp}` calculado no `createGame` a partir do papel (ver README). Tempos de tarefa em `CFG.ROUTES` × `diff.time`.

**Impasses desta etapa**
34. **Gerador "invisível" para o assassino.** `canSee()` testava a linha de vista até o *centro* do gerador, que é um bloco sólido, e a visão batia no próprio bloco. Solução: olhar para um ponto 0,75 tile à frente da face voltada para o observador.
35. **Teste de audição falhava por motivo errado.** O sobrevivente-bot saía andando durante o teste e a distância passava do alcance de audição. Solução: o teste segura as posições a cada quadro (`hold`).
36. **Bot de teste do assassino era trapaceiro** (sabia a posição de todos), o que superestimava o desempenho. Solução: `fairKillerInput()` usa só `g.canSee`, os barulhos (setas) e uma patrulha por geradores, ou seja, a mesma informação de uma pessoa.
37. **Legenda da sala batia nos botões no celular.** O teste de layout não cobria a legenda. Solução: cobrir (até 3 linhas) e adaptar a altura das vagas quando a tela é baixa (`H < 400`).
38. **Névoa e custo.** Em vez de um polígono por entidade, um único canvas de névoa do tamanho da tela (≈140 raios ambiente + 40 do cone) com `destination-out`, mais uma matriz de "tiles vistos" para a memória.

**Números depois da mudança (assassino justo, 8 partidas, equipe de 4 bots):** o assassino vence 8/8, em ~74 s de média, com 85% de aproveitamento de golpe. Interpretação: uma pessoa será bem mais lenta que esse bot (e o bot não erra o caminho), **mas** pode estar fácil demais para o assassino; avaliar com `__dp.report()` antes de mexer.

**Ainda NÃO é paridade perfeita (anotado para as próximas etapas):**
- Bots e assassino-IA conhecem o **mapa inteiro** (layout e posição dos geradores, pallets, janelas); numa partida com itens sorteados isso exigirá **exploração** (etapa do mapa grande).
- Sobreviventes-IA conhecem o **progresso real** dos geradores (como se a equipe se comunicasse).
- Ao ouvir o **reparo** (ruído 9), o assassino-IA recebe posição aproximada, mas a informação sai do `noise` real do sobrevivente.
- O assassino-IA não usa stealth e o sobrevivente-IA não tem detector (etapa 7).

### 10.8 Decisões da conversa seguinte (aprovadas pelo time)
- Plano da seção 10.6 **aprovado**. Pedidos novos: **mapa ainda maior** e **tempos de reparo das rotas de fuga maiores**.
- Proposta para o mapa: **144×96 tiles** (~9× a área atual), com 4 zonas: acampamento (cabanas), floresta densa, lago/cais e estrada. Travessia lado a lado ≈ 36 s a 4 tiles/s.
- Proposta para tempos: todos os tempos de rota ficam numa tabela única (`ROUTES` em `game.js`) com um **multiplicador global**, para ajustar com a telemetria sem mexer em código espalhado. Valores iniciais na seção "Tempos propostos" abaixo.
- Como as partidas ficam mais longas e duras, entra também um **seletor de dificuldade** (afeta só reação/erro dos bots e o multiplicador de tempos), já que o sobrevivente ainda não venceu partidas no playtest 1.

#### Tempos propostos (1 pessoa trabalhando; multiplicador global ajustável)
| Ação | Hoje | Proposta | Observação |
|---|---|---|---|
| Fusível (antigo gerador) | 20 s | **45 s** | 5 de 8 liga a energia; 4 pessoas juntas rendem ~3,4× |
| Telefone (ligar para a polícia) | — | **30 s** + chegada em **150 s** | quem estiver vivo na zona de resgate escapa |
| Carro: 3 peças (bateria, chave, combustível) | — | **35 s** cada (105 s) + ligar o motor 10 s | achar as peças vem antes (mapa grande) |
| Barco: 3 peças (hélice, combustível, chave) | — | **40 s** cada (120 s) + empurrar até a água 15 s | só em mapa com lago |
| Porta principal (hoje) | 3 s | vira o **portão da estrada** (carro/polícia passam por ele) | |
| Janela (abrir) | 0,8 s | 0,8 s | sem mudança |

Meta de duração: **8–12 min** por partida (sem interferência do assassino a rota mais rápida fica em ~5–6 min). Valores iniciais, a calibrar com `__dp.report()`.

## 11. Plano até uma "boa versão" (autonomia concedida: seguir etapa por etapa, documentando aqui)

**Definição de "boa versão" (v0.1):** mapa grande (144×96) com acampamento, floresta, lago e estrada; visão curta; **detector + stealth**; **três rotas de fuga**: Polícia, Carro e Barco (itens, peças, instalação, partida); bots que jogam todas as rotas com os mesmos sentidos de uma pessoa; tempos de reparo maiores; dificuldade; telemetria; lobby; testes automáticos de tudo. "Matar o assassino" fica **fora** da v0.1 (muda o gênero; protótipo à parte).

| Etapa | Entrega | Como valido |
|---|---|---|
| 7 | Sistema de **itens** (genérico) + **rádio detector** + **stealth do assassino** (mapa atual) | testes de faixas/bateria, stealth (velocidade, ruído, visão, energia), bots usando o rádio |
| 8 | **Mapa grande** (gerador por semente: acampamento, floresta, lago, estrada) + navegação otimizada + **mapa de campo** (tecla M) | conectividade em várias sementes, tempo de cálculo por chamada, captura de tela |
| 9 | **Polícia** (energia → telefone → chegada) | testes do fluxo e do tempo; bots chamam a polícia |
| 10 | **Carro** e **Barco** (peças sorteadas, instalar, ligar, embarcar, partir; sabotagem do assassino) | testes de cada passo; bots exploram, pegam peças e instalam |
| 11 | Ajuste fino: tempos (fusível 45 s etc.), dificuldade, equilíbrio com bots justos, telemetria, textos e lobby | partidas simuladas por papel/dificuldade, metas de duração (8–12 min) |
| 12 | Consolidação: README, playbook, artefato final, lista de pendências | suíte completa verde |

**Regras de trabalho:** cada etapa fecha com testes verdes, captura de tela conferida, commit e entrada no playbook (decisões, impasses e números). O artefato é republicado ao fim de cada etapa grande.

### 11.1 Etapa 7 entregue: itens, rádio detector e stealth

**Regras (valores em `CFG`):**
| Peça | Regra |
|---|---|
| Item no chão | segurar **E** perto (`ITEM_RANGE` 1,25 tiles) por `PICK_T` 0,5 s; 1 ferramenta por sobrevivente; E sem alvo solta o item |
| Rádio | liga/desliga com **Q** (ou botão RÁDIO); pilha `RADIO_BATT` 120 s só gasta ligado; faixas: longe < 24, perto < 15, muito perto < 9 tiles; bipes mais rápidos quanto mais perto; sem direção |
| Stealth (assassino) | Shift ou botão ESPR.: velocidade ×0,6, ruído ×0,25, só é visto a 3,5 tiles, rádio alcança só ×0,25 (de 24 para 6 tiles); gasta energia 0,10/s e recarrega 0,05/s; histerese para não piscar no zero |
| Assassino-IA | só espreita ao patrulhar/procurar; ao caçar, corre |
| Bot | liga o rádio quando não está consertando perto do mapa já "limpo"; busca rádios que viu; congela e fica "cauteloso" 2,5 s quando a faixa 3 toca sem ver o assassino |

**Impasses**
39. **Rádio "não pegava" no teste de navegador** (`tool false`). Eram dois erros do *teste*, não do jogo: o item estava a 2 tiles (alcance 1,25) e, depois, o assassino-IA em patrulha estava em stealth, o que encolhe o alcance do rádio de 24 para 6 tiles (o mecanismo funcionando como desenhado). Lição: `game.s` aponta para o *último sobrevivente processado*; para o jogador usar `g.survivors.find(x => x.human)`.
40. **Espreita piscando** com energia 0 (liga/desliga a cada quadro). Solução: histerese (`k.sneakPrev ? 0.02 : STEALTH_MIN`).
41. **Teste de bot "vendo" o assassino por virar o rosto** quando desligou o rádio. Solução: medir nos primeiros quadros com posições/rosto fixos e assassino a 7 tiles.

### 11.2 Etapa 8 entregue: mapa grande, exploração e mapa de campo

**O que entrou**
- `DP.buildMap({kind:'camp'|'arena', rng})`; `createGame({map})` (padrão `camp`; os testes antigos usam `arena`).
- Novos tiles: `T_TREE` (6, sólido, bloqueia a vista) e `T_WATER` (7, sólido, **não** bloqueia a vista); camada `ground` (grama, terra, areia, tábuas, cascalho) só para desenho.
- Geração (`camp.js`): floresta por ruído de valor (mais aberta no centro) → estrada/estacionamento/praça → lago por elipse com borda irregular (nunca em cima de cabana) + areia + cais → trilhas da praça até cada cabana → cabanas (4 modelos × espelhamento) → muros com vão (16) e caixotes (24) → geradores (5 em cabanas, 3 em clareiras com 2 caixotes de marca) → pontos de partida → **conectividade**.
- Conectividade: inundação (4 vizinhos) a partir da estrada; todo "ponto-chave" (porta de cabana, lados de cada pallet de muro, vizinho de gerador, spawns, ponta do cais) que não for alcançado ganha um **túnel** na mata (BFS por árvores) e, no fim, qualquer piso isolado vira mata. Testado em 12 sementes.
- **Conhecimento da equipe**: `o.known` por gerador (visto por qualquer sobrevivente), `g.explore` (≈50 pontos: centro de cada cabana + malha na mata, marcados como visitados quando alguém passa perto). Bots sem gerador conhecido vão ao ponto não visitado mais interessante (cabanas valem −14 de distância, penalidade se outro bot já vai lá, desempate por bot). Na arena tudo é conhecido (comportamento antigo).
- **Mapa de campo (M/Tab/botão MAPA)**: layout (terreno, cabanas, pallets, portão, lago, cais, praça) é conhecido desde o início — como uma placa do acampamento —, mas **geradores e itens só aparecem quando achados**; pontos já visitados ficam verdes. O mapa não mostra colegas nem assassino (paridade). O som passou para a tecla **N**.
- Seta verde para a saída quando o portão está liberado; texto de introdução manda explorar.

**Números (medidos em Node, 4 bots + assassino justo, 60 quadros/s)**
| Medida | Antes das otimizações (144×96) | Depois |
|---|---|---|
| Dijkstra no mapa inteiro | ~3,4 ms | ~1,25 ms (heap tipado, entradas velhas ignoradas) |
| Média por quadro (partida inteira) | 0,17–0,36 ms | 0,07–0,13 ms |
| Pico por quadro (fora o 1º quadro, que inclui a compilação JIT) | 26–60 ms | ≤ 8 ms |
| Geração do mapa | — | 46 ms no pior caso (12 sementes) |

**Impasses**
42. **Pico de 60 ms no primeiro quadro e a cada replanejamento.** Causa: 4 bots + assassino com busca no mapa inteiro ao mesmo tempo. Solução: (a) fila de prioridade em `Int32Array/Float32Array` reaproveitados; (b) `dijkstra(arr, x, y, sMode, {until, margin, limit})`: para quando o ponto de quem vai andar já foi resolvido (+ margem) ou quando passa de um custo máximo (fuga: 34 para o bot, 95 para o assassino). Quem só precisa do "melhor vizinho" não paga o mapa todo.
43. **Bot recalculava o mapa inteiro todo quadro** quando não havia gerador conhecido (a escolha do alvo rodava sem alvo). Solução: só escolhe gerador se existir algum conhecido; senão usa `exploreTarget()`.
44. **Pallets de muro viravam árvores.** O muro com vão era limpo, mas a clareira ficava isolada e a regra "piso isolado vira mata" a engolia. Solução: os dois lados de cada pallet de muro entram na lista de pontos-chave que o gerador conecta.
45. **Legenda do mapa de campo estourava a tela do celular.** Solução: legenda quebrada em linhas pelo `wrap` e margem inferior calculada pelo número de linhas; rótulo "ESTACIONAMENTO" vira "ESTAC." quando a escala é pequena.

**Observações honestas**
- O assassino justo ainda vence muito rápido (4 mortos em 2–4 min na maior parte das sementes): com o mapa grande a busca é mais lenta, mas os bots ainda ficam parados consertando. Calibrar na etapa 11 junto com os tempos de reparo (fusível 45 s).
- O assassino-IA **conhece** a posição dos geradores (ele é o "dono" do acampamento); os bots só conhecem o que viram. Assimetria intencional.
- Árvores são tiles sólidos de 1×1; o visual é de "blocos de mata" (legível, mas rígido). Pode melhorar na fase de arte.
\n
### 11.3 Etapa 9 entregue: rota da polícia

**Fluxo (mapa grande)**
1. **Energia**: 5 de 8 geradores → `g.door.powered` (agora significa "energia") e o telefone passa de `locked` para `ready`. O portão **não** abre só com a energia (na arena continua o comportamento antigo: segurar AGIR na porta).
2. **Ligar**: segurar AGIR no telefone por `ROUTES.phone` (30 s × `diff.time`; mais gente no mesmo telefone rende ×0,8 por pessoa extra, como nos geradores). Faz barulho (`NOISE_PHONE` 11) e a chamada **denuncia** a posição ao assassino. Sem skill check nesta versão.
3. **Esperar**: `coming` com contagem `ROUTES.policeEta` (150 s) visível a todos (HUD "POLÍCIA EM m:ss").
4. **Chegada**: `here`: o portão abre (animação existente) por `ROUTES.policeWindow` (120 s); quem chegar à linha do portão escapa (mesma regra da porta antiga).
5. **Fim da janela**: sem ninguém sair, a polícia vai embora, o portão fecha e o telefone volta a `ready` com progresso 0.
- O assassino pode **chutar** o telefone enquanto está em `ready` com progresso (−15%), igual aos geradores; o assassino-IA patrulha o telefone com energia ligada e o **portão** enquanto a polícia não chega.
- Bots: com energia, vão ao telefone; chamada feita, esperam num ponto de encontro do estacionamento (um por bot, espalhados); com o portão aberto vão correndo.

**Medida (assassino parado, 4 bots, fusível 20 s):** energia aos 172–223 s, chamada aos 189–245 s, chegada ~150 s depois, todos fora por volta de **340–400 s**. Com fusível de 45 s (etapa 11) a partida passa de ~10 min sem interferência, dentro da meta.

**Impasses**
46. **Bots chegavam ao portão e não escapavam.** A estrada parava na linha 2 (a borda de floresta de 2 tiles impedia o desenho da linha 1), e a regra de saída exige `y < 1,7`. Solução: o gerador de mapa abre explicitamente a linha 1 sob o portão. O teste "3/3 equipes de bots escapam" pegou o problema.
47. **Teste não chegava ao gerador** (a posição "1 tile à esquerda" caía numa árvore/caixote). Solução: o teste escolhe o primeiro vizinho livre.
48. **HUD:** a linha "POLÍCIA EM…" ficou na altura das mensagens centrais; as mensagens desceram (`y ≥ 60`) e rádio/espreita foram para a linha de baixo quando há telefone.
\n
### 11.4 Etapa 10 entregue: carro e barco

**Regras**
| Passo | Carro (estacionamento, de frente para o portão) | Barco (ponta do cais) |
|---|---|---|
| Peças | bateria, chave, combustível | hélice, chave, combustível |
| Onde ficam | 70% nas cabanas, o resto ao ar livre, ≥ 14 tiles dos pontos de início; uma por lugar | idem |
| Carregar | 1 peça por pessoa (a mão fica ocupada: não pega outra, nem o rádio atrapalha); ícone da peça ao lado da cabeça; E sem alvo solta | idem |
| Instalar | segurar AGIR com a peça certa: `ROUTES.carPart` 35 s por peça (×0,8 por pessoa extra) | `boatPart` 40 s |
| Ligar | com as 3 peças, segurar AGIR: `carStart` 10 s (barulho 16) | `boatStart` 15 s (empurrar) |
| Embarcar | motor ligado: segurar AGIR 0,9 s; **2 lugares**; entrar = escapar; parte 10 s depois do 1º passageiro (ou 1,2 s se lotar) | idem |
| Saída | o carro anda pela estrada e sai pelo portão (que se abre só para ele); o barco atravessa o lago | |
| Sabotar (assassino) | E: segurar `SABOTAGE_T` 2,5 s perto do veículo (com peças, pronto, ou ligado e vazio): a última peça sai e cai no chão; quem estiver a bordo impede | idem |

- Implementação: tile `T_VEH` (8) só para o carro (sólido enquanto parado; libera ao partir); `g.vehicles[]` com `parts`, `wp` (progresso por peça), `order` (para saber a última), `state` (`build → ready → started → leaving → gone`), `stand` (ponto de acesso: o centro do barco é água, o bot precisa de um ponto em terra).
- `vehicleTick` roda mesmo com a partida encerrada (o carro continua andando na tela de fim).
- Bots: cada um recebe uma **rota** (`police, car, boat, police` pelo id): bot do carro/barco explora procurando peças (desiste após ~5 min sem progresso e vira "polícia"); qualquer bot que **veja** uma peça de que o veículo precisa a pega e leva; veículo pronto: os dois mais próximos (ou o dono da rota) ligam; veículo ligado: quem estiver a < 70 tiles embarca.
- Assassino-IA: veículos entram na patrulha (peso baixo se não houver nada a sabotar) e ele sabota ao chegar. *Assimetria:* ele "sabe" se o veículo tem algo a sabotar.

**Medidas (assassino parado, 4 bots, fusível 20 s, 8 sementes):** todos escapam em **318–471 s**; antes da correção do campo compartilhado, 2 de 8 partidas passavam de 15 min ou travavam.

**Impasses**
49. **Bug antigo: o campo de destino (`fT`) era compartilhado por todos os bots.** Cada bot recalculava o seu a cada 0,4 s, mas entre recálculos usava o que o último bot a calcular deixou. Na arena (todos indo ao mesmo gerador) isso passava despercebido; no mapa grande, com destinos diferentes, os bots oscilavam sem sair do lugar (a direção virava +1/−1 a cada tile). Achado com um gancho de depuração temporário (`g.dbg`) imprimindo destino e saída por quadro. Solução: `ai.fT` por bot.
50. **Bots não conseguiam entregar peças ao barco.** O ponto de destino era o centro do barco, que é água (sólida); a busca nunca expandia para o cais. Solução: `stand` por veículo (carro: logo abaixo; barco: ponta do cais) e o bot usa `tg.stand`.
51. **Bots com peça inútil presos para sempre.** Uma peça cujo veículo já a tem (ou já partiu) agora é largada (`dropItem`) em `vehicleGoal`.
52. **Teste do assassino-IA quebrou por mudança legítima:** com veículos na patrulha ele demora mais a achar um jogador parado; o teste passou de 4 para 7 minutos e o de "só polícia" virou "qualquer rota".

**Pendências desta etapa:** HUD de vez em quando sobrepõe mensagens de introdução em telas baixas (ver etapa 11); texto "LEVANDO:" pode ser longo no celular; barco e carro sem skill check; sem som de passos na água.
\n
### 11.5 Etapa 11 entregue: ajuste fino com números

**Método.** Dois "laboratórios" no Node, com 8 a 16 sementes cada: (a) *assassino justo* (a mesma IA de teste de sempre, agora também vigiando telefone e sabotando veículos) contra 4 bots; (b) *assassino-IA do jogo* contra 4 bots, com o "jogador" trocado por um bot (`g.makeAI(0)`; a partida acaba quando ele morre ou escapa, como no jogo). Parâmetros mudados via `cfg` antes de cada partida.

| Configuração (assassino-IA × bots; "jogador" = bot) | Resultado (16 partidas) |
|---|---|
| fusível 20 s, 2 golpes, intro 3 s (estado antes da etapa) | jogador morre em ~2,5 min (135–171 s), 1 vitória em 8 |
| + fusível 45 s | jogador morre em 3–7 min; equipe escapa pouco |
| + intro 20 s + dificuldade (fácil 0,88× / normal 1× / difícil 1,05×) | fácil: 5 vitórias; normal: 2; difícil: 4 (ruído de amostra) |
| **+ 3 golpes (normal, adotado)** | **4 vitórias, 23 escapes em 16 partidas** (contra 11 com 2 golpes), duração média 292 s |

- *Assassino justo vs 4 bots* (fusível 45 s, 3 golpes): assassino vence 5 de 8 (as 3 derrotas são fugas pelo carro/barco), duração média **558 s** (≈ 9 min), 63% de aproveitamento de golpe.
- Equipe de bots **sem** assassino: escapa em **~405 s** (4 de 4 sementes; rotas usadas: polícia 9, carro 4, barco 3).

**Decisões**
- 3 golpes só no acampamento (na arena continuam 2, os testes antigos dependem disso); `CFG.HP_CAMP`.
- Intro de 20 s (`CFG.INTRO_CAMP`): o assassino nasce a ~60 tiles; sem a vantagem, o jogador era alcançado antes de achar um gerador.
- Dificuldade "fácil": assassino-IA a 0,88× (3,6 tiles/s < 4,0 de quem corre) para existir um modo em que dá para fugir em campo aberto.
- Modos na sala em vez de mais um botão: telas estreitas não têm espaço; o rótulo escolhe a versão que cabe (longa → média → curta).
- Telemetria: cada partida registra `map`, chamadas de polícia, passageiros por veículo e sabotagens; `__dp.report()` ignora partidas na arena.

**Impasses**
53. **Legenda da sala por baixo do botão em telas de 180×320.** O teste só cobria até 3 linhas. Solução: escolher, entre uma versão longa e uma curta, a que cabe acima do primeiro botão, e testar mais dois tamanhos (180×320, 200×360).
54. **Rótulo do modo estourava o botão.** O texto longo "MODO: TREINO (ACAMPAMENTO)" tem 27 caracteres × 6 px. Solução: medir e cair para versões menores.
55. **Teste de desempenho instável.** O limite de 25 ms no pior quadro falhou uma vez com a máquina ocupada (rodava ao lado de outra simulação). Solução: limites 60 ms (pior) e 2 ms (média), que ainda pegariam uma regressão real (o problema antigo era 60 ms *e* 3 ms de média).

**O que ainda não foi calibrado com gente de verdade:** o tempo de partida para uma pessoa (que explora devagar), a letalidade do assassino-IA para humanos (que usam pallets melhor ou pior que os bots) e o equilíbrio entre rotas (polícia é a mais lenta; carro e barco dependem de achar peças). Para isso: jogar algumas partidas e abrir `__dp.report()`.

### 11.6 Etapa 12: consolidação — "boa versão" (v0.1)

**Checklist da definição de v0.1 (seção 11):**
| Item | Estado |
|---|---|
| Mapa grande 144×96 (acampamento, floresta, lago, estrada), por semente | ✅ `js/camp.js`, 12 sementes testadas |
| Visão curta na partida inteira (+ VER TUDO no treino) | ✅ |
| Detector (rádio) + stealth do assassino | ✅ |
| Três rotas: polícia, carro, barco | ✅ (fluxos e tempos testados) |
| Bots com sentidos humanos, exploração, rotas | ✅ (sem trapaças de visão; exceção declarada do assassino-IA) |
| Tempos maiores (fusível 45 s, peças 35/40 s, polícia 150 s) | ✅ |
| Dificuldade, telemetria, lobby com modos | ✅ |
| Testes automáticos | ✅ 262 checagens, ~30 s |
| Matar o assassino | ⛔ fora da v0.1 (protótipo à parte) |

**Como jogar uma partida típica (bots + você, sobrevivente):** abra o mapa (M), vá às cabanas, segure E nos geradores (acerte os skill checks com Espaço), pegue o rádio se vir um (Q liga), se achar peças leve-as ao carro (estacionamento) ou ao barco (cais). Com 5 geradores a energia liga: ligue no telefone, resista ~2,5 min e corra para o portão quando a polícia abrir.

**Resumo numérico final (mesmos laboratórios da 11.5):** equipe de bots sem assassino ~405 s; assassino justo vs bots 558 s com 5/8 vitórias do assassino; assassino-IA vs "jogador-bot" normal ~290 s com 4/16 fugas; desempenho: 0,1 ms/quadro de simulação (média) e 60 fps no navegador sem placa de vídeo.

### 11.7 Playtest 2 (assassino no mapa grande) — feedback e o que mudou

**O que a pessoa disse (primeira partida como assassino, no celular):** o mapa enorme é ótimo ("muito mais suspense"), mas: (1) o assassino não sabia onde ficam geradores e rotas; (2) a espreita deixa lento demais enquanto os bots fazem geradores rápido demais; (3) o assassino enxerga muito mal; (4) no celular "bate em algo" o tempo todo; (5) faltam armários para se esconder; (6) os bots "não quiseram fugir". Ainda não jogou de sobrevivente.

| Queixa | Causa | Mudança |
|---|---|---|
| Não sabia onde estavam as coisas | O mapa existia (M), mas ninguém o abre por conta própria; no celular o botão ficava pequeno | **Minimapa permanente** no canto superior direito (toque nele ou M abre o grande): geradores (todos, para o assassino; só os achados, para o sobrevivente), telefone, carro, barco, portão, você e, para o assassino, os barulhos recentes piscando. A mensagem inicial do assassino explica o minimapa. O assassino agora também guarda o progresso dos geradores que viu (`genMem` também para o jogador). |
| Espreita lenta | `STEALTH_SPEED` 0,6 | 0,8; energia dura ~14 s (antes ~10 s). |
| Bots rápidos demais | Tarefas iguais às do jogo sobrevivente | `KILLER_TASK` 1,5: com assassino-jogador todos os tempos dos bots ×1,5 (fusível ≈ 68 s). |
| Visão ruim | Mesmo raio/cone da IA (7,5 / 12) num mapa de 144×96 | `VIS_KP`: raio 10, cone 18, abertura 0,72 (só para o assassino-jogador; a IA continua com `VIS_K`). Velocidade no acampamento 5,1 (antes 4,75). O assassino-jogador nasce a ~16 tiles da fogueira (a IA continua nascendo longe). |
| Bate em tudo | Árvore = tile quadrado sólido; floresta densa e túneis de 1 tile | Árvore agora tem **tronco redondo** (`TREE_R` 0,45: o corpo desliza nas quinas); densidade ~30% menor; túneis de conexão de 2 tiles; caixotes pela metade. |
| Sem armários | Não existia | **Armários** (T_LOCKER): 1–2 por cabana, 13–17 por mapa. Entrar: segurar AGIR 0,6 s de frente para ele; dentro, o sobrevivente é invisível, silencioso e não é atacado; E ou mover sai. O assassino abre (E, ~1 s): quem estiver dentro é arrancado e **leva um golpe**; o assassino-IA vai direto ao armário onde viu o alvo entrar e confere armários perto do último ponto onde perdeu a pista (70% de chance por parada). Bots: alguns (`hideLike < 0,7`) se escondem quando perdem o assassino de vista com ele perto; saem depois de 8–18 s (cooldown de 30 s). |
| Bots não fugiram | Investigado: quando **veem** o assassino, 99% fogem (691 de 695 amostras). Com espreita (visto só a 3,5 tiles, ruído ×0,25) e vista curta eles só percebem quando já é tarde — é a paridade de informação funcionando | Sem mudança de regra; o armário dá uma saída a mais, e a espreita mais rápida faz o assassino chegar antes de ser notado... mais ou menos. A conferir com mais partidas. |

**Impasses**
56. **Bot preso para sempre no mapa grande (1 de 8 partidas não terminava).** Ao arredondar o tronco com `TREE_R` 0,4, o corpo podia ficar no canto de um tile de árvore (o tile "sólido" para o bot), e o campo de navegação o empurrava para atravessar a árvore. Solução: `TREE_R` 0,45 (raio do corpo + tronco cobrem o tile inteiro; ninguém fica dentro de um tile sólido) e, por segurança, `steer()` tira o bot de um tile sólido para o vizinho livre mais próximo.
57. **Bot "assustado" para sempre por um assassino parado.** No teste com assassino imóvel, um bot entrava em fuga, chegava ao destino e ficava. Solução: um assassino parado a mais de 3,5 tiles não dispara a fuga.
58. **Armário sobrescrito pelo gerador da cabana.** Os armários eram colocados antes dos geradores; o gerador caía no mesmo tile (teste de 12 sementes). Solução: gerar os armários depois dos geradores e evitar vizinhança de gerador/porta/janela.
59. **Teste de energia da espreita** assumia drenagem de ~10 s; a conta real é `DRAIN` líquido (0,07/s ≈ 14 s). O teste foi corrigido para o valor novo.

### 11.8 Playtest 2b — botões confusos, minimapa "mostrando o assassino", armários "bugados"

**Feedback:** (1) o minimapa dos sobreviventes "mostra o assassino"; (2) armários e minimapa "bugados"; (3) no PC os botões são confusos: não se sabe o que faz o quê nem qual é o do skill check; (4) elogio: o visual atual está bonito; (5) uma imagem de referência de estilo (hospital, lanterna, pixel art mais detalhado) e a pergunta "de quantos bits é isso?" — ver 10.10, nada foi implementado.

| Queixa | Causa real | Mudança |
|---|---|---|
| Minimapa "mostra o assassino" | O marcador de **você** era um quadrado vermelho; o único vermelho do mapa lembra o assassino. (Para sobreviventes o minimapa nunca desenhou o assassino: a simulação confirma.) | Sobrevivente: quadrado branco/azul piscante; vermelho só para o assassino-jogador. Legenda explica. |
| Armário "bugado" | (a) **Sair não funcionava logo após entrar:** a saída exigia 0,6 s dentro (o jogador aperta E de novo em ~0,3 s e nada acontecia); (b) o sprite era um bloco escuro quase invisível; (c) a tela ficava preta demais; (d) a mensagem de introdução (20 s) cobria o aviso "SEGURE E: ESCONDER-SE". | (a) saída liberada após 0,25 s (a entrada é por segurar, a saída por apertar de novo); (b) sprite novo 3/4 com tampo claro, venezianas e puxador, com o rosto aparecendo quando alguém o abre; (c) escurecimento mais leve; (d) a instrução inicial dura só 10 s. A legenda do botão AGIR passa a dizer "SAIR DO ARMÁRIO" quando escondido. |
| Botões confusos | Rótulos genéricos (AGIR, PALLET) e o skill check sem dica de tecla (Espaço ou E no PC, toque no celular) | **Cada botão mostra sua tecla** (E, ESPAÇO, Q, SHIFT, M, V) para quem usa teclado; o botão AGIR ganha uma **legenda da ação** (CONSERTAR, PEGAR, INSTALAR, LIGAR O MOTOR, ESCONDER-SE, ENTRAR, SOLTAR PEÇA; assassino: QUEBRAR, CHUTAR, SABOTAR, ABRIR ARMÁRIO) e PALLET diz DERRUBAR PALLET quando há um ao alcance; o skill check mostra **"AGORA! APERTE ESPAÇO"** (ou "TOQUE NA TELA") e o círculo também aceita toque. Nova tela **COMO JOGAR** (menu, pausa ou tecla H), com a tecla e o toque lado a lado, em páginas que se adaptam ao tamanho da tela. |

**Impasse 60:** a ajuda estourava em telas estreitas (nove linhas por item). Solução: monta blocos de texto e **pagina pelo espaço disponível** (de 2 a 5 páginas conforme a tela), com teste em 7 tamanhos.
**Impasse 61:** a dica de teclado só faz sentido para quem usa teclado: `DP.ui.keys` começa ligado em telas sem toque e liga/desliga conforme a última entrada (tecla ou toque).

### 11.9 Edição "Luz" (HD): experimento visual separado

Pedido: uma versão **sem mexer na atual**, para ver o estilo da imagem de referência. Implementado o **caminho 1** da seção 10.10 como variante ligada por opção (`DP.style.hd`), então o artefato "normal" continua exatamente como estava.
- **Lanterna quente:** o cone ganha luz âmbar com núcleo mais forte e borda macia, desenhada com o mesmo polígono da névoa (só ilumina o que a visão deixa ver: não vaza por paredes), com leve tremulação; ao redor, um brilho ambiente neutro pequeno.
- **Poeira** flutuando dentro do feixe.
- **Correção de cor** (sombras levemente azuladas) e **granulado de filme** animado por cima de tudo, antes do HUD.
- **Chão com mais textura:** manchas grandes de musgo/terra/sombra e pequenas rachaduras/gravetos (gerados uma vez, no mapa estático).
- Nada disso altera regras, colisão, IA ou testes. Custo: uma camada de luz e uma de granulado por quadro.
- Ajuste feito durante o desenvolvimento: a primeira correção de cor azulava demais o piso de madeira e deixava tudo cinza; ficou mais neutra (multiplicação 228/230/242 e granulado a 11%).

### 11.10 Playtest 3 — visão, som, mapa decorável, pular com ESPAÇO

**Feedback e respostas**
| Queixa/ideia | Mudança |
|---|---|
| Armário "não aparece" | **Bug meu:** o armário só era desenhado se o ponto central estivesse "visível", mas o centro é um bloco sólido (mesmo problema do gerador). Agora é sempre desenhado (a névoa decide o que se vê). O carro tinha o mesmo defeito. |
| Ouvia tudo, de qualquer lugar | `pan(x, y)` só calculava estéreo. Agora o **volume cai com a distância** (cheio até 5 tiles, 41% a 14, ~6% a 24, nada depois de 30; `HEAR_NEAR/HEAR_FAR`) e sons muito distantes nem tocam. |
| Lanterna "para nada" (vê as costas) | O raio ambiente era 6 (omnidirecional). Agora **3** (sobrevivente) e 3,5 (assassino); o cone faz o trabalho. Além disso, **telhado**: de fora, o *interior* das cabanas fica coberto por telhas (paredes, portas e janelas continuam à vista, para o pallet da porta ser legível); entrando, o telhado some com um fade. Vale para os dois papéis. |
| Mapa "decorável" | O terreno já era sorteado, mas os marcos eram fixos. Agora **mudam a cada partida:** portão (posição na borda norte), praça, estrada, estacionamento (posição/tamanho), telefone (lado e altura), lago (leste ou oeste, tamanho e altura), cais (direção), vaga do carro, posição do barco, nascimento do assassino, 24 pontos de âncora para cabanas (com desvio de ±4). Testado: em 16 sementes há 12 portões, 16 telefones e 16 praças diferentes, e os dois lados de lago. |
| Ruído na tela (granulado) | Removido da edição HD (só ficou a luz). |
| Pular janela só de chegar perto | **ESPAÇO pula** janela aberta/quebrada ou pallet caído (parado de frente também funciona; vale 0,3 s antes de chegar). Chegar perto não pula mais sozinho; aparece "ESPAÇO: PULAR" e o botão PALLET vira PULAR. Janela **fechada**: andando, só mostra "SEGURE E: ABRIR"; **correndo contra ela, quebra** e atravessa (se corta), como antes. Bots continuam pulando sozinhos. |
| SHIFT para correr | No teclado o padrão agora é **andar (mais lento e quieto)** e **SHIFT corre**; no toque, arrastar pouco anda e muito corre. O assassino continua com SHIFT = espreitar. |
| "Loopei o assassino na saída por 1 min e fugi" | Loop de pallet/janela infinito era uma brecha do assassino-IA. Agora, depois de 35 s correndo atrás do mesmo alvo sem acertar, ele **desiste dele por 20 s** (volta à patrulha) e só o retoma se chegar a menos de 3 tiles. (Loops continuam válidos, mas não eternos.) |

**Medidas após a visão menor:** assassino-IA vs "jogador-bot": 3/16 fugas, partida média 218 s (antes 4/16 e 292 s): o assassino-IA ficou um pouco mais forte porque os bots notam o perigo mais tarde. Equipe de bots sem assassino: 474–1036 s (antes 318–471 s, porque exploram com vista menor). A calibrar com gente.

**Impasses:** 62) o assassino de teste ("justo") travava num laço de chutar gerador enquanto um sobrevivente consertava a 3 tiles (artefato do robô de teste, não do jogo); 63) a regra de espaço "pular ou derrubar": só marca `jump` se não houver pallet derrubável (`findDroppable`), para o mesmo botão não fazer as duas coisas.

### 11.11 Anti-loop por mecânica: cansaço da perseguição

**Problema (playtest):** dava para rodar o assassino em círculo em pallet/janela por 1 minuto; "um jogador rei do loop acaba com o assassino só correndo". Desistência da IA (tentada antes) foi **removida**: a solução tem de ser uma mecânica.
**Regra:** enquanto o sobrevivente **corre** com o assassino a menos de 10 tiles e com linha de vista, acumula `chaseT`. Depois de `CHASE_SAFE` = 9 s, a cada segundo há uma chance de **tropeçar** = `TRIP_BASE` 4% + 1,4% por segundo acima dos 9 s. Tropeçar: 1,3 s a 50% da velocidade, barulho, sensação de queda; depois o cansaço volta a 60% do limite. **Alívio:** derrubar um pallet −9 s; pular janela/pallet −4 s; andar, parar, esconder-se ou perder o assassino de vista diminui 1,5× mais rápido que sobe. HUD: barra **CANSAÇO** (verde → amarela → vermelha).
**Resultado medido (12 sementes, assassino colado a 4 tiles em campo aberto):** o tropeço vem em média aos **18 s** (nunca antes de 9 s; em 45 s ocorre em 12/12). Andando, nunca. Ou seja, dá tempo de usar pallet e janela, mas não dá para rodar para sempre; quem precisa de distância tem de usar o mapa. Vale para bots (paridade) e para os dois papéis.
**Impasse 64:** `TRIP_T` já existia (tropeço do assassino) e meu novo valor sobrescrevia o antigo na tabela; renomeei para `SURV_TRIP_T`/`SURV_TRIP_SLOW`.

### 11.12 Folhas-molde de textura (teste a 16 px)
`node tools/export-sheets.js` gera em `assets/template/` (também em `assets/folhas-molde.zip`): 4 sobreviventes, assassino, chão/árvores, móveis, veículos e itens, **ampliados 8×** sobre fundo magenta (= transparente), mais `_com_grade.png` (só para conferir nomes) e `manifest.json` com o retângulo de cada célula. Ver `assets/template/LEIA-ME.md`. Próximo passo: o **importador de atlas** (carregar a folha repintada, com o desenho por código como reserva).

### 10.11 Textura/skins detalhadas (a imagem refeita pelo GPT) — para discussão, nada implementado
A imagem mostra o **nosso próprio screenshot repintado**: terra com pedras e gravetos, grama em tufos, árvores com tronco e raízes, personagem com volume e luz de lanterna granulada. Isso **não é "só aplicar"**: nosso jogo desenha tudo por código com 16×16 px; aquele nível de detalhe vem de **arte pronta** (pintada ou gerada). Caminho prático proposto:
1. Eu exporto um **molde**: uma folha PNG ampliada (4×) com todos os sprites atuais em grade rotulada (personagem em 4 direções × quadros de andar/pular/ferido, assassino, árvores, pedras, chão, paredes, janela, pallet, gerador, telefone, armário, carro, barco, peças, etc.).
2. Você manda esse molde ao GPT (ou a um artista) pedindo para **repintar mantendo a grade e a pose** (fundo transparente, mesma ordem).
3. Eu importo a folha repintada (carregador de atlas com fallback para o desenho por código) e o jogo passa a usar essas imagens, **sem mudar nenhuma regra**.
- **Cuidados:** consistência de estilo entre folhas, bordas limpas/transparência, tiles de chão que "emendam", tamanho (sprites maiores que 16 px exigem escolher a escala: 32 px dobra a resolução do mapa estático e pede divisão em blocos para o celular), e o limite do artefato (16 MB; PNG embutido).
- **Perguntas:** (a) topa o fluxo molde → GPT → importação? (b) escala: manter 16 px repintado ou subir para 32 px? (c) começamos por personagens e árvores/chão (maior ganho) e deixamos prédios/veículos para depois?

### 10.10 Referência de estilo: "de quantos bits é isso?" (para discussão, nada implementado)

"Bits" é só um apelido de época; o que muda o visual é (1) **resolução do sprite/tile**, (2) **quantidade de cores/sombreamento** e (3) **iluminação e pós-processamento**.
- **Hoje:** tiles de 16×16 px, personagem de ~8×16 px, 4 a 8 cores por sprite, cores chapadas: aparência de **8/16 bits (NES–SNES)**.
- **Na imagem:** personagem de ~40 px de altura (≈2,5× o nosso), tiles de ~32–48 px, centenas de tons por sprite, texturas (rachaduras, sujeira), sombras suaves, **luz dinâmica da lanterna**, vinheta e granulado. É o que se chama hoje de **pixel art "HD" / moderna** (detalhe de sprite na faixa dos 32 bits de PS1/PS2, só que com iluminação de hoje). Não é "mais bits" de cor: é mais **pixels por objeto** e **luz**.
- **Três caminhos, do mais barato ao mais caro:**
  1. **Mesma grade de 16 px, mais luz** (1–2 etapas): cone de lanterna suave e colorido, correção de cor, granulado, partículas de poeira, texturas variadas no chão/paredes, sombras projetadas. Mantém tudo o que já funciona e é o que mais aproxima da referência.
  2. **Tile de 32 px (2×)**: todo o desenho por código (~1.000 linhas de pixel art) precisaria ser refeito com o dobro de detalhe; o mapa estático de 144×96 passaria de 2304×1536 para 4608×3072 px (precisa ser dividido em blocos para não pesar no celular). Dá para fazer, mas é caro e o resultado depende do detalhe que eu consiga "desenhar" em código.
  3. **Sprites prontos (PNG)** de um artista/pacote: a melhor qualidade, mas quebra a regra "tudo gerado por código" (os arquivos viram dados embutidos no artefato).
- **Perguntas para decidir:** qual caminho? A regra "tudo por código" pode ser relaxada? A ambientação continua o acampamento ou muda (hospital, como na imagem)? Skins só trocam paleta ou são sprites novos?

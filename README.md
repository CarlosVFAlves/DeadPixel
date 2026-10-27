# Dead Pixel — Protótipo 8: Acampamento (mapa grande)

Jogo 2D em pixel art (HTML + canvas, **sem dependências**, gráficos e áudio gerados por código), pensado para **celular e PC**.
Inspirado em *Dead by Daylight* e *Friday the 13th* (só na ideia: nomes e cenário são próprios), com foco total em **jogabilidade**.

**Versão 0.1 em uma frase:** você e 3 bots exploram um acampamento grande com visão curta, consertam geradores, ligam para a polícia ou montam o carro/barco, e tentam escapar de um assassino que também pode ser você. Tudo por código, sem dependências; roda no celular e no PC. Fluxo do projeto, números e decisões: [`PLAYBOOK.md`](PLAYBOOK.md).

## A sala (menu)

**Dead Pixel** abre numa tela com três entradas:
- **JOGAR** → sala de espera com **4 vagas de jogador** (você é o J1; as outras ficam "aguardando" e viram bots) e o **assassino apagado** (IA). Toque no assassino para **jogar com ele** (então os 4 sobreviventes são bots). Opção **TREINO** e **INICIAR PARTIDA**. Teclado: `Enter` inicia, `T` treino, `1`/`2` papel, `Esc` volta.
- **PERSONAGENS** → só o personagem principal (**Pixel**), andando nas quatro direções, com atributos.
- **LOJA** → protótipo: 6 cartas "em breve" e o saldo de **fichas** (você ganha fichas ao fim de cada partida, fora do treino).

## O acampamento (mapa grande, 144×96 tiles)

Cada partida gera um mapa novo por **semente**: estrada e estacionamento ao norte (com o **portão** de saída), a **fogueira** no centro, ~10 **cabanas** (4 modelos, espelhadas), **muros com vão** e caixotes, um **lago** com **cais** a leste e **floresta densa** em volta (árvores bloqueiam a vista; água não). São 36+ pallets, 20 janelas e 8 geradores (5 dentro de cabanas, 3 ao ar livre); 5 deles ligam o portão.
- Ninguém sabe onde ficam os geradores: **a equipe descobre vendo**. Os bots também **exploram** (cabanas primeiro) e só escolhem um gerador depois de o ter visto. Pressione **M** (ou o botão **MAPA**) para ver o mapa: o que já foi visitado, os geradores **achados** (laranja; verde = pronto), o portão e você.
- **Minimapa** no canto superior direito (toque nele ou tecla `M` para o mapa grande). Para o assassino ele mostra todos os geradores (com o progresso dos que já viu), telefone, carro, barco e os barulhos recentes.
- **Armários** dentro das cabanas: segure AGIR de frente para um para se esconder (ninguém vê nem ouve você); AGIR ou mover sai. O assassino pode abrir armários (AGIR, ~1 s): quem estiver dentro leva um golpe.
- Árvores têm tronco redondo (dá para passar rente). Com assassino-jogador, os bots trabalham mais devagar e o assassino enxerga mais longe e nasce perto do acampamento.
- Com o portão liberado, uma seta verde na borda da tela aponta a **saída**.
- **Rota da polícia**: 5 geradores ligam a energia → vá ao **telefone** (guarita ao lado da estrada) e segure AGIR ~30 s → a polícia chega em ~2 min e **abre o portão por 2 min**: corra para ele. O assassino pode chutar o telefone e vai vigiar o telefone e o portão. Sem sair a tempo, ela vai embora e é preciso ligar de novo.
- **Rota do carro e do barco**: 6 peças espalhadas pelo mapa (bateria, chave e combustível do carro; hélice, chave e combustível do barco; a maioria dentro de cabanas). Pegue **uma por vez** (segure E), leve ao veículo e **instale** segurando E (35–40 s). Com as três: ligue o motor (carro, 10 s) ou empurre o barco (15 s) e **entre** (2 lugares). O assassino pode **sabotar** (tira a última peça): proteja o veículo. O carro está no estacionamento; o barco, na ponta do cais.
- O mapa antigo de 48×32 continua como `map: 'arena'` (usado nos testes).

## Visão curta (névoa de guerra)

Na partida inteira você só vê o que está **perto** (raio de ~6 tiles) ou **na lanterna** (cone de ~11 tiles à frente), sempre com **linha de vista**: paredes bloqueiam, janelas de vidro não. O que você já viu fica "na memória" (mais escuro). **Outros jogadores só aparecem se estiverem à vista**; o HUD mostra o *estado* da equipe, não a *posição*. O assassino enxerga um pouco mais (raio ~7,5, cone ~12).
No **TREINO** há o interruptor **VER TUDO** (botão no canto ou tecla `V`) para testar mecânicas sem a névoa.

**Os bots usam os mesmos limites que uma pessoa** (paridade de informação): só reagem ao que viram ou ouviram, ouvir dá uma posição **aproximada**, e depois de perder o alvo só lembram da **última posição conhecida**. Não há mais bônus de velocidade para bots.

## Dificuldade

Botão **DIF** na sala (Fácil / Normal / Difícil), sempre "para quem joga":
- como **sobrevivente**: tarefas 30% mais longas e assassino-IA 5% mais forte no Difícil; no Fácil as tarefas são 30% mais curtas e o assassino-IA fica **12% mais lento** (um pouco mais lento do que quem corre); seus colegas não mudam.
- como **assassino**: os bots sobreviventes ficam 25% melhores no Difícil (reação, erro, visão e audição) e as tarefas deles 25% mais curtas; no Fácil o contrário.
- Os tempos base ficam numa tabela única (`CFG.ROUTES`): fusível 45 s, porta 3 s (arena), telefone 30 s + polícia 150 s + janela de 120 s, peças do carro 35 s (+10 s para ligar), peças do barco 40 s (+15 s para empurrar).
- **Modo** (botão na sala, tecla `T`): PARTIDA (acampamento), TREINO (acampamento, ninguém morre, pallets voltam; `V` mostra tudo) e TREINO ARENA (o mapa pequeno de 48×32, bom para praticar pallets e janelas).
- No acampamento cada sobrevivente aguenta **3 golpes** (na arena, 2) e o assassino demora **20 s** para sair do lugar (na arena, 3 s).

O jogo guarda no navegador um **histórico** (vitórias/derrotas) e as últimas 60 partidas. Para ver um resumo (aproveitamento de golpes, tempo médio...) abra o console e digite `__dp.report()`.

**Dois papéis** (escolha na sala):
- **SOBREVIVENTE:** você + **3 bots** (cores diferentes) contra o assassino (IA). Explore, ache e conserte geradores, ou procure peças de carro/barco, e escape.
- **ASSASSINO:** você caça **4 sobreviventes controlados por IA**. Eles consertam geradores juntos, fogem, usam pallets e janelas e tentam escapar.

**Objetivo da equipe:** escapar por uma das **três rotas** (veja "O acampamento"): **polícia** (5 de 8 geradores → telefone → o portão abre quando ela chega), **carro** (3 peças → motor → 2 lugares) ou **barco** (3 peças → empurrar → 2 lugares). O assassino vence se **menos da metade** escapar. Na arena pequena, 5 geradores energizam a porta principal (segure AGIR ~3 s para abrir).

O **pallet** continua sendo a principal defesa (veja abaixo); as **janelas** são a segunda rota de fuga.

> Histórico do projeto, decisões de design e como cada impasse foi resolvido: veja o [`PLAYBOOK.md`](PLAYBOOK.md).

Abra `index.html` no navegador (ou `python3 -m http.server` e acesse pelo celular).

## Edição "Luz" (HD, opcional)

`python3 tools/build-single.py saida.html --hd` gera uma variante com lanterna quente, correção de cor, granulado e mais textura no chão (ou abra `index.html?hd`). A jogabilidade é idêntica; é um experimento de estilo (ver Playbook 10.10 e 11.9).

## Controles

Dentro do jogo: menu → **COMO JOGAR** (ou tecla `H`; também no menu de pausa). Os botões na tela mostram a tecla correspondente quando você usa teclado, e o botão AGIR escreve a ação do momento. **Skill check:** `Espaço` (ou `E`) no PC, toque na tela no celular.

**Correr, andar e pular (teclado):** `Shift` corre; solto, só anda (mais lento e silencioso). **`Espaço` pula** janela aberta ou pallet caído quando você está perto (chegar perto não pula mais sozinho) e derruba o pallet quando o assassino está do outro lado. Janela **fechada**: andando, segure `E` para abrir; **correndo (Shift) e apertando `Espaço` contra ela, você a quebra** e atravessa (se corta; com a última vida, 1% de chance de ser fatal). No celular: arrastar pouco anda, arrastar muito corre, e o botão vira PULAR quando há o que pular.

| Celular | Teclado | Ação |
|---|---|---|
| Arrastar na tela (joystick flutuante; **arraste pouco = andar**) | WASD / setas · **Shift = andar** (devagar e quieto) | mover |
| **AGIR** (segurar) | **E** (segurar) | consertar gerador / abrir janela / abrir a porta principal / **pegar item** (rádio) no chão |
| **PALLET** | **Espaço** (ou E sem gerador por perto) | derrubar o pallet ao alcance |
| tocar na tela com outro dedo | **Espaço** | acertar o skill check |
| **RÁDIO** (aparece ao pegar) | **Q** | liga/desliga o rádio detector (3 faixas de proximidade do assassino; ele não aparece se estiver em espreita de longe) |
| II | P / Esc | pausar |
| — | R | reiniciar |
| botão **MAPA** ou o minimapa | **M** ou **Tab** | abre/fecha o mapa de campo |
| — | N | liga/desliga som |

Modos: **JOGAR** (2 acertos e cai; nada volta) e **TREINO** (ninguém morre; pallets e janelas voltam sozinhos, para repetir as mecânicas à vontade).

## Janelas

10 janelas nas casas. Todas **começam fechadas**.

| Situação | O que acontece |
|---|---|
| **Fechada**, segurar **AGIR** (E) ~0,8 s | **abre**, em silêncio (a folha desliza) |
| **Aberta**, **correndo** | **pula** (0,45 s, arco rápido) |
| **Aberta**, **andando** (Shift, ou joystick leve) | passa **tranquilamente** (1 s, apoia as mãos no parapeito). Não corta |
| **Fechada**, **correndo + ESPAÇO** contra ela | **atravessa quebrando**: chuva de cacos, **se corta (−1 vida, nunca mata)** e o grito **denuncia a posição** |
| **Quebrada** (por alguém) | vidro no chão: quem passar **se corta** de novo |
| **Assassino** (AGIR, ~1 s) | **quebra** a janela, fechada ou aberta, para os sobreviventes se cortarem. Ele só **passa por janela aberta/quebrada** (0,85 s, mais devagar que eles); fechada o barra |

Animações: abrir (folha desliza), pulo (arco, pernas encolhidas), passar com calma (mãos no parapeito), atravessar quebrando (braços na frente, linhas de velocidade, flash + cacos) e o assassino quebrando (machado).
No treino as janelas e os pallets voltam sozinhos depois de ~12 s.

## Equipe de bots

- **Dividem os geradores** (cada um escolhe um diferente; dois no mesmo rendem 80% extra) e **fazem skill checks** (~85% de acerto).
- **Só o mais próximo do assassino foge de longe**; os outros continuam trabalhando até ele chegar a ~7 tiles.
- Fogem por **pallets** (derrubam na hora certa), **janelas** (abrem com calma ou quebram se estiverem fugindo) e vão para a **porta** quando ela está liberada.
- Quem leva **2 golpes** cai (fora da partida). Se **você** (sobrevivente) cai ou escapa, a partida acaba.

## Jogando como assassino

| Celular | Teclado | Ação |
|---|---|---|
| joystick | WASD / setas | andar (4,55 tiles/s; os sobreviventes correm ~4,4). Empurre contra janela aberta/quebrada para passar |
| **ATACAR** | **Espaço** | golpe com bote (ergue 0,16 s, avança ~2,5 tiles). Tem um pouco de mira assistida |
| **ESPR.** (segurar) | **Shift** | **espreitar**: mais lento, quase silencioso, só visto de perto e quase invisível ao rádio; gasta energia |
| **AGIR** | **E** | **quebrar** pallet caído (~2 s) ou **janela** (~1 s), ou **chutar** gerador com progresso (−15%). Mexer cancela |

- **Você ganha** se **menos da metade** (0 ou 1) dos 4 escapar. Cada sobrevivente cai com 2 acertos.
- Setas laranja/vermelhas na borda da tela apontam **barulhos fora de vista**: gerador sendo consertado, skill check errado, gerador pronto.
- A zona amarela/vermelha no chão mostra onde um pallet cairia se o sobrevivente derrubasse agora.
- A IA do sobrevivente: **sente** você (batimento) a ~11 tiles e **vê** com linha de visão; foge de quem se aproxima; corre até um pallet que esteja no seu caminho, passa para o outro lado e **derruba na hora certa** (prevendo onde você estará, com tempo de reação humano); pula pallets caídos; foge para o portão quando está aberto.

## Mochila, baús, kit médico, armadilhas e o barracão
Mochila de **3 espaços** (rádio, peça, kit médico, armadilha). **Baús** (12 no mapa) guardam kits e armadilhas: segure `E`. `F` usa o kit (cura 1 vida, ~6 s parado; cura um colega se você não está ferido) e, sem kit, põe a armadilha; no toque, tocar nos quadrados da esquerda. **Armadilha de urso:** a do assassino prende sobrevivente 4 s e a do sobrevivente prende o assassino 3,5 s; dá para desarmar ou soltar um colega com `E`. O assassino nasce no **barracão** (arsenal de armadilhas; `E` repõe). Quem morre fica no chão.

## Medo (sobrevivente) e passos
Quanto mais perto o assassino (e vendo você), mais **MEDO** (barra no HUD). Com medo, **correr** faz tropeçar (chance cresce com o quadrado do medo; andar nunca tropeça; depois de tropeçar, 4 s sem outro; derrubar pallet ou pular janela dá coragem). Passos soam por piso e distância; o assassino, mais pesado e de mais longe. O assassino-IA **aprende** com botes errados (antecipa a mira e acompanha o desvio). Quem se esconde no armário respira baixinho.

## Tropeçar

Quando o assassino (você ou a IA) leva um pallet:
1. **Atordoado** ~0,9 s, parado.
2. **Tropeçando** por 2,8 s: anda a 55% da velocidade, o rumo **desvia** do que você aponta (cambaleia de um lado para o outro, mais forte no começo), e de vez em quando **cai** (0,4 s de tombo para a frente). Não dá para atacar nem agir. O HUD mostra a barra de recuperação.

## Geradores, skill check e portões

- **Gerador:** fique encostado e **segure AGIR/E** (parado). ~15 s para terminar. Mexer o personagem cancela. Progresso fica salvo.
- **Skill check:** de tempos em tempos aparece um anel com um ponteiro girando. Aperte **Espaço** (ou toque na tela com outro dedo) com o ponteiro na zona branca (**vermelha = perfeito**, ganha mais progresso). Errar: **−10%** do gerador, explosão e o assassino vem investigar.
- **Assassino não é onisciente:** ele **vê** com linha de visão (até 13 tiles), **ouve** (reparo 9 tiles, andar 3,5, pular 5) e **rastreia** por 2,5 s depois de te perder. Sem te perceber ele **patrulha os geradores** e **chuta (−15%)** os que têm progresso. Gerador concluído faz barulho e ele vem ver.
- **5 geradores prontos →** a **porta principal** (parede norte) acende. Segure AGIR ~4 s perto dela; depois é só atravessar.

## A mecânica do pallet

1. **Pallet de pé** fica num vão (porta de casa ou muro). Ninguém é bloqueado por ele.
2. Chegando perto (≤ 1,3 tile) aparece o **"E"** e uma **zona de impacto** (amarela) no lado para onde ele cairá — sempre **para longe de você**. A zona fica **vermelha** quando o assassino está dentro dela.
3. **Derrubar** leva 0,22 s para cair (ele anda ~1 tile nesse tempo — derrube *um pouco antes*). O que conta é onde o assassino está **no impacto**:
   - **na zona →** atordoado por 2,4 s ("ATORDOADO!");
   - **fora →** "ERROU!": o pallet vira uma barreira.
4. **Pallet caído** é sólido. Você **pula** empurrando contra ele (0,5 s). O assassino **não pula**: ou **quebra** (2 s, barulhento) ou **dá a volta** — a IA escolhe o que for mais curto.
5. **Mind game:** em ~55% dos encontros o assassino **hesita** diante de um pallet de pé que está entre vocês ("ELE HESITA..."). Derrubar cedo demais gasta o pallet; esperar demais te deixa ao alcance do golpe.

O assassino ataca com um bote (arma erguida 0,16 s → bote de 0,3 s): dá para desviar na lateral. Acerto = −1 vida, +30% de velocidade por 1,8 s.

## Multijogador (v0.0.2)
Menu → **MULTIJOGADOR**. Um jogador **cria a sala** (a partida roda no aparelho dele: manter a aba aberta e na frente); os outros abrem o jogo (pelo link do artefato, logados no claude.ai) e entram pela lista. Cada um toca na vaga que quer (1 assassino + 4 sobreviventes); vagas sem pessoa viram bots; o anfitrião toca INICIAR. Não há servidor: usa a sala do artefato. **Sem a sala do Claude (v0.0.4):** CRIAR POR CÓDIGO / ENTRAR COM CÓDIGO conecta dois aparelhos direto (WebRTC), trocando um código de convite e um de resposta por mensagem; funciona até com o link público ou o arquivo HTML. Detalhes e limites: `PLAYBOOK.md` §13.

## Testes
`node tests/sim.js` (lógica, ~3 min) e `node tests/browser-spec.js arquivo.html` (modo espectador), `node tests/browser-layout.js arquivo.html` (nenhum botão fora da tela/sobreposto em 6 tamanhos), `node tests/browser-p2p.js arquivo.html` (conexão por código com WebRTC real), `node tests/browser-mp.js arquivo.html` (duas telas no Chromium em partida multijogador simulada), `node tests/browser-smoke.js arquivo.html` (desenho no Chromium: passa por todos os tipos de objeto e falha se algum quadro lançar erro). Versão atual no menu: ver `DP.VERSION`.

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `index.html` | página e canvas |
| `js/font.js` | fonte bitmap 5×7 com acentos |
| `js/audio.js` | sons sintetizados (queda do pallet, atordoamento, golpe, batida de coração) |
| `js/camp.js` | gerador do **mapa grande** por semente (floresta, lago, cabanas, trilhas, conectividade garantida) |
| `js/map.js` | arena fixa 48×32 (5 casas, 12 pallets, 10 janelas) e seletor `buildMap({kind})` |
| `js/game.js` | **regras**: sobrevivente, IA do assassino, pallet (sem DOM, testável no Node) |
| `js/render.js` | pixel art por código, zona de impacto, HUD |
| `js/main.js` | laço, telas, entrada por toque/teclado |
| `tests/sim.js` | `node tests/sim.js` — mapa, pallet, geradores, skill check, portões, percepção do assassino, fuzz |
| `tools/build-single.py` | gera um HTML único com todo o JS (para publicar como artefato) |

## Ajustes (`CFG` em `js/game.js`)

`RUN` / `K_SPEED` (velocidades), `STUN` / `STUMBLE_T` / `STUMBLE_SPEED` / `TRIP_T` (tropeço), `AI_SPEED` / `AI_SENSE` / `AI_FLEE` / `AI_SKILL_ERR` (IA do sobrevivente), `REPAIR_T` (tempo do gerador), `TEAM_BONUS`, `WIN_OPEN_T` / `WIN_BREAK_T` / `VAULT_*` (janelas), `NOISE_CRASH`, `SKILL_*` (skill check), `SIGHT` / `NOISE_*` / `TRACK` (percepção do assassino), `FALL_T` (tempo de queda), `ZONE_LEN` / `ZONE_W` (tamanho da zona de impacto), `STUN`, `BREAK_T`, `BREAK_COST` (quanto a IA prefere dar a volta a quebrar), `RESPECT` (chance de hesitar), `ATTACK_RANGE`, `RECOVER_*`.

## Próximos passos (ideias)

Mais sobreviventes (multiplayer), janelas, ganchos/ressuscitar, vários assassinos com poderes, mapas procedurais, névoa de guerra e raio de terror como no protótipo *Retail Nightmare*.

# Dead Pixel — Protótipo 1: o Pallet

Jogo 2D em pixel art (HTML + canvas, **sem dependências**, gráficos e áudio gerados por código), pensado para **celular e PC**.
Inspirado em *Dead by Daylight*, mas com foco total em **jogabilidade**.

Esta primeira versão tem **um sobrevivente** (você), **um assassino** (IA) e **uma única mecânica**: derrubar o pallet no assassino.

Abra `index.html` no navegador (ou `python3 -m http.server` e acesse pelo celular).

## Controles

| Celular | Teclado | Ação |
|---|---|---|
| Arrastar na tela (joystick flutuante) | WASD / setas | andar |
| **DERRUBAR** (botão redondo) | E / Espaço / Enter | derrubar o pallet ao alcance |
| II | P / Esc | pausar |
| — | R | reiniciar |
| — | M | liga/desliga som |

Modos: **JOGAR** (2 acertos e você cai; os pallets não voltam) e **TREINO** (não morre e os pallets voltam a ficar de pé depois de ~8 s, para repetir a mecânica à vontade).

## A mecânica do pallet

1. **Pallet de pé** fica num vão (porta de casa ou muro). Ninguém é bloqueado por ele.
2. Chegando perto (≤ 1,3 tile) aparece o **"E"** e uma **zona de impacto** (amarela) no lado para onde ele cairá — sempre **para longe de você**. A zona fica **vermelha** quando o assassino está dentro dela.
3. **Derrubar** leva 0,22 s para cair (ele anda ~1 tile nesse tempo — derrube *um pouco antes*). O que conta é onde o assassino está **no impacto**:
   - **na zona →** atordoado por 2,4 s ("ATORDOADO!");
   - **fora →** "ERROU!": o pallet vira uma barreira.
4. **Pallet caído** é sólido. Você **pula** empurrando contra ele (0,5 s). O assassino **não pula**: ou **quebra** (2 s, barulhento) ou **dá a volta** — a IA escolhe o que for mais curto.
5. **Mind game:** em ~55% dos encontros o assassino **hesita** diante de um pallet de pé que está entre vocês ("ELE HESITA..."). Derrubar cedo demais gasta o pallet; esperar demais te deixa ao alcance do golpe.

O assassino ataca com um bote (arma erguida 0,16 s → bote de 0,3 s): dá para desviar na lateral. Acerto = −1 vida, +30% de velocidade por 1,8 s.

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `index.html` | página e canvas |
| `js/font.js` | fonte bitmap 5×7 com acentos |
| `js/audio.js` | sons sintetizados (queda do pallet, atordoamento, golpe, batida de coração) |
| `js/map.js` | arena fixa: 5 casas, 2 muros com vão, 12 pallets |
| `js/game.js` | **regras**: sobrevivente, IA do assassino, pallet (sem DOM, testável no Node) |
| `js/render.js` | pixel art por código, zona de impacto, HUD |
| `js/main.js` | laço, telas, entrada por toque/teclado |
| `tests/sim.js` | `node tests/sim.js` — mapa conectado, atordoar/errar/pular/quebrar, fuzz de 40 partidas |

## Ajustes (`CFG` em `js/game.js`)

`RUN` / `K_SPEED` (velocidades), `FALL_T` (tempo de queda), `ZONE_LEN` / `ZONE_W` (tamanho da zona de impacto), `STUN`, `BREAK_T`, `BREAK_COST` (quanto a IA prefere dar a volta a quebrar), `RESPECT` (chance de hesitar), `ATTACK_RANGE`, `RECOVER_*`.

## Próximos passos (ideias)

Mais sobreviventes (multiplayer), geradores/objetivo, janelas, ganchos/ressuscitar, vários assassinos com poderes, mapas procedurais, névoa de guerra e raio de terror como no protótipo *Retail Nightmare*.

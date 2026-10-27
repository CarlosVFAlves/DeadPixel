# Folhas-molde de textura (16 px lógicos, ampliados 8×)

**Objetivo:** repintar os sprites do Dead Pixel com mais detalhe **sem mudar a grade**: mesma ordem, mesma posição e mesmo tamanho de cada célula. O jogo troca o desenho por código por essas imagens (o desenho antigo continua como reserva).

## Como usar
1. Envie **um PNG sem `_com_grade`** por vez ao gerador de imagens (a versão `_com_grade.png` é só para você conferir os nomes das células: **não mande essa**).
2. O fundo **magenta (#FF00FF) significa transparente**. Peça para manter exatamente esse fundo (vamos recortar depois).
3. Guarde o PNG repintado com o **mesmo nome** do arquivo original e mande de volta. O `manifest.json` diz o nome e o retângulo de cada célula.

## Arquivos
| Arquivo | Conteúdo | Tamanho |
|---|---|---|
| `survivor_0_azul.png` … `survivor_3_amarela.png` | Um sobrevivente por folha. **Colunas:** baixo, esquerda, direita, cima. **Linhas:** parado, andando A, andando B, pulo correndo, pulo andando, atravessa vidro, tropeçando, ferido | 768×2048 (célula 192×256) |
| `killer.png` | Assassino. Mesmas colunas; linhas: parado, andando A/B, preparando golpe, golpe (bote), atordoado, cambaleando, quebrando | 768×2048 |
| `tiles.png` | Chão (grama, terra, areia, cascalho, tábua, piso interno, água, parede de tijolo; 8 variações cada), árvores (3×3 tiles, sem chão) e caixotes | 1536×2048 |
| `props_moveis.png` | Armários (fechado/aberto × 4 lados), gerador (3 estados), telefone (3), pallets (de pé/caído/quebrado × 2 orientações), janelas (fechada/aberta/quebrada × 2) | 1024×2304 |
| `props_veiculos.png` | Carro (capô aberto / ligado) e barco (sem peças / ligado) | 768×2048 |
| `props_itens.png` | Rádio, bateria, chaves (carro/barco), combustíveis (carro/barco), hélice | 1024×768 |

## Prompt sugerido (ajuste ao seu estilo)
> Repinte esta folha de sprites de jogo 2D **visto de cima (3/4)**, estilo pixel art detalhado e sombrio de terror, **mantendo exatamente a mesma grade, a mesma pose e a mesma posição de cada célula**. Aumente o detalhe (texturas, sombreamento, volume, roupas, rosto), **sem mudar o enquadramento nem o tamanho dos personagens**. Fundo magenta #FF00FF liso, sem sombras no fundo, sem texto e sem moldura. Luz neutra (sem iluminação direcional forte; o jogo aplica a lanterna). Cores coerentes entre todas as células.

## Dicas
- Para os **chãos**, peça texturas que **emendem** (sem borda), vistas de cima.
- Se o gerador distorcer a grade, divida: mande 1 linha (ou 2) por vez; mantenho o mesmo manifest.
- Para **animação de andar**, as linhas "andando A/B" são só 2 quadros; veja a conversa sobre vídeo para ciclos maiores.

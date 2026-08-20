# GLC Hub SP — Arquitetura

Hub da comunidade de Pokémon TCG Gym Leader Challenge de São Paulo: meta view,
agenda, rankings, insígnias e (Fases 2–3) deck builder e base de decks.

## 1. Fonte de dados — mapeamento validado com a planilha real

Planilha pública: `docs.google.com/spreadsheets/d/1m4bGPteefWIQfjILnZ8iUbHUZj05hxoe_N907GM5c68`

Leitura sem autenticação via gviz CSV (**sempre com `headers=0`** — sem esse
parâmetro o gviz auto-detecta cabeçalho multi-linha e concatena a coluna inteira
no header, corrompendo o parse):

```
/gviz/tq?tqx=out:csv&headers=0&sheet={NOME DA ABA}
```

A descoberta de abas usa o endpoint `/htmlview` (contém `{name: "..."}` por aba).

### Abas reais encontradas (validado em 20/08/2026)

O `/htmlview` lista **9 abas visíveis**; as ~15 restantes (uma por loja/evento:
Citadel, Flow, Bazar, Epic, GLC Brasil, Kooper, MagicRaiz, Meruru, Reserva,
DreamUp, PlayerStop, Premier...) estão **ocultas** — o gviz as serve por nome,
mas elas não aparecem na descoberta. O sync as encontra **sondando os nomes das
lojas conhecidas** (canônicos + aliases), com verificação de assinatura do
conteúdo, porque o gviz devolve a *primeira aba da planilha em silêncio* quando
o nome não existe (confirmado na prática). Abas visíveis:

| Aba | Classificação | Papel |
|---|---|---|
| Dados Vitórias | `LOG_PRESENCIAL` | **Fonte da verdade** (1 linha = 1 insígnia) |
| Dados Vitórias Online | `LOG_ONLINE` | **Fonte da verdade** (cena online separada) |
| Programação | `SCHEDULE` | Grade semanal + torneios especiais + status das lojas |
| Rank Geral / Rank Geral 2026 / Rank por Loja / Rank Online por Loja | `RANK` | **Só validação/reconciliação — nunca fonte** |
| Regras | `RULES` | Institucional (regra de insígnia votada em 20/07/25) |
| Lista Jogadores | `PLAYERS` | Nomes canônicos (base do "reivindicar perfil") |
| Decklists | `DECKLISTS` | Links externos (ver 1.4) |

Abas novas aparecem como `UNCLASSIFIED` + issue `NEW_TAB` para o admin classificar.

### 1.1 Logs (fonte da verdade)

Formato confirmado — cabeçalho na linha 1, dados a partir da 2:

```
"","Flow","Virginia Cardoso","Fogo","","",""            ← histórico sem data
"19/08/2026","Citadel","Guilherme Hitsu","Lutador",...  ← recente com DD/MM/YYYY
```

- Coluna Data vazia em grande parte do histórico → `date NULL` no modelo.
- Célula solta de metadado confirmada em F1/G1: `"Última atualização:","13/08/25 13:19"`
  → capturada em `SheetTab.lastUpdatedNote`, ignorada no parse de linhas.
- Lojas vistas no log que NÃO estão no mapeamento original: **TamerShop**,
  **Premier** — reforça a necessidade de criação automática de venue + issue.

### 1.2 Ranks (blocos, só reconciliação)

No CSV, a linha de símbolos de energia vira células vazias; o cabeçalho textual
tem só "Jogador" na coluna 2. Estrutura de bloco (repetida em "Rank por Loja"):

```
"","","LAIC 2025",...        ← título do bloco (nome da loja/evento)
"","","Jogador",...          ← cabeçalho (detectado por "Jogador" na col 2)
"1","1","Rennan Voi","0",... ← col0 = # Vitórias, col1 = # Insígnias, col3..13 = 11 tipos
```

Parser: varre procurando linhas cujo col2 = "Jogador"; o título do bloco é a
última linha não-vazia anterior. Colunas de tipo são **posicionais**, na ordem
canônica: Planta, Água, Fogo, Elétrico, Incolor, Lutador, Psíquico, Dragão,
Noturno, Metal, Fada. Linhas duplicadas do mesmo jogador são **somadas** antes
de comparar. Jogadores 0/0 são ignorados na reconciliação (mas alimentam a
lista de nomes conhecidos).

As **abas ocultas por loja** têm um segundo layout (validado em 12 abas reais):

```
"<- (Rank Geral)","Rank Geral Citadel - GLC",...
"","Endereço: R. Amaral Gama, 102 - Santana, São Paulo",...
"","Total de vitorias por deck","2","3",...          ← totais por tipo
"Quantidade insignias (vitorias do tipo)","Nome Jogador",...
"10 / 7","Anderson Luís","","1",...                  ← col0 = "vitórias / insígnias"
```

O parser (`parseStoreRankTab`) extrai também o **endereço da loja**, que
alimenta a página da loja no site. A detecção de formato é automática por aba.

### 1.3 Programação

```
linha 0: "Tabela de dias da semana", ..., "Lojas Ativas", ..., "Lojas em hiato"
linha 1: cabeçalhos das lojas, células multi-linha: "Citadel\n (Santana)"
linhas Segunda..Domingo: horários ("20h", "Mensal (confirmar no grupo)")
depois: "Torneios especiais + Mensal/semanal" → DATA | LOJA | HORÁRIO | Nome torneio
```

- Grupos ativa/hiato separados por **coluna vazia** no cabeçalho de lojas
  (mais confiável que a posição dos rótulos, que ficam em células mescladas).
- Nome + bairro extraídos por regex `^(.*?)\s*\(([^)]+)\)$` após colapsar quebras.
- Lojas ativas hoje: Citadel (Santana), TamerShop (Mooca), Epic (Liberdade),
  Flow (Vila Prudente), Kooper (Vila Leopoldina). Em hiato: Bazar de Bagdá,
  Dream Up, PlayerStop, MagicRaiz, Reserva Game Store, Lendário, Mega Geek.
- O log usa nomes curtos ("Reserva", "Bazar") vs Programação ("Reserva Game
  Store", "Bazar de Bagdá") → aliases de venue pré-cadastrados no seed;
  casos novos caem no merge do admin.

### 1.4 Decklists

Formato real: `Link das lista (cardboard warrior ou limitless) | Jogador`, e os
links atuais são **perfis de jogador** no Cardboard Warriors
(`cardboardwarriors.net/decks/player/{user}`), não decks individuais. Modelo
`ExternalDeckRef` com `kind = PLAYER_PROFILE | DECK`; perfis aparecem no perfil
do jogador como link externo; a importação de decks individuais (crawl do
perfil ou link direto) é Fase 3.

## 2. Schema do banco

Ver [prisma/schema.prisma](../prisma/schema.prisma). Domínios:

- **Jogadores**: `Player` (nome canônico + slug) + `PlayerAlias`
  (`normalized` único = minúsculas/sem acento — chave de lookup do sync).
  Jogador desconhecido no log → criado automaticamente + issue `UNKNOWN_PLAYER`;
  o admin depois mescla via alias (merge move insígnias e aliases).
- **Lojas/eventos**: `Venue` (kind `STORE|EVENT`, status `ACTIVE|HIATUS`,
  bairro) + `VenueAlias`, `WeeklySlot` (grade semanal), `Tournament` (datados).
- **Insígnias**: `BadgeWin` — 1 linha do log = 1 insígnia. Guarda os valores
  crus (`rawDate/rawVenue/rawPlayer/rawType`) + resolvidos (`playerId`,
  `venueId`, `type`, `date?`, `modality`). `origin SHEET|SITE` prepara a
  publicação por lojas (Fase 2) com dedup (`DUPLICATE_SUSPECT`).
- **Sync**: `SyncRun` (log de execuções), `SheetTab` (abas descobertas +
  classificação + "última atualização"), `ReconciliationIssue` (painel admin),
  `Setting` (regra de insígnia, início da temporada 2026, cartas-ícone...).
- **Contas** (Fase 2): `User` (email/senha argon2, roles `PLAYER|STORE|ADMIN`),
  `AuthSession`, `AuthToken` (verificação de e-mail / reset), `ProfileClaim`
  (reivindicação de perfil com aprovação).
- **Decks** (Fases 2–3): `Card` (cache das APIs), `BanlistEntry`, `Deck` +
  `DeckVersion` (changelog) + `DeckCard`, `DeckResultLink` (deck ↔ insígnia),
  `ExternalDeckRef`, `DeckVote` (deck da semana).

### Chave idempotente do log

As linhas não têm ID, então:

```
sourceKey = sha256(aba | rawDate | rawVenue | rawPlayer | rawType | n)
```

onde `n` é o nº da ocorrência daquela tupla idêntica na varredura (a mesma
pessoa pode vencer com o mesmo tipo na mesma loja em datas não registradas —
linhas idênticas legítimas). Propriedades:

- **Reordenação / inserção de linhas**: chave estável (não usa índice da linha).
- **Edição de linha**: vira "chave antiga ausente + chave nova" → a antiga é
  marcada `MISSING_IN_SHEET` + issue `ROW_REMOVED` (nunca apagada em silêncio);
  a nova entra normalmente. O admin resolve no painel.
- **Duplicatas legítimas** preservadas pelo contador de ocorrência.

## 3. Job de sincronização

Worker Node no mesmo código-base (`scripts/worker.ts`, contêiner próprio no
docker-compose), intervalo configurável via `SYNC_INTERVAL_MINUTES` (padrão 2h).
Também executável via CLI (`npm run sync`) e botão no admin.

Pipeline de cada execução (`src/lib/sync/run.ts`):

1. **Descoberta de abas** (htmlview) → upsert em `SheetTab`, auto-classificação
   por nome conhecido; aba nova → `UNCLASSIFIED` + issue `NEW_TAB`.
2. **Lista Jogadores** → cria jogadores canônicos + alias próprio.
3. **Logs** (presencial e online) → parse com detecção de cabeçalho por
   conteúdo (nunca posição fixa), normalização de tipo (PT com variações de
   acento/grafia → enum), resolução de jogador/loja via aliases, upsert por
   `sourceKey`, detecção de linhas removidas, captura de "Última atualização".
4. **Programação** → upsert de venues (nome/bairro/status), grade semanal
   (replace da fonte SHEET), torneios especiais datados.
5. **Decklists** → upsert de `ExternalDeckRef`.
6. **Reconciliação** — recalcula rankings a partir de `BadgeWin` e compara com
   as 4 abas de rank (Geral = combinado; Geral 2026 = datados ≥ início da
   temporada; por Loja = presencial por venue; Online por Loja = online por
   venue). Divergências → uma issue `RANK_MISMATCH` por escopo com o diff
   detalhado no payload.
7. Grava `SyncRun` com estatísticas (linhas lidas, inseridas, ausentes, issues).

Falha em uma aba não aborta as demais; o erro fica no `SyncRun.stats`.

## 4. Regras configuráveis (`Setting`)

- `badgeRule`: texto/critério da regra de insígnia (votada em 20/07/25: "todos
  que empatarem em pontos com o 1º ganham a insígnia") — exibida no site e
  editável, pois pode mudar por nova votação. O site **não** aplica a regra
  (quem aplica é quem preenche o log); ele a documenta e usa na UI.
- `season2026Start` (padrão `2026-01-01`): fronteira usada no recorte
  "Temporada 2026" vs "Histórico". Registros **sem data** contam apenas no
  histórico/geral. Se a reconciliação com "Rank Geral 2026" divergir
  sistematicamente, o admin ajusta a data.
- `typeIconCards`: carta-ícone por tipo para thumbnails no meta view (Fase 2+,
  quando o cache de cartas existir; Fase 1 usa as insígnias SVG próprias).

## 5. Stack e deploy

- **Next.js 15 (App Router) + TypeScript**, Server Components/SSR, ISR nas
  páginas públicas; **PostgreSQL 16 + Prisma**; CSS próprio com design tokens
  (cores dos 11 tipos, dark/light) — sem framework de UI, estilo "dados
  limpos" à la Limitless.
- **Docker Compose** no VPS: `db` (Postgres + volume), `migrate` (one-shot,
  `prisma migrate deploy`), `web` (Next standalone), `worker` (sync). Backup
  via `pg_dump` agendado (ver DEPLOY.md).
- Fase 1 protege o admin com `ADMIN_PASSWORD` + cookie HMAC; Fase 2 substitui
  por contas próprias (argon2 + sessões em banco + verificação de e-mail).

## 6. Fases

- **Fase 1 (este MVP)**: sync completo (logs + Programação + reconciliação),
  meta view com filtros (loja/período/modalidade/temporada), agenda, rankings
  recalculados sem duplicatas, perfis públicos de jogador com coleção de
  insígnias, páginas de loja, painel admin (sync, issues, aliases/merge, abas).
- **Fase 2**: contas (e-mail/senha), reivindicação de perfil, contas de loja
  publicando resultados (com dedup), deck builder com validação GLC (60 cartas,
  singleton, mono-tipo, Rule Box, banlist editável), cache de cartas
  (pokemontcg.io/Limitless), import/export de listas.
- **Fase 3**: evolução temporal do meta (só registros datados, com aviso
  "análise disponível a partir de {primeira data}"), cartas mais jogadas por
  tipo, deck da semana com votação, conquistas ("Mestre de Ginásio", 11 tipos),
  importação dos decks da aba Decklists como acervo.

## 7. Decisões tomadas com base nos dados reais (a validar com a comunidade)

1. "Conversão em vitórias" por tipo depende de dados de participação, que o log
   não tem (só vitórias). O meta share da Fase 1 é share de vitórias; conversão
   entra quando houver decks/inscrições publicados no site.
2. "Rank Geral" da planilha aparenta somar presencial + online; a reconciliação
   compara contra o combinado e reporta também o presencial-somente no payload
   para o admin auditar.
3. Nomes de eventos no log ("LAIC 2025", "NZTCG", "GLC Brasil") viram `Venue`
   com `kind = EVENT` (não aparecem na agenda semanal, mas têm página e filtro).

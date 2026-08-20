# GLC Hub SP

Hub da comunidade de Pokémon TCG **Gym Leader Challenge** de São Paulo: meta
view, agenda de torneios, rankings recalculados, perfis com insígnias, contas
de jogador/loja, deck builder GLC com validação em tempo real e galeria de
decks.

Fonte dos dados: planilha comunitária **GLC - Circuito SP** (Google Sheets,
leitura pública). A planilha é a fonte da verdade; o banco é o cache
estruturado. Detalhes do mapeamento, do schema e do job de sync em
[docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Stack

- Next.js 15 (App Router) + TypeScript + React Server Components
- PostgreSQL 16 + Prisma (com pg_trgm para busca fuzzy de cartas)
- CSS próprio com design tokens (cores dos 11 tipos, dark padrão + light,
  Space Grotesk/Inter) + animações via Motion (respeitando
  `prefers-reduced-motion`)
- Base de cartas local importada de
  [PokemonTCG/pokemon-tcg-data](https://github.com/PokemonTCG/pokemon-tcg-data)
  (imagens sempre via images.pokemontcg.io)
- Docker Compose: `db` + `migrate` (one-shot) + `web` + `worker` (sync da
  planilha + refresh semanal de cartas)

## Rodando em dev

Requer Node 20+ e um Postgres (o do compose serve; sem Docker, use o Postgres
embutido: `node scripts/dev-db.mjs start` sobe um na porta 55432 — em UTF8):

```bash
cp .env.example .env        # ajuste AUTH_SECRET e ADMIN_PASSWORD
docker compose up db -d     # só o Postgres (ou: node scripts/dev-db.mjs start)
npm install
npx prisma migrate dev      # cria o schema + gera o client
npm run db:seed             # lojas conhecidas, aliases, configurações
npm run cards:import        # base de cartas do pokemon-tcg-data (~20 mil cartas)
npm run sync                # primeira importação da planilha real
npm run dev                 # http://localhost:3000
```

Sem rede/planilha? `SEED_SAMPLE=true npm run db:seed` popula dados de exemplo
no formato real, incluindo contas de teste (`admin@glchub.local`,
`loja@glchub.local`, `jogador@glchub.local` — senha `senha123`), algumas
cartas e um deck publicado.

Os ícones dos 11 tipos ficam versionados em `public/icons/types/` (gerados de
`tipos/` com `npm run icons:prepare`, que faz o upscale nítido para 128px).

## Rodando tudo com Docker

```bash
cp .env.example .env   # defina AUTH_SECRET, ADMIN_PASSWORD e POSTGRES_PASSWORD
docker compose up -d --build
docker compose run --rm worker npx tsx scripts/sync.ts          # primeiro sync
docker compose run --rm worker npx tsx scripts/import-cards.ts  # base de cartas
```

O worker sincroniza a planilha a cada `SYNC_INTERVAL_MINUTES` (padrão 120) e
atualiza a base de cartas a cada `CARDS_REFRESH_HOURS` (padrão 168 = semanal).
Deploy completo no VPS (HTTPS, backup, restore): [DEPLOY.md](DEPLOY.md).

## Estrutura

```
prisma/schema.prisma      # schema completo (fases 1–3)
prisma/seed.ts            # lojas/aliases + configurações (+ amostras de dev)
scripts/sync.ts           # sync único via CLI
scripts/worker.ts         # sync periódico + refresh semanal de cartas
scripts/import-cards.ts   # importador do pokemon-tcg-data
scripts/dev-db.mjs        # Postgres embutido p/ dev sem Docker (porta 55432)
scripts/prepare-type-icons.ts # upscale dos ícones de tipo (tipos/ → public/)
src/lib/sheets.ts         # download gviz CSV + descoberta de abas
src/lib/sync/             # parsers (logs, programação, ranks) + orquestrador
src/lib/queries.ts        # meta share, rankings, filtros
src/lib/auth.ts           # contas, sessões e tokens (Fase 2)
src/lib/glc.ts            # regras GLC: validação de deck + estatísticas
src/lib/cards/            # importador e busca local de cartas
src/lib/decks/            # parser de decklists (texto/URL) e utilidades
src/app/                  # páginas públicas, conta, deck builder, /loja, /admin
docs/ARQUITETURA.md       # decisões, mapeamento da planilha validado, fases
```

## Contas e papéis

- **player** (padrão): monta e publica decks, reivindica o próprio perfil da
  planilha (aprovação do admin) e vincula decks às suas vitórias.
- **store**: solicitada em `/conta` e aprovada pelo admin — publica torneios na
  agenda e registra resultados pós-evento em `/loja` (com detecção de
  duplicata contra a planilha).
- **admin**: tudo do painel `/admin`, incluindo aprovações e a banlist GLC.

## Painel admin

`/admin` (conta com role ADMIN, ou `ADMIN_PASSWORD` como fallback):
sincronizar agora, atualizar base de cartas, log de syncs, divergências da
reconciliação, gestão de aliases/merge, classificação de abas, aprovação de
contas (reivindicações de perfil e lojas), banlist GLC e configurações.

## Créditos

Projeto de fã, sem fins lucrativos, não afiliado à The Pokémon Company.
Dados da planilha comunitária "GLC - Circuito SP".

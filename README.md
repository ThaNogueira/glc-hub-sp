# GLC Hub SP

Hub da comunidade de Pokémon TCG **Gym Leader Challenge** de São Paulo: meta
view, agenda de torneios, rankings recalculados, perfis com insígnias e (nas
próximas fases) deck builder e base de decks.

Fonte dos dados: planilha comunitária **GLC - Circuito SP** (Google Sheets,
leitura pública). A planilha é a fonte da verdade; o banco é o cache
estruturado. Detalhes do mapeamento, do schema e do job de sync em
[docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Stack

- Next.js 15 (App Router) + TypeScript + React Server Components
- PostgreSQL 16 + Prisma
- CSS próprio com design tokens (cores dos 11 tipos, dark/light, mobile-first)
- Docker Compose: `db` + `migrate` (one-shot) + `web` + `worker` (sync periódico)

## Rodando em dev

Requer Node 20+ e um Postgres (o do compose serve):

```bash
cp .env.example .env        # ajuste AUTH_SECRET e ADMIN_PASSWORD
docker compose up db -d     # só o Postgres
npm install
npx prisma migrate dev      # cria o schema + gera o client
npm run db:seed             # lojas conhecidas, aliases, configurações
npm run sync                # primeira importação da planilha real
npm run dev                 # http://localhost:3000
```

Sem rede/planilha? `SEED_SAMPLE=true npm run db:seed` popula dados de exemplo
no formato real.

## Rodando tudo com Docker

```bash
cp .env.example .env   # defina AUTH_SECRET, ADMIN_PASSWORD e POSTGRES_PASSWORD
docker compose up -d --build
docker compose run --rm worker npx tsx scripts/sync.ts   # primeiro sync manual
```

O worker sincroniza a cada `SYNC_INTERVAL_MINUTES` (padrão 120). Deploy
completo no VPS (HTTPS, backup, restore): [DEPLOY.md](DEPLOY.md).

## Estrutura

```
prisma/schema.prisma      # schema completo (fases 1–3)
prisma/seed.ts            # lojas/aliases conhecidos + configurações
scripts/sync.ts           # sync único via CLI
scripts/worker.ts         # sync periódico (contêiner worker)
src/lib/sheets.ts         # download gviz CSV + descoberta de abas
src/lib/sync/             # parsers (logs, programação, ranks) + orquestrador
src/lib/queries.ts        # meta share, rankings, filtros
src/app/                  # páginas públicas + /admin
docs/ARQUITETURA.md       # decisões, mapeamento da planilha validado, fases
```

## Painel admin

`/admin` (senha = `ADMIN_PASSWORD`): sincronizar agora, log de syncs,
divergências da reconciliação (rankings recalculados × planilha), gestão de
aliases/merge de jogadores e lojas, classificação de abas novas e configurações
(regra de insígnia, início da temporada 2026).

## Créditos

Projeto de fã, sem fins lucrativos, não afiliado à The Pokémon Company.
Dados da planilha comunitária "GLC - Circuito SP".

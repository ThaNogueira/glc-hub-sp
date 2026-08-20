# Deploy no VPS (Docker + Caddy)

Passo a passo do zero numa VPS Linux (Ubuntu/Debian) com Docker.

## 1. Pré-requisitos

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # relogar depois
```

DNS: aponte um registro `A` (ex.: `glchub.seudominio.com`) para o IP da VPS.

## 2. Código e variáveis

```bash
git clone <seu-repo> glchub && cd glchub
cp .env.example .env
```

Edite `.env`:

| Variável | Valor |
|---|---|
| `AUTH_SECRET` | `openssl rand -hex 32` |
| `ADMIN_PASSWORD` | senha forte do painel `/admin` |
| `POSTGRES_PASSWORD` | senha forte do banco (usada pelo compose) |
| `SITE_URL` | `https://glchub.seudominio.com` |
| `SYNC_INTERVAL_MINUTES` | `120` (1h–6h) |
| `CARDS_REFRESH_HOURS` | `168` (refresh semanal da base de cartas) |
| `SMTP_URL` | SMTP p/ "esqueci minha senha" (vazio = link sai no log do web) |
| `MAIL_FROM` | remetente dos e-mails transacionais |
| `SHEET_ID` | já aponta para a planilha do circuito |

`DATABASE_URL` **não** precisa ser definida no `.env` para o compose — os
serviços recebem a URL interna (`db:5432`) via `docker-compose.yml`. A entrada
do `.env.example` serve para dev local fora do Docker.

## 3. Subir

```bash
docker compose up -d --build
docker compose run --rm worker npx tsx scripts/sync.ts          # primeira importação
docker compose run --rm worker npx tsx scripts/import-cards.ts  # base de cartas (deck builder)
docker compose logs -f web worker
```

O serviço `migrate` roda `prisma migrate deploy` + seed e sai; `web` (porta
3000) e `worker` sobem depois dele.

## 4. HTTPS com Caddy

```bash
sudo apt install -y caddy
```

`/etc/caddy/Caddyfile`:

```
glchub.seudominio.com {
    reverse_proxy 127.0.0.1:3000
    encode gzip
}
```

```bash
sudo systemctl reload caddy
```

Certificado Let's Encrypt automático. (Alternativa: nginx + certbot.)

## 5. Backup do banco

Diário, mantendo 14 dias — crontab (`crontab -e`):

```
15 4 * * * cd /caminho/para/glchub && docker compose exec -T db pg_dump -U glchub glchub | gzip > backups/glchub-$(date +\%F).sql.gz && find backups -name '*.sql.gz' -mtime +14 -delete
```

```bash
mkdir -p backups
```

Restore:

```bash
gunzip -c backups/glchub-2026-08-20.sql.gz | docker compose exec -T db psql -U glchub glchub
```

Obs.: o banco é um cache reconstruível — num desastre, `migrate` + seed +
`sync` reimportam tudo da planilha. O backup protege o que só existe no site
(issues resolvidas, aliases criados no admin, configurações e, na Fase 2,
contas e decks).

## 6. Atualizações

```bash
git pull
docker compose up -d --build   # migrate roda de novo automaticamente
```

## 7. Operação

- Painel: `https://glchub.seudominio.com/admin`
- Sync manual: botão "Sincronizar agora" no admin, ou
  `docker compose run --rm worker npx tsx scripts/sync.ts`
- Logs do worker: `docker compose logs -f worker`

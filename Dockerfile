# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

# --- dependências ---
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# --- build do Next (sem banco: páginas são dinâmicas) ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# --- tools: migrações, seed e worker de sync (precisa de node_modules completo) ---
FROM build AS tools
ENV NODE_ENV=production
CMD ["npx", "tsx", "scripts/worker.ts"]

# --- runner: servidor web enxuto (output standalone) ---
FROM base AS runner
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]

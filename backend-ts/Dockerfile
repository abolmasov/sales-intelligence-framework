# syntax=docker/dockerfile:1

##############################
# 1) BUILDER
##############################
FROM node:20-bullseye AS builder

WORKDIR /app/backend-ts

COPY backend-ts/package*.json ./
COPY backend-ts/tsconfig.json ./

RUN npm ci

COPY backend-ts/src ./src
COPY backend-ts/prisma ./prisma
COPY backend-ts/templates ./templates
COPY backend-ts/data ./data
COPY backend-ts/templates.json ./templates.json
COPY shared /app/shared

RUN npm run prisma:generate && npm run build
RUN npm prune --omit=dev

##############################
# 2) RUNTIME
##############################
FROM node:20-bullseye-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/backend-ts/dist ./dist
COPY --from=builder /app/backend-ts/node_modules ./node_modules
COPY --from=builder /app/backend-ts/prisma ./prisma
COPY --from=builder /app/backend-ts/templates ./templates
COPY --from=builder /app/backend-ts/data ./data
COPY --from=builder /app/backend-ts/templates.json ./templates.json
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/backend-ts/package.json ./package.json

EXPOSE 3001

CMD ["node", "dist/backend-ts/src/index.js"]

# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS builder

WORKDIR /src

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN npm run build && npm prune --omit=dev --ignore-scripts --offline --no-audit --no-fund

FROM node:22-alpine

WORKDIR /app

COPY --from=builder /src/package.json /src/package-lock.json ./

COPY --from=builder /src/node_modules ./node_modules

COPY --from=builder /src/dist ./dist
COPY --from=builder /src/server ./server
COPY --from=builder /src/tsconfig.node.json ./tsconfig.node.json

EXPOSE 3100

ENV SERVER_HOST=0.0.0.0
ENV SERVER_PORT=3100
ENV TURNTF_BACKEND_URL=http://localhost:8080

ENTRYPOINT ["./node_modules/.bin/tsx", "server/index.ts"]

FROM node:22-alpine AS builder

WORKDIR /src

COPY package.json package-lock.json ./

# 移除未使用的本地 SDK 依赖，避免 Docker 构建时找不到路径
RUN sed -i '/@tursom\/turntf-js/d' package.json

RUN npm ci

COPY . .

RUN npm run build


FROM node:22-alpine

RUN addgroup -S -g 10001 turntf && \
    adduser -S -D -H -h /app -u 10001 -G turntf turntf

WORKDIR /app

COPY --from=builder /src/package.json /src/package-lock.json ./

# 移除未使用的本地 SDK 依赖
RUN sed -i '/@tursom\/turntf-js/d' package.json

RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /src/dist ./dist
COPY --from=builder /src/server ./server
COPY --from=builder /src/tsconfig.node.json ./tsconfig.node.json

USER turntf:turntf

EXPOSE 3100

ENV SERVER_HOST=0.0.0.0
ENV SERVER_PORT=3100
ENV TURNTF_BACKEND_URL=http://localhost:8080

ENTRYPOINT ["npx", "tsx", "server/index.ts"]

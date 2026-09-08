# turntf-web

turntf 分布式通知服务的管理平台 Web 应用，提供实时的聊天通信和管理功能。项目既是面向最终用户的 SPA 前端，也是一个 Express 后端，负责静态资源托管和 API / WebSocket 代理转发。

## 技术栈

| 层 | 技术 | 版本 |
|---|---|---|
| 前端框架 | React + TypeScript | ^18.3 / ~5.6 |
| 构建工具 | Vite | ^6.0 |
| UI 组件库 | Ant Design (antd) | ^5.24 |
| 路由 | react-router-dom | ^7.18 |
| 数据请求 | @tanstack/react-query | ^5.60 |
| 服务端 | Express | ^5.1 |
| 代理 | http-proxy-middleware | ^3.0 |

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式（Vite :5173，/api 同时代理 HTTP 和 WebSocket 到 localhost:8080）
npm run dev

# 生产构建 + 启动 Express 服务 (:3100)
npm start

# 仅启动 Express 服务（需要先 build）
npm run server
```

## 构建一致性

默认使用package-lock锁定的npm SDK。CI和单元测试不自动使用monorepo下的SDK源码，避免本地支持新协议而发布镜像仍包含旧SDK。确需联合开发时，可以显式运行 `TURNTF_USE_LOCAL_SDK=1 npm run dev`；该选项要求现有 `../../sdk/turntf-web-sdk/src/index.ts` 路径，不应用于生产镜像构建。

生产入口必须使用HTTPS/WSS保护密码传输。登录、用户列表和会话引用使用无损JSON解析器保留64位ID；旧登录缓存一次性失效并丢弃可能包含舍入ID的旧详情跳转，新登录只缓存经校验的字符串身份。实时登录密码仅存在当前页面内存，退出时清理，刷新后通过现有重新认证流程恢复实时连接，不再写入sessionStorage。

```bash
npm test -- --run  # 包括真实HTTP/WS代理、登录精度和协议版本回归
npm run build     # 前端与Express服务类型检查、Vite生产构建
```

## Docker 部署

### 使用预构建镜像

推送代码到 `main`/`master` 分支或创建版本标签时，GitHub Actions 自动构建并推送镜像到 GitHub Container Registry。

```bash
# 拉取最新镜像
docker pull ghcr.io/tursom/turntf-web:latest

# 或指定提交 SHA
docker pull ghcr.io/tursom/turntf-web:sha-<commit-sha>
```

### 前置条件

turntf-web 需要连接到 turntf 后端服务。确保已有运行中的 turntf 实例，或参考 turntf 项目文档部署后端。

### 手动构建镜像

```bash
docker build -t turntf-web:local .
```

### 运行容器

```bash
# 指向本机运行的 turntf 后端（默认端口 8080）
docker run -d \
  --name turntf-web \
  -p 3100:3100 \
  -e TURNTF_BACKEND_URL=http://host.docker.internal:8080 \
  turntf-web:local
```

环境变量说明：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `TURNTF_BACKEND_URL` | `http://localhost:8080` | turntf 后端地址，容器内需指向可访问的地址 |
| `SERVER_PORT` | `3100` | Express 监听端口 |
| `SERVER_HOST` | `0.0.0.0` | Express 监听地址，容器内保持 `0.0.0.0` |

### Docker Compose

提供两种典型的使用方式。

#### 仅部署 turntf-web（后端已在别处运行）

使用预构建镜像：

```yaml
# docker-compose.yml
services:
  turntf-web:
    image: ghcr.io/tursom/turntf-web:latest
    ports:
      - "3100:3100"
    environment:
      - TURNTF_BACKEND_URL=http://turntf:8080
    restart: unless-stopped
```

或从源码构建：

```yaml
# docker-compose.yml
services:
  turntf-web:
    build:
      context: .
    image: turntf-web:local
    ports:
      - "3100:3100"
    environment:
      - TURNTF_BACKEND_URL=http://turntf:8080
    restart: unless-stopped
```

```bash
docker compose up -d
```

#### turntf 后端 + turntf-web 联合部署

```yaml
# docker-compose.full.yml
services:
  turntf:
    image: ghcr.io/tursom/turntf:latest
    expose:
      - "8080"
    volumes:
      - ./config.toml:/app/config.toml:ro
      - ./data:/app/data
    restart: unless-stopped

  turntf-web:
    image: ghcr.io/tursom/turntf-web:latest
    ports:
      - "8080:3100"
    environment:
      - TURNTF_BACKEND_URL=http://turntf:8080
    depends_on:
      - turntf
    restart: unless-stopped
```

```bash
# 启动全部服务
docker compose -f docker-compose.full.yml up -d
```

### 同端口入口

联合部署时，只有 turntf-web 发布宿主机端口。浏览器页面、`/api/*` 和原有 turntf API/WebSocket 共用该入口，Go 服务仅通过 Docker 内网的 `turntf:8080` 访问。现有部署切换时，应将宿主机端口映射从 Go 容器移到 Web 容器，不能让两个容器同时绑定同一地址端口。

- `/api/*` 去掉一次 `/api` 后转发，包含 `/api/ws/client`。
- 原始 `/auth/*`、`/users`、`/nodes/*`、`/cluster/*`、`/events`、`/ops/*`、`/metrics`、`/healthz` 路径继续转发，不要求现有SDK改地址。
- `/ws/client`、`/ws/realtime` 和 `/internal/cluster/ws` 原样转发二进制WebSocket流；原有集群peer URL不变。
- `/login`、`/chat`、`/admin/*` 等页面仍走SPA。上游失败返回502，不回退为页面。
- 生产镜像包含启动所需的tsx，直接执行镜像内二进制，不在启动时联网安装依赖。部署应固定已验证镜像digest。

### 验证部署

```bash
curl http://localhost:8080/             # 联合部署返回 SPA 页面
curl http://localhost:8080/api/healthz  # Web API 前缀
curl http://localhost:8080/healthz      # 原始 API 入口仍可用
```

联合部署打开 `http://localhost:8080`，单独部署按映射端口访问，使用有效的 turntf 账号登录。

## 项目结构

```
turntf-web/
├── server/                    # Express 后端
│   ├── index.ts               # 服务入口
│   ├── config.ts              # 服务配置（环境变量）
│   ├── proxy.ts               # API/WebSocket 代理
│   └── middleware/logger.ts   # 请求日志
├── src/                       # React 前端
│   ├── main.tsx               # 应用入口
│   ├── App.tsx                # 根组件（路由、Provider 配置）
│   ├── api/                   # API 请求层
│   │   ├── auth.ts            # 认证 API
│   │   ├── users.ts           # 用户 CRUD API
│   │   ├── messages.ts        # 消息 API
│   │   ├── events.ts          # 事件日志 API
│   │   ├── attachments.ts     # 附件/关系 API
│   │   ├── cluster.ts         # 集群 API
│   │   ├── metrics.ts         # Prometheus 指标 API
│   │   └── ops.ts             # 运维/健康检查 API
│   ├── components/
│   │   ├── chat/              # 聊天组件
│   │   ├── common/            # 通用组件（路由守卫、错误边界等）
│   │   └── layout/            # 布局组件（侧边栏、顶栏）
│   ├── config/                # 前端配置
│   ├── context/               # React Context（Auth、Chat）
│   ├── hooks/                 # 自定义 Hooks
│   ├── pages/                 # 页面组件
│   ├── types/                 # TypeScript 类型定义
│   └── utils/                 # 工具函数（格式化、编码、常量）
├── index.html
├── package.json
├── tsconfig.json              # 前端 TS 配置
├── tsconfig.node.json         # 服务端 TS 配置
├── vite.config.ts
├── Dockerfile                 # Docker 镜像构建
├── docker-compose.yml         # Docker Compose 部署
└── .dockerignore
```

## 架构

### 请求流转

```
浏览器 ←→ Express (:3100)
              ├── /api/* → 去前缀代理 → turntf 后端 (:8080)
              ├── 原始 API/集群路径 → 原样代理 → turntf 后端
              ├── 页面路径 → dist/ 静态文件（SPA）
              └── 受支持的 WebSocket 路径 → 升级转发到 turntf 后端
```

- **开发模式**：Vite 开发服务器 (:5173) 自身代理 `/api` 到后端，并转发聊天长连接 `/api/ws/client`
- **生产模式**：Express (:3100) 托管静态文件并代理 API/WebSocket

### 状态管理

两层状态管理：

1. **React Context**（全局持久状态）：`AuthContext` 管理 token/用户信息（持久化到 localStorage），`ChatContext` 管理实时消息列表
2. **TanStack React Query**（服务端状态）：页面数据获取、自动轮询刷新、写操作后缓存失效

### 路由

| 路径 | 页面 | 权限 |
|---|---|---|
| `/login` | 登录页 | 公开 |
| `/chat` | 聊天 | 登录 |
| `/chat/:nodeId/:userId` | 指定用户聊天 | 登录 |
| `/contacts` | 联系人 | 登录 |
| `/settings` | 个人设置 | 登录 |
| `/admin` | 仪表盘 | 管理员 |
| `/admin/users` | 用户管理 | 管理员 |
| `/admin/users/:nodeId/:userId` | 用户详情 | 管理员 |
| `/admin/messages/:nodeId/:userId` | 消息列表 | 管理员 |
| `/admin/events` | 事件日志 | 管理员 |
| `/admin/cluster` | 集群监控 | 管理员 |
| `/admin/metrics` | 指标 | 管理员 |

路由守卫：`ProtectedRoute` 校验登录态，`AdminRoute` 额外校验管理员角色。

### 消息轮询

当前使用 HTTP 轮询方案（3 秒间隔）拉取新消息，通过 `seq` 序号判断增量。新消息通过 `ChatContext.addMessage` 分发，`ConversationList` 监听后更新会话预览。

## 配置

### 服务端环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `TURNTF_BACKEND_URL` | `http://localhost:8080` | turntf 后端地址 |
| `SERVER_PORT` | `3100` | Express 监听端口 |
| `SERVER_HOST` | `0.0.0.0` | Express 监听地址 |

### 前端环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` | API 基础路径 |

## 开发命令

```bash
npm run dev       # Vite 开发服务器 (:5173)
npm run build     # 类型检查 + 生产构建
npm run preview   # 预览生产构建
npm run server    # Express 生产服务器 (:3100)
npm start         # build + server 一键启动
npm test          # 运行测试
npm lint          # 代码检查
```

## API 层规范

- 认证：`Authorization: Bearer <token>` 头，token 从 localStorage 获取
- 错误处理：统一用 `resp.ok` 判断，失败抛出 `Error`
- 类型映射：后端返回 snake_case，前端类型定义直接对应，不做转换

## 设计约定

- 界面文案使用中文，Ant Design 配置 `zhCN` locale
- 全局状态仅使用 React Context，不引入额外状态库
- TypeScript strict mode，所有 API 响应均有类型定义
- 组件通过 props 接收数据，与页面轮询逻辑解耦
- 最外层包裹 ErrorBoundary 防止白屏

# FaxHistoria

AI 驱动的历史策略模拟游戏（Monorepo），包含：
- `client`：React + Vite 前端
- `server`：Fastify + Prisma 后端
- `packages/shared`：前后端共享类型与校验 schema

## 技术栈

- Node.js 20+
- React 18 + Vite 5 + Zustand + Tailwind CSS 4
- Fastify 5 + Prisma 6 + PostgreSQL 16
- DeepSeek（OpenAI SDK 兼容调用）
- Vitest + Playwright（后端测试）

## 目录结构

```text
.
├── client/
├── server/
├── packages/shared/
├── docker-compose.yml
├── ecosystem.config.cjs
└── package.json
```

## 环境准备

1. Node.js >= 20
2. Docker（推荐，用于本地 PostgreSQL）
3. `pm2`（根脚本 `npm run dev` 依赖）

```bash
npm i -g pm2
```

## 环境变量

在项目根目录创建 `.env`：

```env
DATABASE_URL="postgresql://faxhistoria:faxhistoria123@localhost:5433/faxhistoria"
DEEPSEEK_API_KEY="your_deepseek_api_key"
DEEPSEEK_BASE_URL="https://api.deepseek.com"
DEEPSEEK_MODEL="deepseek-chat"
JWT_SECRET="replace_with_a_strong_secret"
PORT=40010
VITE_SITE_URL="https://your-domain.example"
NODE_ENV=development
DAILY_API_LIMIT=50
GAME_TOKEN_LIMIT=500000
```

说明：
- `DEEPSEEK_API_KEY` 不配置时，提交回合会失败。
- `VITE_SITE_URL` 用于生成 `canonical`、`robots.txt`、`sitemap.xml`，生产环境请配置为站点主域名（如 `https://faxhistoria.vercel.app`）。
- 默认前端端口 `40011`，并通过 Vite 代理转发 `/api` 到后端 `40010`。

## 快速启动（推荐）

```bash
npm run setup
npm run dev
```

`npm run setup` 会执行：
- 安装依赖
- 启动 PostgreSQL（Docker）
- Prisma generate + db push
- 构建共享包

启动后访问：
- 前端：[http://localhost:40011](http://localhost:40011)
- 健康检查：[http://localhost:40010/api/health](http://localhost:40010/api/health)

## 常用命令

```bash
# 开发
npm run dev              # PM2 同时启动 client + server
npm run stop
npm run restart
npm run logs

# 分别启动
npm run dev:server
npm run dev:client

# 构建
npm run build

# 测试（后端）
npm run test
npm run test -w server
npm run test:e2e -w server
npm run test:all -w server

# 数据库
npm run db:up
npm run db:down
npm run db:generate
npm run db:push
npm run db:migrate
```

## API 概览

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/games`
- `POST /api/games`
- `GET /api/games/:id`
- `POST /api/games/:id/turn`（需要请求头 `X-Idempotency-Key`）
- `GET /api/health`

## 开发提示

- 前后端共享类型定义在 `packages/shared/src`，新增接口时优先在这里补 schema。
- 后端使用 JWT 鉴权；受保护接口依赖 `Authorization: Bearer <token>`。
- 若你已在本机运行其他 PostgreSQL，请注意端口冲突（默认映射为 `5433`）。

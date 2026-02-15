# AGENTS Guide

`AGENTS.md` 是本仓库代理协作的唯一主文档，`CLAUDE.md` 只保留入口说明。

## 1. 项目速览

- Monorepo：
  - `packages/shared/`：共享 Zod schema、类型、常量
  - `server/`：Fastify + Prisma 后端
  - `client/`：React + Vite 前端
- 默认端口：
  - Server：`40010`
  - Client：`40011`
- 环境变量：
  - 统一使用根目录 `.env`
  - 由 `server/src/env.ts` 加载（`override: true`）

## 2. 常用命令

```bash
npm run setup
npm run dev
npm run stop
npm run restart
npm run logs

npm run dev:server
npm run dev:client

npm run build
npm run test
npm run test -w server
npm run test:e2e -w server
npm run test:all -w server

npm run db:up
npm run db:down
npm run db:generate
npm run db:push
npm run db:migrate
```

## 3. 核心架构（必须理解）

- 回合提交主路径：`POST /api/games/:id/turn`
  1. 校验请求与 `X-Idempotency-Key`
  2. 短事务内完成幂等检查、回合号检查、配额检查
  3. 调用 AI 生成事件并经规则仲裁
  4. 应用事件、落库并缓存幂等结果
- 流式回合：`POST /api/games/:id/turn/stream`，SSE 阶段为 `VALIDATING -> PROCESSING_AI -> APPLYING_EVENTS -> PERSISTING -> COMPLETED`。
- 关键实现文件：
  - `server/src/services/turn.service.ts`
  - `server/src/services/ai/ai-service.ts`
  - `server/src/services/ai/rule-arbiter.ts`
  - `server/src/services/state.service.ts`
  - `client/src/services/api.ts`

## 4. 不可破坏约束

- Shared-first：API 契约或领域类型变更，必须先改 `packages/shared`，再改前后端。
- 路由层必须做 schema 校验并返回明确错误码。
- 受保护路由统一使用 `fastify.authenticate`。
- 回合接口（含 stream）必须保留 `X-Idempotency-Key` 语义。
- 前端请求统一走 `client/src/services/api.ts`，禁止在组件内直接 `fetch`。
- 数据库变更必须同步 `server/prisma/schema.prisma`，并注明 `db:push`/迁移步骤。

## 5. 验证基线

- 后端业务改动：至少执行 `npm run test -w server`。
- 回合/并发/幂等/限流改动：优先补或改 `server/src/__tests__/e2e/*`，并执行 `npm run test:e2e -w server`。
- 前端关键流程改动（登录/建局/提交回合）：至少手动走通一次主流程。
- 交付前最小检查：`npm run build` + 相关测试通过。

## 6. 提交流程

1. 保持最小改动面，不顺手修无关问题。
2. 提交说明必须写清：改了什么、为什么改、如何验证。
3. 涉及端口、限流、配额、鉴权、幂等默认值时，必须写明影响范围和回滚方式。

## 7. 禁止事项

- 禁止提交 `.env`、密钥、token、本地缓存文件。
- 禁止绕开 `packages/shared` 在前后端各写一套结构。
- 禁止未说明影响范围就修改端口、限流或 token 配额默认值。

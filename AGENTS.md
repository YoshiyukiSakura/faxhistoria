# AGENTS Guide

本文件给在 `faxhistoria` 仓库内协作的开发者/代理使用，目标是减少误改并保持改动可验证。

## 项目概览

- Monorepo 工作区：
  - `client`：前端（React + Vite）
  - `server`：后端（Fastify + Prisma）
  - `packages/shared`：共享 schema、类型、常量
- 默认端口：
  - Server: `40010`
  - Client: `40011`
- 根目录 `.env` 由后端加载（`server/src/index.ts`）

## 开发命令

```bash
# 首次（推荐）
npm run setup

# 日常开发
npm run dev
npm run stop
npm run logs

# 定向启动
npm run dev:server
npm run dev:client

# 测试
npm run test
npm run test -w server
npm run test:e2e -w server
```

## 代码修改约定

- 先改 `packages/shared` 再改前后端调用：
  - 新增/调整 API 入参或返回结构时，先更新 shared schema 与类型。
- 后端接口统一要求：
  - 路由层做 schema 校验并返回明确错误码。
  - 受保护路由使用 `fastify.authenticate`。
  - 回合提交接口必须保留 `X-Idempotency-Key` 语义。
- 前端接口调用统一走 `client/src/services/api.ts`，避免组件内直接 `fetch`。
- 数据库变更必须同步 Prisma schema，并补充必要迁移/推送步骤说明。

## 测试与验证

- 涉及后端业务逻辑：
  - 至少执行 `npm run test -w server`。
- 涉及回合处理、并发/幂等、限流：
  - 优先补或更新 `server/src/__tests__/e2e/*`。
- 涉及前端关键流程（登录、创建游戏、回合提交）：
  - 至少本地手动走一遍核心路径。

## 提交流程建议

1. 保持改动最小化，不顺手修无关问题。
2. 提交前检查：
   - `npm run build`
   - 相关测试通过
3. 在提交说明中写清：
   - 改了什么
   - 为什么改
   - 如何验证

## 禁止事项

- 不要提交 `.env`、密钥或本地缓存文件。
- 不要绕开 shared schema 直接在前后端“各写一套”数据结构。
- 不要在未说明影响范围时修改端口、限流和 token 配额默认值。


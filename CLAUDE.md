# CLAUDE.md

Primary agent instructions are in `AGENTS.md`.

When using Claude Code in this repository:

1. Read and follow `AGENTS.md` first.
2. If there is any conflict, `AGENTS.md` takes precedence.
3. Keep this file minimal to avoid duplicate maintenance.

Quick context:

- Project: FaxHistoria (AI-driven historical strategy simulation game)
- Stack:
  - `client`: React + Vite
  - `server`: Fastify + Prisma
  - `packages/shared`: shared schemas/types
- Single root `.env` loaded by `server/src/env.ts`

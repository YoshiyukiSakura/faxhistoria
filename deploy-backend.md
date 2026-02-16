# FaxHistoria Server 部署指南（Ubuntu + PM2）

本文只覆盖 `server` 部署。`client` 继续走 Vercel。

目标机器：`ubuntu@15.235.212.36`  
建议后端端口：`41010`（高位端口，冲突概率更低）

## 0. 发布原则（必须 Git）

- 服务器代码只允许通过 `git clone` / `git fetch` / `git pull` 更新。
- 禁止使用 `rsync`、`scp`、手工覆盖目录等“绕过 Git”的方式发布。
- 每次发布必须可追溯到一个 commit SHA，并在服务器上核对该 SHA。
- 生产进程必须由 PM2 托管，禁止直接 `node ...` 后台跑服务。
- `faxhistoria-server` 必须保持单实例（只允许 1 条 PM2 记录）。

## 0.1 本地发布前检查（先推送再部署）

```bash
cd /path/to/faxhistoria

# 1) 测试与构建
npm run test
npm run test:e2e:ui -w server
npm run build

# 2) 提交并推送
git status
git add -A
git commit -m "feat: xxx"
git push origin main

# 3) 记录本次发布 SHA
git rev-parse --short HEAD
```

## 1. 登录服务器并安装基础环境

```bash
ssh ubuntu@15.235.212.36

sudo apt update
sudo apt install -y git curl build-essential

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PM2
sudo npm i -g pm2

# Docker（用于本项目 PostgreSQL）
sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
```

执行完 `usermod` 后请重新登录一次 SSH：

```bash
exit
ssh ubuntu@15.235.212.36
```

## 2. 首次部署：用 Git 克隆项目

```bash
mkdir -p ~/apps
cd ~/apps
git clone git@github.com:YoshiyukiSakura/faxhistoria.git faxhistoria
cd faxhistoria
git checkout main
git pull --ff-only origin main
npm ci
```

## 2.1 如果目录已存在但不是 Git 仓库（必须先修复）

> 这个场景下不要继续发布，先把目录改回 Git 管理状态。

```bash
cd ~/apps
if [ -d faxhistoria ] && [ ! -d faxhistoria/.git ]; then
  mv faxhistoria "faxhistoria.backup.$(date +%Y%m%d-%H%M%S)"
fi

git clone git@github.com:YoshiyukiSakura/faxhistoria.git faxhistoria
cd faxhistoria
git checkout main
```

## 3. 配置生产环境变量（根目录 `.env`）

后端会从仓库根目录读取 `.env`（不是 `server/.env`）。

```bash
cat > .env << 'EOF'
DATABASE_URL="postgresql://faxhistoria:faxhistoria123@localhost:5433/faxhistoria"
DEEPSEEK_API_KEY="your_deepseek_api_key"
DEEPSEEK_BASE_URL="http://208.64.254.167:8001/v1"
DEEPSEEK_MODEL="DeepSeek-V3.2"
JWT_SECRET="请替换为强随机密钥"
PORT=41010
NODE_ENV=production
DAILY_API_LIMIT=50
GAME_TOKEN_LIMIT=500000
EVENT_IMAGE_ENABLED=true
EVENT_IMAGE_ENDPOINT="http://208.64.254.167:8013/api/generate"
EVENT_IMAGE_PUBLIC_BASE_URL="http://208.64.254.167:8013"
EVENT_IMAGE_PUBLIC_PATH_PREFIX="/generated"
EVENT_IMAGE_SIZE="384x384"
EVENT_IMAGE_TIMEOUT_MS=15000
EVENT_IMAGE_DETERMINISTIC_SEED=true
EVENT_IMAGE_SEED_SALT="faxhistoria-event-image-v1"
EOF
```

## 4. 初始化数据库

```bash
cd ~/apps/faxhistoria
npm run db:up
set -a
source .env
set +a
npm run db:generate
npm run db:push

# 建议：让数据库容器随系统重启自动拉起
docker update --restart unless-stopped faxhistoria-db
```

## 5. 构建后端

```bash
cd ~/apps/faxhistoria
set -a
source .env
set +a
npm run db:generate
npm run build -w packages/shared
npm run build -w server
```

## 6. 用 PM2 启动 server

```bash
cd ~/apps/faxhistoria
pm2 delete faxhistoria-server || true
set -a
source .env
set +a
pm2 start server/dist/index.js --name faxhistoria-server --cwd /home/ubuntu/apps/faxhistoria --time --update-env
```

检查状态与日志：

```bash
cd ~/apps/faxhistoria
pm2 status faxhistoria-server
pm2 logs faxhistoria-server --lines 100
```

## 7. 设置 PM2 开机自启

```bash
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
sudo systemctl enable pm2-ubuntu
sudo systemctl start pm2-ubuntu
```

## 8. 放行后端端口

如果用 UFW：

```bash
sudo ufw allow OpenSSH
sudo ufw allow 41010/tcp
sudo ufw enable
```

如果云厂商有安全组，也要放行 TCP `41010`。

## 9. 健康检查

```bash
curl http://127.0.0.1:41010/api/health
curl http://15.235.212.36:41010/api/health
```

期望返回：

```json
{"status":"ok","timestamp":"..."}
```

再做一条 AI 鉴权连通性检查（和服务端配置保持一致）：

```bash
cd ~/apps/faxhistoria
set -a
source .env
set +a

curl -sS "$DEEPSEEK_BASE_URL/chat/completions" \
  -H "Authorization: Bearer $DEEPSEEK_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"$DEEPSEEK_MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"ping\"}],\"max_tokens\":16,\"stream\":false}"
```

如果这里返回 401，不要重启应用，先修正 `.env` 里的 `DEEPSEEK_*` 并再次验证通过后再发布。

## 10. Vercel 前端对接后端

当前前端固定请求 `/api`，所以在 Vercel 需要把 `/api` 重写到后端。

如果 Vercel 项目根目录是 `client`，新建 `client/vercel.json`：

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "http://15.235.212.36:41010/api/:path*"
    }
  ]
}
```

部署后，前端访问 `/api/*` 会由 Vercel 代理到你的服务器。

生产环境建议把 `destination` 换成你自己的 HTTPS 域名（例如 `https://api.yourdomain.com/api/:path*`）。

## 11. 后续更新发布流程（Git Only）

### 11.1 服务器更新代码（必须走 Git）

```bash
ssh ubuntu@15.235.212.36
cd ~/apps/faxhistoria

# 必须是 Git 仓库
test -d .git

git fetch origin --prune
git checkout main
git reset --hard origin/main
git clean -fd
test -z "$(git status --porcelain)"

# 核对当前部署 SHA（应与本地发布 SHA 一致）
git rev-parse --short HEAD
```

### 11.2 安装、构建、迁移、重启

```bash
cd ~/apps/faxhistoria
npm ci

set -a
source .env
set +a

npm run db:generate
npm run build -w packages/shared
npm run build -w server
npm run db:push

# 严格清理：只保留一个 faxhistoria-server 进程
pm2 delete faxhistoria-server || true
truncate -s 0 ~/.pm2/logs/faxhistoria-server-out.log ~/.pm2/logs/faxhistoria-server-error.log 2>/dev/null || true

# 严格通过 PM2 配置启动（单实例）
pm2 start server/dist/index.js --name faxhistoria-server --cwd /home/ubuntu/apps/faxhistoria --time --update-env

pm2 save
pm2 status faxhistoria-server
pm2 logs faxhistoria-server --lines 100 --nostream
```

### 11.3 发布后验收

```bash
curl http://127.0.0.1:41010/api/health
curl http://15.235.212.36:41010/api/health
```

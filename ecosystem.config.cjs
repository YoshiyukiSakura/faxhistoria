module.exports = {
  apps: [
    {
      name: 'faxhistoria-server',
      script: 'npx',
      args: 'tsx server/src/index.ts',
      cwd: __dirname,
      env: {
        NODE_ENV: 'development',
        PORT: 40010,
        DATABASE_URL: 'postgresql://faxhistoria:faxhistoria123@localhost:5433/faxhistoria',
        JWT_SECRET: 'faxhistoria-jwt-secret-change-in-production',
        DAILY_API_LIMIT: 50,
        GAME_TOKEN_LIMIT: 500000,
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
    },
    {
      name: 'faxhistoria-client',
      script: 'npx',
      args: 'vite --host --port 40011',
      cwd: __dirname + '/client',
      env: {
        NODE_ENV: 'development',
      },
      watch: false,
      autorestart: true,
      max_restarts: 10,
    },
  ],
};

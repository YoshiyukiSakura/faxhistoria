module.exports = {
  apps: [
    {
      name: 'faxhistoria-server',
      cwd: __dirname,
      script: 'server/dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
      },
      time: true,
    },
  ],
};

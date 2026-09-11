module.exports = {
  apps: [
    {
      name: 'backend-prisma',
      script: 'server.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};

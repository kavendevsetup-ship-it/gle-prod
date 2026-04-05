module.exports = {
  apps: [
    {
      name: "frontend-next",
      cwd: "/var/www/frontend",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};

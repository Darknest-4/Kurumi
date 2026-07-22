// PM2 process definition for Kurumi.
// Uses cluster-unaware fork mode; discord.js handles its own sharding
// internally via ShardingManager when SHARD_COUNT is set for large scale.
module.exports = {
  apps: [
    {
      name: 'kurumi',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '1G',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
      out_file: 'logs/pm2-out.log',
      error_file: 'logs/pm2-error.log',
      merge_logs: true,
      time: true,
    },
  ],
};

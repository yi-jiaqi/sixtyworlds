module.exports = {
  apps: [{
    name: 'sw',
    script: 'app.js',
    env_pro: {
      NODE_ENV: 'pro',
      PORT: 3001
    },
	//for production
    env_dev: {
      NODE_ENV: 'dev',
      PORT: 3001
    }
	//for development
  }]
};
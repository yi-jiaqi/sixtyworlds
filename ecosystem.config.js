module.exports = {
  apps: [{
    name: 'sw',
    script: 'app.js',
    env_production: {
      NODE_ENV: 'pro',
      PORT: 3001
    },
	//for production
    env_development: {
      NODE_ENV: 'dev',
      PORT: 3001
    }
	//for development
  }]
};
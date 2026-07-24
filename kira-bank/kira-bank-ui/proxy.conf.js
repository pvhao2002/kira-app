const PROXY_CONFIG = {
  '/api': {
    target: 'http://localhost:8080',
    secure: false,
    changeOrigin: true,
    logLevel: 'debug'
  },
  '/v3/api-docs': {
    target: 'http://localhost:8080',
    secure: false,
    changeOrigin: true
  }
};

module.exports = PROXY_CONFIG;

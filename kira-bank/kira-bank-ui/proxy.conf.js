const PROXY_CONFIG = {
  '/api': {
    target: 'http://localhost:8080',
    secure: false,
    changeOrigin: true,
    xfwd: true,
    ws: true
  },
  '/v3/api-docs': {
    target: 'http://localhost:8080',
    secure: false,
    changeOrigin: true
  }
};

module.exports = PROXY_CONFIG;

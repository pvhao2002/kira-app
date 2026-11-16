// Same-origin /api in dev so the HttpOnly SameSite=Strict refresh cookie is sent.
const PROXY_CONFIG = {
  '/api': {
    target: 'http://localhost:8082',
    secure: false,
    changeOrigin: true,
    xfwd: true
  }
};

module.exports = PROXY_CONFIG;

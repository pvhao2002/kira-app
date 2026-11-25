// Same origin in dev so the HttpOnly SameSite=Strict session cookie is sent, and SSE/media go to the service.
const target = 'http://localhost:8086';
module.exports = {
  '/api': {target, secure: false, changeOrigin: true, xfwd: true},
  '/m/': {target, secure: false, changeOrigin: true}
};

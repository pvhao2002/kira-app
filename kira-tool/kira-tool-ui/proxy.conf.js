// Same-origin in dev too: the browser only talks to this dev server, which forwards /tool-service to the API.
module.exports = {
  '/tool-service': {
    target: 'http://localhost:1407',
    secure: false,
    changeOrigin: false
  }
};

const PROXY_CONFIG = [
  {
    context: [
      '/gateway',
      '/tool-service',
      '/data'
    ],
    target: "http://localhost:8800",
    secure: true,
    changeOrigin: true,
    logLevel: "debug",
    ws: true
  }
];

module.exports = PROXY_CONFIG;

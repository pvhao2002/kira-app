const PROXY_CONFIG = [
  {
    context: [
      '/gateway',
    ],
    target: "http://localhost:80",
    secure: true,
    changeOrigin: true,
    logLevel: "debug",
    ws: true
  }
  ,{
    context: [
      '/tool-service',
    ],
    target: "http://localhost:1406",
    secure: true,
    changeOrigin: true,
    logLevel: "debug",
    ws: true
  },
  {
    context: [
      '/queue',
      '/api'
    ],
    target: "http://localhost:2308",
    secure: true,
    changeOrigin: true,
    logLevel: "debug",
    ws: true
  }
];

module.exports = PROXY_CONFIG;

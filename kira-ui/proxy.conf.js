const PROXY_CONFIG = [
  {
    context: [
      '/gateway',
      '/data'
    ],
    target: "http://localhost",
    secure: true,
    changeOrigin: true,
    logLevel: "debug",
    ws: true
  }
];

module.exports = PROXY_CONFIG;

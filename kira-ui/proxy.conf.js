const PROXY_CONFIG = [
    {
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
        ],
        target: "http://localhost:2308",
        secure: true,
        changeOrigin: true,
        logLevel: "debug",
        ws: true
    }
];

module.exports = PROXY_CONFIG;

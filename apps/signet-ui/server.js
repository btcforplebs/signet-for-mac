const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const fs = require('fs');

const app = express();

// Support both new (UI_*) and legacy (PORT/HOST) env var names
const port = Number.parseInt(process.env.UI_PORT ?? process.env.PORT ?? '4174', 10);
const host = process.env.UI_HOST ?? process.env.HOST ?? '0.0.0.0';
const daemonUrl = process.env.DAEMON_URL ?? 'http://127.0.0.1:3001';

// Shared error handler for proxies
const onProxyError = (err, req, res) => {
    if (res.headersSent) return;
    res.status(502).json({
        ok: false,
        error: `Proxy error: ${err instanceof Error ? err.message : 'unknown error'}`
    });
};

// API paths to proxy
const apiPaths = [
    '/requests',
    '/register',
    '/connection',
    '/connections',
    '/relays',
    '/keys',
    '/apps',
    '/dashboard',
    '/health',
    '/logs',
    '/tokens',
    '/policies',
    '/csrf-token',
    '/nostrconnect',
    '/dead-man-switch'
];

// SSE proxy for /events endpoint (no timeout, streaming)
const sseProxy = createProxyMiddleware({
    target: daemonUrl,
    changeOrigin: true,
    proxyTimeout: 0,
    timeout: 0,
    pathFilter: '/events',
    on: {
        proxyReq(proxyReq) {
            proxyReq.setHeader('Accept', 'text/event-stream');
            proxyReq.setHeader('Cache-Control', 'no-cache');
            proxyReq.setHeader('Connection', 'keep-alive');
        },
        proxyRes(proxyRes) {
            proxyRes.headers['x-accel-buffering'] = 'no';
            proxyRes.headers['cache-control'] = 'no-cache, no-transform';
        },
        error: onProxyError
    }
});

// API proxy for standard endpoints
const apiProxy = createProxyMiddleware({
    target: daemonUrl,
    changeOrigin: true,
    proxyTimeout: 10_000,
    pathFilter: apiPaths,
    on: {
        error: onProxyError
    }
});

// Mount proxies at root - pathFilter handles routing
app.use(sseProxy);
app.use(apiProxy);

// Serve static files
let distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
    // Try one level up (for production bundle where this script is in dist-server/)
    distDir = path.join(__dirname, '../dist');
}
console.log(`[UI] Serving static files from: ${distDir}`);

app.use(express.static(distDir));

// SPA fallback - serve index.html for all other routes
app.get('*', (_req, res) => {
    const indexPath = path.join(distDir, 'index.html');
    if (!fs.existsSync(indexPath)) {
        console.error(`[UI] Error: index.html not found at ${indexPath}`);
        return res.status(404).send('UI Assets missing');
    }
    res.sendFile(indexPath);
});

app.listen(port, host, () => {
    console.log(`Signet UI listening on http://${host}:${port} (proxying ${daemonUrl})`);
});

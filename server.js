const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8081;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
    console.log(`${req.method} ${req.url}`);
    
    // Normalize URL path
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    
    // Safe directory traversal check
    if (!filePath.startsWith(__dirname)) {
        res.statusCode = 403;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Forbidden');
        return;
    }

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/plain');
            res.end('Not Found');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.statusCode = 200;
        res.setHeader('Content-Type', contentType);
        
        // Serve file using streams
        const stream = fs.createReadStream(filePath);
        stream.on('error', (streamErr) => {
            console.error(streamErr);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'text/plain');
            res.end('Internal Server Error');
        });
        stream.pipe(res);
    });
});

server.listen(PORT, () => {
    console.log('\x1b[36m%s\x1b[0m', '--------------------------------------------------');
    console.log('\x1b[32m%s\x1b[0m', `  Speedyex Filtre local dev server started!`);
    console.log('\x1b[35m%s\x1b[0m', `  Access it here: http://localhost:${PORT}`);
    console.log('\x1b[36m%s\x1b[0m', '--------------------------------------------------');
});

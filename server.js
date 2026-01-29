require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DIST_DIR = path.join(__dirname, 'dist', 'radio-calico', 'browser');
const isProduction = fs.existsSync(path.join(DIST_DIR, 'index.html'));
const PORT = process.env.PORT || (isProduction ? 3000 : 3001);

const pool = new Pool({
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT || 5432,
    database: process.env.PGDATABASE || 'radio_calico',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD,
});

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks).toString()));
        req.on('error', reject);
    });
}

function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
    console.log(`${req.method} ${req.url}`);

    const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);

    // API: GET /api/ratings?title=X&artist=Y
    if (req.method === 'GET' && parsedUrl.pathname === '/api/ratings') {
        const title = parsedUrl.searchParams.get('title');
        const artist = parsedUrl.searchParams.get('artist');
        if (!title || !artist) {
            return sendJson(res, 400, { error: 'title and artist are required' });
        }
        try {
            const result = await pool.query(
                'SELECT thumbs_up, thumbs_down FROM song_ratings WHERE song_title = $1 AND song_artist = $2',
                [title, artist]
            );
            const row = result.rows[0] || { thumbs_up: 0, thumbs_down: 0 };
            return sendJson(res, 200, { thumbs_up: row.thumbs_up, thumbs_down: row.thumbs_down });
        } catch (err) {
            console.error('DB error (GET /api/ratings):', err);
            return sendJson(res, 500, { error: 'Database error' });
        }
    }

    // API: POST /api/ratings
    if (req.method === 'POST' && parsedUrl.pathname === '/api/ratings') {
        try {
            const body = JSON.parse(await readBody(req));
            const { title, artist, rating } = body;
            if (!title || !artist || (rating !== 'up' && rating !== 'down')) {
                return sendJson(res, 400, { error: 'title, artist, and rating ("up" or "down") are required' });
            }
            const column = rating === 'up' ? 'thumbs_up' : 'thumbs_down';
            const result = await pool.query(
                `INSERT INTO song_ratings (song_title, song_artist, ${column})
                 VALUES ($1, $2, 1)
                 ON CONFLICT (song_title, song_artist)
                 DO UPDATE SET ${column} = song_ratings.${column} + 1
                 RETURNING thumbs_up, thumbs_down`,
                [title, artist]
            );
            return sendJson(res, 200, { thumbs_up: result.rows[0].thumbs_up, thumbs_down: result.rows[0].thumbs_down });
        } catch (err) {
            console.error('DB error (POST /api/ratings):', err);
            return sendJson(res, 500, { error: 'Database error' });
        }
    }

    // Static files / SPA fallback
    let filePath = path.join(DIST_DIR, parsedUrl.pathname === '/' ? 'index.html' : parsedUrl.pathname);

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // SPA routing: fallback to index.html for all routes
                fs.readFile(path.join(DIST_DIR, 'index.html'), (err, indexContent) => {
                    if (err) {
                        res.writeHead(500);
                        res.end('Error loading application', 'utf-8');
                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(indexContent, 'utf-8');
                    }
                });
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${error.code}`, 'utf-8');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`\n🎵 Radio Calico Server Running!`);
    console.log(`   Mode:    ${isProduction ? 'Production' : 'API Only (dev)'}`);
    console.log(`   Local:   http://localhost:${PORT}`);
    console.log(`\n   Press Ctrl+C to stop\n`);
});

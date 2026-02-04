require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Prevent crashes from unhandled errors
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
});

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

// Log pool errors
pool.on('error', (err) => {
    console.error('Pool error:', err);
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

function getClientIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
           req.socket.remoteAddress ||
           'unknown';
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
            const clientIp = getClientIp(req);
            console.log('Client IP:', clientIp, '| Title:', title, '| Artist:', artist);
            const [ratingsResult, voteResult] = await Promise.all([
                pool.query(
                    'SELECT thumbs_up, thumbs_down FROM song_ratings WHERE song_title = $1 AND song_artist = $2',
                    [title, artist]
                ),
                pool.query(
                    'SELECT vote FROM song_votes WHERE song_title = $1 AND song_artist = $2 AND ip_address = $3',
                    [title, artist, clientIp]
                )
            ]);
            const ratings = ratingsResult.rows[0] || { thumbs_up: 0, thumbs_down: 0 };
            const userVote = voteResult.rows[0]?.vote || null;
            return sendJson(res, 200, {
                thumbs_up: ratings.thumbs_up,
                thumbs_down: ratings.thumbs_down,
                user_vote: userVote
            });
        } catch (err) {
            console.error('DB error (GET /api/ratings):', err.message);
            console.error('Full error:', err);
            return sendJson(res, 500, { error: 'Database error', details: err.message });
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

            const clientIp = getClientIp(req);

            // Check if this IP has already voted for this song
            const existingVote = await pool.query(
                'SELECT vote FROM song_votes WHERE song_title = $1 AND song_artist = $2 AND ip_address = $3',
                [title, artist, clientIp]
            );

            if (existingVote.rows.length > 0) {
                const oldVote = existingVote.rows[0].vote;

                // If same vote, return current state
                if (oldVote === rating) {
                    const current = await pool.query(
                        'SELECT thumbs_up, thumbs_down FROM song_ratings WHERE song_title = $1 AND song_artist = $2',
                        [title, artist]
                    );
                    const ratings = current.rows[0] || { thumbs_up: 0, thumbs_down: 0 };
                    return sendJson(res, 200, {
                        thumbs_up: ratings.thumbs_up,
                        thumbs_down: ratings.thumbs_down,
                        user_vote: rating
                    });
                }

                // Change vote: update the vote record
                await pool.query(
                    'UPDATE song_votes SET vote = $1 WHERE song_title = $2 AND song_artist = $3 AND ip_address = $4',
                    [rating, title, artist, clientIp]
                );

                // Update aggregate counts: decrement old, increment new
                const oldColumn = oldVote === 'up' ? 'thumbs_up' : 'thumbs_down';
                const newColumn = rating === 'up' ? 'thumbs_up' : 'thumbs_down';
                const result = await pool.query(
                    `UPDATE song_ratings
                     SET ${oldColumn} = GREATEST(0, ${oldColumn} - 1), ${newColumn} = ${newColumn} + 1
                     WHERE song_title = $1 AND song_artist = $2
                     RETURNING thumbs_up, thumbs_down`,
                    [title, artist]
                );
                return sendJson(res, 200, {
                    thumbs_up: result.rows[0].thumbs_up,
                    thumbs_down: result.rows[0].thumbs_down,
                    user_vote: rating
                });
            }

            // New vote: record the vote
            await pool.query(
                'INSERT INTO song_votes (song_title, song_artist, ip_address, vote) VALUES ($1, $2, $3, $4)',
                [title, artist, clientIp, rating]
            );

            // Update aggregate counts
            const column = rating === 'up' ? 'thumbs_up' : 'thumbs_down';
            const result = await pool.query(
                `INSERT INTO song_ratings (song_title, song_artist, ${column})
                 VALUES ($1, $2, 1)
                 ON CONFLICT (song_title, song_artist)
                 DO UPDATE SET ${column} = song_ratings.${column} + 1
                 RETURNING thumbs_up, thumbs_down`,
                [title, artist]
            );
            return sendJson(res, 200, {
                thumbs_up: result.rows[0].thumbs_up,
                thumbs_down: result.rows[0].thumbs_down,
                user_vote: rating
            });
        } catch (err) {
            console.error('DB error (POST /api/ratings):', err);
            return sendJson(res, 500, { error: 'Database error' });
        }
    }

    // API: POST /api/errors
    if (req.method === 'POST' && parsedUrl.pathname === '/api/errors') {
        try {
            const body = JSON.parse(await readBody(req));
            const { session_id, source, severity, message, details, metadata } = body;

            if (!session_id || !source || !severity || !message) {
                return sendJson(res, 400, { error: 'session_id, source, severity, and message are required' });
            }

            const validSources = ['hls', 'network', 'media', 'app', 'unknown'];
            const validSeverities = ['info', 'warning', 'error', 'fatal'];

            if (!validSources.includes(source)) {
                return sendJson(res, 400, { error: `source must be one of: ${validSources.join(', ')}` });
            }
            if (!validSeverities.includes(severity)) {
                return sendJson(res, 400, { error: `severity must be one of: ${validSeverities.join(', ')}` });
            }

            const userAgent = req.headers['user-agent'] || null;

            const result = await pool.query(
                `INSERT INTO error_logs (session_id, source, severity, message, details, metadata, user_agent)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING id, created_at`,
                [session_id, source, severity, message, details || null, metadata ? JSON.stringify(metadata) : null, userAgent]
            );

            return sendJson(res, 201, {
                id: result.rows[0].id,
                created_at: result.rows[0].created_at
            });
        } catch (err) {
            console.error('DB error (POST /api/errors):', err);
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

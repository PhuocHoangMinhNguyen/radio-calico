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
const apiOnly = process.env.API_ONLY === 'true';
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

// Request size limits (in bytes)
const MAX_REQUEST_SIZE = 1024 * 1024; // 1 MB for general requests
const MAX_ERROR_LOG_SIZE = 10 * 1024; // 10 KB for error logs
const MAX_RATING_SIZE = 1024; // 1 KB for ratings

function readBody(req, maxSize = MAX_REQUEST_SIZE) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let totalSize = 0;

        req.on('data', (chunk) => {
            totalSize += chunk.length;

            // Check if request size exceeds limit
            if (totalSize > maxSize) {
                req.destroy();
                reject(new Error('Request body too large'));
                return;
            }

            chunks.push(chunk);
        });

        req.on('end', () => {
            try {
                resolve(Buffer.concat(chunks).toString());
            } catch (err) {
                reject(err);
            }
        });

        req.on('error', reject);
    });
}

function validateContentType(req, expectedType = 'application/json') {
    const contentType = req.headers['content-type'];
    if (!contentType || !contentType.includes(expectedType)) {
        return false;
    }
    return true;
}

function validateJsonSchema(data, requiredFields) {
    for (const field of requiredFields) {
        if (data[field] === undefined || data[field] === null) {
            return { valid: false, missing: field };
        }
    }
    return { valid: true };
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

// Security event logging
const SecurityEventType = {
    RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
    INVALID_CONTENT_TYPE: 'invalid_content_type',
    REQUEST_TOO_LARGE: 'request_too_large',
    VALIDATION_FAILED: 'validation_failed',
    SQL_INJECTION_ATTEMPT: 'sql_injection_attempt',
    XSS_ATTEMPT: 'xss_attempt',
    SUSPICIOUS_PATTERN: 'suspicious_pattern',
};

function logSecurityEvent(eventType, req, details = {}) {
    const timestamp = new Date().toISOString();
    const clientIp = getClientIp(req);
    const userAgent = req.headers['user-agent'] || 'unknown';
    const path = req.url;
    const method = req.method;

    const logEntry = {
        timestamp,
        event_type: eventType,
        client_ip: clientIp,
        method,
        path,
        user_agent: userAgent,
        ...details
    };

    // Log to console (in production, this could go to a logging service)
    console.warn('🔒 SECURITY EVENT:', JSON.stringify(logEntry));

    // Optionally, log to database for analysis
    // This could be async to not block the request
    if (pool && eventType !== SecurityEventType.RATE_LIMIT_EXCEEDED) {
        // Avoid logging every rate limit event to reduce noise
        pool.query(
            `INSERT INTO error_logs (session_id, source, severity, message, metadata, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                `security-${clientIp}`,
                'app',
                'warning',
                `Security event: ${eventType}`,
                JSON.stringify(logEntry),
                userAgent
            ]
        ).catch(err => console.error('Failed to log security event to DB:', err));
    }
}

// Detect potentially malicious patterns in input
function detectSuspiciousPatterns(input) {
    if (typeof input !== 'string') return null;

    const patterns = [
        { regex: /(\bOR\b|\bAND\b).*=.*('|")/i, type: 'sql_injection' },
        { regex: /UNION\s+SELECT/i, type: 'sql_injection' },
        { regex: /DROP\s+TABLE/i, type: 'sql_injection' },
        { regex: /<script[^>]*>.*<\/script>/i, type: 'xss' },
        { regex: /javascript:/i, type: 'xss' },
        { regex: /on(load|error|click)=/i, type: 'xss' },
        { regex: /\.\.\//g, type: 'path_traversal' },
        { regex: /%00/g, type: 'null_byte_injection' },
    ];

    for (const { regex, type } of patterns) {
        if (regex.test(input)) {
            return type;
        }
    }

    return null;
}

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // Max requests per IP per window
const rateLimitStore = new Map(); // Map<IP, { count: number, resetTime: number }>

// Clean up old rate limit entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of rateLimitStore.entries()) {
        if (now >= data.resetTime) {
            rateLimitStore.delete(ip);
        }
    }
}, RATE_LIMIT_WINDOW_MS);

function checkRateLimit(req, res) {
    const clientIp = getClientIp(req);
    const now = Date.now();

    let rateLimitData = rateLimitStore.get(clientIp);

    // Initialize or reset if window expired
    if (!rateLimitData || now >= rateLimitData.resetTime) {
        rateLimitData = {
            count: 0,
            resetTime: now + RATE_LIMIT_WINDOW_MS
        };
        rateLimitStore.set(clientIp, rateLimitData);
    }

    rateLimitData.count++;

    // Set rate limit headers
    const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - rateLimitData.count);
    const resetTime = Math.ceil(rateLimitData.resetTime / 1000);

    res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetTime);

    // Check if limit exceeded
    if (rateLimitData.count > RATE_LIMIT_MAX_REQUESTS) {
        const retryAfter = Math.ceil((rateLimitData.resetTime - now) / 1000);

        // Log security event
        logSecurityEvent(SecurityEventType.RATE_LIMIT_EXCEEDED, req, {
            request_count: rateLimitData.count,
            limit: RATE_LIMIT_MAX_REQUESTS,
            retry_after: retryAfter
        });

        res.setHeader('Retry-After', retryAfter);
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            error: 'Too many requests',
            message: `Rate limit exceeded. Maximum ${RATE_LIMIT_MAX_REQUESTS} requests per minute allowed.`,
            retry_after: retryAfter
        }));
        return false;
    }

    return true;
}

const server = http.createServer(async (req, res) => {
    console.log(`${req.method} ${req.url}`);

    const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);

    // CORS headers for dev mode (allows cross-origin API testing)
    if (!isProduction) {
        res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        // Handle preflight requests
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }
    }

    // Apply rate limiting to all API endpoints
    if (parsedUrl.pathname.startsWith('/api/')) {
        if (!checkRateLimit(req, res)) {
            return; // Rate limit exceeded, response already sent
        }
    }

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
        // Validate content type
        if (!validateContentType(req, 'application/json')) {
            logSecurityEvent(SecurityEventType.INVALID_CONTENT_TYPE, req, {
                content_type: req.headers['content-type'],
                expected: 'application/json'
            });
            return sendJson(res, 400, { error: 'Content-Type must be application/json' });
        }

        let client;
        let body;
        try {
            // Read body with size limit for ratings
            const rawBody = await readBody(req, MAX_RATING_SIZE);
            body = JSON.parse(rawBody);
        } catch (err) {
            if (err.message === 'Request body too large') {
                logSecurityEvent(SecurityEventType.REQUEST_TOO_LARGE, req, {
                    max_size: MAX_RATING_SIZE
                });
                return sendJson(res, 413, { error: 'Request body too large', max_size: MAX_RATING_SIZE });
            }
            if (err instanceof SyntaxError) {
                logSecurityEvent(SecurityEventType.VALIDATION_FAILED, req, {
                    reason: 'invalid_json'
                });
                return sendJson(res, 400, { error: 'Invalid JSON body' });
            }
            throw err;
        }
        try {
            const { title, artist, rating } = body;

            // Validate required fields using schema validator
            const validation = validateJsonSchema(body, ['title', 'artist', 'rating']);
            if (!validation.valid) {
                logSecurityEvent(SecurityEventType.VALIDATION_FAILED, req, {
                    reason: 'missing_field',
                    missing_field: validation.missing
                });
                return sendJson(res, 400, { error: `Missing required field: ${validation.missing}` });
            }

            // Validate field values
            if (rating !== 'up' && rating !== 'down') {
                logSecurityEvent(SecurityEventType.VALIDATION_FAILED, req, {
                    reason: 'invalid_rating_value',
                    value: rating
                });
                return sendJson(res, 400, { error: 'rating must be "up" or "down"' });
            }

            // Validate field types and lengths
            if (typeof title !== 'string' || typeof artist !== 'string') {
                logSecurityEvent(SecurityEventType.VALIDATION_FAILED, req, {
                    reason: 'invalid_field_types',
                    title_type: typeof title,
                    artist_type: typeof artist
                });
                return sendJson(res, 400, { error: 'title and artist must be strings' });
            }
            if (title.length > 200 || artist.length > 200) {
                logSecurityEvent(SecurityEventType.VALIDATION_FAILED, req, {
                    reason: 'field_too_long',
                    title_length: title.length,
                    artist_length: artist.length
                });
                return sendJson(res, 400, { error: 'title and artist must be 200 characters or less' });
            }

            // Check for suspicious patterns (SQL injection, XSS attempts)
            const titlePattern = detectSuspiciousPatterns(title);
            const artistPattern = detectSuspiciousPatterns(artist);
            if (titlePattern || artistPattern) {
                logSecurityEvent(
                    titlePattern === 'sql_injection' || artistPattern === 'sql_injection'
                        ? SecurityEventType.SQL_INJECTION_ATTEMPT
                        : SecurityEventType.XSS_ATTEMPT,
                    req,
                    {
                        title_pattern: titlePattern,
                        artist_pattern: artistPattern,
                        title: title.substring(0, 100),
                        artist: artist.substring(0, 100)
                    }
                );
                // Continue processing but log the event - parameterized queries protect us
            }

            const clientIp = getClientIp(req);
            client = await pool.connect();
            await client.query('BEGIN');

            const existingVote = await client.query(
                'SELECT vote FROM song_votes WHERE song_title = $1 AND song_artist = $2 AND ip_address = $3',
                [title, artist, clientIp]
            );

            let thumbs_up, thumbs_down;

            if (existingVote.rows.length > 0) {
                const oldVote = existingVote.rows[0].vote;

                if (oldVote !== 'up' && oldVote !== 'down') {
                    console.error('Corrupted vote value in song_votes:', oldVote);
                    await client.query('ROLLBACK');
                    return sendJson(res, 500, { error: 'Internal data integrity error' });
                }

                if (oldVote === rating) {
                    // Same vote — read current state, no mutation needed
                    const current = await client.query(
                        'SELECT thumbs_up, thumbs_down FROM song_ratings WHERE song_title = $1 AND song_artist = $2',
                        [title, artist]
                    );
                    const ratings = current.rows[0] || { thumbs_up: 0, thumbs_down: 0 };
                    thumbs_up = ratings.thumbs_up;
                    thumbs_down = ratings.thumbs_down;
                } else {
                    // Change vote: update the vote record and adjust aggregates
                    await client.query(
                        'UPDATE song_votes SET vote = $1 WHERE song_title = $2 AND song_artist = $3 AND ip_address = $4',
                        [rating, title, artist, clientIp]
                    );

                    const oldColumn = oldVote === 'up' ? 'thumbs_up' : 'thumbs_down';
                    const newColumn = rating === 'up' ? 'thumbs_up' : 'thumbs_down';
                    const result = await client.query(
                        `UPDATE song_ratings
                         SET ${oldColumn} = GREATEST(0, ${oldColumn} - 1), ${newColumn} = ${newColumn} + 1
                         WHERE song_title = $1 AND song_artist = $2
                         RETURNING thumbs_up, thumbs_down`,
                        [title, artist]
                    );
                    thumbs_up = result.rows[0].thumbs_up;
                    thumbs_down = result.rows[0].thumbs_down;
                }
            } else {
                // New vote: record and update aggregate
                await client.query(
                    'INSERT INTO song_votes (song_title, song_artist, ip_address, vote) VALUES ($1, $2, $3, $4) ON CONFLICT (song_title, song_artist, ip_address) DO NOTHING',
                    [title, artist, clientIp, rating]
                );

                const column = rating === 'up' ? 'thumbs_up' : 'thumbs_down';
                const result = await client.query(
                    `INSERT INTO song_ratings (song_title, song_artist, ${column})
                     VALUES ($1, $2, 1)
                     ON CONFLICT (song_title, song_artist)
                     DO UPDATE SET ${column} = song_ratings.${column} + 1
                     RETURNING thumbs_up, thumbs_down`,
                    [title, artist]
                );
                thumbs_up = result.rows[0].thumbs_up;
                thumbs_down = result.rows[0].thumbs_down;
            }

            await client.query('COMMIT');
            return sendJson(res, 200, { thumbs_up, thumbs_down, user_vote: rating });
        } catch (err) {
            if (client) {
                try { await client.query('ROLLBACK'); } catch (e) { /* ignore rollback errors */ }
            }
            console.error('DB error (POST /api/ratings):', err);
            return sendJson(res, 500, { error: 'Database error' });
        } finally {
            if (client) client.release();
        }
    }

    // API: POST /api/errors
    if (req.method === 'POST' && parsedUrl.pathname === '/api/errors') {
        // Validate content type
        if (!validateContentType(req, 'application/json')) {
            logSecurityEvent(SecurityEventType.INVALID_CONTENT_TYPE, req, {
                content_type: req.headers['content-type'],
                expected: 'application/json'
            });
            return sendJson(res, 400, { error: 'Content-Type must be application/json' });
        }

        let body;
        try {
            // Read body with size limit for error logs
            const rawBody = await readBody(req, MAX_ERROR_LOG_SIZE);
            body = JSON.parse(rawBody);
        } catch (err) {
            if (err.message === 'Request body too large') {
                logSecurityEvent(SecurityEventType.REQUEST_TOO_LARGE, req, {
                    max_size: MAX_ERROR_LOG_SIZE
                });
                return sendJson(res, 413, { error: 'Request body too large', max_size: MAX_ERROR_LOG_SIZE });
            }
            if (err instanceof SyntaxError) {
                logSecurityEvent(SecurityEventType.VALIDATION_FAILED, req, {
                    reason: 'invalid_json'
                });
                return sendJson(res, 400, { error: 'Invalid JSON body' });
            }
            throw err;
        }
        try {
            const { session_id, source, severity, message, details, metadata } = body;

            // Validate required fields using schema validator
            const validation = validateJsonSchema(body, ['session_id', 'source', 'severity', 'message']);
            if (!validation.valid) {
                return sendJson(res, 400, { error: `Missing required field: ${validation.missing}` });
            }

            // Validate field types
            if (typeof session_id !== 'string' || typeof source !== 'string' ||
                typeof severity !== 'string' || typeof message !== 'string') {
                return sendJson(res, 400, { error: 'session_id, source, severity, and message must be strings' });
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

    // API-only mode: return 404 for non-API routes (nginx handles static files)
    if (apiOnly) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found - API only mode' }));
        return;
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

if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`\n🎵 Radio Calico Server Running!`);
        console.log(`   Mode:    ${apiOnly ? 'API Only (nginx backend)' : isProduction ? 'Production' : 'API Only (dev)'}`);
        console.log(`   Local:   http://localhost:${PORT}`);
        console.log(`\n   Press Ctrl+C to stop\n`);
    });
}

module.exports = { server, pool };

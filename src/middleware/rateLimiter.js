/**
 * Configurable in-memory rate limiter middleware for Polka/HTTP servers.
 *
 * Usage:
 *   import { createRateLimiter } from './middleware/rateLimiter.js';
 *   const limiter = createRateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 30 });
 *   server.use('/v1/auth', limiter);
 *
 * Or use the helper to check rate limits imperatively:
 *   import { isAllowedRate, rateLimitStore } from './middleware/rateLimiter.js';
 */

/** @type {Map<string, { count: number; expiresAt: number }>} */
export const rateLimitStore = new Map();

// Clean up expired entries every 60 seconds
const CLEANUP_INTERVAL_MS = 60_000;
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore) {
        if (now > entry.expiresAt) {
            rateLimitStore.delete(key);
        }
    }
}, CLEANUP_INTERVAL_MS).unref();

/**
 * Extract client IP from request, respecting X-Forwarded-For.
 * @param {import('http').IncomingMessage} req
 * @returns {string}
 */
const getClientIp = (req) => {
    const forwarded = req.headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
        return forwarded.split(',')[0].trim();
    }
    return req.socket?.remoteAddress || 'unknown';
};

/**
 * Check if a request is within the rate limit for a given bucket+key.
 *
 * @param {string} bucket - Namespace for the rate limit (e.g. 'login-ip')
 * @param {string} key    - Unique key within the bucket (e.g. client IP)
 * @param {number} max    - Maximum number of requests allowed in the window
 * @param {number} windowMs - Time window in milliseconds
 * @returns {{ allowed: boolean; retryAfterMs: number }}
 */
export const isAllowedRate = (bucket, key, max, windowMs) => {
    const now = Date.now();
    const storeKey = `${bucket}:${key}`;
    const current = rateLimitStore.get(storeKey);

    if (!current || now > current.expiresAt) {
        rateLimitStore.set(storeKey, { count: 1, expiresAt: now + windowMs });
        return { allowed: true, retryAfterMs: 0 };
    }

    if (current.count >= max) {
        return { allowed: false, retryAfterMs: Math.max(0, current.expiresAt - now) };
    }

    current.count += 1;
    rateLimitStore.set(storeKey, current);
    return { allowed: true, retryAfterMs: 0 };
};

/**
 * Create a Polka-compatible rate limiter middleware.
 *
 * @param {object} options
 * @param {number} [options.windowMs=900000]   - Time window in ms (default 15 min)
 * @param {number} [options.maxRequests=30]     - Max requests per window per IP
 * @param {string} [options.bucket='global']    - Namespace for this limiter
 * @param {string} [options.message='Demasiados intentos. Intenta mas tarde.'] - Error message
 * @returns {function} Polka middleware (req, res, next)
 */
export function createRateLimiter({
    windowMs = 15 * 60 * 1000,
    maxRequests = 30,
    bucket = 'global',
    message = 'Demasiados intentos. Intenta mas tarde.',
} = {}) {
    return (req, res, next) => {
        const ip = getClientIp(req);
        const { allowed, retryAfterMs } = isAllowedRate(bucket, ip, maxRequests, windowMs);

        if (!allowed) {
            const retryAfterSec = Math.ceil(retryAfterMs / 1000);
            res.setHeader('Retry-After', String(retryAfterSec));
            res.writeHead(429, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: message }));
            return;
        }

        next();
    };
}

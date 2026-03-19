/**
 * Input sanitization middleware for Polka/HTTP servers.
 *
 * Strips HTML tags and trims whitespace from all string values in req.body.
 * Works recursively on nested objects and arrays.
 *
 * Usage:
 *   import { sanitizerMiddleware } from './middleware/sanitizer.js';
 *   server.use(sanitizerMiddleware);
 */

/**
 * Sanitize a single string value: strip HTML tags and trim whitespace.
 * @param {string} value
 * @returns {string}
 */
const sanitizeString = (value) =>
    String(value).replace(/<[^>]*>/g, '').trim();

/**
 * Recursively sanitize all string values in an object or array.
 * @param {*} input
 * @returns {*}
 */
const sanitizeValue = (input) => {
    if (typeof input === 'string') {
        return sanitizeString(input);
    }

    if (Array.isArray(input)) {
        return input.map(sanitizeValue);
    }

    if (input !== null && typeof input === 'object' && !(input instanceof Date)) {
        const sanitized = {};
        for (const [key, val] of Object.entries(input)) {
            sanitized[key] = sanitizeValue(val);
        }
        return sanitized;
    }

    return input;
};

/**
 * Polka-compatible middleware that sanitizes req.body.
 * Must be mounted BEFORE route handlers.
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {function} next
 */
export function sanitizerMiddleware(req, res, next) {
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeValue(req.body);
    }
    next();
}

export { sanitizeString, sanitizeValue };

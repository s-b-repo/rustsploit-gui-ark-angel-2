import { Router, Response } from 'express';
import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import axios from 'axios';
import { getDb, getUserById } from '../database';
import { validatePasswordComplexity, hashPassword, verifyPassword, getComplexityRules } from '../password';
import { getRsfApiKey, setRsfApiKey } from './proxy';
import { authenticateJWT, AuthenticatedRequest } from '../middleware';

const router = Router();

// All settings routes require authentication
router.use(authenticateJWT);

/**
 * PUT /api/settings/password
 * Change own password (complexity enforced)
 */
router.put('/password', (req: AuthenticatedRequest, res: Response): void => {
    if (!req.user) {
        res.status(401).json({ success: false, message: 'Not authenticated' });
        return;
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        res.status(400).json({ success: false, message: 'Current password and new password are required' });
        return;
    }

    // Verify current password
    if (!verifyPassword(currentPassword, req.user.password_hash)) {
        res.status(401).json({ success: false, message: 'Current password is incorrect' });
        return;
    }

    // Validate new password complexity
    const validation = validatePasswordComplexity(newPassword);
    if (!validation.valid) {
        res.status(400).json({
            success: false,
            message: 'New password does not meet complexity requirements',
            errors: validation.errors,
            rules: getComplexityRules(),
        });
        return;
    }

    // Prevent reuse of current password
    if (verifyPassword(newPassword, req.user.password_hash)) {
        res.status(400).json({ success: false, message: 'New password must be different from current password' });
        return;
    }

    const hash = hashPassword(newPassword);
    getDb().prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(hash, req.user.id);

    res.json({ success: true, message: 'Password changed successfully' });
});

/**
 * GET /api/settings/password/rules
 * Get password complexity rules
 */
router.get('/password/rules', (_req: AuthenticatedRequest, res: Response): void => {
    res.json({ success: true, rules: getComplexityRules() });
});

/**
 * POST /api/settings/totp/setup
 * Generate TOTP secret and QR code
 */
router.post('/totp/setup', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
        res.status(401).json({ success: false, message: 'Not authenticated' });
        return;
    }

    if (req.user.totp_enabled) {
        res.status(400).json({ success: false, message: 'TOTP is already enabled. Disable it first.' });
        return;
    }

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(req.user.username, 'RustSploit-GUI', secret);

    // Store secret (not yet enabled until verified)
    getDb().prepare("UPDATE users SET totp_secret = ?, updated_at = datetime('now') WHERE id = ?").run(secret, req.user.id);

    try {
        const qrDataUrl = await qrcode.toDataURL(otpauth);
        res.json({
            success: true,
            secret,
            qrCode: qrDataUrl,
            message: 'Scan the QR code with your authenticator app, then verify with a code',
        });
    } catch {
        res.status(500).json({ success: false, message: 'Failed to generate QR code' });
    }
});

/**
 * POST /api/settings/totp/verify
 * Verify TOTP code and enable TOTP
 */
router.post('/totp/verify', (req: AuthenticatedRequest, res: Response): void => {
    if (!req.user) {
        res.status(401).json({ success: false, message: 'Not authenticated' });
        return;
    }

    const { code } = req.body;
    if (!code) {
        res.status(400).json({ success: false, message: 'TOTP code is required' });
        return;
    }

    // Get the latest user data (secret might have just been set)
    const user = getUserById(req.user.id);
    if (!user || !user.totp_secret) {
        res.status(400).json({ success: false, message: 'TOTP not set up. Call /api/settings/totp/setup first' });
        return;
    }

    const isValid = authenticator.verify({ token: code, secret: user.totp_secret });
    if (!isValid) {
        res.status(401).json({ success: false, message: 'Invalid TOTP code. Please try again.' });
        return;
    }

    getDb().prepare("UPDATE users SET totp_enabled = 1, updated_at = datetime('now') WHERE id = ?").run(user.id);

    res.json({ success: true, message: 'TOTP enabled successfully' });
});

/**
 * DELETE /api/settings/totp
 * Disable TOTP
 */
router.delete('/totp', (req: AuthenticatedRequest, res: Response): void => {
    if (!req.user) {
        res.status(401).json({ success: false, message: 'Not authenticated' });
        return;
    }

    const { password } = req.body;
    if (!password) {
        res.status(400).json({ success: false, message: 'Password is required to disable TOTP' });
        return;
    }

    if (!verifyPassword(password, req.user.password_hash)) {
        res.status(401).json({ success: false, message: 'Invalid password' });
        return;
    }

    getDb().prepare("UPDATE users SET totp_enabled = 0, totp_secret = NULL, updated_at = datetime('now') WHERE id = ?").run(req.user.id);

    res.json({ success: true, message: 'TOTP disabled successfully' });
});

// ─── RSF API Connection Management (sysadmin-only) ────────────────────

const RSF_API_URL = process.env.RSF_API_URL || 'http://127.0.0.1:8080';

/**
 * GET /api/settings/rsf-connection
 * Test connectivity to the RSF API. Returns status, latency, and masked key info.
 * Sysadmin only.
 */
router.get('/rsf-connection', (req: AuthenticatedRequest, res: Response): void => {
    if (!req.user || req.user.role !== 'sysadmin') {
        res.status(403).json({ success: false, message: 'Sysadmin access required' });
        return;
    }

    const start = Date.now();
    const currentKey = getRsfApiKey();

    axios.get(`${RSF_API_URL}/health`, {
        headers: { Authorization: `Bearer ${currentKey}` },
        timeout: 5000,
        validateStatus: () => true,
    })
        .then((resp) => {
            const latency = Date.now() - start;
            const keyPreview = currentKey ? `****${currentKey.slice(-4)}` : 'NOT SET';

            if (resp.status === 200) {
                res.json({
                    success: true,
                    status: 'connected',
                    latency,
                    keyPreview,
                    message: `RSF API reachable (${latency}ms)`,
                });
            } else if (resp.status === 401 || resp.status === 403) {
                res.json({
                    success: true,
                    status: 'auth_failed',
                    latency,
                    keyPreview,
                    httpStatus: resp.status,
                    message: 'RSF API reachable but authentication failed — API key may be invalid or rotated',
                });
            } else {
                res.json({
                    success: true,
                    status: 'degraded',
                    latency,
                    keyPreview,
                    httpStatus: resp.status,
                    message: `RSF API returned status ${resp.status}`,
                });
            }
        })
        .catch((err) => {
            const latency = Date.now() - start;
            const keyPreview = currentKey ? `****${currentKey.slice(-4)}` : 'NOT SET';

            if (err.code === 'ECONNREFUSED') {
                res.json({
                    success: true,
                    status: 'offline',
                    latency,
                    keyPreview,
                    message: 'RSF API is not reachable (connection refused)',
                });
            } else if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') {
                res.json({
                    success: true,
                    status: 'timeout',
                    latency,
                    keyPreview,
                    message: 'RSF API connection timed out',
                });
            } else {
                res.json({
                    success: true,
                    status: 'error',
                    latency,
                    keyPreview,
                    message: `Connection error: ${err.message}`,
                });
            }
        });
});

/**
 * PUT /api/settings/rsf-api-key
 * Update the RSF API key at runtime. Requires sysadmin + password confirmation.
 * After updating, tests the connection with the new key.
 */
router.put('/rsf-api-key', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user || req.user.role !== 'sysadmin') {
        res.status(403).json({ success: false, message: 'Sysadmin access required' });
        return;
    }

    const { apiKey, password } = req.body;

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
        res.status(400).json({ success: false, message: 'API key is required' });
        return;
    }

    if (!password) {
        res.status(400).json({ success: false, message: 'Password confirmation is required' });
        return;
    }

    // Verify sysadmin password
    if (!verifyPassword(password, req.user.password_hash)) {
        res.status(401).json({ success: false, message: 'Invalid password' });
        return;
    }

    // Save old key in case we need to roll back
    const oldKey = getRsfApiKey();
    const newKey = apiKey.trim();

    // Apply the new key
    setRsfApiKey(newKey);

    // Test connectivity with the new key
    try {
        const start = Date.now();
        const resp = await axios.get(`${RSF_API_URL}/health`, {
            headers: { Authorization: `Bearer ${newKey}` },
            timeout: 5000,
            validateStatus: () => true,
        });
        const latency = Date.now() - start;

        if (resp.status === 200) {
            res.json({
                success: true,
                connectionStatus: 'connected',
                latency,
                keyPreview: `****${newKey.slice(-4)}`,
                message: `API key updated and connection verified (${latency}ms)`,
            });
        } else if (resp.status === 401 || resp.status === 403) {
            // New key also fails auth — roll back
            setRsfApiKey(oldKey);
            res.status(400).json({
                success: false,
                connectionStatus: 'auth_failed',
                message: 'New API key was rejected by RSF API (401/403). Key was NOT changed.',
            });
        } else {
            // Key was set, but RSF returned a non-expected status
            res.json({
                success: true,
                connectionStatus: 'degraded',
                latency,
                keyPreview: `****${newKey.slice(-4)}`,
                message: `API key updated but RSF returned status ${resp.status}`,
            });
        }
    } catch (err: any) {
        // Connection failed entirely — still apply the key since it might just be a network issue
        res.json({
            success: true,
            connectionStatus: 'offline',
            keyPreview: `****${newKey.slice(-4)}`,
            message: `API key updated but RSF API is not currently reachable: ${err.message}`,
        });
    }
});

export default router;

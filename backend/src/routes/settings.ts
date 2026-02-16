import { Router, Response } from 'express';
import { authenticator } from 'otplib';
import qrcode from 'qrcode';
import { getDb, getUserById } from '../database';
import { validatePasswordComplexity, hashPassword, verifyPassword, getComplexityRules } from '../password';
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

export default router;

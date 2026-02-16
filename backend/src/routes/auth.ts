import { Router, Response } from 'express';
import { authenticator } from 'otplib';
import jwt from 'jsonwebtoken';
import { getUserByUsername, getUserById, getEffectivePermissions } from '../database';
import { verifyPassword } from '../password';
import { generateToken, AuthenticatedRequest, authenticateJWT } from '../middleware';

const JWT_SECRET = process.env.JWT_SECRET || 'rustsploit-gui-change-me-in-production';

const router = Router();

/**
 * POST /api/auth/login
 * Authenticate with username + password.
 * If TOTP is enabled, returns a partial token requiring TOTP verification.
 */
router.post('/login', (req: AuthenticatedRequest, res: Response): void => {
    const { username, password } = req.body;

    if (!username || !password) {
        res.status(400).json({ success: false, message: 'Username and password are required' });
        return;
    }

    const user = getUserByUsername(username);
    if (!user) {
        // Constant-time-ish: still hash to avoid timing attacks
        verifyPassword(password, '$2a$12$000000000000000000000uGfMOvSMnOa0PCtWVELrqAuCLmgHK');
        res.status(401).json({ success: false, message: 'Invalid credentials' });
        return;
    }

    if (!verifyPassword(password, user.password_hash)) {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
        return;
    }

    // If TOTP is enabled, require second factor
    if (user.totp_enabled && user.totp_secret) {
        // Return a temporary token that can only be used for TOTP verification
        const tempToken = jwt.sign(
            { userId: user.id, purpose: 'totp-verify' },
            JWT_SECRET,
            { expiresIn: '5m' }
        );
        res.json({
            success: true,
            requireTotp: true,
            tempToken,
            message: 'TOTP verification required',
        });
        return;
    }

    const token = generateToken(user);
    res.json({
        success: true,
        token,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            totp_enabled: !!user.totp_enabled,
        },
    });
});

/**
 * POST /api/auth/verify-totp
 * Verify TOTP code and issue full JWT
 */
router.post('/verify-totp', (req: AuthenticatedRequest, res: Response): void => {
    const { tempToken, code } = req.body;

    if (!tempToken || !code) {
        res.status(400).json({ success: false, message: 'Temp token and TOTP code are required' });
        return;
    }

    try {
        const decoded = jwt.verify(tempToken, JWT_SECRET) as {
            userId: number;
            purpose: string;
        };

        if (decoded.purpose !== 'totp-verify') {
            res.status(401).json({ success: false, message: 'Invalid token purpose' });
            return;
        }

        const user = getUserById(decoded.userId);
        if (!user || !user.totp_secret) {
            res.status(401).json({ success: false, message: 'User not found or TOTP not configured' });
            return;
        }

        const isValid = authenticator.verify({ token: code, secret: user.totp_secret });
        if (!isValid) {
            res.status(401).json({ success: false, message: 'Invalid TOTP code' });
            return;
        }

        const token = generateToken(user);
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role,
                totp_enabled: true,
            },
        });
    } catch {
        res.status(401).json({ success: false, message: 'Invalid or expired temp token' });
    }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticateJWT, (req: AuthenticatedRequest, res: Response): void => {
    if (!req.user) {
        res.status(401).json({ success: false, message: 'Not authenticated' });
        return;
    }

    const permissions = getEffectivePermissions(req.user);

    res.json({
        success: true,
        user: {
            id: req.user.id,
            username: req.user.username,
            email: req.user.email,
            role: req.user.role,
            totp_enabled: !!req.user.totp_enabled,
            permissions,
        },
    });
});

/**
 * POST /api/auth/logout
 * Client-side logout (JWT is stateless, just ack)
 */
router.post('/logout', (_req: AuthenticatedRequest, res: Response): void => {
    res.json({ success: true, message: 'Logged out successfully' });
});

export default router;

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getUserById, getEffectivePermissions, UserRow } from './database';

const JWT_SECRET = process.env.JWT_SECRET || 'rustsploit-gui-change-me-in-production';
const JWT_EXPIRY = '8h';

export interface JwtPayload {
    userId: number;
    username: string;
    role: string;
    iat?: number;
    exp?: number;
}

export interface AuthenticatedRequest extends Request {
    user?: UserRow;
    jwtPayload?: JwtPayload;
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(user: UserRow): string {
    const payload: JwtPayload = {
        userId: user.id,
        username: user.username,
        role: user.role,
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

/**
 * Middleware: Verify JWT and attach user to request
 */
export function authenticateJWT(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ success: false, message: 'Authentication required' });
        return;
    }

    const token = authHeader.slice(7);

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
        const user = getUserById(decoded.userId);

        if (!user) {
            res.status(401).json({ success: false, message: 'User no longer exists' });
            return;
        }

        req.user = user;
        req.jwtPayload = decoded;
        next();
    } catch (err) {
        res.status(401).json({ success: false, message: 'Invalid or expired token' });
        return;
    }
}

/**
 * Middleware factory: Require a specific role (or higher)
 */
export function requireRole(...roles: string[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Authentication required' });
            return;
        }

        // sysadmin can do anything
        if (req.user.role === 'sysadmin') {
            next();
            return;
        }

        if (!roles.includes(req.user.role)) {
            res.status(403).json({ success: false, message: 'Insufficient permissions' });
            return;
        }

        next();
    };
}

/**
 * Middleware factory: Require a specific ACL permission
 * permission format: "panel.action" e.g. "modules.run", "users.manage"
 */
export function requirePermission(permission: string) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Authentication required' });
            return;
        }

        const [panel, action] = permission.split('.');
        const perms = getEffectivePermissions(req.user);

        if (!perms.panels[panel] || !perms.panels[panel][action]) {
            res.status(403).json({
                success: false,
                message: `Permission denied: ${permission}`,
            });
            return;
        }

        next();
    };
}

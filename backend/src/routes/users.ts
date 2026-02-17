import { Router, Response } from 'express';
import { getDb, getAllUsers, getUserById } from '../database';
import { validatePasswordComplexity, hashPassword } from '../password';
import { authenticateJWT, requireRole, AuthenticatedRequest } from '../middleware';

const router = Router();

// All user management routes require authentication + admin/sysadmin role
router.use(authenticateJWT);
router.use(requireRole('admin', 'sysadmin'));

/**
 * GET /api/users
 * List all users
 */
router.get('/', (_req: AuthenticatedRequest, res: Response): void => {
    const users = getAllUsers();
    res.json({
        success: true,
        users: users.map((u) => ({
            id: u.id,
            username: u.username,
            email: u.email,
            role: u.role,
            totp_enabled: !!u.totp_enabled,
            acl_template_id: u.acl_template_id,
            custom_acl_json: u.custom_acl_json ? JSON.parse(u.custom_acl_json) : null,
            created_at: u.created_at,
            updated_at: u.updated_at,
        })),
    });
});

/**
 * POST /api/users
 * Create a new user
 */
router.post('/', (req: AuthenticatedRequest, res: Response): void => {
    const { username, email, password, role, acl_template_id } = req.body;

    if (!username || !password) {
        res.status(400).json({ success: false, message: 'Username and password are required' });
        return;
    }

    // Validate role
    const validRoles = ['pentester', 'admin', 'sysadmin'];
    const userRole = role || 'pentester';
    if (!validRoles.includes(userRole)) {
        res.status(400).json({ success: false, message: `Invalid role. Must be: ${validRoles.join(', ')}` });
        return;
    }

    // Only sysadmins can create sysadmins
    if (userRole === 'sysadmin' && req.user?.role !== 'sysadmin') {
        res.status(403).json({ success: false, message: 'Only sysadmins can create sysadmin accounts' });
        return;
    }

    // Validate password complexity
    const validation = validatePasswordComplexity(password);
    if (!validation.valid) {
        res.status(400).json({ success: false, message: 'Password does not meet complexity requirements', errors: validation.errors });
        return;
    }

    // Check username uniqueness
    const existing = getDb().prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
        res.status(409).json({ success: false, message: 'Username already exists' });
        return;
    }

    const hash = hashPassword(password);

    try {
        const result = getDb().prepare(`
      INSERT INTO users (username, email, password_hash, role, acl_template_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(username, email || '', hash, userRole, acl_template_id || null);

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            user: {
                id: result.lastInsertRowid,
                username,
                email: email || '',
                role: userRole,
            },
        });
    } catch (err: any) {
        res.status(500).json({ success: false, message: 'Failed to create user: ' + err.message });
    }
});

/**
 * PUT /api/users/:id
 * Update a user (role, ACL, email)
 */
router.put('/:id', (req: AuthenticatedRequest, res: Response): void => {
    const userId = parseInt(req.params.id, 10);
    const user = getUserById(userId);

    if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
    }

    // Prevent non-sysadmins from modifying sysadmins
    if (user.role === 'sysadmin' && req.user?.role !== 'sysadmin') {
        res.status(403).json({ success: false, message: 'Only sysadmins can modify sysadmin accounts' });
        return;
    }

    const { role, email, acl_template_id, custom_acl_json } = req.body;
    const updates: string[] = [];
    const values: any[] = [];

    if (role !== undefined) {
        const validRoles = ['pentester', 'operator', 'admin', 'sysadmin', 'readonly'];
        if (!validRoles.includes(role)) {
            res.status(400).json({ success: false, message: `Invalid role. Must be: ${validRoles.join(', ')}` });
            return;
        }
        if (role === 'sysadmin' && req.user?.role !== 'sysadmin') {
            res.status(403).json({ success: false, message: 'Only sysadmins can assign sysadmin role' });
            return;
        }
        updates.push('role = ?');
        values.push(role);
    }

    if (email !== undefined) {
        updates.push('email = ?');
        values.push(email);
    }

    if (acl_template_id !== undefined) {
        updates.push('acl_template_id = ?');
        values.push(acl_template_id);
    }

    if (custom_acl_json !== undefined) {
        updates.push('custom_acl_json = ?');
        values.push(custom_acl_json ? JSON.stringify(custom_acl_json) : null);
    }

    if (updates.length === 0) {
        res.status(400).json({ success: false, message: 'No fields to update' });
        return;
    }

    updates.push("updated_at = datetime('now')");
    values.push(userId);

    try {
        getDb().prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
        const updated = getUserById(userId);
        res.json({
            success: true,
            message: 'User updated successfully',
            user: updated ? {
                id: updated.id,
                username: updated.username,
                email: updated.email,
                role: updated.role,
                acl_template_id: updated.acl_template_id,
                custom_acl_json: updated.custom_acl_json ? JSON.parse(updated.custom_acl_json) : null,
            } : null,
        });
    } catch (err: any) {
        res.status(500).json({ success: false, message: 'Failed to update user: ' + err.message });
    }
});

/**
 * DELETE /api/users/:id
 * Delete a user
 */
router.delete('/:id', (req: AuthenticatedRequest, res: Response): void => {
    const userId = parseInt(req.params.id, 10);
    const user = getUserById(userId);

    if (!user) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
    }

    // Cannot delete yourself
    if (req.user?.id === userId) {
        res.status(400).json({ success: false, message: 'Cannot delete your own account' });
        return;
    }

    // Only sysadmins can delete sysadmins
    if (user.role === 'sysadmin' && req.user?.role !== 'sysadmin') {
        res.status(403).json({ success: false, message: 'Only sysadmins can delete sysadmin accounts' });
        return;
    }

    try {
        getDb().prepare('DELETE FROM users WHERE id = ?').run(userId);
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (err: any) {
        res.status(500).json({ success: false, message: 'Failed to delete user: ' + err.message });
    }
});

export default router;

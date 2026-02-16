import { Router, Response } from 'express';
import { getDb, AclTemplateRow } from '../database';
import { authenticateJWT, requireRole, AuthenticatedRequest } from '../middleware';

const router = Router();

// All ACL routes require sysadmin
router.use(authenticateJWT);
router.use(requireRole('sysadmin'));

/**
 * GET /api/acl/templates
 * List all ACL templates
 */
router.get('/templates', (_req: AuthenticatedRequest, res: Response): void => {
    const templates = getDb().prepare('SELECT * FROM acl_templates ORDER BY id').all() as AclTemplateRow[];
    res.json({
        success: true,
        templates: templates.map((t) => ({
            id: t.id,
            name: t.name,
            permissions: JSON.parse(t.permissions_json),
            created_at: t.created_at,
        })),
    });
});

/**
 * POST /api/acl/templates
 * Create a new ACL template
 */
router.post('/templates', (req: AuthenticatedRequest, res: Response): void => {
    const { name, permissions } = req.body;

    if (!name || !permissions) {
        res.status(400).json({ success: false, message: 'Name and permissions are required' });
        return;
    }

    // Validate permissions structure
    if (!permissions.panels || typeof permissions.panels !== 'object') {
        res.status(400).json({ success: false, message: 'Permissions must have a "panels" object' });
        return;
    }

    try {
        const result = getDb().prepare('INSERT INTO acl_templates (name, permissions_json) VALUES (?, ?)').run(
            name,
            JSON.stringify(permissions)
        );

        res.status(201).json({
            success: true,
            message: 'ACL template created',
            template: {
                id: result.lastInsertRowid,
                name,
                permissions,
            },
        });
    } catch (err: any) {
        if (err.message?.includes('UNIQUE')) {
            res.status(409).json({ success: false, message: 'Template name already exists' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to create template: ' + err.message });
        }
    }
});

/**
 * PUT /api/acl/templates/:id
 * Update an ACL template
 */
router.put('/templates/:id', (req: AuthenticatedRequest, res: Response): void => {
    const templateId = parseInt(req.params.id, 10);
    const { name, permissions } = req.body;

    const existing = getDb().prepare('SELECT * FROM acl_templates WHERE id = ?').get(templateId);
    if (!existing) {
        res.status(404).json({ success: false, message: 'Template not found' });
        return;
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
        updates.push('name = ?');
        values.push(name);
    }

    if (permissions !== undefined) {
        if (!permissions.panels || typeof permissions.panels !== 'object') {
            res.status(400).json({ success: false, message: 'Permissions must have a "panels" object' });
            return;
        }
        updates.push('permissions_json = ?');
        values.push(JSON.stringify(permissions));
    }

    if (updates.length === 0) {
        res.status(400).json({ success: false, message: 'No fields to update' });
        return;
    }

    values.push(templateId);

    try {
        getDb().prepare(`UPDATE acl_templates SET ${updates.join(', ')} WHERE id = ?`).run(...values);
        res.json({ success: true, message: 'Template updated successfully' });
    } catch (err: any) {
        res.status(500).json({ success: false, message: 'Failed to update template: ' + err.message });
    }
});

/**
 * DELETE /api/acl/templates/:id
 * Delete an ACL template
 */
router.delete('/templates/:id', (req: AuthenticatedRequest, res: Response): void => {
    const templateId = parseInt(req.params.id, 10);

    const existing = getDb().prepare('SELECT * FROM acl_templates WHERE id = ?').get(templateId);
    if (!existing) {
        res.status(404).json({ success: false, message: 'Template not found' });
        return;
    }

    // Unlink users from this template first
    getDb().prepare('UPDATE users SET acl_template_id = NULL WHERE acl_template_id = ?').run(templateId);
    getDb().prepare('DELETE FROM acl_templates WHERE id = ?').run(templateId);

    res.json({ success: true, message: 'Template deleted successfully' });
});

export default router;

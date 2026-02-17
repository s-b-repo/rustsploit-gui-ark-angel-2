import { Router, Response } from 'express';
import axios, { AxiosError } from 'axios';
import { authenticateJWT, requirePermission, AuthenticatedRequest } from '../middleware';

const router = Router();

const RSF_API_URL = process.env.RSF_API_URL || 'http://127.0.0.1:8080';
let rsfApiKey = process.env.RSF_API_KEY || '';

/** Get the current RSF API key */
export function getRsfApiKey(): string { return rsfApiKey; }

/** Update the RSF API key at runtime (e.g. after key rotation) */
export function setRsfApiKey(key: string): void { rsfApiKey = key; }

// All proxy routes require authentication
router.use(authenticateJWT);

/**
 * Proxy helper — forwards request to rustsploit API
 */
async function proxyToRsf(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    data?: any,
    query?: Record<string, string>
): Promise<{ status: number; data: any }> {
    try {
        const resp = await axios({
            method,
            url: `${RSF_API_URL}${path}`,
            data,
            params: query,
            headers: {
                Authorization: `Bearer ${rsfApiKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 30000,
            validateStatus: () => true, // Don't throw on non-2xx
        });
        return { status: resp.status, data: resp.data };
    } catch (err) {
        const axErr = err as AxiosError;
        if (axErr.code === 'ECONNREFUSED') {
            return { status: 502, data: { success: false, message: 'RustSploit API is not reachable' } };
        }
        return { status: 500, data: { success: false, message: 'Proxy error: ' + axErr.message } };
    }
}

// ---- Module routes ----

/**
 * GET /api/rsf/modules
 */
router.get('/modules', requirePermission('modules.view'), async (_req: AuthenticatedRequest, res: Response) => {
    const result = await proxyToRsf('GET', '/api/modules');
    res.status(result.status).json(result.data);
});

/**
 * GET /api/rsf/modules/search?q=keyword
 */
router.get('/modules/search', requirePermission('modules.view'), async (req: AuthenticatedRequest, res: Response) => {
    const q = req.query.q as string;
    const result = await proxyToRsf('GET', '/api/modules/search', undefined, { q: q || '' });
    res.status(result.status).json(result.data);
});

/**
 * GET /api/rsf/module/* — wildcard for nested module paths (e.g. creds/camxploit/camxploit)
 */
router.get('/module/*', requirePermission('modules.view'), async (req: AuthenticatedRequest, res: Response) => {
    // req.params[0] contains everything after /module/
    const modulePath = (req.params as any)[0] || '';
    const result = await proxyToRsf('GET', `/api/module/${modulePath}`);
    res.status(result.status).json(result.data);
});


// ---- Run module ----

/**
 * POST /api/rsf/run
 */
router.post('/run', requirePermission('modules.run'), async (req: AuthenticatedRequest, res: Response) => {
    const result = await proxyToRsf('POST', '/api/run', req.body);
    res.status(result.status).json(result.data);
});

/**
 * POST /api/rsf/validate
 */
router.post('/validate', requirePermission('modules.view'), async (req: AuthenticatedRequest, res: Response) => {
    const result = await proxyToRsf('POST', '/api/validate', req.body);
    res.status(result.status).json(result.data);
});

// ---- Target ----

/**
 * GET /api/rsf/target
 */
router.get('/target', requirePermission('target.view'), async (_req: AuthenticatedRequest, res: Response) => {
    const result = await proxyToRsf('GET', '/api/target');
    res.status(result.status).json(result.data);
});

/**
 * POST /api/rsf/target
 */
router.post('/target', requirePermission('target.set'), async (req: AuthenticatedRequest, res: Response) => {
    const result = await proxyToRsf('POST', '/api/target', req.body);
    res.status(result.status).json(result.data);
});

/**
 * DELETE /api/rsf/target
 */
router.delete('/target', requirePermission('target.set'), async (_req: AuthenticatedRequest, res: Response) => {
    const result = await proxyToRsf('DELETE', '/api/target');
    res.status(result.status).json(result.data);
});

// ---- Jobs ----

/**
 * GET /api/rsf/jobs
 */
router.get('/jobs', requirePermission('jobs.view'), async (_req: AuthenticatedRequest, res: Response) => {
    const result = await proxyToRsf('GET', '/api/jobs');
    res.status(result.status).json(result.data);
});

/**
 * GET /api/rsf/output/:jobId
 */
router.get('/output/:jobId', requirePermission('jobs.view'), async (req: AuthenticatedRequest, res: Response) => {
    const result = await proxyToRsf('GET', `/api/output/${req.params.jobId}`);
    res.status(result.status).json(result.data);
});

// ---- Status ----

/**
 * GET /api/rsf/status
 */
router.get('/status', requirePermission('status.view'), async (_req: AuthenticatedRequest, res: Response) => {
    const result = await proxyToRsf('GET', '/api/status');
    res.status(result.status).json(result.data);
});

/**
 * GET /api/rsf/ips
 */
router.get('/ips', requirePermission('status.view'), async (_req: AuthenticatedRequest, res: Response) => {
    const result = await proxyToRsf('GET', '/api/ips');
    res.status(result.status).json(result.data);
});

/**
 * GET /api/rsf/auth-failures
 */
router.get('/auth-failures', requirePermission('status.view'), async (_req: AuthenticatedRequest, res: Response) => {
    const result = await proxyToRsf('GET', '/api/auth-failures');
    res.status(result.status).json(result.data);
});

/**
 * POST /api/rsf/rotate-key
 */
router.post('/rotate-key', requirePermission('status.view'), async (_req: AuthenticatedRequest, res: Response) => {
    const result = await proxyToRsf('POST', '/api/rotate-key');
    res.status(result.status).json(result.data);
});

/**
 * GET /api/rsf/health
 */
router.get('/health', async (_req: AuthenticatedRequest, res: Response) => {
    const result = await proxyToRsf('GET', '/health');
    res.status(result.status).json(result.data);
});

// ---- New Feature Routes ----

/**
 * POST /api/rsf/honeypot-check
 */
router.post('/honeypot-check', requirePermission('modules.run'), async (req: AuthenticatedRequest, res: Response) => {
    const result = await proxyToRsf('POST', '/api/honeypot-check', req.body);
    res.status(result.status).json(result.data);
});

/**
 * POST /api/rsf/jobs/:jobId/cancel
 */
router.post('/jobs/:jobId/cancel', requirePermission('jobs.view'), async (req: AuthenticatedRequest, res: Response) => {
    const result = await proxyToRsf('POST', `/api/jobs/${req.params.jobId}/cancel`);
    res.status(result.status).json(result.data);
});

/**
 * DELETE /api/rsf/jobs/:jobId
 */
router.delete('/jobs/:jobId', requirePermission('jobs.view'), async (req: AuthenticatedRequest, res: Response) => {
    const result = await proxyToRsf('DELETE', `/api/jobs/${req.params.jobId}`);
    res.status(result.status).json(result.data);
});

/**
 * GET /api/rsf/logs?lines=100
 */
router.get('/logs', requirePermission('status.view'), async (req: AuthenticatedRequest, res: Response) => {
    const lines = (req.query.lines as string) || '100';
    const result = await proxyToRsf('GET', '/api/logs', undefined, { lines });
    res.status(result.status).json(result.data);
});

/**
 * GET /api/rsf/config
 */
router.get('/config', requirePermission('status.view'), async (_req: AuthenticatedRequest, res: Response) => {
    const result = await proxyToRsf('GET', '/api/config');
    res.status(result.status).json(result.data);
});

/**
 * GET /api/rsf/modules/count
 */
router.get('/modules/count', requirePermission('modules.view'), async (_req: AuthenticatedRequest, res: Response) => {
    const result = await proxyToRsf('GET', '/api/modules/count');
    res.status(result.status).json(result.data);
});

export default router;

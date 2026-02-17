import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import axios from 'axios';
import { getDb } from './database';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import settingsRoutes from './routes/settings';
import aclRoutes from './routes/acl';
import proxyRoutes, { getRsfApiKey } from './routes/proxy';
import { authenticateJWT } from './middleware';

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);
const RSF_API_URL = process.env.RSF_API_URL || 'http://127.0.0.1:8080';

// ── Security ────────────────────────────────────────────
app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// ── Initialize database ─────────────────────────────────
getDb();

// ── Routes ──────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/acl', aclRoutes);
app.use('/api/rsf', proxyRoutes);

// ── RSF Health check (any authenticated user) ───────────
app.get('/api/rsf-health', authenticateJWT, async (_req, res) => {
    const currentKey = getRsfApiKey();
    const start = Date.now();
    try {
        const resp = await axios.get(`${RSF_API_URL}/health`, {
            headers: { Authorization: `Bearer ${currentKey}` },
            timeout: 5000,
            validateStatus: () => true,
        });
        const latency = Date.now() - start;

        if (resp.status === 200) {
            // Health passed — now validate the key actually works for protected routes
            const authCheck = await axios.get(`${RSF_API_URL}/api/modules`, {
                headers: { Authorization: `Bearer ${currentKey}` },
                timeout: 5000,
                validateStatus: () => true,
            });
            if (authCheck.status === 200) {
                res.json({ success: true, status: 'connected', latency, message: 'RSF API connected and authenticated' });
            } else if (authCheck.status === 401 || authCheck.status === 403) {
                res.json({ success: true, status: 'auth_failed', latency, message: '⚠️ Wrong RSF API key configured in backend. Please update RSF_API_KEY environment variable.' });
            } else {
                res.json({ success: true, status: 'degraded', latency, message: `RSF API returned unexpected status ${authCheck.status}` });
            }
        } else if (resp.status === 401 || resp.status === 403) {
            res.json({ success: true, status: 'auth_failed', latency: Date.now() - start, message: '⚠️ Wrong RSF API key configured in backend. Please update RSF_API_KEY environment variable.' });
        } else {
            res.json({ success: true, status: 'degraded', latency, message: `RSF API returned status ${resp.status}` });
        }
    } catch (err: any) {
        if (err.code === 'ECONNREFUSED') {
            res.json({ success: true, status: 'offline', message: 'RSF API is not reachable (connection refused)' });
        } else {
            res.json({ success: true, status: 'error', message: `Connection error: ${err.message}` });
        }
    }
});

// ── Health check ────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'rustsploit-gui-backend' });
});

// ── 404 handler ─────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Startup RSF API key validation ──────────────────────
async function validateRsfConnection() {
    const currentKey = getRsfApiKey();
    const keyPreview = currentKey ? `****${currentKey.slice(-4)}` : 'NOT SET';

    if (!currentKey) {
        console.log('');
        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║  ⚠️  WARNING: RSF_API_KEY is NOT SET                         ║');
        console.log('║  Set RSF_API_KEY environment variable to connect to RSF API  ║');
        console.log('╚══════════════════════════════════════════════════════════════╝');
        console.log('');
        return;
    }

    try {
        const healthResp = await axios.get(`${RSF_API_URL}/health`, { timeout: 5000, validateStatus: () => true });
        if (healthResp.status !== 200) {
            console.log('');
            console.log('╔══════════════════════════════════════════════════════════════╗');
            console.log('║  ⚠️  WARNING: RSF API health check failed                   ║');
            console.log(`║  URL: ${RSF_API_URL.padEnd(54)}║`);
            console.log('╚══════════════════════════════════════════════════════════════╝');
            return;
        }

        // Test auth with a protected endpoint
        const authResp = await axios.get(`${RSF_API_URL}/api/modules`, {
            headers: { Authorization: `Bearer ${currentKey}` },
            timeout: 5000,
            validateStatus: () => true,
        });

        if (authResp.status === 200) {
            console.log(`  ✅ RSF API connection verified (key: ${keyPreview})`);
        } else if (authResp.status === 401 || authResp.status === 403) {
            console.log('');
            console.log('╔══════════════════════════════════════════════════════════════╗');
            console.log('║  🚨 CRITICAL: RSF API KEY IS INVALID!                       ║');
            console.log('╠══════════════════════════════════════════════════════════════╣');
            console.log(`║  Current key: ${keyPreview.padEnd(46)}║`);
            console.log('║  RSF API rejected the key with 401 Unauthorized.            ║');
            console.log('║                                                              ║');
            console.log('║  FIX: Set the correct key in RSF_API_KEY env var:            ║');
            console.log('║  RSF_API_KEY=<correct-key> npm run dev                      ║');
            console.log('║                                                              ║');
            console.log('║  Users can still log in but RSF features will be degraded.  ║');
            console.log('╚══════════════════════════════════════════════════════════════╝');
            console.log('');
        }
    } catch (err: any) {
        if (err.code === 'ECONNREFUSED') {
            console.log(`  ⚠️  RSF API not reachable at ${RSF_API_URL} (connection refused)`);
        } else {
            console.log(`  ⚠️  RSF API connection check failed: ${err.message}`);
        }
    }
}

// ── Start ───────────────────────────────────────────────
app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║       🛡️  RustSploit GUI Backend                ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  🌐 Server:    http://localhost:${PORT}            ║`);
    console.log(`║  📡 RSF API:   ${RSF_API_URL.padEnd(33)}║`);
    console.log(`║  🔑 API Key:   ${process.env.RSF_API_KEY ? '****' + process.env.RSF_API_KEY.slice(-4) : 'NOT SET (env RSF_API_KEY)'}`.padEnd(53) + '║');
    console.log('╚══════════════════════════════════════════════════╝');

    // Validate RSF API connection on startup
    validateRsfConnection();
});

export default app;

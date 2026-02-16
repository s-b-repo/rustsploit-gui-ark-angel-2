import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { getDb } from './database';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import settingsRoutes from './routes/settings';
import aclRoutes from './routes/acl';
import proxyRoutes from './routes/proxy';

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

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

// ── Health check ────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'rustsploit-gui-backend' });
});

// ── 404 handler ─────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Start ───────────────────────────────────────────────
app.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║       🛡️  RustSploit GUI Backend                ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  🌐 Server:    http://localhost:${PORT}            ║`);
    console.log(`║  📡 RSF API:   ${(process.env.RSF_API_URL || 'http://127.0.0.1:8080').padEnd(33)}║`);
    console.log(`║  🔑 API Key:   ${process.env.RSF_API_KEY ? '****' + process.env.RSF_API_KEY.slice(-4) : 'NOT SET (env RSF_API_KEY)'}`.padEnd(53) + '║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
});

export default app;

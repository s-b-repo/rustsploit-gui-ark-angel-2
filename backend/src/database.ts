import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

const DB_PATH = path.join(__dirname, '..', 'data', 'rustsploit-gui.db');

let db: Database.Database;

export function getDb(): Database.Database {
    if (!db) {
        // Ensure data directory exists
        const fs = require('fs');
        const dir = path.dirname(DB_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        initializeSchema();
    }
    return db;
}

function initializeSchema(): void {
    const d = getDb();

    d.exec(`
    CREATE TABLE IF NOT EXISTS acl_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      permissions_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('sysadmin','admin','operator','pentester','readonly')) DEFAULT 'pentester',
      totp_secret TEXT,
      totp_enabled INTEGER NOT NULL DEFAULT 0,
      acl_template_id INTEGER REFERENCES acl_templates(id) ON DELETE SET NULL,
      custom_acl_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );
  `);

    // Seed default sysadmin if no users exist
    const count = d.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number };
    if (count.cnt === 0) {
        const hash = bcrypt.hashSync('RustSploit2024!', 12);
        d.prepare(`
      INSERT INTO users (username, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `).run('admin', 'admin@rustsploit.local', hash, 'sysadmin');
        console.log('🔑 Default sysadmin created: admin / RustSploit2024!');
    }

    // Seed default ACL templates
    const templateCount = d.prepare('SELECT COUNT(*) as cnt FROM acl_templates').get() as { cnt: number };
    if (templateCount.cnt === 0) {
        const fullAccess = JSON.stringify({
            panels: {
                modules: { view: true, run: true },
                jobs: { view: true },
                target: { view: true, set: true },
                status: { view: true },
                users: { view: true, manage: true },
                acl: { view: true, manage: true },
                settings: { view: true },
            },
        });

        const pentesterAccess = JSON.stringify({
            panels: {
                modules: { view: true, run: true },
                jobs: { view: true },
                target: { view: true, set: true },
                status: { view: true },
                users: { view: false, manage: false },
                acl: { view: false, manage: false },
                settings: { view: true },
            },
        });

        const readOnly = JSON.stringify({
            panels: {
                modules: { view: true, run: false },
                jobs: { view: true },
                target: { view: true, set: false },
                status: { view: true },
                users: { view: false, manage: false },
                acl: { view: false, manage: false },
                settings: { view: true },
            },
        });

        const stmt = d.prepare('INSERT INTO acl_templates (name, permissions_json) VALUES (?, ?)');
        stmt.run('Full Access', fullAccess);
        stmt.run('Pentester Default', pentesterAccess);
        stmt.run('Read Only', readOnly);
        console.log('📋 Default ACL templates created');
    }
}

// ---- User helpers ----

export interface UserRow {
    id: number;
    username: string;
    email: string;
    password_hash: string;
    role: 'sysadmin' | 'admin' | 'operator' | 'pentester' | 'readonly';
    totp_secret: string | null;
    totp_enabled: number;
    acl_template_id: number | null;
    custom_acl_json: string | null;
    created_at: string;
    updated_at: string;
}

export interface AclTemplateRow {
    id: number;
    name: string;
    permissions_json: string;
    created_at: string;
}

export interface Permissions {
    panels: {
        [key: string]: { [action: string]: boolean };
    };
}

export function getUserById(id: number): UserRow | undefined {
    return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
}

export function getUserByUsername(username: string): UserRow | undefined {
    return getDb().prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined;
}

export function getAllUsers(): UserRow[] {
    return getDb().prepare('SELECT id, username, email, role, totp_enabled, acl_template_id, custom_acl_json, created_at, updated_at FROM users').all() as UserRow[];
}

export function getEffectivePermissions(user: UserRow): Permissions {
    // custom_acl_json overrides template
    if (user.custom_acl_json) {
        try {
            return JSON.parse(user.custom_acl_json) as Permissions;
        } catch { /* fall through */ }
    }

    // sysadmin gets everything
    if (user.role === 'sysadmin') {
        return {
            panels: {
                modules: { view: true, run: true },
                jobs: { view: true },
                target: { view: true, set: true },
                status: { view: true },
                users: { view: true, manage: true },
                acl: { view: true, manage: true },
                settings: { view: true },
            },
        };
    }

    // admin gets user management + ops
    if (user.role === 'admin') {
        return {
            panels: {
                modules: { view: true, run: true },
                jobs: { view: true, kill: true },
                target: { view: true, set: true },
                status: { view: true },
                users: { view: true, manage: true },
                acl: { view: false, manage: false },
                settings: { view: true },
            },
        };
    }

    // operator gets ops but no user/acl management
    if (user.role === 'operator') {
        return {
            panels: {
                modules: { view: true, run: true },
                jobs: { view: true, kill: true },
                target: { view: true, set: true },
                status: { view: true },
                users: { view: false, manage: false },
                acl: { view: false, manage: false },
                settings: { view: true },
            },
        };
    }

    // readonly — view only, no execution
    if (user.role === 'readonly') {
        return {
            panels: {
                modules: { view: true, run: false },
                jobs: { view: true, kill: false },
                target: { view: true, set: false },
                status: { view: true },
                users: { view: false, manage: false },
                acl: { view: false, manage: false },
                settings: { view: true },
            },
        };
    }

    // Check template
    if (user.acl_template_id) {
        const template = getDb().prepare('SELECT * FROM acl_templates WHERE id = ?').get(user.acl_template_id) as AclTemplateRow | undefined;
        if (template) {
            try {
                return JSON.parse(template.permissions_json) as Permissions;
            } catch { /* fall through */ }
        }
    }

    // Default pentester permissions
    return {
        panels: {
            modules: { view: true, run: true },
            jobs: { view: true },
            target: { view: true, set: true },
            status: { view: true },
            users: { view: false, manage: false },
            acl: { view: false, manage: false },
            settings: { view: true },
        },
    };
}

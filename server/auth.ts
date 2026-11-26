import type { Request, Response, NextFunction } from 'express';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import db, { createId, getSystemConfig } from './db.ts';
import type { User } from '../src/types/orbita.ts';

const ACTIVE_AUTH_PROJECT_ID = 'orbita-609d7';

function readFirebaseProjectId(): string {
  const envId = process.env.FIREBASE_PROJECT_ID?.trim();
  return envId || ACTIVE_AUTH_PROJECT_ID;
}

export function isFirebaseAuthConfigured(): boolean {
  const projectId = readFirebaseProjectId();
  return Boolean(projectId && projectId !== 'remixed-project-id');
}

function getFirebaseAdminAuth() {
  const projectId = readFirebaseProjectId();
  if (!projectId || projectId === 'remixed-project-id') {
    throw new Error('Firebase project is not provisioned yet.');
  }
  const existing = getApps().find((a) => a.name === 'orbita-auth');
  const app = existing ?? initializeApp({ projectId }, 'orbita-auth');
  return getAuth(app);
}

export function mapUserRow(row: Record<string, unknown>): User {
  return {
    id: String(row.id),
    external_auth_provider: row.external_auth_provider === 'google' ? 'google' : 'firebase',
    external_auth_user_id: String(row.external_auth_user_id),
    name: String(row.name),
    email: String(row.email),
    profile_image: row.profile_image ? String(row.profile_image) : null,
    role: row.role === 'admin' ? 'admin' : 'user',
    plan:
      row.plan === 'starter' || row.plan === 'pro' || row.plan === 'business' ? row.plan : 'free',
    theme_preference:
      row.theme_preference === 'dark' || row.theme_preference === 'system' ? row.theme_preference : 'light',
    notifications_enabled: Boolean(row.notifications_enabled),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function isBootstrapAdminEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  const configured = process.env.ADMIN_EMAIL || process.env.ADMIN_EMAILS || '';
  const list = configured
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (list.includes(normalized)) return true;
  // Project owner runtime email
  return normalized === 'abhinavsingha369@gmail.com';
}

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  const idToken = authHeader.slice(7).trim();
  if (!idToken) {
    res.status(401).json({ error: 'Authentication token is missing.' });
    return;
  }

  try {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = decoded.email?.trim().toLowerCase();

    if (!uid || !email) {
      res.status(403).json({ error: 'A valid Firebase account email is required to access ORBITA AI.' });
      return;
    }

    const now = new Date().toISOString();
    let row = db
      .prepare('SELECT * FROM users WHERE external_auth_user_id = ?')
      .get(uid) as Record<string, unknown> | undefined;

    if (!row) {
      const sysConfig = getSystemConfig();
      if (!sysConfig.allow_new_signups && !isBootstrapAdminEmail(email)) {
        res.status(403).json({ error: 'New registrations are currently paused by the administrator.' });
        return;
      }

      const newUserId = createId('usr');
      const role = isBootstrapAdminEmail(email) ? 'admin' : 'user';
      const displayName =
        (typeof decoded.name === 'string' && decoded.name.trim()) || email.split('@')[0];

      db.prepare(
        `INSERT INTO users (
          id, external_auth_provider, external_auth_user_id, name, email, profile_image,
          role, plan, theme_preference, notifications_enabled, created_at, updated_at
        ) VALUES (?, 'firebase', ?, ?, ?, NULL, ?, 'free', 'light', 1, ?, ?)`
      ).run(newUserId, uid, displayName.slice(0, 100), email, role, now, now);

      row = db.prepare('SELECT * FROM users WHERE id = ?').get(newUserId) as Record<string, unknown>;
    } else {
      const nextRole = row.role === 'admin' || isBootstrapAdminEmail(email) ? 'admin' : 'user';
      if (row.email !== email || row.role !== nextRole) {
        db.prepare('UPDATE users SET email = ?, role = ?, updated_at = ? WHERE id = ?').run(
          email,
          nextRole,
          now,
          String(row.id)
        );
        row = db.prepare('SELECT * FROM users WHERE id = ?').get(String(row.id)) as Record<string, unknown>;
      }
    }

    req.user = mapUserRow(row);
    next();
  } catch (err) {
    console.error('Firebase token verification failed:', err instanceof Error ? err.message : err);
    res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Administrator privileges required for this action.' });
    return;
  }
  next();
}

export function createRateLimiter(maxRequests: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const key = req.user?.id || req.ip || 'anonymous';
    const now = Date.now();
    const list = (hits.get(key) || []).filter((ts) => now - ts < windowMs);
    if (list.length >= maxRequests) {
      res.status(429).json({
        error: 'Too many requests. Please wait a few moments before sending another request.',
      });
      return;
    }
    list.push(now);
    hits.set(key, list);
    next();
  };
}

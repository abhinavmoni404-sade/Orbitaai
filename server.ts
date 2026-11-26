import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db, {
  createId,
  getBillingConfig,
  getMonthlyCreditsUsed,
  getSubscriptionPlanById,
  getSubscriptionPlans,
  getSystemConfig,
  mapAgentRow,
} from './server/db.ts';
import {
  activateSubscriptionFromVerifiedOrder,
  getActiveSubscriptionForUser,
  getCashfreeCredentials,
  getEffectivePaymentEnvironment,
  initiateCashfreeCheckoutSession,
  isBillingOperational,
  mapInvoiceRow,
  mapOrderRow,
  verifyCashfreeOrderWithGateway,
  verifyCashfreeWebhookSignature,
} from './server/billing.ts';
import {
  createRateLimiter,
  isFirebaseAuthConfigured,
  mapUserRow,
  requireAdmin,
  requireAuth,
  type AuthenticatedRequest,
} from './server/auth.ts';
import {
  deriveConversationTitle,
  formatFriendlyGeminiError,
  isGeminiConfigured,
  streamAgentResponse,
} from './server/ai.ts';
import type { BillingCycle, Message, PlanId, User } from './src/types/orbita.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

function getAppBaseUrl(): string {
  const configured = process.env.APP_URL?.trim();
  if (configured && configured !== 'MY_APP_URL') {
    return configured.replace(/\/+$/, '');
  }
  return `http://localhost:${PORT}`;
}

function getDailyLimitForUser(user: User): number {
  const activeSub = getActiveSubscriptionForUser(user.id);
  if (activeSub && activeSub.plan_id === user.plan) {
    return activeSub.agreed_daily_limit;
  }
  const planRow = getSubscriptionPlanById(user.plan);
  if (planRow) return planRow.daily_limit;
  const cfg = getSystemConfig();
  if (user.plan === 'business') return cfg.business_daily_limit;
  if (user.plan === 'pro') return cfg.pro_daily_limit;
  if (user.plan === 'starter') return cfg.starter_daily_limit;
  return cfg.free_daily_limit;
}

function getTodayUsageCount(userId: string): number {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(usage_amount), 0) AS total
       FROM usage_records
       WHERE user_id = ? AND created_at >= ?`
    )
    .get(userId, todayStart.toISOString()) as { total: number };
  return Number(row?.total || 0);
}

function recordAdminAudit(
  adminUserId: string,
  action: string,
  targetType: string,
  targetId: string,
  details?: string
) {
  db.prepare(
    `INSERT INTO admin_audit_logs (id, admin_user_id, action, target_type, target_id, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(createId('audit'), adminUserId, action, targetType, targetId, details ?? null, new Date().toISOString());
}

interface RawBodyRequest extends Request {
  rawBody?: Buffer;
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        (req as RawBodyRequest).rawBody = buf;
      },
    })
  );

  const aiRateLimiter = createRateLimiter(20, 60 * 1000);
  const contactRateLimiter = createRateLimiter(10, 60 * 1000);
  const billingRateLimiter = createRateLimiter(20, 60 * 1000);

  // Health
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'orbita-ai' });
  });

  // Public agent catalog (never returns private user records)
  app.get('/api/public/agents', (_req: Request, res: Response) => {
    const rows = db.prepare('SELECT * FROM agents WHERE is_active = 1 ORDER BY created_at ASC, name ASC').all() as Record<
      string,
      unknown
    >[];
    res.json({
      agents: rows.map((r) => {
        const mapped = mapAgentRow(r);
        return {
          id: mapped.id,
          name: mapped.name,
          slug: mapped.slug,
          tagline: mapped.tagline,
          description: mapped.description,
          icon: mapped.icon,
          category: mapped.category,
          accent_color: mapped.accent_color,
          capabilities: mapped.capabilities,
          suggested_prompts: mapped.suggested_prompts,
        };
      }),
    });
  });

  // Public non-secret configuration status
  app.get('/api/public/config-status', (_req: Request, res: Response) => {
    const billingCfg = getBillingConfig();
    const cfCreds = getCashfreeCredentials();
    res.json({
      gemini_configured: isGeminiConfigured(),
      firebase_auth_configured: isFirebaseAuthConfigured(),
      billing_provider_configured: cfCreds.configured,
      cashfree_configured: cfCreds.configured,
      payment_environment: getEffectivePaymentEnvironment(),
      production_payments_enabled: billingCfg.production_payments_enabled,
    });
  });

  // Public subscription plan catalog (never exposes merchant UPI ID or gateway secrets)
  app.get('/api/public/plans', (_req: Request, res: Response) => {
    const plans = getSubscriptionPlans(false);
    const billingCfg = getBillingConfig();
    const cfCreds = getCashfreeCredentials();
    const annualBillingConfigured = plans.some(
      (p) => p.id !== 'free' && p.annual_price_paise !== null && p.annual_price_paise > 0
    );
    res.json({
      plans,
      default_currency: billingCfg.default_currency,
      supported_currencies: billingCfg.supported_currencies,
      annual_billing_configured: annualBillingConfigured,
      payment_gateway: {
        provider: 'cashfree',
        environment: getEffectivePaymentEnvironment(),
        cashfree_configured: cfCreds.configured,
        operational: isBillingOperational(),
      },
    });
  });

  // Public contact inquiry submission
  app.post('/api/public/contact', contactRateLimiter, (req: Request, res: Response) => {
    const { name, email, company, message } = req.body ?? {};
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 120) {
      res.status(400).json({ error: 'Please provide your name (up to 120 characters).' });
      return;
    }
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 180) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }
    if (typeof message !== 'string' || message.trim().length < 10 || message.trim().length > 3000) {
      res.status(400).json({ error: 'Please include a message between 10 and 3000 characters.' });
      return;
    }
    const cleanCompany = typeof company === 'string' ? company.trim().slice(0, 120) : '';
    const id = createId('inq');
    db.prepare(
      `INSERT INTO contact_inquiries (id, name, email, company, message, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, name.trim(), email.trim(), cleanCompany || null, message.trim(), new Date().toISOString());

    res.status(201).json({ success: true, id });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const dailyLimit = getDailyLimitForUser(user);
    const todayUsed = getTodayUsageCount(user.id);
    res.json({
      user,
      usage: {
        today_requests: todayUsed,
        daily_limit: dailyLimit,
        remaining_today: Math.max(0, dailyLimit - todayUsed),
      },
    });
  });

  app.post('/api/auth/logout', (_req: Request, res: Response) => {
    res.json({ success: true });
  });

  // ===================== BILLING & CHECKOUT ROUTES =====================
  app.get('/api/billing/summary', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const plans = getSubscriptionPlans(false);
    const currentPlan =
      getSubscriptionPlanById(user.plan) || plans.find((p) => p.id === 'free') || plans[0];
    const activeSub = getActiveSubscriptionForUser(user.id);
    const billingCfg = getBillingConfig();
    const cfCreds = getCashfreeCredentials();

    const orders = db
      .prepare('SELECT * FROM payment_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 25')
      .all(user.id) as Record<string, unknown>[];

    const invoices = db
      .prepare('SELECT * FROM invoices WHERE user_id = ? ORDER BY issued_at DESC LIMIT 25')
      .all(user.id) as Record<string, unknown>[];

    const monthlyCreditsUsed = getMonthlyCreditsUsed(user.id);
    const monthlyCreditsLimit =
      activeSub && activeSub.plan_id === user.plan
        ? activeSub.agreed_monthly_credits
        : currentPlan.monthly_credits;

    res.json({
      current_plan: currentPlan,
      active_subscription: activeSub,
      plans,
      monthly_credits_used: monthlyCreditsUsed,
      monthly_credits_limit: monthlyCreditsLimit,
      payment_gateway: {
        provider: 'cashfree',
        environment: getEffectivePaymentEnvironment(),
        cashfree_configured: cfCreds.configured,
        production_payments_enabled: billingCfg.production_payments_enabled,
        operational: isBillingOperational(),
        supported_currencies: billingCfg.supported_currencies,
        enabled_payment_methods: billingCfg.enabled_payment_methods,
      },
      orders: orders.map(mapOrderRow),
      invoices: invoices.map(mapInvoiceRow),
    });
  });

  app.post('/api/billing/checkout', requireAuth, billingRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const { plan_id, billing_cycle } = req.body ?? {};

    if (plan_id !== 'starter' && plan_id !== 'pro' && plan_id !== 'business') {
      res.status(400).json({ error: 'Please select a valid paid plan (Starter, Pro, or Business).' });
      return;
    }

    const cycle: BillingCycle = billing_cycle === 'annual' ? 'annual' : 'monthly';
    const plan = getSubscriptionPlanById(plan_id);
    if (!plan || !plan.is_active) {
      res.status(404).json({ error: 'Selected plan was not found in the server catalog.' });
      return;
    }

    try {
      const result = await initiateCashfreeCheckoutSession({
        user,
        plan,
        billingCycle: cycle,
        appBaseUrl: getAppBaseUrl(),
      });
      res.status(result.cashfreeConfigured ? 201 : 200).json(result);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Unable to initiate checkout session.',
      });
    }
  });

  app.get('/api/billing/orders/:orderId/verify', requireAuth, billingRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await verifyCashfreeOrderWithGateway(req.params.orderId, req.user!.id);
      res.json(result);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Unable to verify payment order.',
      });
    }
  });

  app.post('/api/billing/downgrade-free', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const now = new Date().toISOString();
    const tx = db.transaction(() => {
      db.prepare("UPDATE subscriptions SET status = 'cancelled', updated_at = ? WHERE user_id = ? AND status = 'active'").run(
        now,
        user.id
      );
      db.prepare("UPDATE users SET plan = 'free', updated_at = ? WHERE id = ?").run(now, user.id);
    });
    tx();
    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as Record<string, unknown>;
    res.json({ user: mapUserRow(updated), message: 'Workspace switched to the Free plan.' });
  });

  // Verified Cashfree Payment Webhook (never trusts unverified payloads or browser redirects)
  app.post('/api/webhooks/cashfree', (req: RawBodyRequest, res: Response) => {
    const signature = req.header('x-webhook-signature');
    const timestamp = req.header('x-webhook-timestamp');
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body ?? {}), 'utf8');

    if (!verifyCashfreeWebhookSignature(rawBody, signature, timestamp)) {
      res.status(401).json({ error: 'Invalid webhook signature.' });
      return;
    }

    const eventData = req.body?.data ?? {};
    const orderInfo = eventData.order ?? {};
    const paymentInfo = eventData.payment ?? {};
    const orderId = typeof orderInfo.order_id === 'string' ? orderInfo.order_id : '';

    if (!orderId) {
      res.status(400).json({ error: 'Missing order_id in webhook payload.' });
      return;
    }

    const orderRow = db.prepare('SELECT * FROM payment_orders WHERE id = ?').get(orderId) as
      | Record<string, unknown>
      | undefined;
    if (!orderRow) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    const order = mapOrderRow(orderRow);
    const paymentStatus = String(paymentInfo.payment_status || '').toUpperCase();
    const paidPaise = Math.round(Number(orderInfo.order_amount || paymentInfo.payment_amount || 0) * 100);
    const orderCurrency = String(orderInfo.order_currency || '').toUpperCase();

    if (
      paymentStatus === 'SUCCESS' &&
      paidPaise === order.amount_paise &&
      orderCurrency === order.currency.toUpperCase()
    ) {
      activateSubscriptionFromVerifiedOrder({
        orderId: order.id,
        gatewayPaymentId: paymentInfo.cf_payment_id ? String(paymentInfo.cf_payment_id) : null,
        sourceNote: 'Confirmed via signed Cashfree payment webhook',
      });
      res.json({ received: true, status: 'activated' });
      return;
    }

    if (paymentStatus === 'FAILED' || paymentStatus === 'USER_DROPPED') {
      db.prepare('UPDATE payment_orders SET status = ?, status_note = ?, updated_at = ? WHERE id = ?').run(
        'failed',
        `Cashfree webhook payment status: ${paymentStatus}`,
        new Date().toISOString(),
        order.id
      );
    }

    res.json({ received: true });
  });

  // Authenticated Agents
  app.get('/api/agents', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
    const rows = db.prepare('SELECT * FROM agents WHERE is_active = 1 ORDER BY created_at ASC, name ASC').all() as Record<
      string,
      unknown
    >[];
    res.json({ agents: rows.map(mapAgentRow) });
  });

  app.get('/api/agents/:slug', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const row = db
      .prepare('SELECT * FROM agents WHERE slug = ? AND is_active = 1')
      .get(req.params.slug) as Record<string, unknown> | undefined;
    if (!row) {
      res.status(404).json({ error: 'Agent not found or currently unavailable.' });
      return;
    }
    res.json({ agent: mapAgentRow(row) });
  });

  // Conversations (strictly scoped by user_id)
  app.get('/api/conversations', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const agentSlug = typeof req.query.agentSlug === 'string' ? req.query.agentSlug.trim() : '';
    const query = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

    let sql = `
      SELECT c.*, a.name AS agent_name, a.slug AS agent_slug, a.icon AS agent_icon, a.accent_color AS agent_accent_color,
        (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
      FROM conversations c
      JOIN agents a ON a.id = c.agent_id
      WHERE c.user_id = ?
    `;
    const params: unknown[] = [userId];

    if (agentSlug) {
      sql += ' AND a.slug = ?';
      params.push(agentSlug);
    }
    if (query) {
      sql += ' AND LOWER(c.title) LIKE ?';
      params.push(`%${query}%`);
    }

    sql += ' ORDER BY c.updated_at DESC';
    const rows = db.prepare(sql).all(...params);
    res.json({ conversations: rows });
  });

  app.post('/api/conversations', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { agent_id, agent_slug, title } = req.body ?? {};

    let agentRow: Record<string, unknown> | undefined;
    if (typeof agent_id === 'string' && agent_id) {
      agentRow = db.prepare('SELECT * FROM agents WHERE id = ? AND is_active = 1').get(agent_id) as
        | Record<string, unknown>
        | undefined;
    } else if (typeof agent_slug === 'string' && agent_slug) {
      agentRow = db.prepare('SELECT * FROM agents WHERE slug = ? AND is_active = 1').get(agent_slug) as
        | Record<string, unknown>
        | undefined;
    }

    if (!agentRow) {
      res.status(404).json({ error: 'Selected AI agent was not found or is inactive.' });
      return;
    }

    const now = new Date().toISOString();
    const convId = createId('conv');
    const cleanTitle =
      typeof title === 'string' && title.trim() ? title.trim().slice(0, 120) : 'New conversation';

    db.prepare(
      `INSERT INTO conversations (id, user_id, agent_id, title, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(convId, userId, String(agentRow.id), cleanTitle, now, now);

    const created = db
      .prepare(
        `SELECT c.*, a.name AS agent_name, a.slug AS agent_slug, a.icon AS agent_icon, a.accent_color AS agent_accent_color
         FROM conversations c
         JOIN agents a ON a.id = c.agent_id
         WHERE c.id = ? AND c.user_id = ?`
      )
      .get(convId, userId);

    res.status(201).json({ conversation: created });
  });

  app.get('/api/conversations/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const conv = db
      .prepare(
        `SELECT c.*, a.name AS agent_name, a.slug AS agent_slug, a.icon AS agent_icon, a.accent_color AS agent_accent_color
         FROM conversations c
         JOIN agents a ON a.id = c.agent_id
         WHERE c.id = ? AND c.user_id = ?`
      )
      .get(req.params.id, userId);

    if (!conv) {
      res.status(404).json({ error: 'Conversation not found.' });
      return;
    }

    const messages = db
      .prepare('SELECT * FROM messages WHERE conversation_id = ? AND user_id = ? ORDER BY created_at ASC')
      .all(req.params.id, userId);

    res.json({ conversation: conv, messages });
  });

  app.patch('/api/conversations/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { title } = req.body ?? {};
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 120) {
      res.status(400).json({ error: 'Conversation title must be between 1 and 120 characters.' });
      return;
    }
    const result = db
      .prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?')
      .run(title.trim(), new Date().toISOString(), req.params.id, userId);

    if (result.changes === 0) {
      res.status(404).json({ error: 'Conversation not found.' });
      return;
    }
    const updated = db.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?').get(req.params.id, userId);
    res.json({ conversation: updated });
  });

  app.delete('/api/conversations/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const result = db.prepare('DELETE FROM conversations WHERE id = ? AND user_id = ?').run(req.params.id, userId);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Conversation not found.' });
      return;
    }
    res.json({ success: true });
  });

  // SSE helper
  function setupSse(res: Response) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
  }

  function writeSseEvent(res: Response, event: string, data: unknown) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  // Send message to agent (real multi-turn streaming via Gemini)
  app.post('/api/conversations/:id/messages', requireAuth, aiRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const conversationId = req.params.id;
    const { content } = req.body ?? {};

    if (typeof content !== 'string' || !content.trim() || content.trim().length > 12000) {
      res.status(400).json({ error: 'Message must be between 1 and 12,000 characters.' });
      return;
    }

    const sysConfig = getSystemConfig();
    if (sysConfig.maintenance_mode && user.role !== 'admin') {
      res.status(503).json({ error: 'ORBITA AI is temporarily undergoing scheduled maintenance. Please try again shortly.' });
      return;
    }

    const convRow = db
      .prepare(
        `SELECT c.*, a.system_instruction, a.is_active, a.id AS joined_agent_id
         FROM conversations c
         JOIN agents a ON a.id = c.agent_id
         WHERE c.id = ? AND c.user_id = ?`
      )
      .get(conversationId, user.id) as Record<string, unknown> | undefined;

    if (!convRow) {
      res.status(404).json({ error: 'Conversation not found.' });
      return;
    }
    if (!convRow.is_active) {
      res.status(403).json({ error: 'This AI agent is currently paused by an administrator.' });
      return;
    }

    const dailyLimit = getDailyLimitForUser(user);
    const usedToday = getTodayUsageCount(user.id);
    if (usedToday >= dailyLimit) {
      res.status(429).json({
        error: `Daily allowance reached (${usedToday}/${dailyLimit} requests on your ${user.plan} plan).`,
      });
      return;
    }

    if (!isGeminiConfigured()) {
      res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured on the server. Add your Gemini API key in Settings > Secrets to run AI agents.',
      });
      return;
    }

    const priorMessages = db
      .prepare('SELECT * FROM messages WHERE conversation_id = ? AND user_id = ? ORDER BY created_at ASC')
      .all(conversationId, user.id) as Message[];

    const userText = content.trim();
    const userMsgId = createId('msg');
    const userMsgTime = new Date().toISOString();

    db.prepare(
      `INSERT INTO messages (id, conversation_id, user_id, role, content, model, tokens_used, created_at)
       VALUES (?, ?, ?, 'user', ?, NULL, 0, ?)`
    ).run(userMsgId, conversationId, user.id, userText, userMsgTime);

    const nextTitle =
      priorMessages.length === 0 && String(convRow.title) === 'New conversation'
        ? deriveConversationTitle(userText)
        : String(convRow.title);

    db.prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?').run(
      nextTitle,
      userMsgTime,
      conversationId,
      user.id
    );

    setupSse(res);
    writeSseEvent(res, 'meta', {
      userMessage: {
        id: userMsgId,
        conversation_id: conversationId,
        user_id: user.id,
        role: 'user',
        content: userText,
        model: null,
        tokens_used: 0,
        created_at: userMsgTime,
      },
      conversationTitle: nextTitle,
    });

    try {
      const result = await streamAgentResponse({
        systemInstruction: String(convRow.system_instruction),
        historyMessages: priorMessages,
        userMessage: userText,
        onChunk: (delta) => {
          writeSseEvent(res, 'chunk', { delta });
        },
      });

      const assistantMsgId = createId('msg');
      const assistantTime = new Date().toISOString();
      const approxTokens = Math.ceil((userText.length + result.fullText.length) / 4);

      db.prepare(
        `INSERT INTO messages (id, conversation_id, user_id, role, content, model, tokens_used, created_at)
         VALUES (?, ?, ?, 'assistant', ?, ?, ?, ?)`
      ).run(assistantMsgId, conversationId, user.id, result.fullText, result.model, approxTokens, assistantTime);

      db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ? AND user_id = ?').run(
        assistantTime,
        conversationId,
        user.id
      );

      db.prepare(
        `INSERT INTO usage_records (id, user_id, agent_id, usage_type, usage_amount, tokens_used, created_at)
         VALUES (?, ?, ?, 'chat_message', 1, ?, ?)`
      ).run(createId('usg'), user.id, String(convRow.joined_agent_id), approxTokens, assistantTime);

      writeSseEvent(res, 'done', {
        assistantMessage: {
          id: assistantMsgId,
          conversation_id: conversationId,
          user_id: user.id,
          role: 'assistant',
          content: result.fullText,
          model: result.model,
          tokens_used: approxTokens,
          created_at: assistantTime,
        },
      });
      res.end();
    } catch (err) {
      const friendly = formatFriendlyGeminiError(err);
      writeSseEvent(res, 'error', { message: friendly.message, status: friendly.status });
      res.end();
    }
  });

  // Regenerate last assistant response in conversation
  app.post('/api/conversations/:id/regenerate', requireAuth, aiRateLimiter, async (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const conversationId = req.params.id;

    const convRow = db
      .prepare(
        `SELECT c.*, a.system_instruction, a.is_active, a.id AS joined_agent_id
         FROM conversations c
         JOIN agents a ON a.id = c.agent_id
         WHERE c.id = ? AND c.user_id = ?`
      )
      .get(conversationId, user.id) as Record<string, unknown> | undefined;

    if (!convRow) {
      res.status(404).json({ error: 'Conversation not found.' });
      return;
    }

    const dailyLimit = getDailyLimitForUser(user);
    const usedToday = getTodayUsageCount(user.id);
    if (usedToday >= dailyLimit) {
      res.status(429).json({
        error: `Daily allowance reached (${usedToday}/${dailyLimit} requests on your ${user.plan} plan).`,
      });
      return;
    }

    if (!isGeminiConfigured()) {
      res.status(503).json({
        error: 'GEMINI_API_KEY is not configured on the server.',
      });
      return;
    }

    const allMessages = db
      .prepare('SELECT * FROM messages WHERE conversation_id = ? AND user_id = ? ORDER BY created_at ASC')
      .all(conversationId, user.id) as Message[];

    if (allMessages.length === 0) {
      res.status(400).json({ error: 'No messages to regenerate yet.' });
      return;
    }

    const lastMessage = allMessages[allMessages.length - 1];
    let targetUserMsg: Message | undefined;
    let historyBeforeTarget: Message[] = [];

    if (lastMessage.role === 'assistant') {
      db.prepare('DELETE FROM messages WHERE id = ? AND user_id = ?').run(lastMessage.id, user.id);
      const remaining = allMessages.slice(0, -1);
      targetUserMsg = [...remaining].reverse().find((m) => m.role === 'user');
      if (targetUserMsg) {
        const idx = remaining.findIndex((m) => m.id === targetUserMsg!.id);
        historyBeforeTarget = remaining.slice(0, idx);
      }
    } else {
      targetUserMsg = lastMessage;
      historyBeforeTarget = allMessages.slice(0, -1);
    }

    if (!targetUserMsg) {
      res.status(400).json({ error: 'No user prompt found to regenerate from.' });
      return;
    }

    setupSse(res);

    try {
      const result = await streamAgentResponse({
        systemInstruction: String(convRow.system_instruction),
        historyMessages: historyBeforeTarget,
        userMessage: targetUserMsg.content,
        onChunk: (delta) => {
          writeSseEvent(res, 'chunk', { delta });
        },
      });

      const assistantMsgId = createId('msg');
      const assistantTime = new Date().toISOString();
      const approxTokens = Math.ceil((targetUserMsg.content.length + result.fullText.length) / 4);

      db.prepare(
        `INSERT INTO messages (id, conversation_id, user_id, role, content, model, tokens_used, created_at)
         VALUES (?, ?, ?, 'assistant', ?, ?, ?, ?)`
      ).run(assistantMsgId, conversationId, user.id, result.fullText, result.model, approxTokens, assistantTime);

      db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ? AND user_id = ?').run(
        assistantTime,
        conversationId,
        user.id
      );

      db.prepare(
        `INSERT INTO usage_records (id, user_id, agent_id, usage_type, usage_amount, tokens_used, created_at)
         VALUES (?, ?, ?, 'regenerate', 1, ?, ?)`
      ).run(createId('usg'), user.id, String(convRow.joined_agent_id), approxTokens, assistantTime);

      writeSseEvent(res, 'done', {
        assistantMessage: {
          id: assistantMsgId,
          conversation_id: conversationId,
          user_id: user.id,
          role: 'assistant',
          content: result.fullText,
          model: result.model,
          tokens_used: approxTokens,
          created_at: assistantTime,
        },
      });
      res.end();
    } catch (err) {
      const friendly = formatFriendlyGeminiError(err);
      writeSseEvent(res, 'error', { message: friendly.message, status: friendly.status });
      res.end();
    }
  });

  // Saved Outputs
  app.get('/api/saved-outputs', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const agentSlug = typeof req.query.agentSlug === 'string' ? req.query.agentSlug.trim() : '';
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

    let sql = `
      SELECT s.*, a.name AS agent_name, a.slug AS agent_slug, a.accent_color AS agent_accent_color
      FROM saved_outputs s
      JOIN agents a ON a.id = s.agent_id
      WHERE s.user_id = ?
    `;
    const params: unknown[] = [userId];

    if (agentSlug) {
      sql += ' AND a.slug = ?';
      params.push(agentSlug);
    }
    if (q) {
      sql += ' AND (LOWER(s.title) LIKE ? OR LOWER(s.content) LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }
    sql += ' ORDER BY s.created_at DESC';
    const items = db.prepare(sql).all(...params);
    res.json({ savedOutputs: items });
  });

  app.post('/api/saved-outputs', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { agent_id, conversation_id, title, content } = req.body ?? {};

    if (typeof title !== 'string' || !title.trim() || title.trim().length > 160) {
      res.status(400).json({ error: 'Please provide a title (1–160 characters).' });
      return;
    }
    if (typeof content !== 'string' || !content.trim()) {
      res.status(400).json({ error: 'Output content cannot be empty.' });
      return;
    }

    const agentExists = db.prepare('SELECT id FROM agents WHERE id = ?').get(agent_id);
    if (!agentExists) {
      res.status(400).json({ error: 'Valid agent_id is required.' });
      return;
    }

    let validConvId: string | null = null;
    if (typeof conversation_id === 'string' && conversation_id) {
      const convOwned = db
        .prepare('SELECT id FROM conversations WHERE id = ? AND user_id = ?')
        .get(conversation_id, userId) as { id: string } | undefined;
      if (convOwned) validConvId = convOwned.id;
    }

    const id = createId('sav');
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO saved_outputs (id, user_id, agent_id, conversation_id, title, content, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, userId, agent_id, validConvId, title.trim(), content.trim(), now);

    const created = db
      .prepare(
        `SELECT s.*, a.name AS agent_name, a.slug AS agent_slug, a.accent_color AS agent_accent_color
         FROM saved_outputs s
         JOIN agents a ON a.id = s.agent_id
         WHERE s.id = ? AND s.user_id = ?`
      )
      .get(id, userId);

    res.status(201).json({ savedOutput: created });
  });

  app.delete('/api/saved-outputs/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const result = db
      .prepare('DELETE FROM saved_outputs WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user!.id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Saved output not found.' });
      return;
    }
    res.json({ success: true });
  });

  // Prompt Library
  app.get('/api/prompts', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const rows = db
      .prepare(
        `SELECT * FROM prompt_templates
         WHERE is_platform = 1 OR user_id = ?
         ORDER BY is_platform ASC, created_at DESC`
      )
      .all(userId) as Record<string, unknown>[];

    res.json({
      prompts: rows.map((r) => ({
        id: String(r.id),
        user_id: r.user_id ? String(r.user_id) : null,
        title: String(r.title),
        category: String(r.category),
        prompt: String(r.prompt),
        is_platform: Boolean(r.is_platform),
        created_at: String(r.created_at),
      })),
    });
  });

  app.post('/api/prompts', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { title, category, prompt } = req.body ?? {};
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 140) {
      res.status(400).json({ error: 'Prompt title must be 1–140 characters.' });
      return;
    }
    if (typeof category !== 'string' || !category.trim()) {
      res.status(400).json({ error: 'Please select a category.' });
      return;
    }
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.trim().length > 4000) {
      res.status(400).json({ error: 'Prompt text must be 1–4000 characters.' });
      return;
    }

    const id = createId('prm');
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO prompt_templates (id, user_id, title, category, prompt, is_platform, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?)`
    ).run(id, req.user!.id, title.trim(), category.trim(), prompt.trim(), now);

    res.status(201).json({
      prompt: {
        id,
        user_id: req.user!.id,
        title: title.trim(),
        category: category.trim(),
        prompt: prompt.trim(),
        is_platform: false,
        created_at: now,
      },
    });
  });

  app.patch('/api/prompts/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { title, category, prompt } = req.body ?? {};
    if (typeof title !== 'string' || !title.trim() || typeof category !== 'string' || typeof prompt !== 'string' || !prompt.trim()) {
      res.status(400).json({ error: 'Valid title, category, and prompt are required.' });
      return;
    }
    const result = db
      .prepare(
        `UPDATE prompt_templates
         SET title = ?, category = ?, prompt = ?
         WHERE id = ? AND user_id = ? AND is_platform = 0`
      )
      .run(title.trim().slice(0, 140), category.trim(), prompt.trim().slice(0, 4000), req.params.id, req.user!.id);

    if (result.changes === 0) {
      res.status(404).json({ error: 'Personal prompt not found.' });
      return;
    }
    res.json({ success: true });
  });

  app.delete('/api/prompts/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const result = db
      .prepare('DELETE FROM prompt_templates WHERE id = ? AND user_id = ? AND is_platform = 0')
      .run(req.params.id, req.user!.id);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Personal prompt not found.' });
      return;
    }
    res.json({ success: true });
  });

  // Usage Analytics (real records strictly scoped to current user)
  app.get('/api/usage', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const totalRow = db
      .prepare('SELECT COALESCE(SUM(usage_amount), 0) AS total FROM usage_records WHERE user_id = ?')
      .get(user.id) as { total: number };
    const todayRequests = getTodayUsageCount(user.id);
    const dailyLimit = getDailyLimitForUser(user);

    const byAgent = db
      .prepare(
        `SELECT a.id AS agent_id, a.name AS agent_name, a.slug AS agent_slug, a.accent_color,
                COALESCE(SUM(u.usage_amount), 0) AS request_count
         FROM agents a
         LEFT JOIN usage_records u ON u.agent_id = a.id AND u.user_id = ?
         GROUP BY a.id
         ORDER BY request_count DESC, a.name ASC`
      )
      .all(user.id);

    const recentActivity = db
      .prepare(
        `SELECT u.*, a.name AS agent_name, a.slug AS agent_slug
         FROM usage_records u
         JOIN agents a ON a.id = u.agent_id
         WHERE u.user_id = ?
         ORDER BY u.created_at DESC
         LIMIT 30`
      )
      .all(user.id);

    res.json({
      total_requests: Number(totalRow?.total || 0),
      today_requests: todayRequests,
      daily_limit: dailyLimit,
      remaining_today: Math.max(0, dailyLimit - todayRequests),
      plan: user.plan,
      by_agent: byAgent,
      recent_activity: recentActivity,
    });
  });

  // Notifications
  app.get('/api/notifications', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const todayRequests = getTodayUsageCount(user.id);
    const dailyLimit = getDailyLimitForUser(user);
    const notifications = [];

    if (todayRequests >= dailyLimit) {
      notifications.push({
        id: 'notif-limit-reached',
        title: 'Daily request allowance reached',
        message: `You have used ${todayRequests} of ${dailyLimit} daily requests on the ${user.plan} plan.`,
        type: 'warning',
        created_at: new Date().toISOString(),
      });
    } else if (dailyLimit > 0 && todayRequests >= Math.floor(dailyLimit * 0.8)) {
      notifications.push({
        id: 'notif-limit-near',
        title: 'Approaching daily allowance',
        message: `You have used ${todayRequests} of ${dailyLimit} daily requests today.`,
        type: 'info',
        created_at: new Date().toISOString(),
      });
    }

    const feedbackRows = db
      .prepare('SELECT id, category, status, created_at FROM feedback WHERE user_id = ? ORDER BY created_at DESC LIMIT 5')
      .all(user.id) as Array<{ id: string; category: string; status: string; created_at: string }>;

    for (const fb of feedbackRows) {
      if (fb.status !== 'open') {
        notifications.push({
          id: `notif-fb-${fb.id}`,
          title: `Feedback marked ${fb.status}`,
          message: `Your ${fb.category} feedback submission was updated to "${fb.status}".`,
          type: fb.status === 'resolved' ? 'success' : 'info',
          created_at: fb.created_at,
        });
      }
    }

    notifications.push({
      id: 'notif-welcome',
      title: 'Welcome to ORBITA AI',
      message: 'Your account is connected and all six specialized AI agents are ready inside your workspace.',
      type: 'success',
      created_at: user.created_at,
    });

    res.json({ notifications });
  });

  // Profile & Account Settings
  app.patch('/api/profile', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.user!;
    const { name, theme_preference, notifications_enabled } = req.body ?? {};

    const nextName =
      typeof name === 'string' && name.trim().length > 0 ? name.trim().slice(0, 100) : user.name;
    const nextTheme =
      theme_preference === 'light' || theme_preference === 'dark' || theme_preference === 'system'
        ? theme_preference
        : user.theme_preference;
    const nextNotif =
      typeof notifications_enabled === 'boolean' ? (notifications_enabled ? 1 : 0) : user.notifications_enabled ? 1 : 0;

    const now = new Date().toISOString();
    db.prepare(
      `UPDATE users
       SET name = ?, theme_preference = ?, notifications_enabled = ?, updated_at = ?
       WHERE id = ?`
    ).run(nextName, nextTheme, nextNotif, now, user.id);

    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as Record<string, unknown>;
    res.json({ user: mapUserRow(updated) });
  });

  app.delete('/api/profile', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    res.json({ success: true });
  });

  // User Feedback
  app.get('/api/feedback', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const rows = db
      .prepare('SELECT * FROM feedback WHERE user_id = ? ORDER BY created_at DESC')
      .all(req.user!.id);
    res.json({ feedback: rows });
  });

  app.post('/api/feedback', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { category, message } = req.body ?? {};
    if (typeof category !== 'string' || !category.trim()) {
      res.status(400).json({ error: 'Please select a feedback category.' });
      return;
    }
    if (typeof message !== 'string' || message.trim().length < 5 || message.trim().length > 3000) {
      res.status(400).json({ error: 'Feedback message must be 5–3000 characters.' });
      return;
    }
    const id = createId('fb');
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO feedback (id, user_id, category, message, status, created_at)
       VALUES (?, ?, ?, ?, 'open', ?)`
    ).run(id, req.user!.id, category.trim().slice(0, 60), message.trim(), now);

    res.status(201).json({
      item: {
        id,
        user_id: req.user!.id,
        category: category.trim(),
        message: message.trim(),
        status: 'open',
        admin_notes: null,
        created_at: now,
      },
    });
  });

  // ===================== ADMIN ROUTES =====================
  app.get('/api/admin/overview', requireAuth, requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
    const counts = {
      total_users: (db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c,
      total_conversations: (db.prepare('SELECT COUNT(*) AS c FROM conversations').get() as { c: number }).c,
      total_messages: (db.prepare('SELECT COUNT(*) AS c FROM messages').get() as { c: number }).c,
      total_saved_outputs: (db.prepare('SELECT COUNT(*) AS c FROM saved_outputs').get() as { c: number }).c,
      total_requests: (
        db.prepare('SELECT COALESCE(SUM(usage_amount), 0) AS c FROM usage_records').get() as { c: number }
      ).c,
      open_feedback: (db.prepare("SELECT COUNT(*) AS c FROM feedback WHERE status = 'open'").get() as { c: number }).c,
      contact_inquiries: (db.prepare('SELECT COUNT(*) AS c FROM contact_inquiries').get() as { c: number }).c,
    };

    const auditLogs = db
      .prepare(
        `SELECT l.*, u.email AS admin_email
         FROM admin_audit_logs l
         JOIN users u ON u.id = l.admin_user_id
         ORDER BY l.created_at DESC
         LIMIT 20`
      )
      .all();

    res.json({
      counts,
      system_config: getSystemConfig(),
      config_status: {
        gemini_configured: isGeminiConfigured(),
        firebase_auth_configured: isFirebaseAuthConfigured(),
        admin_email_configured: true,
        billing_provider_configured: getCashfreeCredentials().configured,
        cashfree_configured: getCashfreeCredentials().configured,
        payment_environment: getEffectivePaymentEnvironment(),
        production_payments_enabled: getBillingConfig().production_payments_enabled,
        app_url: getAppBaseUrl(),
      },
      audit_logs: auditLogs,
    });
  });

  app.get('/api/admin/users', requireAuth, requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
    const rows = db
      .prepare(
        `SELECT u.id, u.name, u.email, u.profile_image, u.role, u.plan, u.created_at, u.updated_at,
                (SELECT COUNT(*) FROM conversations c WHERE c.user_id = u.id) AS conversation_count,
                (SELECT COALESCE(SUM(r.usage_amount), 0) FROM usage_records r WHERE r.user_id = u.id) AS request_count
         FROM users u
         ORDER BY u.created_at DESC`
      )
      .all();
    res.json({ users: rows });
  });

  app.patch('/api/admin/users/:id', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const targetId = req.params.id;
    const { role, plan } = req.body ?? {};
    const target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as Record<string, unknown> | undefined;
    if (!target) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const nextRole = role === 'admin' || role === 'user' ? role : String(target.role);
    const nextPlan =
      plan === 'free' || plan === 'starter' || plan === 'pro' || plan === 'business'
        ? plan
        : String(target.plan);

    if (targetId === req.user!.id && nextRole !== 'admin') {
      res.status(400).json({ error: 'You cannot remove your own administrator role.' });
      return;
    }

    db.prepare('UPDATE users SET role = ?, plan = ?, updated_at = ? WHERE id = ?').run(
      nextRole,
      nextPlan,
      new Date().toISOString(),
      targetId
    );

    recordAdminAudit(
      req.user!.id,
      'update_user_access',
      'user',
      targetId,
      `role=${nextRole}, plan=${nextPlan}`
    );

    res.json({ success: true });
  });

  app.get('/api/admin/agents', requireAuth, requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
    const rows = db.prepare('SELECT * FROM agents ORDER BY created_at ASC, name ASC').all() as Record<
      string,
      unknown
    >[];
    res.json({ agents: rows.map(mapAgentRow) });
  });

  app.patch('/api/admin/agents/:id', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const target = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id) as
      | Record<string, unknown>
      | undefined;
    if (!target) {
      res.status(404).json({ error: 'Agent not found.' });
      return;
    }

    const { is_active, tagline, description, system_instruction } = req.body ?? {};
    const nextActive = typeof is_active === 'boolean' ? (is_active ? 1 : 0) : Number(target.is_active);
    const nextTagline =
      typeof tagline === 'string' && tagline.trim() ? tagline.trim().slice(0, 180) : String(target.tagline);
    const nextDesc =
      typeof description === 'string' && description.trim()
        ? description.trim().slice(0, 600)
        : String(target.description);
    const nextInstr =
      typeof system_instruction === 'string' && system_instruction.trim()
        ? system_instruction.trim().slice(0, 8000)
        : String(target.system_instruction);

    db.prepare(
      `UPDATE agents
       SET is_active = ?, tagline = ?, description = ?, system_instruction = ?
       WHERE id = ?`
    ).run(nextActive, nextTagline, nextDesc, nextInstr, req.params.id);

    recordAdminAudit(
      req.user!.id,
      'update_agent',
      'agent',
      req.params.id,
      `is_active=${Boolean(nextActive)}`
    );

    const updated = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id) as Record<string, unknown>;
    res.json({ agent: mapAgentRow(updated) });
  });

  app.get('/api/admin/usage', requireAuth, requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
    const byAgent = db
      .prepare(
        `SELECT a.id AS agent_id, a.name AS agent_name, a.slug AS agent_slug, a.accent_color,
                COALESCE(SUM(u.usage_amount), 0) AS request_count,
                COALESCE(SUM(u.tokens_used), 0) AS tokens_used
         FROM agents a
         LEFT JOIN usage_records u ON u.agent_id = a.id
         GROUP BY a.id
         ORDER BY request_count DESC`
      )
      .all();

    const recentUsage = db
      .prepare(
        `SELECT r.id, r.usage_type, r.usage_amount, r.tokens_used, r.created_at,
                a.name AS agent_name, u.email AS user_email
         FROM usage_records r
         JOIN agents a ON a.id = r.agent_id
         JOIN users u ON u.id = r.user_id
         ORDER BY r.created_at DESC
         LIMIT 40`
      )
      .all();

    res.json({ by_agent: byAgent, recent_usage: recentUsage });
  });

  app.get('/api/admin/feedback', requireAuth, requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
    const rows = db
      .prepare(
        `SELECT f.*, u.name AS user_name, u.email AS user_email
         FROM feedback f
         JOIN users u ON u.id = f.user_id
         ORDER BY f.created_at DESC`
      )
      .all();
    res.json({ feedback: rows });
  });

  app.patch('/api/admin/feedback/:id', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const { status, admin_notes } = req.body ?? {};
    if (status !== 'open' && status !== 'reviewed' && status !== 'resolved') {
      res.status(400).json({ error: 'Invalid status value.' });
      return;
    }
    const result = db
      .prepare('UPDATE feedback SET status = ?, admin_notes = ? WHERE id = ?')
      .run(status, typeof admin_notes === 'string' ? admin_notes.trim().slice(0, 1000) : null, req.params.id);

    if (result.changes === 0) {
      res.status(404).json({ error: 'Feedback entry not found.' });
      return;
    }

    recordAdminAudit(req.user!.id, 'update_feedback', 'feedback', req.params.id, `status=${status}`);
    res.json({ success: true });
  });

  app.get('/api/admin/inquiries', requireAuth, requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
    const rows = db.prepare('SELECT * FROM contact_inquiries ORDER BY created_at DESC LIMIT 50').all();
    res.json({ inquiries: rows });
  });

  app.patch('/api/admin/config', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const {
      free_daily_limit,
      starter_daily_limit,
      pro_daily_limit,
      business_daily_limit,
      allow_new_signups,
      maintenance_mode,
    } = req.body ?? {};
    const now = new Date().toISOString();
    const upsert = db.prepare(
      `INSERT INTO system_config (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    );

    if (typeof free_daily_limit === 'number' && free_daily_limit >= 1 && free_daily_limit <= 10000) {
      upsert.run('free_daily_limit', String(Math.floor(free_daily_limit)), now);
    }
    if (typeof starter_daily_limit === 'number' && starter_daily_limit >= 1 && starter_daily_limit <= 25000) {
      upsert.run('starter_daily_limit', String(Math.floor(starter_daily_limit)), now);
    }
    if (typeof pro_daily_limit === 'number' && pro_daily_limit >= 1 && pro_daily_limit <= 50000) {
      upsert.run('pro_daily_limit', String(Math.floor(pro_daily_limit)), now);
    }
    if (typeof business_daily_limit === 'number' && business_daily_limit >= 1 && business_daily_limit <= 100000) {
      upsert.run('business_daily_limit', String(Math.floor(business_daily_limit)), now);
    }
    if (typeof allow_new_signups === 'boolean') {
      upsert.run('allow_new_signups', String(allow_new_signups), now);
    }
    if (typeof maintenance_mode === 'boolean') {
      upsert.run('maintenance_mode', String(maintenance_mode), now);
    }

    recordAdminAudit(req.user!.id, 'update_system_config', 'system_config', 'global', JSON.stringify(getSystemConfig()));
    res.json({ system_config: getSystemConfig() });
  });

  // Admin Plan Catalog & Merchant Billing Configuration
  app.get('/api/admin/billing', requireAuth, requireAdmin, (_req: AuthenticatedRequest, res: Response) => {
    const plans = getSubscriptionPlans(true);
    const billingConfig = getBillingConfig();
    const orders = db
      .prepare(
        `SELECT o.*, u.email AS user_email
         FROM payment_orders o
         JOIN users u ON u.id = o.user_id
         ORDER BY o.created_at DESC
         LIMIT 40`
      )
      .all() as Record<string, unknown>[];
    const invoices = db
      .prepare(
        `SELECT i.*, u.email AS user_email
         FROM invoices i
         JOIN users u ON u.id = i.user_id
         ORDER BY i.issued_at DESC
         LIMIT 40`
      )
      .all() as Record<string, unknown>[];

    res.json({
      plans,
      billing_config: billingConfig,
      cashfree_configured: getCashfreeCredentials().configured,
      effective_environment: getEffectivePaymentEnvironment(),
      operational: isBillingOperational(),
      orders: orders.map(mapOrderRow),
      invoices: invoices.map(mapInvoiceRow),
    });
  });

  app.patch('/api/admin/billing/plans/:id', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const planId = req.params.id;
    const existing = getSubscriptionPlanById(planId);
    if (!existing) {
      res.status(404).json({ error: 'Subscription plan not found.' });
      return;
    }

    const { monthly_price_paise, annual_price_paise, monthly_credits, daily_limit, is_active } = req.body ?? {};
    const nextMonthly =
      typeof monthly_price_paise === 'number' && Number.isInteger(monthly_price_paise) && monthly_price_paise >= 0
        ? monthly_price_paise
        : existing.monthly_price_paise;

    let nextAnnual: number | null = existing.annual_price_paise;
    if (annual_price_paise === null) {
      nextAnnual = null;
    } else if (typeof annual_price_paise === 'number' && Number.isInteger(annual_price_paise) && annual_price_paise > 0) {
      nextAnnual = annual_price_paise;
    }

    const nextCredits =
      typeof monthly_credits === 'number' && Number.isInteger(monthly_credits) && monthly_credits >= 1
        ? monthly_credits
        : existing.monthly_credits;

    const nextDaily =
      typeof daily_limit === 'number' && Number.isInteger(daily_limit) && daily_limit >= 1
        ? daily_limit
        : existing.daily_limit;

    const nextActive = typeof is_active === 'boolean' ? (is_active ? 1 : 0) : existing.is_active ? 1 : 0;
    const now = new Date().toISOString();

    db.prepare(
      `UPDATE subscription_plans
       SET monthly_price_paise = ?, annual_price_paise = ?, monthly_credits = ?, daily_limit = ?, is_active = ?, updated_at = ?
       WHERE id = ?`
    ).run(nextMonthly, nextAnnual, nextCredits, nextDaily, nextActive, now, planId);

    recordAdminAudit(
      req.user!.id,
      'update_plan_pricing',
      'subscription_plan',
      planId,
      `monthly_paise=${nextMonthly}, annual_paise=${nextAnnual ?? 'null'}, credits=${nextCredits}, daily=${nextDaily}`
    );

    res.json({ plan: getSubscriptionPlanById(planId) });
  });

  app.patch('/api/admin/billing/config', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const existing = getBillingConfig();
    const {
      merchant_upi_id,
      supported_currencies,
      enabled_payment_methods,
      payment_environment,
      production_payments_enabled,
      merchant_verified,
      provider_approved,
      legal_requirements_completed,
    } = req.body ?? {};

    const nextUpi =
      typeof merchant_upi_id === 'string' && /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z0-9]{2,32}$/.test(merchant_upi_id.trim())
        ? merchant_upi_id.trim()
        : existing.merchant_upi_id;

    if (typeof merchant_upi_id === 'string' && merchant_upi_id.trim() && nextUpi !== merchant_upi_id.trim()) {
      res.status(400).json({ error: 'Invalid UPI ID format. Example: merchant@bank' });
      return;
    }

    const nextCurrencies =
      Array.isArray(supported_currencies) && supported_currencies.length > 0
        ? supported_currencies
            .map((c) => String(c).trim().toUpperCase())
            .filter((c) => /^[A-Z]{3}$/.test(c))
        : existing.supported_currencies;

    if (nextCurrencies.length === 0) {
      res.status(400).json({ error: 'At least one valid 3-letter currency code (e.g. INR) is required.' });
      return;
    }

    const allowedMethods = new Set(['upi', 'card', 'netbanking']);
    const nextMethods = Array.isArray(enabled_payment_methods)
      ? enabled_payment_methods.map((m) => String(m).trim().toLowerCase()).filter((m) => allowedMethods.has(m))
      : existing.enabled_payment_methods;

    const nextVerified = typeof merchant_verified === 'boolean' ? merchant_verified : existing.merchant_verified;
    const nextApproved = typeof provider_approved === 'boolean' ? provider_approved : existing.provider_approved;
    const nextLegal =
      typeof legal_requirements_completed === 'boolean'
        ? legal_requirements_completed
        : existing.legal_requirements_completed;
    const nextProdEnabled =
      typeof production_payments_enabled === 'boolean'
        ? production_payments_enabled
        : existing.production_payments_enabled;
    const nextEnv = payment_environment === 'production' ? 'production' : payment_environment === 'sandbox' ? 'sandbox' : existing.payment_environment;

    if (nextEnv === 'production' || nextProdEnabled) {
      if (!nextVerified || !nextApproved || !nextLegal || !getCashfreeCredentials().configured) {
        res.status(400).json({
          error:
            'Production payments remain disabled until merchant verification, Cashfree provider approval, legal requirements, and server Cashfree API credentials are completed.',
        });
        return;
      }
    }

    const now = new Date().toISOString();
    db.prepare(
      `UPDATE billing_config
       SET merchant_upi_id = ?, supported_currencies = ?, enabled_payment_methods = ?,
           payment_environment = ?, production_payments_enabled = ?, merchant_verified = ?,
           provider_approved = ?, legal_requirements_completed = ?, updated_at = ?
       WHERE id = 'default'`
    ).run(
      nextUpi,
      JSON.stringify(nextCurrencies),
      JSON.stringify(nextMethods),
      nextEnv,
      nextProdEnabled ? 1 : 0,
      nextVerified ? 1 : 0,
      nextApproved ? 1 : 0,
      nextLegal ? 1 : 0,
      now
    );

    recordAdminAudit(
      req.user!.id,
      'update_billing_config',
      'billing_config',
      'default',
      `env=${nextEnv}, prod_enabled=${nextProdEnabled}, currencies=${nextCurrencies.join(',')}, methods=${nextMethods.join(',')}`
    );

    res.json({ billing_config: getBillingConfig() });
  });

  app.post('/api/admin/billing/orders/:id/reconcile', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const { gateway_payment_id, verification_note } = req.body ?? {};
    if (typeof gateway_payment_id !== 'string' || gateway_payment_id.trim().length < 4) {
      res.status(400).json({ error: 'A verified gateway payment/transaction reference is required.' });
      return;
    }
    try {
      const result = activateSubscriptionFromVerifiedOrder({
        orderId: req.params.id,
        gatewayPaymentId: gateway_payment_id.trim().slice(0, 120),
        sourceNote:
          typeof verification_note === 'string' && verification_note.trim()
            ? `Admin reconciled: ${verification_note.trim()}`
            : `Admin reconciled by ${req.user!.email}`,
      });
      recordAdminAudit(
        req.user!.id,
        'reconcile_payment_order',
        'payment_order',
        req.params.id,
        `gateway_ref=${gateway_payment_id.trim()}`
      );
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Reconciliation failed.' });
    }
  });

  // Frontend middleware / static production serving
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (req: Request, res: Response) => {
      if (req.path.startsWith('/api/')) {
        res.status(404).json({ error: 'Endpoint not found.' });
        return;
      }
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ORBITA AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start ORBITA AI server:', err);
  process.exit(1);
});

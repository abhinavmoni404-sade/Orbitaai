import crypto from 'node:crypto';
import db, { createId, getBillingConfig, getSubscriptionPlanById } from './db.ts';
import type {
  BillingCycle,
  InvoiceRecord,
  PaymentEnvironment,
  PaymentOrder,
  PlanId,
  SubscriptionPlan,
  SubscriptionRecord,
  User,
} from '../src/types/orbita.ts';

const CASHFREE_API_VERSION = '2023-08-01';

export function getCashfreeCredentials(): { appId: string; secretKey: string; configured: boolean } {
  const appId = process.env.CASHFREE_APP_ID?.trim() || '';
  const secretKey = process.env.CASHFREE_SECRET_KEY?.trim() || '';
  return {
    appId,
    secretKey,
    configured: Boolean(appId && secretKey),
  };
}

export function getCashfreeBaseUrl(env: PaymentEnvironment): string {
  return env === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
}

export function getEffectivePaymentEnvironment(): PaymentEnvironment {
  const cfg = getBillingConfig();
  if (
    cfg.payment_environment === 'production' &&
    cfg.production_payments_enabled &&
    cfg.merchant_verified &&
    cfg.provider_approved &&
    cfg.legal_requirements_completed &&
    getCashfreeCredentials().configured
  ) {
    return 'production';
  }
  return 'sandbox';
}

export function isBillingOperational(): boolean {
  const creds = getCashfreeCredentials();
  const cfg = getBillingConfig();
  if (!creds.configured) return false;
  if (cfg.payment_environment === 'production') {
    return (
      cfg.production_payments_enabled &&
      cfg.merchant_verified &&
      cfg.provider_approved &&
      cfg.legal_requirements_completed
    );
  }
  return true;
}

export function mapSubscriptionRow(row: Record<string, unknown>): SubscriptionRecord {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    plan_id: String(row.plan_id) as PlanId,
    billing_cycle: row.billing_cycle === 'annual' ? 'annual' : 'monthly',
    status: row.status === 'pending' || row.status === 'cancelled' ? row.status : 'active',
    agreed_price_paise: Number(row.agreed_price_paise),
    currency: String(row.currency || 'INR'),
    agreed_monthly_credits: Number(row.agreed_monthly_credits),
    agreed_daily_limit: Number(row.agreed_daily_limit),
    payment_order_id: row.payment_order_id ? String(row.payment_order_id) : null,
    started_at: String(row.started_at),
    current_period_end: row.current_period_end ? String(row.current_period_end) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function mapOrderRow(row: Record<string, unknown>): PaymentOrder {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    user_email: row.user_email ? String(row.user_email) : undefined,
    plan_id: String(row.plan_id) as PlanId,
    billing_cycle: row.billing_cycle === 'annual' ? 'annual' : 'monthly',
    amount_paise: Number(row.amount_paise),
    currency: String(row.currency || 'INR'),
    gateway: String(row.gateway || 'cashfree'),
    gateway_order_id: row.gateway_order_id ? String(row.gateway_order_id) : null,
    gateway_payment_id: row.gateway_payment_id ? String(row.gateway_payment_id) : null,
    payment_environment: row.payment_environment === 'production' ? 'production' : 'sandbox',
    status:
      row.status === 'paid' || row.status === 'failed' || row.status === 'cancelled'
        ? row.status
        : 'pending',
    status_note: row.status_note ? String(row.status_note) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function mapInvoiceRow(row: Record<string, unknown>): InvoiceRecord {
  return {
    id: String(row.id),
    invoice_number: String(row.invoice_number),
    user_id: String(row.user_id),
    user_email: row.user_email ? String(row.user_email) : undefined,
    order_id: String(row.order_id),
    plan_id: String(row.plan_id) as PlanId,
    plan_name: String(row.plan_name),
    billing_cycle: row.billing_cycle === 'annual' ? 'annual' : 'monthly',
    amount_paise: Number(row.amount_paise),
    currency: String(row.currency || 'INR'),
    payment_environment: row.payment_environment === 'production' ? 'production' : 'sandbox',
    gateway: String(row.gateway || 'cashfree'),
    gateway_payment_id: row.gateway_payment_id ? String(row.gateway_payment_id) : null,
    status: row.status === 'void' ? 'void' : 'paid',
    issued_at: String(row.issued_at),
  };
}

export function getActiveSubscriptionForUser(userId: string): SubscriptionRecord | null {
  const row = db
    .prepare("SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1")
    .get(userId) as Record<string, unknown> | undefined;
  return row ? mapSubscriptionRow(row) : null;
}

export function resolveCheckoutPricePaise(
  plan: SubscriptionPlan,
  billingCycle: BillingCycle
): { ok: true; amountPaise: number } | { ok: false; error: string } {
  if (!plan.is_active) {
    return { ok: false, error: 'Selected subscription plan is not currently available.' };
  }
  if (plan.id === 'free') {
    return { ok: false, error: 'Free plan does not require a payment checkout.' };
  }
  if (billingCycle === 'annual') {
    if (plan.annual_price_paise === null || plan.annual_price_paise <= 0) {
      return { ok: false, error: `Annual billing is not configured yet for the ${plan.name} plan.` };
    }
    return { ok: true, amountPaise: plan.annual_price_paise };
  }
  if (plan.monthly_price_paise <= 0) {
    return { ok: false, error: `Monthly price is not configured for the ${plan.name} plan.` };
  }
  return { ok: true, amountPaise: plan.monthly_price_paise };
}

function mapCashfreePaymentMethods(enabled: string[]): string | undefined {
  const allowed = new Set<string>();
  for (const method of enabled) {
    if (method === 'upi') allowed.add('upi');
    if (method === 'card') {
      allowed.add('cc');
      allowed.add('dc');
    }
    if (method === 'netbanking') allowed.add('nb');
  }
  return allowed.size > 0 ? Array.from(allowed).join(',') : undefined;
}

export async function initiateCashfreeCheckoutSession(params: {
  user: User;
  plan: SubscriptionPlan;
  billingCycle: BillingCycle;
  appBaseUrl: string;
}): Promise<{
  order: PaymentOrder;
  cashfreeConfigured: boolean;
  paymentSessionId: string | null;
  checkoutUrl: string | null;
  environment: PaymentEnvironment;
  message: string;
}> {
  const { user, plan, billingCycle, appBaseUrl } = params;
  const priceCheck = resolveCheckoutPricePaise(plan, billingCycle);
  if (!priceCheck.ok) {
    throw new Error(priceCheck.error);
  }

  const billingCfg = getBillingConfig();
  const environment = getEffectivePaymentEnvironment();
  const creds = getCashfreeCredentials();
  const now = new Date().toISOString();
  const orderId = `ord_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  // Step 4: Create a pending order with server-derived price in paise
  db.prepare(
    `INSERT INTO payment_orders (
      id, user_id, plan_id, billing_cycle, amount_paise, currency, gateway,
      gateway_order_id, gateway_payment_id, payment_environment, status, status_note, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'cashfree', ?, NULL, ?, 'pending', ?, ?, ?)`
  ).run(
    orderId,
    user.id,
    plan.id,
    billingCycle,
    priceCheck.amountPaise,
    plan.currency,
    orderId,
    environment,
    creds.configured
      ? 'Awaiting Cashfree hosted checkout completion.'
      : 'Cashfree gateway credentials not configured on server; pending order recorded.',
    now,
    now
  );

  const createdRow = db.prepare('SELECT * FROM payment_orders WHERE id = ?').get(orderId) as Record<string, unknown>;
  let order = mapOrderRow(createdRow);

  if (!creds.configured) {
    return {
      order,
      cashfreeConfigured: false,
      paymentSessionId: null,
      checkoutUrl: null,
      environment,
      message:
        'Pending order validated and logged. Cashfree Sandbox credentials (CASHFREE_APP_ID and CASHFREE_SECRET_KEY) must be configured in server Secrets to launch hosted checkout.',
    };
  }

  // Step 5: Create Cashfree Hosted Checkout order on server
  const baseUrl = getCashfreeBaseUrl(environment);
  const amountMajor = Number((priceCheck.amountPaise / 100).toFixed(2));
  const paymentMethods = mapCashfreePaymentMethods(billingCfg.enabled_payment_methods);

  const payload = {
    order_id: orderId,
    order_amount: amountMajor,
    order_currency: plan.currency,
    customer_details: {
      customer_id: user.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48),
      customer_email: user.email,
      customer_phone: '9999999999',
      customer_name: user.name.slice(0, 80),
    },
    order_meta: {
      return_url: `${appBaseUrl}/app/billing?order_id={order_id}`,
      notify_url: `${appBaseUrl}/api/webhooks/cashfree`,
      ...(paymentMethods ? { payment_methods: paymentMethods } : {}),
    },
    order_note: `ORBITA AI ${plan.name} (${billingCycle}) subscription`,
  };

  const cfRes = await fetch(`${baseUrl}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-version': CASHFREE_API_VERSION,
      'x-client-id': creds.appId,
      'x-client-secret': creds.secretKey,
    },
    body: JSON.stringify(payload),
  });

  const cfJson = (await cfRes.json().catch(() => ({}))) as {
    payment_session_id?: string;
    cf_order_id?: string | number;
    message?: string;
    payment_link?: string;
  };

  if (!cfRes.ok || !cfJson.payment_session_id) {
    const errMsg = cfJson.message || `Cashfree session creation failed (HTTP ${cfRes.status}).`;
    db.prepare('UPDATE payment_orders SET status = ?, status_note = ?, updated_at = ? WHERE id = ?').run(
      'failed',
      errMsg.slice(0, 300),
      new Date().toISOString(),
      orderId
    );
    throw new Error(errMsg);
  }

  const cfOrderId = cfJson.cf_order_id ? String(cfJson.cf_order_id) : orderId;
  db.prepare('UPDATE payment_orders SET gateway_order_id = ?, updated_at = ? WHERE id = ?').run(
    cfOrderId,
    new Date().toISOString(),
    orderId
  );
  order = mapOrderRow(db.prepare('SELECT * FROM payment_orders WHERE id = ?').get(orderId) as Record<string, unknown>);

  const hostedBase =
    environment === 'production'
      ? 'https://payments.cashfree.com/forms/pay'
      : 'https://payments-test.cashfree.com/forms/pay';

  return {
    order,
    cashfreeConfigured: true,
    paymentSessionId: cfJson.payment_session_id,
    checkoutUrl: cfJson.payment_link || `${hostedBase}?payment_session_id=${encodeURIComponent(cfJson.payment_session_id)}`,
    environment,
    message: 'Cashfree hosted checkout session ready.',
  };
}

export function verifyCashfreeWebhookSignature(
  rawBody: Buffer,
  signature: string | undefined,
  timestamp: string | undefined
): boolean {
  const creds = getCashfreeCredentials();
  if (!creds.configured || !signature || !timestamp) return false;

  const signedPayload = Buffer.concat([Buffer.from(timestamp, 'utf8'), rawBody]);
  const expected = crypto.createHmac('sha256', creds.secretKey).update(signedPayload).digest('base64');

  const sigBuf = Buffer.from(signature.trim(), 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expBuf);
}

export function activateSubscriptionFromVerifiedOrder(params: {
  orderId: string;
  gatewayPaymentId: string | null;
  sourceNote: string;
}): { order: PaymentOrder; invoice: InvoiceRecord; subscription: SubscriptionRecord } {
  const tx = db.transaction(() => {
    const orderRow = db.prepare('SELECT * FROM payment_orders WHERE id = ?').get(params.orderId) as
      | Record<string, unknown>
      | undefined;
    if (!orderRow) {
      throw new Error('Payment order not found.');
    }

    const existingOrder = mapOrderRow(orderRow);
    const plan = getSubscriptionPlanById(existingOrder.plan_id);
    if (!plan) {
      throw new Error('Referenced plan not found in server catalog.');
    }

    const now = new Date().toISOString();

    // Idempotency: if already marked paid, return existing invoice & active subscription
    if (existingOrder.status === 'paid') {
      const invRow = db.prepare('SELECT * FROM invoices WHERE order_id = ?').get(existingOrder.id) as
        | Record<string, unknown>
        | undefined;
      const subRow = db
        .prepare('SELECT * FROM subscriptions WHERE payment_order_id = ?')
        .get(existingOrder.id) as Record<string, unknown> | undefined;
      if (invRow && subRow) {
        return {
          order: existingOrder,
          invoice: mapInvoiceRow(invRow),
          subscription: mapSubscriptionRow(subRow),
        };
      }
    }

    db.prepare(
      `UPDATE payment_orders
       SET status = 'paid', gateway_payment_id = COALESCE(?, gateway_payment_id), status_note = ?, updated_at = ?
       WHERE id = ?`
    ).run(params.gatewayPaymentId, params.sourceNote.slice(0, 300), now, existingOrder.id);

    // Mark any prior active subscriptions for this user as superseded/cancelled
    db.prepare(
      `UPDATE subscriptions
       SET status = 'cancelled', updated_at = ?
       WHERE user_id = ? AND status = 'active'`
    ).run(now, existingOrder.user_id);

    const periodEndDate = new Date();
    if (existingOrder.billing_cycle === 'annual') {
      periodEndDate.setUTCFullYear(periodEndDate.getUTCFullYear() + 1);
    } else {
      periodEndDate.setUTCMonth(periodEndDate.getUTCMonth() + 1);
    }

    // Store agreed terms snapshot so future catalog price edits do not overwrite existing subscriber terms
    const subId = createId('sub');
    db.prepare(
      `INSERT INTO subscriptions (
        id, user_id, plan_id, billing_cycle, status, agreed_price_paise, currency,
        agreed_monthly_credits, agreed_daily_limit, payment_order_id, started_at, current_period_end,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      subId,
      existingOrder.user_id,
      plan.id,
      existingOrder.billing_cycle,
      existingOrder.amount_paise,
      existingOrder.currency,
      plan.monthly_credits,
      plan.daily_limit,
      existingOrder.id,
      now,
      periodEndDate.toISOString(),
      now,
      now
    );

    db.prepare('UPDATE users SET plan = ?, updated_at = ? WHERE id = ?').run(
      plan.id,
      now,
      existingOrder.user_id
    );

    const ym = now.slice(0, 7).replace('-', '');
    const invoiceNumber = `ORB-INV-${ym}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const invoiceId = createId('inv');

    db.prepare(
      `INSERT INTO invoices (
        id, invoice_number, user_id, order_id, plan_id, plan_name, billing_cycle,
        amount_paise, currency, payment_environment, gateway, gateway_payment_id, status, issued_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?)`
    ).run(
      invoiceId,
      invoiceNumber,
      existingOrder.user_id,
      existingOrder.id,
      plan.id,
      plan.name,
      existingOrder.billing_cycle,
      existingOrder.amount_paise,
      existingOrder.currency,
      existingOrder.payment_environment,
      existingOrder.gateway,
      params.gatewayPaymentId,
      now
    );

    const updatedOrder = mapOrderRow(
      db.prepare('SELECT * FROM payment_orders WHERE id = ?').get(existingOrder.id) as Record<string, unknown>
    );
    const createdInv = mapInvoiceRow(
      db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId) as Record<string, unknown>
    );
    const createdSub = mapSubscriptionRow(
      db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(subId) as Record<string, unknown>
    );

    return { order: updatedOrder, invoice: createdInv, subscription: createdSub };
  });

  return tx();
}

export async function verifyCashfreeOrderWithGateway(
  orderId: string,
  expectedUserId?: string
): Promise<{
  order: PaymentOrder;
  verifiedPaid: boolean;
  message: string;
}> {
  const row = db.prepare('SELECT * FROM payment_orders WHERE id = ?').get(orderId) as
    | Record<string, unknown>
    | undefined;
  if (!row) {
    throw new Error('Order not found.');
  }
  const order = mapOrderRow(row);
  if (expectedUserId && order.user_id !== expectedUserId) {
    throw new Error('Order does not belong to the signed-in user.');
  }

  if (order.status === 'paid') {
    return { order, verifiedPaid: true, message: 'Order already verified and active.' };
  }

  const creds = getCashfreeCredentials();
  if (!creds.configured) {
    return {
      order,
      verifiedPaid: false,
      message: 'Cashfree gateway credentials are not configured on the server; payment remains unverified.',
    };
  }

  const baseUrl = getCashfreeBaseUrl(order.payment_environment);
  const res = await fetch(`${baseUrl}/orders/${encodeURIComponent(order.id)}`, {
    method: 'GET',
    headers: {
      'x-api-version': CASHFREE_API_VERSION,
      'x-client-id': creds.appId,
      'x-client-secret': creds.secretKey,
    },
  });

  const cfOrder = (await res.json().catch(() => ({}))) as {
    order_status?: string;
    order_amount?: number;
    order_currency?: string;
    cf_order_id?: string | number;
    message?: string;
  };

  if (!res.ok) {
    return {
      order,
      verifiedPaid: false,
      message: cfOrder.message || `Unable to verify order status with Cashfree (HTTP ${res.status}).`,
    };
  }

  const paidPaise = Math.round(Number(cfOrder.order_amount || 0) * 100);
  if (
    cfOrder.order_status === 'PAID' &&
    paidPaise === order.amount_paise &&
    String(cfOrder.order_currency || '').toUpperCase() === order.currency.toUpperCase()
  ) {
    const activated = activateSubscriptionFromVerifiedOrder({
      orderId: order.id,
      gatewayPaymentId: cfOrder.cf_order_id ? String(cfOrder.cf_order_id) : null,
      sourceNote: 'Verified via Cashfree server-side Order Status API',
    });
    return {
      order: activated.order,
      verifiedPaid: true,
      message: 'Payment verified with Cashfree and subscription activated.',
    };
  }

  if (cfOrder.order_status === 'EXPIRED' || cfOrder.order_status === 'TERMINATED') {
    db.prepare('UPDATE payment_orders SET status = ?, status_note = ?, updated_at = ? WHERE id = ?').run(
      'failed',
      `Gateway order status: ${cfOrder.order_status}`,
      new Date().toISOString(),
      order.id
    );
  }

  return {
    order: mapOrderRow(db.prepare('SELECT * FROM payment_orders WHERE id = ?').get(order.id) as Record<string, unknown>),
    verifiedPaid: false,
    message: `Order status on Cashfree is ${cfOrder.order_status || 'PENDING'}.`,
  };
}

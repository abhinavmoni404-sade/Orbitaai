import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  FileText,
  Receipt,
  ShieldCheck,
  X,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { calculateAnnualSavings, formatPriceFromPaise } from '../lib/currency';
import { useAuth } from '../context/AuthContext';
import type {
  BillingCycle,
  BillingSummaryResponse,
  InvoiceRecord,
  PaymentOrder,
  PlanId,
  SubscriptionPlan,
} from '../types/orbita';

interface CheckoutApiResponse {
  order: PaymentOrder;
  cashfreeConfigured: boolean;
  paymentSessionId: string | null;
  checkoutUrl: string | null;
  environment: 'sandbox' | 'production';
  message: string;
}

const PAID_PLAN_ORDER: PlanId[] = ['starter', 'pro', 'business'];

export const BillingPage: React.FC = () => {
  const { refreshSession } = useAuth();
  const [summary, setSummary] = useState<BillingSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [checkoutBusyPlan, setCheckoutBusyPlan] = useState<PlanId | null>(null);
  const [verifyingOrderId, setVerifyingOrderId] = useState<string | null>(null);
  const [checkoutResult, setCheckoutResult] = useState<CheckoutApiResponse | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);

  const loadBilling = useCallback(async () => {
    try {
      const data = await apiFetch<BillingSummaryResponse>('/api/billing/summary');
      setSummary(data);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to load billing summary.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBilling();
  }, [loadBilling]);

  // Verify returning Cashfree order on the server rather than trusting URL redirects
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const returnedOrderId = params.get('order_id');
    if (!returnedOrderId) return;

    setVerifyingOrderId(returnedOrderId);
    apiFetch<{ order: PaymentOrder; verifiedPaid: boolean; message: string }>(
      `/api/billing/orders/${encodeURIComponent(returnedOrderId)}/verify`
    )
      .then(async (res) => {
        if (res.verifiedPaid) {
          setStatusMessage(res.message);
          await refreshSession();
        } else {
          setErrorMessage(res.message);
        }
        await loadBilling();
      })
      .catch((err) => {
        setErrorMessage(err instanceof Error ? err.message : 'Could not verify returned order.');
      })
      .finally(() => {
        setVerifyingOrderId(null);
        window.history.replaceState({}, '', '/app/billing');
      });
  }, [loadBilling, refreshSession]);

  const handleSelectPaidPlan = async (plan: SubscriptionPlan) => {
    setCheckoutBusyPlan(plan.id);
    setErrorMessage(null);
    setStatusMessage(null);
    setCheckoutResult(null);

    try {
      const res = await apiFetch<CheckoutApiResponse>('/api/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({
          plan_id: plan.id,
          billing_cycle: billingCycle,
        }),
      });
      setCheckoutResult(res);
      await loadBilling();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to initiate checkout.');
    } finally {
      setCheckoutBusyPlan(null);
    }
  };

  const handleDowngradeToFree = async () => {
    setCheckoutBusyPlan('free');
    setErrorMessage(null);
    setStatusMessage(null);
    setCheckoutResult(null);

    try {
      const res = await apiFetch<{ message: string }>('/api/billing/downgrade-free', {
        method: 'POST',
      });
      setStatusMessage(res.message);
      await Promise.all([refreshSession(), loadBilling()]);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to switch to Free plan.');
    } finally {
      setCheckoutBusyPlan(null);
    }
  };

  const handleVerifyOrder = async (orderId: string) => {
    setVerifyingOrderId(orderId);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const res = await apiFetch<{ verifiedPaid: boolean; message: string }>(
        `/api/billing/orders/${encodeURIComponent(orderId)}/verify`
      );
      if (res.verifiedPaid) {
        setStatusMessage(res.message);
        await refreshSession();
      } else {
        setErrorMessage(res.message);
      }
      await loadBilling();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Verification check failed.');
    } finally {
      setVerifyingOrderId(null);
    }
  };

  if (loading || !summary) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <div className="h-8 w-56 rounded-lg bg-[#E6EAF0] dark:bg-[#202D43] animate-pulse" />
        <div className="h-40 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-80 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  const paidPlans = summary.plans.filter((p) => p.id !== 'free').sort(
    (a, b) => PAID_PLAN_ORDER.indexOf(a.id) - PAID_PLAN_ORDER.indexOf(b.id)
  );
  const freePlan = summary.plans.find((p) => p.id === 'free');
  const annualConfigured = paidPlans.some(
    (p) => p.annual_price_paise !== null && p.annual_price_paise > 0
  );
  const currentRank = ['free', 'starter', 'pro', 'business'].indexOf(summary.current_plan.id);

  const agreedPricePaise =
    summary.active_subscription && summary.active_subscription.plan_id === summary.current_plan.id
      ? summary.active_subscription.agreed_price_paise
      : summary.current_plan.monthly_price_paise;
  const agreedCycle =
    summary.active_subscription && summary.active_subscription.plan_id === summary.current_plan.id
      ? summary.active_subscription.billing_cycle
      : 'monthly';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#111827] dark:text-[#F8FAFC]">
            Billing &amp; Subscription
          </h1>
          <p className="mt-1.5 text-sm text-[#667085] dark:text-[#A7B2C5]">
            Manage your ORBITA AI subscription, Cashfree hosted checkout orders, monthly credits, and invoices.
          </p>
        </div>

        <div className="px-4 py-2.5 rounded-xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] text-xs flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-[#4563FF] shrink-0" />
          <span className="font-semibold text-[#111827] dark:text-[#F8FAFC] uppercase">
            {summary.payment_gateway.environment} MODE
          </span>
          <span aria-hidden="true" className="text-[#667085]">·</span>
          <span className="text-[#667085] dark:text-[#A7B2C5]">
            {summary.payment_gateway.operational
              ? 'Cashfree hosted checkout ready'
              : 'Cashfree gateway awaiting credentials'}
          </span>
        </div>
      </div>

      {/* Honest Payment Readiness Banner */}
      <div className="p-4 rounded-2xl bg-[#4563FF]/[0.05] dark:bg-[#4563FF]/10 border border-[#4563FF]/25 flex items-start gap-3 text-xs sm:text-sm text-[#111827] dark:text-[#E2E8F0]">
        <AlertCircle className="w-4 h-4 text-[#4563FF] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold">
            {summary.payment_gateway.environment === 'sandbox'
              ? 'Payment Environment: Sandbox Testing Mode'
              : 'Payment Environment: Production'}
          </p>
          <p className="text-xs text-[#667085] dark:text-[#A7B2C5] leading-relaxed">
            {summary.payment_gateway.cashfree_configured
              ? 'Payments are routed exclusively through Cashfree hosted checkout and activated only after server-side signature or gateway verification.'
              : 'Live production payments remain disabled until merchant verification, Cashfree approval, legal checks, and server-side Cashfree API credentials are configured.'}
          </p>
        </div>
      </div>

      {statusMessage && (
        <div className="p-4 rounded-2xl bg-[#12B76A]/10 border border-[#12B76A]/30 flex items-center gap-2.5 text-sm text-[#12B76A]">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-[#F04438]/10 border border-[#F04438]/30 flex items-center gap-2.5 text-sm text-[#F04438]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {checkoutResult && (
        <div className="p-5 rounded-2xl bg-white dark:bg-[#182338] border border-[#4563FF]/40 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-[#111827] dark:text-[#F8FAFC]">
                Pending Checkout Order Created
              </h2>
              <p className="text-xs text-[#667085] dark:text-[#A7B2C5] mt-0.5">
                Order <span className="font-mono">{checkoutResult.order.id}</span> · Server-validated payable amount:{' '}
                <span className="font-mono font-semibold text-[#111827] dark:text-[#F8FAFC] tabular-nums">
                  {formatPriceFromPaise(checkoutResult.order.amount_paise, checkoutResult.order.currency)}
                </span>{' '}
                ({checkoutResult.order.billing_cycle})
              </p>
            </div>

            {checkoutResult.checkoutUrl && (
              <a
                href={checkoutResult.checkoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#4563FF] hover:bg-[#3652E6] text-white text-xs font-semibold inline-flex items-center gap-2 shrink-0"
              >
                <span>Proceed to Cashfree Hosted Checkout</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
          <p className="text-xs text-[#667085] dark:text-[#A7B2C5]">{checkoutResult.message}</p>
        </div>
      )}

      {/* Current Subscription & Agreed Terms */}
      <section className="p-6 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] grid grid-cols-1 md:grid-cols-4 gap-5">
        <div>
          <div className="text-xs text-[#667085] dark:text-[#A7B2C5]">Current Plan</div>
          <div className="mt-1 text-lg font-bold text-[#111827] dark:text-[#F8FAFC]">
            {summary.current_plan.name}
          </div>
          <div className="mt-0.5 text-xs text-[#667085] dark:text-[#A7B2C5]">
            {summary.active_subscription ? 'Agreed subscriber terms locked' : 'Standard workspace tier'}
          </div>
        </div>

        <div>
          <div className="text-xs text-[#667085] dark:text-[#A7B2C5]">Agreed Recurring Rate</div>
          <div className="mt-1 font-mono text-lg font-bold text-[#111827] dark:text-[#F8FAFC] tabular-nums">
            {formatPriceFromPaise(agreedPricePaise, summary.current_plan.currency)}
            <span className="text-xs font-sans font-normal text-[#667085] dark:text-[#A7B2C5]">
              /{agreedCycle === 'annual' ? 'year' : 'month'}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-[#667085] dark:text-[#A7B2C5]">
            Currency: {summary.current_plan.currency}
          </div>
        </div>

        <div>
          <div className="text-xs text-[#667085] dark:text-[#A7B2C5]">Monthly Credits Used</div>
          <div className="mt-1 font-mono text-lg font-bold text-[#111827] dark:text-[#F8FAFC] tabular-nums">
            {summary.monthly_credits_used.toLocaleString()} / {summary.monthly_credits_limit.toLocaleString()}
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-[#E6EAF0] dark:bg-[#2B3950] overflow-hidden">
            <div
              className="h-full bg-[#20C9B7] rounded-full"
              style={{
                width: `${Math.min(
                  100,
                  Math.round((summary.monthly_credits_used / Math.max(1, summary.monthly_credits_limit)) * 100)
                )}%`,
              }}
            />
          </div>
        </div>

        <div>
          <div className="text-xs text-[#667085] dark:text-[#A7B2C5]">Included AI Agents</div>
          <div className="mt-1 font-mono text-lg font-bold text-[#111827] dark:text-[#F8FAFC] tabular-nums">
            {summary.current_plan.included_agents_count} specialized
          </div>
          <div className="mt-0.5 text-xs text-[#667085] dark:text-[#A7B2C5]">
            {summary.active_subscription?.current_period_end
              ? `Renews ${new Date(summary.active_subscription.current_period_end).toLocaleDateString()}`
              : 'No active paid renewal'}
          </div>
        </div>
      </section>

      {/* Paid Plan Cards */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#111827] dark:text-[#F8FAFC]">Subscription Plans</h2>
            <p className="text-xs text-[#667085] dark:text-[#A7B2C5]">
              Billed in INR via Cashfree hosted checkout. All prices are validated server-side before creating an order.
            </p>
          </div>

          {annualConfigured && (
            <div className="inline-flex items-center p-1 rounded-xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950]">
              {(['monthly', 'annual'] as BillingCycle[]).map((cycle) => (
                <button
                  key={cycle}
                  type="button"
                  onClick={() => setBillingCycle(cycle)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer ${
                    billingCycle === cycle
                      ? 'bg-[#4563FF] text-white'
                      : 'text-[#667085] dark:text-[#A7B2C5]'
                  }`}
                >
                  {cycle}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {paidPlans.map((plan) => {
            const isCurrent = summary.current_plan.id === plan.id;
            const planRank = ['free', 'starter', 'pro', 'business'].indexOf(plan.id);
            const isDowngrade = planRank < currentRank;
            const savings = calculateAnnualSavings(plan.monthly_price_paise, plan.annual_price_paise);
            const showAnnual =
              billingCycle === 'annual' && plan.annual_price_paise !== null && plan.annual_price_paise > 0;
            const displayPaise = showAnnual ? plan.annual_price_paise! : plan.monthly_price_paise;
            const accentColor =
              plan.id === 'starter' ? '#20C9B7' : plan.id === 'pro' ? '#4563FF' : '#8B7CFF';

            return (
              <div
                key={plan.id}
                className={`p-6 rounded-2xl bg-white dark:bg-[#182338] border flex flex-col justify-between ${
                  isCurrent || plan.id === 'pro'
                    ? 'border-[#4563FF]'
                    : 'border-[#E6EAF0] dark:border-[#2B3950]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-bold tracking-tight text-[#111827] dark:text-[#F8FAFC] uppercase">
                      {plan.name}
                    </h3>
                    <span
                      className="text-xs font-semibold"
                      style={{ color: accentColor }}
                    >
                      {isCurrent ? 'Active Plan' : plan.id === 'pro' ? 'Most Popular' : `${plan.included_agents_count} AI Agents`}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-[#667085] dark:text-[#A7B2C5] leading-relaxed">
                    {plan.tagline}
                  </p>

                  <div className="mt-5 flex items-baseline gap-1.5">
                    <span className="font-mono text-3xl font-bold text-[#111827] dark:text-[#F8FAFC] tabular-nums">
                      {formatPriceFromPaise(displayPaise, plan.currency)}
                    </span>
                    <span className="text-xs text-[#667085] dark:text-[#A7B2C5]">
                      /{showAnnual ? 'year' : 'month'}
                    </span>
                  </div>
                  {showAnnual && savings && (
                    <div className="mt-1 text-xs font-medium text-[#12B76A]">
                      Save {formatPriceFromPaise(savings.savingsPaise, plan.currency)} ({savings.savingsPercent}%) vs. monthly
                    </div>
                  )}

                  <div className="mt-4 py-2.5 border-y border-[#E6EAF0] dark:border-[#2B3950] flex items-center justify-between text-xs">
                    <span className="text-[#667085] dark:text-[#A7B2C5]">Monthly credits</span>
                    <span className="font-mono font-semibold text-[#111827] dark:text-[#F8FAFC] tabular-nums">
                      {plan.monthly_credits.toLocaleString()} credits
                    </span>
                  </div>

                  <ul className="mt-4 space-y-2 text-xs text-[#111827] dark:text-[#E2E8F0]">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-[#12B76A] shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  {plan.limitations.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-[#E6EAF0] dark:border-[#2B3950] space-y-1 text-[11px] text-[#667085] dark:text-[#A7B2C5]">
                      {plan.limitations.map((lim) => (
                        <div key={lim}>· {lim}</div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-6 space-y-2">
                  <button
                    type="button"
                    disabled={isCurrent || checkoutBusyPlan !== null || (billingCycle === 'annual' && !showAnnual)}
                    onClick={() => handleSelectPaidPlan(plan)}
                    className={`w-full min-h-[44px] px-4 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60 ${
                      isCurrent
                        ? 'bg-[#F7F9FC] dark:bg-[#202D43] text-[#667085] dark:text-[#A7B2C5]'
                        : 'bg-[#4563FF] hover:bg-[#3652E6] text-white'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>
                      {checkoutBusyPlan === plan.id
                        ? 'Creating checkout...'
                        : isCurrent
                          ? 'Current Plan'
                          : isDowngrade
                            ? `Switch to ${plan.name}`
                            : `Upgrade to ${plan.name}`}
                    </span>
                  </button>
                  <p className="text-[11px] text-center text-[#667085] dark:text-[#A7B2C5]">
                    Recurring {showAnnual ? 'annual' : 'monthly'} billing · Cancel anytime
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Free Plan Separate Option */}
        {freePlan && (
          <div className="p-5 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-bold text-[#111827] dark:text-[#F8FAFC]">
                  {freePlan.name} Plan
                </h3>
                <span className="font-mono text-sm font-bold text-[#111827] dark:text-[#F8FAFC] tabular-nums">
                  {formatPriceFromPaise(freePlan.monthly_price_paise, freePlan.currency)}/month
                </span>
                <span className="text-xs text-[#667085] dark:text-[#A7B2C5]">
                  · {freePlan.monthly_credits.toLocaleString()} monthly credits · {freePlan.included_agents_count} AI agents
                </span>
              </div>
              <p className="text-xs text-[#667085] dark:text-[#A7B2C5]">
                {freePlan.tagline} ({freePlan.limitations.join(' · ')})
              </p>
            </div>

            {summary.current_plan.id === 'free' ? (
              <span className="text-xs font-semibold text-[#12B76A] whitespace-nowrap shrink-0">
                Active Free Plan
              </span>
            ) : (
              <button
                type="button"
                disabled={checkoutBusyPlan !== null}
                onClick={handleDowngradeToFree}
                className="min-h-[40px] px-4 py-2 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] hover:border-[#4563FF] text-xs font-semibold text-[#111827] dark:text-[#F8FAFC] whitespace-nowrap shrink-0 cursor-pointer"
              >
                {checkoutBusyPlan === 'free' ? 'Updating...' : 'Downgrade to Free'}
              </button>
            )}
          </div>
        )}
      </section>

      {/* Payment Orders & Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders */}
        <section className="rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E6EAF0] dark:border-[#2B3950] flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#111827] dark:text-[#F8FAFC]">Payment Orders</h2>
            <span className="text-xs text-[#667085] dark:text-[#A7B2C5]">Cashfree Hosted Checkout</span>
          </div>

          {summary.orders.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#667085] dark:text-[#A7B2C5]">
              No payment orders created yet.
            </div>
          ) : (
            <div className="divide-y divide-[#E6EAF0] dark:divide-[#2B3950]">
              {summary.orders.map((ord) => (
                <div key={ord.id} className="px-5 py-3.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-semibold text-[#111827] dark:text-[#F8FAFC] capitalize">
                      {ord.plan_id} ({ord.billing_cycle}) ·{' '}
                      <span className="font-mono tabular-nums">
                        {formatPriceFromPaise(ord.amount_paise, ord.currency)}
                      </span>
                    </div>
                    <div className="text-[#667085] dark:text-[#A7B2C5] truncate mt-0.5">
                      <span className="font-mono">{ord.id}</span> · {ord.payment_environment} ·{' '}
                      {new Date(ord.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`font-semibold uppercase text-[11px] ${
                        ord.status === 'paid'
                          ? 'text-[#12B76A]'
                          : ord.status === 'failed'
                            ? 'text-[#F04438]'
                            : 'text-[#F79009]'
                      }`}
                    >
                      {ord.status}
                    </span>
                    {ord.status === 'pending' && summary.payment_gateway.cashfree_configured && (
                      <button
                        type="button"
                        disabled={verifyingOrderId === ord.id}
                        onClick={() => handleVerifyOrder(ord.id)}
                        className="px-2.5 py-1 rounded-lg border border-[#E6EAF0] dark:border-[#2B3950] text-[11px] font-semibold hover:border-[#4563FF] cursor-pointer"
                      >
                        {verifyingOrderId === ord.id ? 'Checking...' : 'Verify'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Invoices */}
        <section className="rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E6EAF0] dark:border-[#2B3950] flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#111827] dark:text-[#F8FAFC]">Invoices</h2>
            <span className="text-xs text-[#667085] dark:text-[#A7B2C5]">Issued on verified payment</span>
          </div>

          {summary.invoices.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <Receipt className="w-7 h-7 text-[#667085] mx-auto opacity-60" />
              <p className="text-xs text-[#667085] dark:text-[#A7B2C5]">
                No invoices issued yet. Invoices appear automatically after payment verification.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#E6EAF0] dark:divide-[#2B3950]">
              {summary.invoices.map((inv) => (
                <button
                  key={inv.id}
                  type="button"
                  onClick={() => setSelectedInvoice(inv)}
                  className="w-full px-5 py-3.5 flex items-center justify-between gap-3 text-left text-xs hover:bg-[#F7F9FC] dark:hover:bg-[#202D43] cursor-pointer"
                >
                  <div>
                    <div className="font-mono font-semibold text-[#111827] dark:text-[#F8FAFC]">
                      {inv.invoice_number}
                    </div>
                    <div className="text-[#667085] dark:text-[#A7B2C5] mt-0.5">
                      {inv.plan_name} ({inv.billing_cycle}) · {new Date(inv.issued_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono font-bold text-[#111827] dark:text-[#F8FAFC] tabular-nums">
                      {formatPriceFromPaise(inv.amount_paise, inv.currency)}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#667085]" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg p-6 rounded-2xl bg-white dark:bg-[#182338] border border-[#E6EAF0] dark:border-[#2B3950] space-y-5 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#4563FF]" />
                <h3 className="text-base font-bold text-[#111827] dark:text-[#F8FAFC]">
                  ORBITA AI Invoice
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                aria-label="Close invoice"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#667085] hover:text-[#111827] dark:hover:text-[#F8FAFC] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs border-y border-[#E6EAF0] dark:border-[#2B3950] py-4">
              <div>
                <div className="text-[#667085] dark:text-[#A7B2C5]">Invoice Number</div>
                <div className="mt-0.5 font-mono font-semibold">{selectedInvoice.invoice_number}</div>
              </div>
              <div>
                <div className="text-[#667085] dark:text-[#A7B2C5]">Issued Date</div>
                <div className="mt-0.5 font-mono">{new Date(selectedInvoice.issued_at).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[#667085] dark:text-[#A7B2C5]">Plan &amp; Cycle</div>
                <div className="mt-0.5 font-semibold capitalize">
                  {selectedInvoice.plan_name} · {selectedInvoice.billing_cycle}
                </div>
              </div>
              <div>
                <div className="text-[#667085] dark:text-[#A7B2C5]">Amount Paid</div>
                <div className="mt-0.5 font-mono font-bold tabular-nums">
                  {formatPriceFromPaise(selectedInvoice.amount_paise, selectedInvoice.currency)}
                </div>
              </div>
              <div>
                <div className="text-[#667085] dark:text-[#A7B2C5]">Gateway &amp; Environment</div>
                <div className="mt-0.5 uppercase font-medium">
                  {selectedInvoice.gateway} ({selectedInvoice.payment_environment})
                </div>
              </div>
              <div>
                <div className="text-[#667085] dark:text-[#A7B2C5]">Gateway Payment Ref</div>
                <div className="mt-0.5 font-mono truncate">
                  {selectedInvoice.gateway_payment_id || selectedInvoice.order_id}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="min-h-[40px] px-4 rounded-xl border border-[#E6EAF0] dark:border-[#2B3950] text-xs font-semibold cursor-pointer"
              >
                Print Invoice
              </button>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="min-h-[40px] px-4 rounded-xl bg-[#4563FF] text-white text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

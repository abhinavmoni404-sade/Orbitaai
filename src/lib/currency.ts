import type { SubscriptionPlan } from '../types/orbita';

export function formatPriceFromPaise(paise: number, currency = 'INR'): string {
  const safePaise = Number.isFinite(paise) ? Math.max(0, Math.round(paise)) : 0;
  const major = safePaise / 100;
  const hasRemainder = safePaise % 100 !== 0;

  try {
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: hasRemainder ? 2 : 0,
      maximumFractionDigits: hasRemainder ? 2 : 0,
    }).format(major);
  } catch {
    return `${currency} ${hasRemainder ? major.toFixed(2) : Math.round(major)}`;
  }
}

export function calculateAnnualSavings(
  monthlyPaise: number,
  annualPaise: number | null
): { savingsPaise: number; savingsPercent: number } | null {
  if (annualPaise === null || annualPaise <= 0 || monthlyPaise <= 0) {
    return null;
  }
  const twelveMonthsPaise = monthlyPaise * 12;
  if (annualPaise >= twelveMonthsPaise) {
    return null;
  }
  const savingsPaise = twelveMonthsPaise - annualPaise;
  const savingsPercent = Math.round((savingsPaise / twelveMonthsPaise) * 100);
  return { savingsPaise, savingsPercent };
}

export const INITIAL_FALLBACK_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Explore ORBITA AI across all six assistants at no cost.',
    monthly_price_paise: 0,
    annual_price_paise: null,
    currency: 'INR',
    monthly_credits: 250,
    daily_limit: 25,
    included_agents_count: 6,
    features: [
      'Access to all 6 specialized AI agents',
      '250 monthly AI credits (up to 25 requests/day)',
      'Persistent multi-turn conversation history',
      'Saved outputs & personal prompt library',
    ],
    limitations: [
      'Single workspace seat',
      'Standard daily credit ceiling',
      'No shared team workflows',
    ],
    is_active: true,
    sort_order: 0,
    updated_at: '',
  },
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'For solo founders, creators, and professionals building daily momentum.',
    monthly_price_paise: 49900,
    annual_price_paise: null,
    currency: 'INR',
    monthly_credits: 2500,
    daily_limit: 100,
    included_agents_count: 6,
    features: [
      'All 6 specialized AI agents (Sales, Marketing, Research, Finance, Support, Ops)',
      '2,500 monthly AI credits (up to 100 requests/day)',
      'Unlimited saved outputs & custom prompt templates',
      'Full conversation history & usage breakdown',
    ],
    limitations: ['Single individual workspace', 'No multi-seat team administration'],
    is_active: true,
    sort_order: 1,
    updated_at: '',
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'For power operators and high-output consultants running daily workflows.',
    monthly_price_paise: 99900,
    annual_price_paise: null,
    currency: 'INR',
    monthly_credits: 10000,
    daily_limit: 250,
    included_agents_count: 6,
    features: [
      'All 6 specialized AI agents with full multi-turn context',
      '10,000 monthly AI credits (up to 250 requests/day)',
      'Priority usage analytics & exportable outputs',
      'Unlimited prompt templates across all categories',
    ],
    limitations: ['Individual operator license', 'Shared team workspaces available on Business'],
    is_active: true,
    sort_order: 2,
    updated_at: '',
  },
  {
    id: 'business',
    name: 'Business',
    tagline: 'For growing businesses and teams scaling AI operations across departments.',
    monthly_price_paise: 159900,
    annual_price_paise: null,
    currency: 'INR',
    monthly_credits: 35000,
    daily_limit: 1000,
    included_agents_count: 6,
    features: [
      'All 6 specialized AI agents for high-volume workflows',
      '35,000 monthly AI credits (up to 1,000 requests/day)',
      'Invoice history & commercial billing support',
      'Prepared for multi-user workspaces & connected workflows',
    ],
    limitations: ['Team seat sharing rolls out as multi-user sync matures'],
    is_active: true,
    sort_order: 3,
    updated_at: '',
  },
];

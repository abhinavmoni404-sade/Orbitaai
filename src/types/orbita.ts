export type UserRole = 'user' | 'admin';
export type PlanId = 'free' | 'starter' | 'pro' | 'business';
export type BillingCycle = 'monthly' | 'annual';
export type PaymentEnvironment = 'sandbox' | 'production';
export type ThemePreference = 'light' | 'dark' | 'system';

export interface User {
  id: string;
  external_auth_provider: 'firebase' | 'google';
  external_auth_user_id: string;
  name: string;
  email: string;
  profile_image: string | null;
  role: UserRole;
  plan: PlanId;
  theme_preference: ThemePreference;
  notifications_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export type AgentSlug =
  | 'orbita-sales'
  | 'orbita-marketing'
  | 'orbita-research'
  | 'orbita-finance'
  | 'orbita-support'
  | 'orbita-operations';

export interface Agent {
  id: string;
  name: string;
  slug: AgentSlug | string;
  tagline: string;
  description: string;
  system_instruction: string;
  icon: string;
  category: string;
  accent_color: string;
  capabilities: string[];
  suggested_prompts: string[];
  is_active: boolean;
  created_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  agent_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  agent_name?: string;
  agent_slug?: string;
  agent_icon?: string;
  agent_accent_color?: string;
  last_message?: string;
  message_count?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  model: string | null;
  tokens_used: number;
  created_at: string;
}

export interface SavedOutput {
  id: string;
  user_id: string;
  agent_id: string;
  conversation_id: string | null;
  title: string;
  content: string;
  created_at: string;
  agent_name?: string;
  agent_slug?: string;
  agent_accent_color?: string;
}

export type PromptCategory =
  | 'Sales'
  | 'Marketing'
  | 'Research'
  | 'Finance'
  | 'Customer Support'
  | 'Operations'
  | 'General Productivity';

export interface PromptTemplate {
  id: string;
  user_id: string | null;
  title: string;
  category: PromptCategory | string;
  prompt: string;
  is_platform: boolean;
  created_at: string;
}

export interface UsageRecord {
  id: string;
  user_id: string;
  agent_id: string;
  usage_type: string;
  usage_amount: number;
  tokens_used: number;
  created_at: string;
  agent_name?: string;
  agent_slug?: string;
}

export interface UsageSummary {
  total_requests: number;
  today_requests: number;
  daily_limit: number;
  remaining_today: number;
  plan: PlanId;
  by_agent: Array<{
    agent_id: string;
    agent_name: string;
    agent_slug: string;
    accent_color: string;
    request_count: number;
  }>;
  recent_activity: UsageRecord[];
}

export interface FeedbackItem {
  id: string;
  user_id: string;
  category: string;
  message: string;
  status: 'open' | 'reviewed' | 'resolved';
  admin_notes: string | null;
  created_at: string;
  user_name?: string;
  user_email?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success';
  created_at: string;
}

export interface ConfigStatus {
  gemini_configured: boolean;
  firebase_auth_configured: boolean;
  admin_email_configured: boolean;
  billing_provider_configured: boolean;
  cashfree_configured: boolean;
  payment_environment: PaymentEnvironment;
  production_payments_enabled: boolean;
  app_url: string;
}

export interface SystemConfig {
  free_daily_limit: number;
  starter_daily_limit: number;
  pro_daily_limit: number;
  business_daily_limit: number;
  allow_new_signups: boolean;
  maintenance_mode: boolean;
}

export interface SubscriptionPlan {
  id: PlanId;
  name: string;
  tagline: string;
  monthly_price_paise: number;
  annual_price_paise: number | null;
  currency: string;
  monthly_credits: number;
  daily_limit: number;
  included_agents_count: number;
  features: string[];
  limitations: string[];
  is_active: boolean;
  sort_order: number;
  updated_at: string;
}

export interface SubscriptionRecord {
  id: string;
  user_id: string;
  plan_id: PlanId;
  billing_cycle: BillingCycle;
  status: 'active' | 'pending' | 'cancelled';
  agreed_price_paise: number;
  currency: string;
  agreed_monthly_credits: number;
  agreed_daily_limit: number;
  payment_order_id: string | null;
  started_at: string;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentOrder {
  id: string;
  user_id: string;
  user_email?: string;
  plan_id: PlanId;
  billing_cycle: BillingCycle;
  amount_paise: number;
  currency: string;
  gateway: string;
  gateway_order_id: string | null;
  gateway_payment_id: string | null;
  payment_environment: PaymentEnvironment;
  status: 'pending' | 'paid' | 'failed' | 'cancelled';
  status_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceRecord {
  id: string;
  invoice_number: string;
  user_id: string;
  user_email?: string;
  order_id: string;
  plan_id: PlanId;
  plan_name: string;
  billing_cycle: BillingCycle;
  amount_paise: number;
  currency: string;
  payment_environment: PaymentEnvironment;
  gateway: string;
  gateway_payment_id: string | null;
  status: 'paid' | 'void';
  issued_at: string;
}

export interface BillingSummaryResponse {
  current_plan: SubscriptionPlan;
  active_subscription: SubscriptionRecord | null;
  plans: SubscriptionPlan[];
  monthly_credits_used: number;
  monthly_credits_limit: number;
  payment_gateway: {
    provider: 'cashfree';
    environment: PaymentEnvironment;
    cashfree_configured: boolean;
    production_payments_enabled: boolean;
    operational: boolean;
    supported_currencies: string[];
    enabled_payment_methods: string[];
  };
  orders: PaymentOrder[];
  invoices: InvoiceRecord[];
}

export interface AdminBillingConfig {
  merchant_upi_id: string;
  default_currency: string;
  supported_currencies: string[];
  enabled_payment_methods: string[];
  payment_environment: PaymentEnvironment;
  production_payments_enabled: boolean;
  merchant_verified: boolean;
  provider_approved: boolean;
  legal_requirements_completed: boolean;
  updated_at: string;
}

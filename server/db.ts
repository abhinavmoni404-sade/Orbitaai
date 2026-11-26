import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import path from 'node:path';
import type {
  AdminBillingConfig,
  Agent,
  AgentSlug,
  PlanId,
  PromptCategory,
  SubscriptionPlan,
  SystemConfig,
} from '../src/types/orbita.ts';

const DB_PATH = path.resolve(process.cwd(), 'orbita.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    external_auth_provider TEXT NOT NULL DEFAULT 'firebase',
    external_auth_user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    profile_image TEXT,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'business')),
    theme_preference TEXT NOT NULL DEFAULT 'light' CHECK (theme_preference IN ('light', 'dark', 'system')),
    notifications_enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(external_auth_provider, external_auth_user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    tagline TEXT NOT NULL,
    description TEXT NOT NULL,
    system_instruction TEXT NOT NULL,
    icon TEXT NOT NULL,
    category TEXT NOT NULL,
    accent_color TEXT NOT NULL,
    capabilities TEXT NOT NULL,
    suggested_prompts TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_conversations_user_updated ON conversations(user_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_conversations_user_agent ON conversations(user_id, agent_id);

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    model TEXT,
    tokens_used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at ASC);

  CREATE TABLE IF NOT EXISTS saved_outputs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    conversation_id TEXT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_saved_outputs_user ON saved_outputs(user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS prompt_templates (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    prompt TEXT NOT NULL,
    is_platform INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_prompt_templates_user ON prompt_templates(user_id, is_platform);

  CREATE TABLE IF NOT EXISTS usage_records (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    usage_type TEXT NOT NULL,
    usage_amount INTEGER NOT NULL DEFAULT 1,
    tokens_used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_usage_records_user_date ON usage_records(user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    category TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'resolved')),
    admin_notes TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS contact_inquiries (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    company TEXT,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id TEXT PRIMARY KEY,
    admin_user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS subscription_plans (
    id TEXT PRIMARY KEY CHECK (id IN ('free', 'starter', 'pro', 'business')),
    name TEXT NOT NULL,
    tagline TEXT NOT NULL,
    monthly_price_paise INTEGER NOT NULL,
    annual_price_paise INTEGER,
    currency TEXT NOT NULL DEFAULT 'INR',
    monthly_credits INTEGER NOT NULL,
    daily_limit INTEGER NOT NULL,
    included_agents_count INTEGER NOT NULL DEFAULT 6,
    features_json TEXT NOT NULL,
    limitations_json TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS billing_config (
    id TEXT PRIMARY KEY,
    merchant_upi_id TEXT NOT NULL,
    default_currency TEXT NOT NULL DEFAULT 'INR',
    supported_currencies TEXT NOT NULL,
    enabled_payment_methods TEXT NOT NULL,
    payment_environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (payment_environment IN ('sandbox', 'production')),
    production_payments_enabled INTEGER NOT NULL DEFAULT 0,
    merchant_verified INTEGER NOT NULL DEFAULT 0,
    provider_approved INTEGER NOT NULL DEFAULT 0,
    legal_requirements_completed INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    plan_id TEXT NOT NULL CHECK (plan_id IN ('free', 'starter', 'pro', 'business')),
    billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'cancelled')),
    agreed_price_paise INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    agreed_monthly_credits INTEGER NOT NULL,
    agreed_daily_limit INTEGER NOT NULL,
    payment_order_id TEXT,
    started_at TEXT NOT NULL,
    current_period_end TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS payment_orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    plan_id TEXT NOT NULL CHECK (plan_id IN ('free', 'starter', 'pro', 'business')),
    billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
    amount_paise INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    gateway TEXT NOT NULL DEFAULT 'cashfree',
    gateway_order_id TEXT,
    gateway_payment_id TEXT,
    payment_environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (payment_environment IN ('sandbox', 'production')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
    status_note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_payment_orders_user ON payment_orders(user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    plan_id TEXT NOT NULL,
    plan_name TEXT NOT NULL,
    billing_cycle TEXT NOT NULL,
    amount_paise INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    payment_environment TEXT NOT NULL DEFAULT 'sandbox',
    gateway TEXT NOT NULL DEFAULT 'cashfree',
    gateway_payment_id TEXT,
    status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'void')),
    issued_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id, issued_at DESC);
`);

// Safely migrate pre-existing SQLite users table if its CHECK constraint lacks 'starter'
{
  const tableDef = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'")
    .get() as { sql?: string } | undefined;
  if (tableDef?.sql && !tableDef.sql.includes("'starter'")) {
    db.pragma('foreign_keys = OFF');
    const migrateUsers = db.transaction(() => {
      db.exec(`
        CREATE TABLE users_new (
          id TEXT PRIMARY KEY,
          external_auth_provider TEXT NOT NULL DEFAULT 'firebase',
          external_auth_user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          profile_image TEXT,
          role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
          plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'business')),
          theme_preference TEXT NOT NULL DEFAULT 'light' CHECK (theme_preference IN ('light', 'dark', 'system')),
          notifications_enabled INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          UNIQUE(external_auth_provider, external_auth_user_id)
        );
        INSERT INTO users_new SELECT * FROM users;
        DROP TABLE users;
        ALTER TABLE users_new RENAME TO users;
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      `);
    });
    migrateUsers();
    db.pragma('foreign_keys = ON');
  }
}

interface SeedAgentInput {
  id: string;
  name: string;
  slug: AgentSlug;
  tagline: string;
  description: string;
  system_instruction: string;
  icon: string;
  category: string;
  accent_color: string;
  capabilities: string[];
  suggested_prompts: string[];
}

const SEED_AGENTS: SeedAgentInput[] = [
  {
    id: 'agent-orbita-sales',
    name: 'ORBITA SALES',
    slug: 'orbita-sales',
    tagline: 'Revenue outreach, proposals, and deal communication',
    description:
      'Specialized assistant for crafting persuasive sales emails, structured follow-up sequences, product proposals, objection handling, and pitch scripts.',
    system_instruction: `You are ORBITA SALES, a specialized sales and business communication AI assistant inside the ORBITA AI workspace.
Your expertise covers:
- Cold and warm sales email writing
- Multi-touch follow-up sequences
- Structured sales proposals and executive summaries
- Lead qualification frameworks (MEDDPICC, BANT)
- Customer outreach drafts and cold call scripts
- Product pitch creation and value propositions
- Practical objection-handling responses

Guidelines:
1. Write crisp, persuasive, human-sounding business copy without generic fluff or spammy hype.
2. When details like recipient role, product price, or target industry are missing, provide a clean fill-in-the-blank structure with clear [bracketed] placeholders AND ask 2–3 brief clarifying questions at the end if helpful.
3. Organize long outputs (sequences, proposals) with clear Markdown headings, bullet lists, and subject line options.
4. Never fabricate customer testimonials, case study metrics, or fake statistics unless the user supplied them.`,
    icon: 'BriefcaseBusiness',
    category: 'Revenue & Growth',
    accent_color: '#4563FF',
    capabilities: [
      'Sales email writing',
      'Follow-up sequences',
      'Sales proposals',
      'Lead qualification',
      'Outreach drafts',
      'Sales scripts & pitches',
      'Objection handling',
    ],
    suggested_prompts: [
      'Write a professional sales email.',
      'Create a follow-up sequence.',
      'Draft a product proposal.',
      'Help me prepare a sales pitch.',
    ],
  },
  {
    id: 'agent-orbita-marketing',
    name: 'ORBITA MARKETING',
    slug: 'orbita-marketing',
    tagline: 'Brand positioning, campaigns, and content engines',
    description:
      'Specialized assistant for building marketing strategies, 30-day content calendars, ad copy, SEO drafts, social posts, and audience positioning.',
    system_instruction: `You are ORBITA MARKETING, a specialized marketing and brand growth AI assistant inside the ORBITA AI workspace.
Your expertise covers:
- Go-to-market and channel marketing strategies
- 30-day social and editorial content calendars
- High-converting advertising copy (search, social, display)
- Brand positioning, messaging pillars, and taglines
- SEO content briefs and article drafts
- Campaign planning and audience segmentation
- Compelling product descriptions

Guidelines:
1. Deliver structured, actionable marketing plans with clear target audience, messaging angle, format, and call-to-action.
2. When creating content calendars or campaign concepts, format schedules cleanly in Markdown tables or day-by-day sections.
3. Avoid generic buzzwords; prioritize concrete customer outcomes, clear hooks, and channel-appropriate tone.
4. Do not invent fake campaign performance benchmarks or fabricated conversion rates; label any projected targets explicitly as planning estimates.`,
    icon: 'Megaphone',
    category: 'Brand & Demand',
    accent_color: '#8B7CFF',
    capabilities: [
      'Marketing strategies',
      'Content calendars',
      'Advertising copy',
      'Brand positioning',
      'SEO content drafts',
      'Campaign planning',
      'Audience research',
    ],
    suggested_prompts: [
      'Create a 30-day content calendar.',
      'Develop a marketing strategy.',
      'Write Instagram captions.',
      'Create an advertising campaign concept.',
    ],
  },
  {
    id: 'agent-orbita-research',
    name: 'ORBITA RESEARCH',
    slug: 'orbita-research',
    tagline: 'Structured market intelligence and strategic analysis',
    description:
      'Specialized assistant for market research, competitor breakdowns, SWOT analyses, business model evaluation, and structured trend synthesis.',
    system_instruction: `You are ORBITA RESEARCH, a specialized research and business intelligence AI assistant inside the ORBITA AI workspace.
Your expertise covers:
- Structured market research & sizing frameworks
- Competitor analysis frameworks
- SWOT and Porter's Five Forces analyses
- Industry overviews & business opportunity exploration
- Business model comparisons and trade-off analysis

CRITICAL RESEARCH INTEGRITY RULES (MANDATORY):
1. Clearly distinguish verified facts, analytical assumptions, and rough estimates using explicit labels (e.g., [Fact], [Assumption], [Estimate]).
2. NEVER invent sources, URLs, citations, journal names, or fabricated market statistics.
3. Do NOT claim to have browsed the live internet or accessed real-time web data unless a live search tool actually supplied the information in this session.
4. Explicitly note when knowledge may be uncertain, incomplete, or time-sensitive, and recommend what primary data the user should verify.`,
    icon: 'SearchCheck',
    category: 'Strategy & Intel',
    accent_color: '#20C9B7',
    capabilities: [
      'Market research',
      'Competitor analysis',
      'SWOT analysis',
      'Industry summaries',
      'Opportunity exploration',
      'Business model analysis',
      'Trend synthesis',
    ],
    suggested_prompts: [
      'Analyze this business idea.',
      'Create a SWOT analysis.',
      'Compare two business models.',
      'Prepare a market research report.',
    ],
  },
  {
    id: 'agent-orbita-finance',
    name: 'ORBITA FINANCE',
    slug: 'orbita-finance',
    tagline: 'Budgets, cash-flow organization, and margin clarity',
    description:
      'Specialized assistant for budget planning, expense categorization, cash-flow summaries, profit margin calculations, and invoice organization.',
    system_instruction: `You are ORBITA FINANCE, a specialized financial organization and business finance AI assistant inside the ORBITA AI workspace.
Your expertise covers:
- Monthly and quarterly business budget planning
- Expense categorization and ledger cleanup
- Cash-flow summary structures
- Deterministic financial calculations (gross/net profit margin, runway, break-even, CAC/LTV formulas)
- Invoice organization checklists
- Business financial report templates and plain-English financial education

CRITICAL FINANCIAL RULES (MANDATORY):
1. Show formulas and step-by-step deterministic arithmetic clearly whenever performing calculations.
2. Clearly disclose every assumption made when numbers are missing or projected.
3. Never present generated estimates, projections, or templates as audited or verified financial records.
4. Include a concise, clear note when relevant that ORBITA FINANCE provides organizational and educational assistance—not regulated financial, tax, investment, or legal advice.`,
    icon: 'Calculator',
    category: 'Finance & Planning',
    accent_color: '#12B76A',
    capabilities: [
      'Budget planning',
      'Expense categorization',
      'Cash-flow summaries',
      'Financial calculations',
      'Invoice organization',
      'Business financial reports',
      'Financial education',
    ],
    suggested_prompts: [
      'Create a monthly business budget.',
      'Summarize these expenses.',
      'Calculate my business profit margin.',
      'Prepare a cash-flow report.',
    ],
  },
  {
    id: 'agent-orbita-support',
    name: 'ORBITA SUPPORT',
    slug: 'orbita-support',
    tagline: 'Empathetic customer responses, FAQs, and knowledge bases',
    description:
      'Specialized assistant for drafting customer support replies, complaint resolutions, ticket summaries, FAQ pages, and help-center documentation.',
    system_instruction: `You are ORBITA SUPPORT, a specialized customer service and communication AI assistant inside the ORBITA AI workspace.
Your expertise covers:
- Empathetic, clear customer support replies
- De-escalation and complaint resolution drafts
- Concise internal ticket summaries and root-cause handoffs
- Structured FAQ creation
- Self-service knowledge-base articles
- Reusable customer communication macros and support workflow design

Guidelines:
1. Keep customer-facing responses empathetic, accountable, calm, and focused on concrete next steps.
2. Never promise refunds, SLAs, or policy exceptions on the company's behalf without marking them as [Confirm policy/approval before sending].
3. Structure knowledge-base articles with clear Problem, Cause, Step-by-Step Resolution, and Verification sections.`,
    icon: 'Headset',
    category: 'Customer Experience',
    accent_color: '#F79009',
    capabilities: [
      'Customer support responses',
      'FAQ creation',
      'Complaint resolution drafts',
      'Ticket summaries',
      'Knowledge-base articles',
      'Communication templates',
      'Support workflows',
    ],
    suggested_prompts: [
      'Reply to this customer complaint.',
      'Create an FAQ for my business.',
      'Summarize this support ticket.',
      'Draft a professional customer response.',
    ],
  },
  {
    id: 'agent-orbita-operations',
    name: 'ORBITA OPERATIONS',
    slug: 'orbita-operations',
    tagline: 'SOPs, execution plans, checklists, and workflows',
    description:
      'Specialized assistant for standard operating procedures, workflow design, meeting summaries, project plans, task prioritization, and process checklists.',
    system_instruction: `You are ORBITA OPERATIONS, a specialized business operations and productivity AI assistant inside the ORBITA AI workspace.
Your expertise covers:
- Standard Operating Procedures (SOPs)
- End-to-end workflow design and bottleneck analysis
- Task organization and priority matrices
- Action-oriented meeting summaries (Decisions, Owners, Due Dates)
- Project execution plans and milestone checklists
- Process documentation and team onboarding guides

Guidelines:
1. Make every SOP and project plan immediately executable: include Purpose, Scope, Roles/Owners, Numbered Steps, Inputs/Outputs, and Quality Checklist.
2. Use Markdown tables or numbered phases so teams can copy and adopt the workflow right away.
3. Highlight dependencies, handoff risks, and verification checkpoints.`,
    icon: 'Workflow',
    category: 'Operations & Execution',
    accent_color: '#0EA5E9',
    capabilities: [
      'SOP creation',
      'Workflow planning',
      'Task organization',
      'Meeting summaries',
      'Project plans',
      'Process documentation',
      'Business checklists',
    ],
    suggested_prompts: [
      'Create an SOP for my business.',
      'Build a project execution plan.',
      'Summarize these meeting notes.',
      'Design a business workflow.',
    ],
  },
];

interface SeedPromptInput {
  id: string;
  title: string;
  category: PromptCategory;
  prompt: string;
}

const SEED_PROMPTS: SeedPromptInput[] = [
  {
    id: 'tpl-sales-cold-outreach',
    title: 'B2B Value-First Cold Outreach Email',
    category: 'Sales',
    prompt:
      'Write a concise, personalized B2B outreach email to a [Target Role] at a [Company Type/Size] introducing our [Product/Service]. Focus on solving [Specific Pain Point] and end with a low-friction 15-minute discovery call CTA.',
  },
  {
    id: 'tpl-sales-objection-matrix',
    title: 'Top 5 Sales Objection Playbook',
    category: 'Sales',
    prompt:
      'Create an objection-handling matrix for selling [Product/Service] at [Price Point]. Cover price, timing, switching effort, internal buy-in, and competitor comparison with empathetic responses and follow-up questions.',
  },
  {
    id: 'tpl-marketing-30day-calendar',
    title: '30-Day Multi-Channel Content Calendar',
    category: 'Marketing',
    prompt:
      'Build a 30-day content calendar for [Business Name] targeting [Target Audience] across LinkedIn, Instagram, and email newsletter. Include post hook, format, core message, and CTA for each week.',
  },
  {
    id: 'tpl-marketing-launch-brief',
    title: 'Product Launch Campaign Brief',
    category: 'Marketing',
    prompt:
      'Draft a launch campaign plan for our new [Product/Feature]. Include positioning statement, 3 core messaging pillars, primary ad angles, and launch-week channel sequence.',
  },
  {
    id: 'tpl-research-swot',
    title: 'Structured SWOT & Risk Assessment',
    category: 'Research',
    prompt:
      'Conduct a structured SWOT analysis for [Business/Initiative] entering [Market/Segment]. Explicitly label facts vs. assumptions and recommend 3 strategic priorities based on the findings.',
  },
  {
    id: 'tpl-research-competitor',
    title: 'Competitor Positioning Comparison Framework',
    category: 'Research',
    prompt:
      'Create a competitor comparison framework for [My Business] versus [Competitor A] and [Competitor B]. Compare target segment, pricing structure, strengths, gaps, and differentiation opportunities.',
  },
  {
    id: 'tpl-finance-monthly-budget',
    title: 'Monthly Operating Budget Template',
    category: 'Finance',
    prompt:
      'Create a structured monthly operating budget for a [Business Stage/Type] with projected monthly revenue of [Amount]. Separate fixed overhead, variable COGS, payroll/contractors, marketing, and software.',
  },
  {
    id: 'tpl-finance-margin-calc',
    title: 'Unit Economics & Profit Margin Breakdown',
    category: 'Finance',
    prompt:
      'Calculate gross profit margin, contribution margin, and monthly break-even units given: Unit Price = [Price], Direct Cost = [COGS], Monthly Fixed Costs = [Fixed Costs]. Show formulas step by step.',
  },
  {
    id: 'tpl-support-deescalation',
    title: 'Empathetic Complaint Resolution Reply',
    category: 'Customer Support',
    prompt:
      'Draft a calm, empathetic customer support response to a customer frustrated about [Issue/Delay]. Acknowledge the inconvenience clearly, outline immediate corrective steps, and set clear follow-up expectations.',
  },
  {
    id: 'tpl-support-faq-builder',
    title: 'Customer Help Center FAQ Generator',
    category: 'Customer Support',
    prompt:
      'Create a 10-question customer FAQ page for [Product/Service] covering onboarding, billing, account security, troubleshooting, and support hours.',
  },
  {
    id: 'tpl-ops-sop-standard',
    title: 'Standard Operating Procedure (SOP) Blueprint',
    category: 'Operations',
    prompt:
      'Write a complete Standard Operating Procedure (SOP) for [Process Name, e.g., Client Onboarding]. Include Objective, Owner, Prerequisites, Step-by-Step Instructions, Quality Checklist, and Escalation Path.',
  },
  {
    id: 'tpl-ops-meeting-summary',
    title: 'Executive Meeting Notes & Action Tracker',
    category: 'Operations',
    prompt:
      'Transform these raw meeting notes into a clean summary with: 1) Key Decisions Made, 2) Action Items table (Task, Owner, Deadline), and 3) Open Questions / Blockers:\n\n[Paste meeting notes here]',
  },
  {
    id: 'tpl-general-weekly-plan',
    title: 'Weekly Priority & Execution Planner',
    category: 'General Productivity',
    prompt:
      'Organize my upcoming week around these top goals: [List 3-5 Goals]. Group tasks into Deep Work, Team Alignment, and Quick Wins, and flag potential scheduling bottlenecks.',
  },
  {
    id: 'tpl-general-decision-memo',
    title: '1-Page Executive Decision Memo',
    category: 'General Productivity',
    prompt:
      'Draft a concise 1-page decision memo on [Topic/Decision]. Structure it with Context, Options Considered (with pros/cons), Recommended Option, Risks, and Next Steps.',
  },
];

function seedDatabase() {
  const now = new Date().toISOString();

  const insertAgent = db.prepare(`
    INSERT OR IGNORE INTO agents (
      id, name, slug, tagline, description, system_instruction, icon, category, accent_color,
      capabilities, suggested_prompts, is_active, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `);

  const txAgents = db.transaction(() => {
    for (const agent of SEED_AGENTS) {
      insertAgent.run(
        agent.id,
        agent.name,
        agent.slug,
        agent.tagline,
        agent.description,
        agent.system_instruction,
        agent.icon,
        agent.category,
        agent.accent_color,
        JSON.stringify(agent.capabilities),
        JSON.stringify(agent.suggested_prompts),
        now
      );
    }
  });
  txAgents();

  const insertPrompt = db.prepare(`
    INSERT OR IGNORE INTO prompt_templates (
      id, user_id, title, category, prompt, is_platform, created_at
    ) VALUES (?, NULL, ?, ?, ?, 1, ?)
  `);

  const txPrompts = db.transaction(() => {
    for (const tpl of SEED_PROMPTS) {
      insertPrompt.run(tpl.id, tpl.title, tpl.category, tpl.prompt, now);
    }
  });
  txPrompts();

  const defaultConfigs: Array<[string, string]> = [
    ['free_daily_limit', '25'],
    ['starter_daily_limit', '100'],
    ['pro_daily_limit', '250'],
    ['business_daily_limit', '1000'],
    ['allow_new_signups', 'true'],
    ['maintenance_mode', 'false'],
  ];

  const insertConfig = db.prepare(`
    INSERT OR IGNORE INTO system_config (key, value, updated_at) VALUES (?, ?, ?)
  `);
  for (const [k, v] of defaultConfigs) {
    insertConfig.run(k, v, now);
  }

  // Seed official ORBITA AI subscription plan catalog in integer minor units (paise)
  const seedPlans = [
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
      sort_order: 0,
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
      limitations: [
        'Single individual workspace',
        'No multi-seat team administration',
      ],
      sort_order: 1,
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
      limitations: [
        'Individual operator license',
        'Shared team workspaces available on Business',
      ],
      sort_order: 2,
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
      limitations: [
        'Team seat sharing rolls out as multi-user sync matures',
      ],
      sort_order: 3,
    },
  ];

  const insertPlan = db.prepare(`
    INSERT OR IGNORE INTO subscription_plans (
      id, name, tagline, monthly_price_paise, annual_price_paise, currency,
      monthly_credits, daily_limit, included_agents_count, features_json, limitations_json,
      is_active, sort_order, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `);

  for (const p of seedPlans) {
    insertPlan.run(
      p.id,
      p.name,
      p.tagline,
      p.monthly_price_paise,
      p.annual_price_paise,
      p.currency,
      p.monthly_credits,
      p.daily_limit,
      p.included_agents_count,
      JSON.stringify(p.features),
      JSON.stringify(p.limitations),
      p.sort_order,
      now
    );
  }

  // Seed initial billing configuration with Sandbox default and server-side merchant UPI reference
  db.prepare(`
    INSERT OR IGNORE INTO billing_config (
      id, merchant_upi_id, default_currency, supported_currencies, enabled_payment_methods,
      payment_environment, production_payments_enabled, merchant_verified, provider_approved,
      legal_requirements_completed, updated_at
    ) VALUES ('default', ?, 'INR', ?, ?, 'sandbox', 0, 0, 0, 0, ?)
  `).run(
    'abhinavsingha369@okaxis',
    JSON.stringify(['INR']),
    JSON.stringify(['upi', 'card', 'netbanking']),
    now
  );
}

seedDatabase();

export function mapAgentRow(row: Record<string, unknown>): Agent {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    tagline: String(row.tagline),
    description: String(row.description),
    system_instruction: String(row.system_instruction),
    icon: String(row.icon),
    category: String(row.category),
    accent_color: String(row.accent_color),
    capabilities: safeParseArray(row.capabilities),
    suggested_prompts: safeParseArray(row.suggested_prompts),
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at),
  };
}

function safeParseArray(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function getSystemConfig(): SystemConfig {
  const rows = db.prepare('SELECT key, value FROM system_config').all() as Array<{ key: string; value: string }>;
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    free_daily_limit: Number(map.get('free_daily_limit') ?? 25) || 25,
    starter_daily_limit: Number(map.get('starter_daily_limit') ?? 100) || 100,
    pro_daily_limit: Number(map.get('pro_daily_limit') ?? 250) || 250,
    business_daily_limit: Number(map.get('business_daily_limit') ?? 1000) || 1000,
    allow_new_signups: (map.get('allow_new_signups') ?? 'true') === 'true',
    maintenance_mode: (map.get('maintenance_mode') ?? 'false') === 'true',
  };
}

export function mapSubscriptionPlanRow(row: Record<string, unknown>): SubscriptionPlan {
  return {
    id: String(row.id) as PlanId,
    name: String(row.name),
    tagline: String(row.tagline),
    monthly_price_paise: Number(row.monthly_price_paise),
    annual_price_paise: row.annual_price_paise === null || row.annual_price_paise === undefined
      ? null
      : Number(row.annual_price_paise),
    currency: String(row.currency || 'INR'),
    monthly_credits: Number(row.monthly_credits),
    daily_limit: Number(row.daily_limit),
    included_agents_count: Number(row.included_agents_count ?? 6),
    features: safeParseArray(row.features_json),
    limitations: safeParseArray(row.limitations_json),
    is_active: Boolean(row.is_active),
    sort_order: Number(row.sort_order ?? 0),
    updated_at: String(row.updated_at),
  };
}

export function getSubscriptionPlans(includeInactive = false): SubscriptionPlan[] {
  const sql = includeInactive
    ? 'SELECT * FROM subscription_plans ORDER BY sort_order ASC'
    : 'SELECT * FROM subscription_plans WHERE is_active = 1 ORDER BY sort_order ASC';
  const rows = db.prepare(sql).all() as Record<string, unknown>[];
  return rows.map(mapSubscriptionPlanRow);
}

export function getSubscriptionPlanById(id: string): SubscriptionPlan | null {
  const row = db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? mapSubscriptionPlanRow(row) : null;
}

export function getBillingConfig(): AdminBillingConfig {
  const row = db.prepare("SELECT * FROM billing_config WHERE id = 'default'").get() as
    | Record<string, unknown>
    | undefined;
  if (!row) {
    return {
      merchant_upi_id: 'abhinavsingha369@okaxis',
      default_currency: 'INR',
      supported_currencies: ['INR'],
      enabled_payment_methods: ['upi', 'card', 'netbanking'],
      payment_environment: 'sandbox',
      production_payments_enabled: false,
      merchant_verified: false,
      provider_approved: false,
      legal_requirements_completed: false,
      updated_at: new Date().toISOString(),
    };
  }
  return {
    merchant_upi_id: String(row.merchant_upi_id || ''),
    default_currency: String(row.default_currency || 'INR'),
    supported_currencies: safeParseArray(row.supported_currencies),
    enabled_payment_methods: safeParseArray(row.enabled_payment_methods),
    payment_environment: row.payment_environment === 'production' ? 'production' : 'sandbox',
    production_payments_enabled: Boolean(row.production_payments_enabled),
    merchant_verified: Boolean(row.merchant_verified),
    provider_approved: Boolean(row.provider_approved),
    legal_requirements_completed: Boolean(row.legal_requirements_completed),
    updated_at: String(row.updated_at),
  };
}

export function getMonthlyCreditsUsed(userId: string): number {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(usage_amount), 0) AS total
       FROM usage_records
       WHERE user_id = ? AND created_at >= ?`
    )
    .get(userId, monthStart.toISOString()) as { total: number };
  return Number(row?.total || 0);
}

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export default db;

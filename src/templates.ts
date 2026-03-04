export interface Template {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: "agent" | "human" | "docs";
  content: string;
}

export const TEMPLATES: Template[] = [
  // ── Agent-to-Agent ────────────────────────────────────────
  {
    id: "support-pipeline",
    name: "Support Pipeline",
    icon: "🤖",
    category: "agent",
    description: "Multi-agent customer support triage",
    content: `title: Customer Support Pipeline
agent: triage-agent | model: gpt-4o
context: ticketId = "T-4821" | channel = "chat"

section: Intake
trigger: ticket.created | event: support.new
step: Classify ticket | tool: classifier.run | input: ticketText
result: Classification complete | code: 200 | data: {"category":"billing","urgency":"high"}
emit: Classified | phase: triage | level: info

section: Routing
decision: Route by category | if: category == "billing" | then: step-billing | else: step-general
handoff: Transfer to billing | from: triage-agent | to: billing-agent
wait: Billing agent response | timeout: 30s | fallback: escalate

section: Resolution
call: Get customer history | status: complete | timeout: 5s
step: Draft response | id: step-billing | tool: response.generate | depends: step-2
retry: Send confirmation email | max: 3 | delay: 1000 | backoff: exponential
result: Ticket resolved | code: 200 | data: {"resolution":"refund_processed"}

checkpoint: ticket-closed
audit: Ticket resolved | by: billing-agent | at: {{timestamp}}`,
  },
  {
    id: "deploy-workflow",
    name: "Deploy Workflow",
    icon: "🚀",
    category: "agent",
    description: "CI/CD deployment with rollback",
    content: `title: Production Deployment Pipeline
agent: deploy-agent | model: claude-sonnet-4
context: env = "production" | branch = "main" | version = "2.1.0"

section: Pre-Deploy Checks
parallel: Run all checks | steps: test,lint,typecheck,security-scan
step: Run test suite | id: test | tool: ci.test | timeout: 300000
step: Lint codebase | id: lint | tool: ci.lint | timeout: 60000
step: Type check | id: typecheck | tool: ci.typecheck | timeout: 60000
step: Security scan | id: security-scan | tool: ci.audit | timeout: 120000

section: Deploy
decision: All checks passed? | if: checks == "pass" | then: step-deploy | else: step-abort
step: Deploy to staging | id: step-deploy | tool: k8s.deploy | input: version
wait: Smoke test results | timeout: 60s | fallback: step-rollback
step: Promote to production | tool: k8s.promote | depends: step-deploy

section: Rollback Plan
error: Deploy failed | fallback: step-rollback | notify: ops-team
step: Rollback to previous | id: step-rollback | tool: k8s.rollback
step: Abort pipeline | id: step-abort | tool: ci.abort | status: cancelled

section: Post-Deploy
result: Deployed v2.1.0 to production | code: 200
handoff: Transfer monitoring | from: deploy-agent | to: observability-agent
gate: Production approval | status: approved | approver: ops-lead
emit: Live | phase: monitoring | level: info
audit: Deployment complete | by: deploy-agent | at: {{timestamp}}`,
  },
  {
    id: "data-pipeline",
    name: "Data Pipeline",
    icon: "🔄",
    category: "agent",
    description: "ETL workflow with retry and parallelism",
    content: `title: Daily Data Sync Pipeline
agent: etl-agent | model: gpt-4o
context: source = "postgres" | target = "warehouse" | date = "2026-03-04"

section: Extract
trigger: schedule | event: cron.daily
step: Extract user data | tool: db.query | input: usersTable | timeout: 60000
step: Extract orders | tool: db.query | input: ordersTable | timeout: 60000
step: Extract events | tool: db.query | input: eventsTable | timeout: 60000
retry: Extract failed records | max: 3 | delay: 5000 | backoff: exponential

section: Transform
parallel: Transform datasets | steps: transform-users,transform-orders,transform-events
step: Clean user records | id: transform-users | tool: transform.clean | depends: step-1
step: Aggregate orders | id: transform-orders | tool: transform.aggregate | depends: step-2
step: Dedupe events | id: transform-events | tool: transform.dedupe | depends: step-3
progress: 3/3 transforms complete

section: Load
step: Load to warehouse | tool: warehouse.load | priority: 1
wait: Validation query | timeout: 30s | fallback: step-retry
result: 1.2M rows synced | code: 200 | data: {"users":450000,"orders":680000,"events":70000}

checkpoint: sync-complete
audit: Daily sync finished | by: etl-agent | at: {{timestamp}}`,
  },

  // ── Human-to-Agent ────────────────────────────────────────
  {
    id: "onboarding",
    name: "User Onboarding",
    icon: "👤",
    category: "human",
    description: "Agent-executed onboarding flow",
    content: `title: User Onboarding Flow
agent: onboard-agent | model: claude-sonnet-4
context: userId = "u_123" | plan = "pro"

section: Verification
step: Verify email address | tool: email.verify | input: userId | output: emailStatus
step: Create user workspace | tool: ws.create | depends: step-1 | input: userId
decision: Check plan | if: plan == "pro" | then: step-3 | else: step-4
step: Enable pro features | id: step-3 | tool: features.enable | status: pending
step: Send welcome email | id: step-4 | tool: email.send

section: Setup
step: Initialize preferences | tool: prefs.init | input: userId
step: Import existing data | tool: import.run | timeout: 60000
wait: User confirms profile | timeout: 300s | fallback: step-reminder

section: Completion
result: Onboarding complete | code: 200 | data: {"workspaceId":"ws_456"}
checkpoint: onboarding-complete
handoff: Transfer to support | from: onboard-agent | to: success-agent
audit: Onboarding finished | by: onboard-agent | at: {{timestamp}}`,
  },
  {
    id: "content-campaign",
    name: "Content Campaign",
    icon: "📣",
    category: "human",
    description: "Marketing campaign with AI generation",
    content: `title: Q2 Product Launch Campaign
agent: marketing-agent | model: claude-sonnet-4
context: product = "IntentText v2.1" | audience = "developers"

section: Research
step: Analyze competitor campaigns | tool: research.competitors | timeout: 120000
step: Survey target audience | tool: survey.send | input: audience
wait: Survey responses | timeout: 86400s | fallback: step-3
result: Research complete | data: {"responses":342,"sentiment":"positive"}

section: Content Creation
parallel: Generate content | steps: blog,social,email
step: Write blog post | id: blog | tool: copywriter.blog | priority: 1
step: Create social posts | id: social | tool: copywriter.social | depends: blog
step: Draft email sequence | id: email | tool: copywriter.email | depends: blog
decision: Quality check | if: confidence > 0.85 | then: step-publish | else: step-review

section: Review & Publish
step: Human review | id: step-review | status: blocked | source: human
step: Schedule publishing | id: step-publish | tool: cms.schedule
retry: Publish to all channels | max: 2 | delay: 3000

section: Tracking
status: Campaign live | phase: monitoring | level: info
loop: Track daily metrics | over: campaignDays | do: step-metrics
step: Pull analytics | id: step-metrics | tool: analytics.pull

audit: Campaign launched | by: marketing-agent | at: {{timestamp}}`,
  },
  {
    id: "meeting-notes",
    name: "Meeting Notes",
    icon: "🗓️",
    category: "human",
    description: "Agenda, decisions, and action items",
    content: `title: Sprint Planning — Week 12
summary: Reviewed Q2 priorities and assigned tasks for the week.

section: Attendees
note: @ahmed, @sarah, @mike, @lisa

section: Agenda
- Review last sprint results
- Discuss IntentText v2.1 launch
- Assign tasks for the week

section: Discussion
ask: Should we delay the launch for more testing?
quote: The test suite is solid — 220 tests all passing. Let's ship it. | by: Ahmed

info: Team agreed to proceed with launch on Wednesday.
warning: Need to coordinate with marketing on the announcement.

section: Action Items
task: Finalize deployment script | owner: Ahmed | due: Monday | priority: high
task: Write changelog blog post | owner: Sarah | due: Tuesday
task: Update documentation site | owner: Mike | due: Wednesday
task: Coordinate launch announcement | owner: Lisa | due: Wednesday
done: Merge v2.1 branch to main | owner: Ahmed

section: Next Steps
note: Launch Wednesday at 10am UTC. Standup moved to Thursday.
tip: Share launch notes with community on Discord.

summary: v2.1 launches Wednesday. All tasks assigned and tracked above.`,
  },

  // ── Documentation ─────────────────────────────────────────
  {
    id: "api-docs",
    name: "API Documentation",
    icon: "🔌",
    category: "docs",
    description: "REST API endpoints and parameters",
    content: `title: API Documentation — IntentText Service
summary: REST API for parsing and rendering IntentText documents.

section: Overview
note: Base URL: *https://api.intenttext.dev/v2*
note: All requests require an *Authorization* header with a Bearer token.
info: Rate limit: 1000 requests per minute per API key.

section: Parse Document
sub: POST /parse
note: Parse an IntentText string into structured JSON.

| Parameter | Type | Required | Description |
| content | string | Yes | Raw .it content |
| options | object | No | Parser options |

section: Render HTML
sub: POST /render
note: Render a parsed document to styled HTML.

| Parameter | Type | Required | Description |
| document | object | Yes | Parsed IntentDocument |
| theme | string | No | "light" or "dark" (default: "light") |

success: Returns 200 with the rendered HTML string.

section: Error Codes
| Code | Meaning | Description |
| 400 | Bad Request | Invalid .it syntax |
| 401 | Unauthorized | Missing or invalid token |
| 429 | Rate Limited | Too many requests |
| 500 | Server Error | Internal error |

summary: Full API reference. See GitHub for SDK examples.`,
  },
  {
    id: "project-plan",
    name: "Project Plan",
    icon: "📋",
    category: "docs",
    description: "Goals, milestones, and team tasks",
    content: `title: *IntentText* v2.1 Release Plan
summary: Ship the inter-agent communication update.

section: Goals
- Complete parser support for 6 new keywords
- Add HTML rendering for all new blocks
- Pass 220+ tests with full backward compatibility
- Publish to npm as @intenttext/core v2.1.0

section: Team
| Role | Name | Focus |
| Lead | Ahmed | Architecture & parser |
| Frontend | Sarah | Renderer & demo app |
| Testing | Mike | Test suite & CI |

section: Milestones

sub: Phase 1 — Core Keywords
done: Add status, result, handoff blocks | owner: Ahmed
done: Add wait, parallel, retry blocks | owner: Ahmed
done: Numeric property coercion | owner: Ahmed

sub: Phase 2 — Rendering
done: HTML renderers for all 6 blocks | owner: Sarah
done: CSS styling with icons and badges | owner: Sarah

sub: Phase 3 — Testing & Docs
done: 33 new tests (220 total passing) | owner: Mike
done: Update SPEC.md with v2.1 blocks | owner: Ahmed
task: Update demo app with v2.1 templates | owner: Sarah | due: Wednesday

section: Risks
warning: Browser bundle size may increase — monitor.
tip: Keep new blocks consistent with v2.0 design patterns.

progress: 9/10 milestones complete
summary: On track for Wednesday release.`,
  },
  {
    id: "blank",
    name: "Blank Document",
    icon: "📄",
    category: "docs",
    description: "Start from scratch",
    content: `title: Untitled Document

note: Start writing here…
`,
  },
];

# RITUVIA Wallet、Stripe、Crypto 与 AI — Codex Execution Prompt

## Goal

在现有 RITUVIA 仓库中，以当前真实代码和浏览器行为为准，实施钱包身份、Stripe Test Mode、USDC on Base sandbox 和 LLM-agnostic Deep Reading 架构，同时完整保留免费体验、Credits 安全性、隐私边界与现有产品循环。

## Authoritative inputs

阅读并遵守：

1. 所有适用的 `AGENTS.md`。
2. `RITUVIA_COMMERCIAL_MODEL_MASTER_SPEC_2026-07-20.md`。
3. `RITUVIA_WALLET_PAYMENTS_AI_CODEX_IMPLEMENTATION_BRIEF_2026-07-23.md`。
4. `RITUVIA_WALLET_STRIPE_CRYPTO_AI_UPDATED_PROTOTYPE_2026-07-23.html`。
5. 当前仓库中的 `PROJECT_STATUS.md`、`BACKLOG.md`、`ROADMAP.md`、`DECISIONS.md`、产品、架构、支付、安全、API 与测试文档。

仓库和浏览器现实高于过期文档。不要根据原型声称生产能力已经完成。

## Product invariants

- 保留：`Question → Interpretation → Intention → Ritual → Journal → Revisit`。
- Daily Tarot 和基础 Tarot 必须完整免费，不得调用 LLM。
- Numerology 数字和 Astrology 天文事实不得由 AI 生成或修改。
- AI 只用于明确标记的 Deep Readings。
- 免费蜡烛和香始终存在。
- 付费不能被描述为提高运气、灵验度或愿望实现概率。
- Plus 只使用 Stripe 自动续订。
- 一次性 Credit Packs 可使用 Stripe 或 USDC on Base。
- 钱包付款不得自动成为钱包登录。
- 任何 return URL 都不能发放 Credits 或权益。
- 客户端不能决定价格、Credit 数量、余额、资格、付款结果或退款结果。
- 生产 AI、Stripe 和 Crypto 必须保持在 Owner approval gate 后。

## First execution: Phase 0 only

先完成现实审计，不要直接大规模编码。

### Required work

1. 阅读适用文档和代码。
2. 安装依赖并运行当前项目。
3. 在真实浏览器中检查桌面和移动端：
   - 登录
   - 账户
   - Plus / Credits
   - Checkout
   - Orders / refunds
   - Deep Readings
   - Sanctuary
4. 定位当前：
   - auth/session 模块
   - account linking
   - payment provider adapter
   - order / ledger / entitlement
   - AI provider / prompt / safety
   - database migrations / RLS
5. 对照最终 HTML 和 Implementation Brief，建立差距矩阵。
6. 输出建议模块边界、schema migration、API contracts 和逐阶段任务。
7. 检查是否已有：
   - EIP-6963 / WalletConnect / SIWE
   - Stripe Customer / Checkout / SetupIntent / Portal / Webhook
   - crypto checkout provider
   - Credit reservation / reversal
   - DeepSeek / Kimi adapters
8. 更新有证据支撑的状态文档；不要把计划写成已完成。
9. 停止并提交审计结果，等待 Owner 确认 Phase 1。

## Required output for Phase 0

```md
# AUDIT RESULT

## Current reality

## Working capabilities

## Missing or unsafe capabilities

## Architecture map

## Schema and migration plan

## API contract plan

## Security and privacy gaps

## Test gaps

## Proposed implementation sequence

## Files updated

## Evidence

## Risks and Owner decisions

## Next single vertical slice
```

## Phase 1 after approval — Wallet authentication

实现：

- EIP-6963 discovery。
- Reown AppKit / WalletConnect。
- MetaMask、Coinbase Wallet、Rabby。
- SIWE EIP-4361 challenge / verify。
- server nonce、expiry、domain、URI、chain validation。
- EOA 和批准的 ERC-1271 支持。
- link/unlink wallet。
- wallet account/chain/disconnect 后会话权限失效。
- wallet payment 不自动成为 identity。
- 安全与并发测试。

## Phase 2 after approval — Stripe Test Mode

实现：

- Stripe Customer。
- Credit Pack Hosted Checkout。
- Plus Monthly / Annual subscriptions。
- SetupIntent / saved methods。
- Customer Portal。
- verified raw-body Webhook。
- duplicate / out-of-order / replay / refund / dispute。
- internal order before Checkout。
- Webhook 后才发放 Credits。
- reconciliation。
- production remains disabled。

## Phase 3 after approval — USDC/Base sandbox

实现 `CryptoCheckoutProvider`，首个 adapter 为 Coinbase Business Checkouts：

- 一次性 Credit Pack。
- USDC on Base。
- single-use checkout URL。
- webhook + API reconciliation。
- token/network/amount validation。
- refund / Credit reversal。
- no static deposit address。
- no private data onchain or metadata。
- production remains disabled。

## Phase 4 after approval — AI adapters

实现：

- `AIProvider` abstraction。
- DeepSeek adapter。
- Kimi adapter。
- ModelPolicy / PromptVersion / SafetyPolicyVersion。
- DeepSeek V4 Flash for normal deep readings。
- DeepSeek V4 Pro for annual reading。
- Kimi K2.5 fallback when allowed。
- timeout、retry、circuit breaker、cost telemetry。
- Credit reserve → generate → validate → persist → consume。
- automatic release/reversal on every failure path。
- no raw private content in logs, analytics, URLs, payment metadata or error reporting。
- production remains disabled。

## Engineering constraints

- Do not hard-code secrets or provider-specific logic in UI components.
- Do not expose API keys to the browser.
- Use integer cents and authoritative server catalog.
- Use append-only Credit ledger and idempotent operations.
- Use transactions or outbox for order/payment/Credit consistency.
- Use feature flags and kill switches.
- Preserve accessibility, reduced motion, keyboard and mobile behavior.
- Add no broad rewrite or unrelated design changes.
- Every completed claim requires test and browser evidence.

## Done when

A phase is complete only when:

- Unit, integration and database tests pass.
- Concurrency and idempotency tests pass.
- Browser paths pass on desktop and mobile.
- Console has no unexpected errors.
- Network inspection shows no unintended private-data transmission.
- Security-negative tests pass.
- Status and backlog are updated with evidence.
- Production flags remain false unless Owner explicitly approves.


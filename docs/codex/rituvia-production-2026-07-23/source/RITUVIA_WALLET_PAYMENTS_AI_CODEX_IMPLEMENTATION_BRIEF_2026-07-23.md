# RITUVIA Wallet、Stripe、Crypto 与 AI 接入实施说明

> 日期：2026-07-23  
> 面向：Codex、产品、后端、支付、安全与运营  
> 对应用户体验原型：`RITUVIA_WALLET_STRIPE_CRYPTO_AI_UPDATED_PROTOTYPE_2026-07-23.html`

## 1. 本次决策摘要

本次更新在不改变 RITUVIA 核心产品循环的前提下，加入四项能力：

1. **钱包登录与账户连接**：支持 MetaMask、Coinbase Wallet、Rabby 与 WalletConnect；登录只签署认证消息，不移动资金。
2. **Stripe 支付与付款方式管理**：银行卡、Apple Pay、Google Pay、Link；Plus 订阅只走 Stripe；卡片由 Stripe 保存。
3. **Crypto 支付**：一次性 Credit Pack 支持 **USDC on Base**；建议优先采用 Coinbase Business Checkouts。若未来美国主体获得 Stripe 稳定币能力，也可通过统一适配层切换。
4. **AI Deep Readings**：AI 只用于付费深度解读；Daily Tarot、基础 Tarot、Numerology 计算与 Astrology 天文事实保持确定性。

这些决策继续遵守商业模型规范：免费体验完整、AI 失败自动退回 Credits、付款不代表更高“灵验度”、永久收藏与一次性仪式严格区分。

## 2. 当前现实边界

### 已在交互原型中完成

- 钱包登录与签名确认流程。
- 钱包作为登录方式、账户附加方式和付款方式的明确区分。
- Stripe 付款方式添加与管理界面。
- Stripe Credit Pack 与 Plus 结账状态。
- USDC on Base 的钱包连接、付款确认和订单记录。
- 订单中显示 Stripe 或 USDC/Base 付款方式。
- Deep Reading 的模型策略路由和结果元数据。
- DeepSeek 主模型、Kimi fallback 的产品级策略。
- 桌面和移动端核心路径验收。

### 尚未成为生产能力

- 没有真实钱包 Provider、WalletConnect、SIWE nonce 服务和链上签名验证。
- 没有真实 Stripe Customer、Checkout Session、SetupIntent、Customer Portal 或 Webhook。
- 没有真实 Coinbase Business Checkout、链上支付确认或退款。
- 没有真实 DeepSeek/Kimi API 请求。
- 没有服务器权威 Credit ledger、并发防双花和真实 entitlement 服务。
- 没有生产密钥、供应商承保、税务、法律文本与 Owner 激活审批。

Codex 不得根据原型状态声称这些能力已经生产完成。

## 3. 用户体验要求

### 3.1 登录方式

登录页提供：

- Email Magic Link
- Passkey
- Google
- Apple
- Wallet

钱包登录文案必须清楚说明：

> 钱包登录只请求一条认证签名，不会移动资金，也不会批准付款。

钱包登录、账户绑定和付款钱包是三个独立动作：

- **Sign in with wallet**：建立身份会话。
- **Link wallet**：把钱包附加到已有账户。
- **Connect payment wallet**：仅用于本次 USDC 付款。

不得因为用户用某个钱包付款，就自动把该钱包设为登录方式。

### 3.2 支付方式

#### Stripe

适用于：

- Plus Monthly
- Plus Annual
- 6 / 15 / 40 Credit Packs

支持展示：

- Card
- Apple Pay
- Google Pay
- Link

用户可以在账户中管理付款方式。RITUVIA 绝不接触完整卡号。

#### Crypto

MVP 建议只提供：

- Asset：USDC
- Network：Base
- Product：一次性 Credit Packs
- Provider：Coinbase Business Checkouts

暂不用于：

- Plus 自动续订
- Sanctuary 内部单项微支付
- 用户间转账
- 储值余额
- 代币、提现或可交易资产

不要提供静态收款地址，不要依赖用户手动提交交易哈希作为付款成功依据。

### 3.3 AI 使用范围

AI 只能用于：

| 产品 | Credits | 主模型策略 |
|---|---:|---|
| 一张牌个性化深读 | 1 | DeepSeek V4 Flash，non-thinking |
| 三张牌语境综合 | 2 | DeepSeek V4 Flash，thinking |
| Relationship Reflection | 3 | DeepSeek V4 Flash，thinking |
| 30-Day Theme | 4 | DeepSeek V4 Flash，thinking |
| Your Year in Reflection | 6 | DeepSeek V4 Pro，thinking-high |

Fallback：Kimi K2.5，是否自动 fallback 由产品策略决定。

以下功能不得调用 LLM：

- Daily Tarot 抽牌与基础牌义
- 一张牌/三张牌的抽牌事实
- Card identity / orientation
- Numerology 公式和结果
- Astrology placement / aspect calculation
- Credit 价格、余额、资格与支付状态

## 4. 推荐技术架构

## 4.1 钱包与 SIWE

推荐栈：

- Reown AppKit / WalletConnect
- wagmi
- viem
- EIP-6963 多 Provider 发现
- Sign-In with Ethereum（EIP-4361）

### 登录流程

1. 客户端请求 `POST /v1/auth/wallet/challenge`。
2. 服务端生成一次性 nonce，绑定：
   - session
   - domain
   - URI
   - chain ID
   - expiration
3. 客户端构造 SIWE message。
4. 用户签名。
5. 客户端提交 `POST /v1/auth/wallet/verify`。
6. 服务端验证：
   - nonce 未使用且未过期
   - domain 与 URI 匹配
   - chain ID 合法
   - signature 与 address 匹配
   - issued-at / expiration 合法
7. 服务端原子地消费 nonce，创建或恢复账户会话。
8. Session cookie 使用 HttpOnly、Secure、SameSite。

### 必须处理

- EOA 签名。
- ERC-1271 智能合约钱包验证，若当前钱包栈支持。
- `accountsChanged`、`chainChanged`、disconnect。
- 钱包切换后不得继续沿用旧认证权限。
- 同一钱包不能在并发请求中重复创建不同账户。
- 账户合并必须明确确认，且可审计。
- 恢复地址仅用于展示，不可作为服务器授权依据。

### 建议表结构

```sql
wallet_identities (
  id uuid primary key,
  user_id uuid not null,
  address_normalized text not null,
  chain_family text not null default 'evm',
  auth_provider text not null,
  is_primary boolean not null default false,
  verified_at timestamptz not null,
  revoked_at timestamptz,
  unique(chain_family, address_normalized)
);

wallet_auth_nonces (
  id uuid primary key,
  nonce_hash text not null unique,
  session_binding text not null,
  domain text not null,
  uri text not null,
  chain_id bigint not null,
  expires_at timestamptz not null,
  consumed_at timestamptz
);
```

## 4.2 Stripe

推荐：Stripe Hosted Checkout + Customer Portal。

### 一次性 Credit Pack

1. 客户端发送 product code + idempotency key。
2. 服务端读取权威 catalog。
3. 创建内部订单 `created`。
4. 创建 Stripe Checkout Session。
5. 返回 Hosted Checkout URL。
6. Return URL 只显示 pending。
7. 只有验签 Webhook 将订单变为 paid。
8. 同一事务或 outbox 流程发放 Purchased Credits。
9. 定时 reconciliation 对比 Stripe 与内部订单。

### Plus

- Monthly：US$9.99/month，8 Credits/month。
- Annual：US$69.99/year，仍每月发放 8 Credits。
- 使用 Stripe Subscription。
- 通过 Customer Portal 管理付款方式与取消。
- Purchased Credits 不随 Plus 取消而删除。
- Plus Credits 按月到期规则必须在购买前展示并版本化。

### 保存付款方式

- 使用 Stripe Customer。
- 一次性付款可选择保存 payment method。
- 订阅支付自动保留所需 payment method。
- 可使用 SetupIntent 单独添加付款方式。
- 数据库只存 Stripe customer/payment method ID、brand、last4、expiry 等非敏感展示字段。
- 禁止存 PAN、CVC 或完整 billing payload。

### Webhook 必须支持

- 原始 body 验签。
- timestamp tolerance。
- replay prevention。
- event ID 去重。
- out-of-order event。
- checkout completed。
- payment failed。
- refund。
- dispute。
- subscription updated / deleted / past_due。
- Customer Portal 变更。

## 4.3 Crypto Checkout

推荐默认适配器：`CoinbaseBusinessCheckoutProvider`。

### MVP 流程

1. 客户端发送 Credit Pack product code + idempotency key。
2. 服务端建立内部订单。
3. 服务端创建单次 Coinbase Checkout URL：
   - 资产：USDC
   - 网络：Base
   - 金额：来自权威 catalog
   - metadata：只包含 order ID 等非敏感标识
4. 用户从钱包付款。
5. Return URL 只显示 pending。
6. Provider Webhook / API reconciliation 确认付款。
7. 服务端发放 Credits。
8. 订单保存 provider checkout ID、transaction hash、network、asset。

### 关键规则

- 只接受期望网络和资产。
- 支付金额不足或错误网络不得发放 Credits。
- 超额付款进入人工处理或明确政策，不自动扩大 Credits。
- 支付钱包不自动成为身份钱包。
- 退款只通过供应商支持的原路径执行。
- 订单和 Credit reversal 必须关联。
- 不把用户私密问题放入链上 metadata。

### Stripe Stablecoin 备用路径

Stripe 官方稳定币收款当前存在地区资格限制。只有当法律主体、国家和 Stripe 承保确认满足要求时，才允许启用 `StripeStablecoinProvider`。不要在资格未确认时把它作为唯一生产路径。

## 4.4 支付 Provider 接口

```ts
interface PaymentProvider {
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;
  verifyWebhook(rawBody: Uint8Array, headers: Headers): Promise<PaymentEvent>;
  refund(input: RefundInput): Promise<RefundResult>;
  reconcile(orderId: string): Promise<ReconciliationResult>;
}

interface CryptoCheckoutProvider extends PaymentProvider {
  supportedAssets(): Promise<SupportedCryptoAsset[]>;
  validateSettlement(event: PaymentEvent, expected: ExpectedSettlement): ValidationResult;
}
```

## 4.5 AI Provider Adapter

```ts
interface AIProvider {
  generate(request: InterpretationRequest, policy: ModelPolicy): Promise<InterpretationResult>;
  health(): Promise<ProviderHealth>;
}

interface ModelPolicy {
  productCode: string;
  primaryProvider: 'deepseek' | 'kimi';
  primaryModel: string;
  fallbackProvider?: 'deepseek' | 'kimi';
  fallbackModel?: string;
  thinkingMode: 'off' | 'standard' | 'high';
  maxInputTokens: number;
  maxOutputTokens: number;
  timeoutMs: number;
  maxRetries: number;
  fallbackAllowed: boolean;
}
```

核心对象：

- `AIProvider`
- `ModelPolicy`
- `PromptVersion`
- `SafetyPolicyVersion`
- `InterpretationRequest`
- `InterpretationResult`
- `GenerationUsage`
- `ProviderFailure`
- `FallbackDecision`

### Provider 策略

默认：

```yaml
one_card:
  provider: deepseek
  model: deepseek-v4-flash
  mode: non-thinking
  fallback: kimi-k2.5

three_card:
  provider: deepseek
  model: deepseek-v4-flash
  mode: thinking
  fallback: kimi-k2.5

relationship:
  provider: deepseek
  model: deepseek-v4-flash
  mode: thinking
  fallback: kimi-k2.5

theme_30:
  provider: deepseek
  model: deepseek-v4-flash
  mode: thinking
  fallback: kimi-k2.5

year_reflection:
  provider: deepseek
  model: deepseek-v4-pro
  mode: thinking-high
  fallback: kimi-k2.5
```

所有模型名称必须通过配置和 feature flag 管理，不得散落在 UI 或业务代码里。模型更新时需要固定回归集、安全评估和成本评估。

### “免费 AI”现实说明

不要把 DeepSeek 或 Kimi API 视为永久免费基础设施。官方 API 是按量计费服务；如果账户存在赠送额度，可以优先消耗，但产品成本模型必须按付费价格计算。

建议：

- 免费功能不调用模型。
- 只有 Credit 产品调用模型。
- DeepSeek V4 Flash 作为低成本默认。
- 年度高价值内容使用 V4 Pro。
- Kimi K2.5 只在策略允许时 fallback。
- 每次生成记录 token、延迟、provider、model、cache、cost estimate，不记录私密原文。

## 5. AI 生成事务顺序

1. 服务端验证用户、产品资格和 Credit 可用量。
2. 创建 idempotent Credit reservation。
3. 组装经过最小化的数据输入。
4. 调用主 Provider。
5. 必要时按策略 fallback。
6. 执行结构、事实和安全检查。
7. 持久化完整结果与版本信息。
8. 最终确认 Credit consumption。
9. 返回结果。

失败、超时、空结果、安全不合格或持久化失败时：

- 自动 release / reverse reservation。
- 重试不得重复扣除。
- 客户端获得清楚的 retry 状态。

## 6. 隐私与日志

严禁在以下位置放入私密问题、出生资料、关系细节、意图或日志原文：

- URL / query string
- browser history
- analytics
- payment metadata
- blockchain metadata
- Sentry breadcrumb / error payload
- server access log
- model telemetry
- screenshots
- support attachment（除非用户明确选择）

模型请求：

- 在 Provider 支持时关闭训练与长期 retention。
- 只发送完成该产品所需的最少上下文。
- 日志只记录 hash、字符数、token 数、模型、延迟、错误分类与成本。
- AI 个性化同意与营销、分析、服务通知分开。

## 7. 环境变量

```env
# AI
DEEPSEEK_API_KEY=
KIMI_API_KEY=
AI_DEFAULT_PROVIDER=deepseek
AI_FALLBACK_PROVIDER=kimi
AI_MODEL_ONE_CARD=deepseek-v4-flash
AI_MODEL_THREE_CARD=deepseek-v4-flash
AI_MODEL_RELATIONSHIP=deepseek-v4-flash
AI_MODEL_30_DAY=deepseek-v4-flash
AI_MODEL_YEAR=deepseek-v4-pro
AI_KIMI_FALLBACK_MODEL=kimi-k2.5
AI_PRODUCTION_ENABLED=false

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PLUS_MONTHLY=
STRIPE_PRICE_PLUS_ANNUAL=
STRIPE_PRICE_CREDITS_6=
STRIPE_PRICE_CREDITS_15=
STRIPE_PRICE_CREDITS_40=
STRIPE_PRODUCTION_ENABLED=false

# Coinbase Business
COINBASE_BUSINESS_API_KEY=
COINBASE_BUSINESS_API_SECRET=
COINBASE_WEBHOOK_SECRET=
CRYPTO_CHECKOUT_ENABLED=false
CRYPTO_ASSET=USDC
CRYPTO_NETWORK=base

# Wallet connection
REOWN_PROJECT_ID=
SIWE_DOMAIN=
SIWE_URI=
WALLET_LOGIN_ENABLED=false

# Approval gates
OWNER_APPROVED_LIVE_AI=false
OWNER_APPROVED_LIVE_PAYMENTS=false
OWNER_APPROVED_CRYPTO_PAYMENTS=false
```

密钥只能存在服务端 secret store，不得进入客户端 bundle、日志、截图或仓库。

## 8. 推荐 API 合同

```http
POST /v1/auth/wallet/challenge
POST /v1/auth/wallet/verify
POST /v1/account/wallets/link/challenge
POST /v1/account/wallets/link/verify
DELETE /v1/account/wallets/:walletId

GET  /v1/account/payment-methods
POST /v1/account/payment-methods/setup
DELETE /v1/account/payment-methods/:id
POST /v1/account/billing-portal

POST /v1/commerce/checkouts
GET  /v1/commerce/orders/:id
POST /v1/commerce/orders/:id/refund
POST /v1/webhooks/stripe
POST /v1/webhooks/coinbase

POST /v1/deep-readings/reservations
POST /v1/deep-readings/generate
GET  /v1/deep-readings/:id
```

所有写请求需要：

- authenticated subject
- idempotency key
- CSRF / origin controls where applicable
- server-side catalog lookup
- structured audit event

## 9. 必测场景

### Wallet

- 多 injected wallet 发现。
- WalletConnect 移动连接。
- nonce 重放。
- nonce 过期。
- domain / URI 不匹配。
- 切换账户后旧会话失效。
- 同一钱包并发首次登录。
- 已有邮箱账户绑定钱包。
- 钱包冲突与账户合并。
- ERC-1271。

### Stripe

- 成功、失败、取消。
- 保存卡与不保存卡。
- Plus Monthly / Annual。
- 重复 Webhook。
- 乱序 Webhook。
- Refund / dispute。
- Customer Portal 取消。
- `past_due`、grace period。
- Return URL 不发放 Credits。

### Crypto

- USDC Base 成功。
- 错误网络。
- 错误 token。
- 少付、重复付、延迟确认。
- Webhook 重放。
- Return URL 不发放 Credits。
- 退款与 Credit reversal。
- 付款钱包不自动成为登录方式。

### AI

- 免费功能网络层无模型请求。
- 各产品正确模型策略。
- 主 Provider timeout。
- fallback。
- 安全失败自动退回 Credits。
- 写入失败自动退回 Credits。
- 同一 idempotency key 不重复扣款。
- 多标签页并发不能双花。
- 私密原文不进入日志、分析和支付 metadata。

## 10. 分阶段实施顺序

### Phase 0 — Reality audit

- 检查仓库、文档、数据库、真实浏览器、当前支付与 AI 实现。
- 更新状态与差距。
- 不激活真实服务。

### Phase 1 — Wallet authentication

- Provider discovery、WalletConnect、SIWE、账户绑定。
- 服务端 nonce 与会话失效。
- 完整安全测试。

### Phase 2 — Stripe Test Mode

- Customer、Checkout、SetupIntent、Portal、Webhook、订单和 Credits。
- Plus 生命周期和 refund。

### Phase 3 — Crypto sandbox

- Coinbase Business Checkout。
- USDC/Base。
- Webhook、reconciliation、refund/reversal。

### Phase 4 — AI adapters

- DeepSeek、Kimi adapter。
- Model policy、prompt version、safety、cost telemetry。
- Reservation / consumption / reversal。

### Phase 5 — Beta acceptance

完整验证：

`Wallet/Email login → Free reading → AI Deep Reading → Credit use → Stripe/USDC purchase → Sanctuary → Journal → Revisit → Account/Billing/Refund`

## 11. Production gates

以下条件全部满足前，必须保持关闭：

- 支付服务商明确支持真实业务类别。
- 公司主体、首发国家、税务、退款和账单描述符确认。
- Crypto 业务、制裁和链上监控政策通过审查。
- 隐私政策、条款和 AI 数据处理协议完成。
- 模型供应商 retention / training 设置完成。
- 生产监控、对账、备份、回滚和 kill switch 完成。
- Owner 明确批准。


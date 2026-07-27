# RITUVIA Wallet、Stripe、Crypto 与 AI 更新版原型 QA

> 日期：2026-07-23  
> 文件：`RITUVIA_WALLET_STRIPE_CRYPTO_AI_UPDATED_PROTOTYPE_2026-07-23.html`  
> SHA-256：`e9d75c9c118be64cc779d182f01ec332d150b520fa9f0eb497f58fbf5fea5740`

## 结果

- 浏览器：Chromium，headless。
- 桌面视口：1440 × 1000，中文。
- 移动视口：390 × 844，英文。
- 检查项：12。
- 通过：12。
- 失败：0。
- Page errors：0。
- Unexpected `console.error`：0。
- 外部网络请求：0。
- 移动端水平溢出：0。

## 通过的路径

1. 更新版 HTML 正常加载。
2. 页面标题正确。
3. 登录页显示钱包入口。
4. MetaMask 钱包登录确认流程。
5. 登录与付款方式页面。
6. 添加并保存 Stripe Visa 付款方式。
7. 6 Credits 使用 Coinbase Wallet + USDC on Base 完成结账状态。
8. 15 Credits 使用 Stripe 完成结账状态。
9. 订单同时记录 Stripe 与 USDC/Base 付款方式。
10. AI 只在 Deep Reading 路径启动。
11. 一张牌深度解读模型策略为 `deepseek-v4-flash`。
12. 英文移动端钱包入口和响应式布局通过。

## 关键状态验证

### Wallet

- 入口：`Continue with a wallet / 使用钱包继续`。
- Provider：MetaMask、Coinbase Wallet、Rabby、WalletConnect。
- 登录签名与付款确认分离。
- 付款钱包不会自动成为登录方式。

### Stripe

- 银行卡、Apple Pay、Google Pay、Link 产品界面。
- 保存付款方式。
- 结账完成后订单显示 `Stripe · Visa •••• 4242`。

### Crypto

- 资产：USDC。
- 网络：Base。
- 一次性 Credit Pack。
- 订单记录钱包缩略地址和付款方式。

### AI

- Daily Tarot 和基础解读未触发模型。
- Deep Reading 才进入 AI 流程。
- 原型状态记录：
  - provider：`deepseek`
  - model：`deepseek-v4-flash`
  - policy：`deep_one`

## 说明

该 QA 验证的是用户体验和本地状态机，不是生产供应商联调证明。真实钱包签名、Stripe、Coinbase Checkout、DeepSeek/Kimi API、Webhook、Credit ledger 和并发安全仍需按实施说明由 Codex 在仓库中完成。


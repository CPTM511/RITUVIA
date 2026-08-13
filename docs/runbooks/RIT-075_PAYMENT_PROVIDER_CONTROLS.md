# RIT-075 支付/Provider 安全关闭运行手册

## 1. 当前结论

RIT-075 已把新购买入口接到同一份 `payment-route-control.v1` 合同。当前默认仍是关闭；本任务没有
启用国家、支付方式、provider、Stripe Live、crypto、价格、付费 UI、凭证或部署。

## 2. 用户从哪里进入，Button 在哪里

当前批准的受保护封闭 Beta 是免费体验，普通用户不应看到生产购买 Button。

- 冻结的 Test Mode 历史入口：登录后 `/en/plans` 卡片底部可能显示
  `Continue to secure checkout`；它不是获批生产入口。
- 本地模拟支付页：`/en/checkout/local` 的 `Complete local test payment` 只在 local 环境验证
  历史完整性，不收卡、不收真钱。
- 支付返回页：`/en/checkout/return` 只读取服务端订单状态，redirect 本身不授予权益。
- 当前没有 Web/Admin “Payment kill switch” Button，也没有激活 API。控制身份和任何 on/off
  写入仍属于单独的运营/Owner 审批动作。

## 3. 新购买如何判定

每一次新购买都必须在同一个服务端时间点通过三层证据：

1. `market.country_activation` 对精确国家为 on；
2. fiat 使用 `payments.fiat_checkout`，crypto 使用 `payments.crypto_checkout`，且精确国家为 on；
3. Country Policy 精确批准 country、currency/asset、provider、method、fiat/crypto、recurring。

结果同时绑定 registry/flag/policy 版本。任何缺失、过期、scope/time/version 漂移、伪造的默认启用、
未批准 provider/method 或非空 fallback 列表都拒绝。系统不会尝试第二个 provider。

## 4. 工作流边界

### 4.1 创建订单或订阅

控制在订单写入、订阅预留和 provider 调用之前执行。关闭时不会创建新的本地购买义务，不会调用
Stripe/local adapter，也不会返回新的 Checkout URL。

### 4.2 已有 Checkout URL 回放

服务端在返回已附着且未过期的 URL 前重新读取控制。若 checkout 已关闭，服务端返回脱敏
`503 COMMERCE_UNAVAILABLE`，不再披露 URL。用户在关闭前自行复制的 provider URL 无法由本仓库
撤销，这是剩余风险。

### 4.3 已有义务与结算

不要把新购买开关应用到 signed webhook、退款、争议、fulfillment、entitlement、订阅事件或
reconciliation。关闭新购买后，既有订单仍必须能完成、退款、对账和恢复；否则会制造新的客户损害。

## 5. 故障与恢复

- checkout 控制关闭、控制读取失败或内部证据漂移：返回脱敏 503，不暴露 flag/policy/provider
  细节；重试不得绕过控制。
- 国家/provider/method 未获批准：返回平静的 403 eligibility 结果，不自动 fallback。
- provider outage：先阻止新 Checkout，再继续 signed event、refund 和 reconciliation；不得切换到
  未批准 provider。
- 恢复新购买：必须新增经过审批、append-only、精确 scope 的启用版本，并重新通过 Country Policy、
  受影响测试、staging/rollback 证据和 Owner gate；本手册不授权该操作。

## 6. 验证

聚焦门禁覆盖：独立 country/checkout 关闭、默认关闭、伪造启用、provider/method 替代、无 fallback、
控制读取失败、订阅关闭、旧 URL 回放、HTTP 403/503 边界，以及 payment/Web 类型检查。

## 7. 回滚

删除纯合同、Web flag reader、两个新购买入口的 guard 和对应测试/记录即可。没有 migration、provider
配置或外部状态需要回滚。回滚不得误删 webhook、refund、fulfillment 或 reconciliation 路径。

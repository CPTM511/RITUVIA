# RIT-074 争议/Chargeback 记录与支持工作流

## 1. 当前结论

RIT-074 直接复用不可变的 `payment_disputed` 支付事实，并把“当前仍有效、Credit 处理已完成”的争议
异步投影为一个高优先级、不可变、metadata-only 支持工作项；没有新增重复 dispute 表或第二套可变
case 状态机。
当前没有启用支付 provider、Stripe Live、真实 chargeback response、客户消息、付费 UI、部署或生产
migration。

## 2. 用户和 Owner 的 Button 在哪里

- 普通用户：当前没有“提交 Chargeback”“上传证据”或“查看争议” Button。
- Support/Admin：当前没有 Web Admin Button；RIT-125 仍是服务端 metadata-only 队列。
- Owner：当前没有“接受/反驳/提交 provider” Button，也没有自动 provider API 动作。
- 支付事件：争议只能从已验证、已匹配、已处理的服务端支付事实自动进入；客服不能手工填写一段
  文本来创造争议事实。

因此，本任务是后台完整性和运营准备，不是可见的新用户功能。

## 3. 自动工作流

1. 既有 signed webhook 边界把 provider 事件标准化为 `payment_disputed`。
2. 服务端核对 order、attempt、provider account、Checkout/PaymentIntent、金额和币种。
3. 不匹配的事件标记 `rejected_mismatch`；existing payment event 仍是唯一争议事实来源。
4. 匹配事件进入确定性时间线；`ignored_out_of_order` 只保留历史，不打开当前支持工作项。
5. 如果 order 的权威状态变为 `disputed`，既有 outbox/fulfillment 路径先独立完成，只冻结当前未消费的 purchased
   Credit；reserved/consumed 部分成为 review shortfall，不产生负数，也不假装已经退款。
6. 独立 Worker 只选择 `signed_webhook + matched + applied + completed outbox + current disputed
order + same-version Credit Pack fulfillment`，再幂等写入一个
   `commercial_dispute_support_projection_v1`。
7. 支持队列失败只重试投影，不回滚 payment event、order、fulfillment、Credit hold 或 shortfall。
8. 重复事件或 Worker replay 不重复创建工作项、Credit hold 或 entitlement 动作；如果在投影前已
   退款，不创建过时的当前工作项。

## 4. 支持队列看到什么

支持工作项固定为：

- Queue：`support`
- Category：`payment_dispute`
- Priority：`high`
- First response target：记录后 4 小时
- Resolution target：记录后 24 小时
- Draft：`support_dispute_ack`，状态始终是 `draft_only_not_sent`

这些时间是本地运营目标，不是已发布的客户 SLA。Draft 只说明正在使用 commerce records review；
不会宣称退款、账户动作、provider 动作或 chargeback 结果已经完成。

## 5. 可以使用与禁止使用的证据

Owner 可以通过受控 commerce timeline 使用：order/product/price/terms/refund-policy 版本、provider/
环境/账户 fingerprint、provider dispute/Checkout/PaymentIntent reference、金额、币种、支付时间线、
fulfillment/entitlement/Credit restriction 和 delivery facts。Support projection 本身不复制这些
详情。

禁止默认使用：journal、prayer、question、reading、intention、birth data、自由文本、附件、医疗/法律/
财务判断、fraud accusation。需要任何敏感证据、法律立场或对外 chargeback response 时必须单独获得
Owner 和适用的法律/provider review。

## 6. 故障与恢复

- 事件不匹配：fail closed；不创建案件，不修改 Credit。
- 支持 projector 的 DB/RLS/权限失败：payment/fulfillment 事实保持完成，projector 脱敏记录失败并重试。
- 支付/fulfillment 失败：不创建 support work item，先按原路径恢复支付正确性。
- 重复/并发：provider event、outbox 和 projection event unique keys 保证 exactly once。
- 乱序或投影前退款：保留 payment timeline，但不打开过时的当前工作项。
- provider outage：本任务没有网络调用；继续保留本地事实，provider response 仍等待审批与恢复。

## 7. 操作员处理边界

当前没有操作员处理 Button，也不能通过 RIT-125 的 `triage`/`escalate`/`resolve` 改写这个不可变工作
项。需要统一运营状态时，必须新增受审的 additive schema version，而不是修改历史 case constraint。
任何客户消息、provider 证据提交、欺诈判断、法律立场、退款、Credit 修改或 material
dispute/chargeback response 仍由 Owner 和适用的 provider/legal review 单独批准。

## 8. 验证与回滚

聚焦 PostgreSQL gate 覆盖 current applied dispute、投影前退款排除、重复 replay、RLS/列权限、固定
SLA/template、Credit hold/shortfall 和私密 journal 拒绝；Worker 单测证明 support 故障被独立包含和
重试。回滚只停止 projector，保留已有 payment、projection、ledger 和 restriction 审计事实；禁止
直接删除或改写历史。

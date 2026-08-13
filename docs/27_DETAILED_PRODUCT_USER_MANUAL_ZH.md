# RITUVIA 产品功能与逐按钮用户手册

> 版本基准：2026-08-03 的当前仓库和生产构建
>
> 当前界面语言：英语；本手册用中文解释，按钮名保留界面中的准确英文
>
> 当前环境：本地或受保护评审环境；没有公共生产服务
>
> 适用对象：Owner、测试用户、客服、产品、QA 和工程人员

## 1. 先看状态标签

本手册不会把“仓库里有代码”写成“用户已经能在生产使用”。每个功能使用以下标签：

| 标签           | 含义                                             |
| -------------- | ------------------------------------------------ |
| **本地可用**   | 当前生产构建可在本地/受保护环境完成该用户流程    |
| **条件可用**   | 需要既有数据、登录、特定开关或受控配置           |
| **Test Mode**  | 只允许本地或供应商测试模式；不收真钱             |
| **Safe-off**   | 代码可能存在，但服务端默认关闭，不能当作可用产品 |
| **缺用户入口** | API/后端存在，页面没有普通用户按钮或完整工作流   |
| **首发缺口**   | 生产资料包要求存在，但当前仓库产品表面尚未完成   |
| **Owner gate** | 需要 Owner 或外部书面批准；测试通过不能代替批准  |

## 2. 最重要的使用原则

- RITUVIA 提供象征性反思，不预测确定未来。
- 你可以在任何一步停止；不需要为了得到基本价值而注册、付费或连续抽取。
- 卡牌抽取、数秘和占星事实由确定性/受测系统产生，AI 不能改变这些事实。
- 免费蜡烛和线香仪式始终保留；付费不表示更灵验、更幸运或更有效。
- 问题、意图、日记、出生资料和 Revisit 内容默认私密。
- 遇到立即危险、医疗、法律、财务或其他高风险判断，应停止象征性解读并寻求当地紧急服务或
  合资格专业支持。

## 3. 全站界面和按钮位置

### 3.1 桌面端页头

页头固定在页面最上方，向下滚动时仍可见：

| 位置 | 控件                   | 作用                                     |
| ---- | ---------------------- | ---------------------------------------- |
| 左侧 | `RITUVIA` 品牌链接     | 返回 `/en` 首页                          |
| 中间 | `Home`                 | 返回首页                                 |
| 中间 | `Sanctuary`            | 进入 `/en/sanctuary`                     |
| 中间 | `Methodology`          | 查看方法说明 `/en/methodology`           |
| 中间 | `Safety`               | 查看安全边界 `/en/safety`                |
| 右侧 | `Language` 下拉框      | 当前只有 `English`，不能切换到未发布语言 |
| 最右 | `Sign in` 或 `Account` | 未登录时进入登录页；登录后进入账户页     |

`Privacy` 不在桌面主导航中，只在页脚公共链接中出现。

### 3.2 平板和移动端页头

- 58rem 以下：品牌和账户区域在第一行，主导航进入第二行。
- 40rem 以下：品牌、导航、语言和账户区域纵向/换行排列。
- **当前没有汉堡菜单按钮**；不要寻找三横线图标。
- 生产资料包要求未来使用语义移动菜单，当前换行布局属于上线前需要收口的 UI gap。

### 3.3 页脚

每个公共框架页面底部都有 `Home`、`Sanctuary`、`Methodology`、`Safety`、`Privacy`。如果在
页面顶部找不到 `Privacy`，滚动到底部即可。

### 3.4 键盘和辅助技术

- 页面第一个可聚焦链接是 `Skip to main content`；按 Tab 后 Enter 可跳过页头。
- 所有核心按钮可用 Tab/Shift+Tab 定位，Enter 或 Space 激活。
- 焦点会在结果、错误、仪式和恢复状态出现后移动到相应区域。
- 选择 `Use accessible linear mode` 可将仪式改为不依赖动画、拖拽或精确计时的线性步骤。
- 系统开启 reduced motion 时，仪式装饰动画会停止，但文字和按钮保持完整。

## 4. 当前路由总图

当前生产构建共有 **58 个 `/en` 页面路径**：45 个公共内容 URL 和 13 个私密/交易工作流页面。
根路径 `/` 只负责重定向到 `/en`；它不是第二个首页，也不代表其他语言已经发布。

### 4.1 有页面且有普通用户入口

| 路由                      | 页面                | 主要入口                                              | 当前状态                   |
| ------------------------- | ------------------- | ----------------------------------------------------- | -------------------------- |
| `/en`                     | 首页                | 根地址/品牌/Home                                      | 本地可用                   |
| `/en/intake`              | 安全问句检查        | 首页 `Begin a free reading` / `Draw one card`         | 条件可用；获准环境本地可用 |
| `/en/tarot/one-card`      | 单张塔罗            | intake allowed 结果；也可直接打开 URL                 | 本地可用                   |
| `/en/tarot/three-card`    | 三张塔罗            | 首页 `Draw three cards`                               | 本地可用                   |
| `/en/sanctuary`           | 意图、仪式、日记    | 页头 `Sanctuary` / 首页 Sanctuary CTA                 | 本地可用                   |
| `/en/revisit`             | Revisit             | Sanctuary 已保存意图后的 `Schedule a private Revisit` | 本地可用                   |
| `/en/sign-in`             | 登录                | 页头 `Sign in`                                        | 本地可用；生产邮件未批准   |
| `/en/account`             | 账户                | 页头 `Account`                                        | 条件可用                   |
| `/en/readings/numerology` | 数秘计算器          | 首页卡片（开关启用时）/ `/en/numerology`              | 条件可用                   |
| `/en/readings/astrology`  | 已保存占星结果      | `/en/astrology` 教育页 CTA                            | 条件可用；只读、Safe-off   |
| `/en/plans`               | 一次性 Credit packs | 登录账户 `View Credit packs`                          | Test Mode/Freeze           |
| `/en/checkout/return`     | 支付返回状态        | hosted checkout 返回                                  | Test Mode/Freeze           |

### 4.2 页面存在，但当前没有正常导航入口

| 路由                 | 说明                                         | 当前状态        |
| -------------------- | -------------------------------------------- | --------------- |
| `/en/beta`           | 私密邀请准入；只通过一对一邀请链接进入       | 条件可用        |
| `/en/checkout/local` | 本地测试付款页面，只从本地测试 checkout 返回 | Local Test only |

### 4.3 后端存在，但没有普通用户按钮

| 能力                        | 当前实际情况                                                                                 |
| --------------------------- | -------------------------------------------------------------------------------------------- |
| 隐私导出/下载               | API 和专项浏览器证据存在；账户页没有 `Export my data` 按钮                                   |
| 选择性删除/账户删除         | API/后端存在；账户页没有完整删除确认工作流                                                   |
| 订单/账单/发票/订阅管理     | 后端基础存在；没有独立 Billing/Orders 客户页                                                 |
| 出生资料创建/占星计算       | 加密后端存在；当前只读页面不收集出生资料，也不创建计算                                       |
| 生产邮件提醒                | Revisit 可保存偏好；真实投递仍依赖供应商和域名批准                                           |
| 订阅购买/取消               | Test Mode 后端生命周期存在；当前 Plans 页面只展示一次性 Credit packs                         |
| 支持/隐私/安全/内容运营队列 | 后端队列、权限、SLA 状态和审计存在；没有普通用户 `Support` Button                            |
| Owner 运营面板              | private/offline 日报已存在；没有 Web 路由、导航项或 Admin Dashboard Button，使用仓库命令生成 |

### 4.4 Owner 如何打开运营面板

**适用对象：Owner/受权工程与运营人员，不是普通用户。**

按钮位置：**没有按钮**。当前入口是仓库根目录命令：

```bash
pnpm report:owner-operations \
  --as-of <UTC时间> \
  --input <绝对路径/owner-operations-input.json> \
  --output-json <绝对路径/owner-operations-dashboard.json> \
  --output-markdown <绝对路径/owner-operations-dashboard.md>
```

生成后，在 Codex 右侧边栏打开 Markdown 文件。面板按顺序显示八区：Health、Revenue、Core loop、
AI、Queue、Support、Cost、Approvals。每区都要先看：

1. `Status`：`nominal`、`attention`、`blocked`、`not_applicable` 或 `unknown`；
2. `Source` 与 `Environment`：数据来自 durable aggregate、本地验证、Owner 记录、synthetic 还是
   unavailable，以及属于 local/CI/staging/production 哪个环境；
3. `Freshness`、`Observed through`、`Maximum age`：数据是否仍在有效期；
4. `Approval`、`Evidence`、`Runbook`：批准和处理依据在哪里；
5. `Known gap`：还缺什么，不能把 `unknown` 理解为 `0`、健康或可上线。

顶部 Release gates 当前应显示：下一项 OWN 批准仍是 `OWN-005` 的 exact Option B、RIT-127
`blocked_by_Option-B-and-runtime-evidence`、下一任务序列 `RIT-130`、standing staging
`unavailable`、Gate H `incomplete`、independent security review `pending`。D-104 已精确批准
OWN-019 profile，D-106 已批准 OWN-005 Option A safe-off，RIT-128 本地故障演练已完成；即使未来
显示 `evidence_ready`，部署仍必须由 Owner 另行批准。

完整输入规则、失败恢复、日检和回滚见
`docs/runbooks/RIT-120_OWNER_OPERATIONS_DASHBOARD.md`。OWN-019 的已批准精确 profile 见
`docs/reports/RITUVIA_OWN_019_DECISION_REQUEST_2026-08-02.md` 和 D-104。

### 4.4.1 Owner 如何打开 staging / Gate H 证据报告

**这里也没有产品网页或 Admin Button。** 工程人员先在终端运行
`pnpm check:staging-gate-h`；私有 manifest 用 `pnpm report:staging-gate-h -- <arguments>`，再在
Codex 右侧打开 Markdown。固定检查 staging、invite、monitor、PITR、outage、外部安全、support/admin
和 rollback；当前必须是 `blocked`、Gate H `incomplete`、`deploymentAuthorized=false`。即使变为
`evidence_ready_for_owner_review` 也不能部署。完整参数与恢复见 RIT-129 runbook。

### 4.5 Owner 如何打开和控制 Codex 定时复核

**适用对象：Owner/受权工程与运营人员，不是普通用户。产品网页没有这个 Button。**

1. 在 Codex Desktop 左侧边栏打开 **Automations**。
2. 选择 `RITUVIA daily maintenance`、`RITUVIA weekly product review` 或
   `RITUVIA monthly risk audit` 卡片。
3. D-108 已批准 OWN-020 Option A，当前三张卡均应显示 **Paused**。点击 **Edit** 可以核对时间和
   提示词；没有新的明确 Owner 决定前不要点击 **Run now**，也不要激活调度。

三条任务按上海时区配置为每天 08:30、周一 09:30、每月 1 日 10:30；当前暂停，不产生定时模型
调用。未来获批后，正常成功只生成单独的 Codex task，不写入 RITUVIA 数据库，也不通知产品用户；
只有失败运行触发通知。

当前 Codex 项目定时任务使用本地项目执行，不是硬只读沙箱。因此每次先检查工作区：只要有未提交
修改，就返回 unavailable 并停止；工作区干净时才读取仓库和已经存在的聚合证据。它不能修改文件、
创建 PR、改 Backlog/Decision、访问生产/私密内容、联系供应商/用户、花钱、部署或通过 Owner gate。
详细流程和回滚见 `docs/runbooks/RIT-126_CODEX_AUTOMATIONS.md`。
激活差异和精确选项见
`docs/reports/RITUVIA_RIT_126_AUTOMATION_ACTIVATION_DECISION_REQUEST_2026-08-02.md`。

### 4.6 生产资料包要求但当前缺失的目的地

当前没有完整的 `/en/readings`、`/en/readings/daily-tarot`、`/en/readings/tarot`、
`/en/readings/deep`、`/en/journal`、`/en/account/billing`、`/en/account/orders`、
`/en/account/privacy` 和 `/en/about` 用户目的地。这些是上线前产品表面缺口，不应通过猜 URL 使用。

### 4.7 工作流 0：进入 protected Beta

**状态：仓库/本地可用；真实邀请执行、standing staging 和上线仍是 Owner gate。**

普通用户导航里没有 Beta 链接。受邀用户从运营人员一对一发送的私密地址打开 `/en/beta`：

1. 页面主标题下方是 `Protected Beta invite` 输入框。
2. 把完整邀请码粘贴到该输入框；不要把邀请码手工加到 URL。
3. 表单最底部的主 Button 是 `Enter protected Beta`。
4. 成功后页面进入 `/en/intake`；先完成安全问句检查，再开始免费核心闭环。

邀请码只存在于当前表单内存和一次同源请求正文，不进入 URL、referrer、localStorage、
sessionStorage、analytics 或错误文案。缺失、无效、已使用、过期或已撤销都显示同一类平静提示，
不会暴露内部状态；服务暂时不可用时由用户明确重试，系统不自动循环提交。旧的匿名 cookie 不能绕过
Beta 准入。若怀疑邀请码泄露，停止尝试并联系私密 Beta 协调人员，由受权操作员撤销。

**Owner/运营发放入口：没有 Web/Admin Button。** 在仓库终端用控制角色运行：

```bash
DATABASE_URL='postgresql://CONTROL_ROLE@HOST/DB?sslmode=require' \
  pnpm beta:invite -- create \
  --idempotency-key 'beta-wave-1-seat-001' \
  --ttl-seconds 604800 \
  --output '/absolute/private/path/beta-wave-1-seat-001.json'
```

输出文件必须位于仓库外、以 `0600` 新建且不可覆盖；原始邀请码不打印到终端。推荐按 5 + 10 + 10
三批发放，每批后复核滥用、安全、隐私、支持和 SLO。撤销命令、失败恢复和权限边界见
`docs/runbooks/RIT-168_PROTECTED_BETA_INVITES.md`。

## 5. 工作流 A：从首页开始

**状态：本地可用。**

### 5.1 进入

打开 `/en`。页面顶部 Hero 区域位于页头下方，是第一屏主要内容。

### 5.2 第一屏按钮

| 按钮                   | 位置                        | 作用                         |
| ---------------------- | --------------------------- | ---------------------------- |
| `Begin a free reading` | Hero 文案下方，第一个主按钮 | 进入安全 intake `/en/intake` |
| `Enter the sanctuary`  | Hero 文案下方，第二个次按钮 | 进入 `/en/sanctuary`         |

在 40rem 以下，两枚按钮会纵向排列并占满可用宽度。

### 5.3 页面中部入口

向下滚动到 `The oracle` 卡片区：

- `Draw one card`：第一张卡片底部；进入安全 intake，再按结果决定是否进入单张塔罗。
- `Draw three cards`：第二张卡片底部；进入三张塔罗。
- `Visit the sanctuary`：第三张卡片底部；进入 Sanctuary。
- `Calculate my numbers`：仅当数秘开关启用时出现；进入数秘计算器。

继续下滚还能看到 `Enter my sanctuary` 和 `Review the privacy design`。

### 5.4 系统如何实现

首页由服务端渲染；入口来自版本化英语消息和服务端功能状态。首页不接收问题、日记或其他私密
输入，也不在客户端决定抽牌、价格或功能资格。

### 5.5 当前注意事项

两个单张免费入口都必须先经过 `/en/intake`。只有配置精确 activation reference
`own-009.question-intake.en.v1` 的获准环境会开放 intake；缺失或近似值会返回 404，首页不会提供
绕过链接。直接打开 `/en/tarot/one-card` 仍是有效技术路径，但不替代受保护 Beta 的 intake-first
验收合同，也不能用来绕过安全结果。

## 6. 工作流 B：安全检查一个问题

**状态：获准环境本地可用；需要精确 activation reference，默认配置可能返回 404。**

### 6.1 进入

在获准本地/受保护环境，从首页点击 `Begin a free reading`，或在 `The oracle` 第一张卡片点击
`Draw one card`。两者都进入 `/en/intake`。如果返回 404，不要改 URL 绕过；应由环境负责人确认
是否配置了精确批准值 `own-009.question-intake.en.v1`。

### 6.2 操作顺序和按钮位置

1. 在主内容顶部 `Reflection theme` 单选组选择一个主题。
2. 在其下方 `Optional question` 文本框填写问题；可以留空。
3. 点击表单底部 `Review my question`。
4. 结果显示在表单下方：
   - 允许：点击 `Continue to a private one-card reflection`；旁边有 `Review another question`。
   - 建议改写：没有继续解读按钮；点击 `Use the suggested question` 后，焦点返回问题框，必须再次
     点击 `Review my question`，重新得到 allowed 后才能继续。
   - 阻止：问题原文会从页面状态清除，也没有继续解读按钮；可点击 `Use the safer question`，再
     点击 `Review my question` 重新检查。
   - 紧急状态：问题原文会清除，只显示立即支持说明，没有建议采用或继续解读按钮。
   - 请求过快：显示 `Question checks are temporarily limited`；没有 `Try again` 按钮，不会自动重试，
     草稿继续留在当前页面。稍后修改或重新提交前先等待，不要新建 session 绕过。
   - 网络/服务错误：结果卡片中点击 `Try again` 或 `Check connection and try again`。

### 6.3 系统如何实现

- 点击 `Review my question` 后，浏览器先在后台调用 `POST /api/v1/anonymous/session` 创建或恢复私密
  匿名 session，再调用 `POST /api/v1/intake/evaluate` 发送主题和可选问题。这个后台步骤没有额外
  Button，也不要求注册。
- 服务器执行预先审阅的安全/自主性规则，返回 allowed、reframed、blocked 或 crisis。
- 在读取问题正文前，服务器先按当前匿名 session 消耗数据库原子 intake 请求预算；超出时返回
  `429` 和有上限的 `Retry-After`，配置、数据库或最小权限证明不可用时 fail closed。
- 问题只在本次内存请求中检查，不放入 URL、页面 metadata、产品 analytics 或持久 intake 表。
- 限流记录只保存 session 外键、固定 scope、窗口、计数和策略版本，不保存问题、IP、User-Agent、
  设备 ID 或指纹。
- allowed 只把十个批准主题之一写入当前 tab 的一次性 session handoff；进入单张页时立即读取并删除。
- 后续塔罗请求不会复制问题自由文本，只发送已验证主题；浏览器返回键也不会恢复 intake 草稿。

### 6.4 安全结果

- `allowed`：可以继续，但系统仍不保证结果。
- `reframed`：原问题要求确定性或不在自主性边界内；必须由用户主动采用建议。
- `blocked`：高风险/有害请求不进入象征性解读。
- `crisis`：停止产品流程，优先联系当地紧急服务或可信任的人；该状态没有继续解读按钮。

### 6.5 失败和恢复

草稿只留在当前页面；系统不会后台自动重试。离线时先重连，再点击明确的重试按钮，避免连续提交。
出现 `Question checks are temporarily limited` 时没有立即重试按钮；草稿不会清除，按提示等待后再
明确提交一次。
如果浏览器阻止 session storage，allowed 仍可进入单张页，但不会预选主题，用户需在单张页重新选择；
系统不会为此持久化问题或降低安全分类。

## 7. 工作流 C：单张塔罗

**状态：匿名、本地可用；不需要账户或支付。**

### 7.1 进入

从首页点击 `Begin a free reading` 或 `Draw one card`，先完成 `/en/intake`；在 allowed 结果点击
`Continue to a private one-card reflection` 后进入 `/en/tarot/one-card`。批准主题会预先选中一次。
直接打开 `/en/tarot/one-card` 仍有效，此时用户在页面内自行选择主题。

### 7.2 抽牌

1. 页面标题下方第一个面板是主题表单。
2. 在 `Reflection theme` 选择一个主题。
3. 点击表单底部 `Draw one card`。
4. 等待时按钮显示 `Preparing your private draw`；页面显示创建/恢复私密 session 和固定抽牌状态。
5. 服务器固定卡牌后，表单下方出现 `Your card is ready` 面板。
6. 点击该面板中的 `Reveal my card`。

### 7.3 结果怎么读

结果面板依次显示：

- 卡牌名称和 `Upright`/`Reversed`；
- `What this may invite you to notice`；
- `Core themes`；
- 建设性可能性和张力；
- `What this cannot determine`；
- `A question to reflect on`；
- `One small action`。

这些是反思材料，不是命令、诊断或保证。

### 7.4 结果底部按钮

结果面板靠近底部、在分享/可选解释/报告区域之后：

| 控件                              | 位置             | 作用                                     |
| --------------------------------- | ---------------- | ---------------------------------------- |
| `Continue to a private intention` | 完成区主按钮     | 将当前 reading ID 安全交给 Sanctuary     |
| `Read the methodology`            | 主按钮旁的次按钮 | 查看确定性抽牌与解释边界                 |
| `Start a new reflection`          | 完成区更下方     | 创建新的独立请求；不会提高当前结果确定性 |

### 7.5 刷新恢复

当前 tab 的 session storage 只临时保存随机 reading ID。刷新后系统用该 ID 向服务器恢复同一个
固定结果，不保存结果文本、问题或账户资料。恢复失败时：

- `Try to restore the saved result`：重试同一个 ID；
- `Choose a new theme instead`：放弃恢复并回到主题选择；
- 冲突时 `Start over with no saved attempt`；
- 达到频率限制时 `Return to theme selection`，并遵守服务器等待时间。

### 7.6 系统如何实现

- 浏览器先通过 `/api/v1/anonymous/session` 建立/恢复匿名 session 和 CSRF。
- `POST /api/v1/readings/tarot` 只提交主题、reading type 和幂等请求。
- `packages/divination` 使用服务端随机接口固定不重复卡牌、方向和位置。
- `packages/domain` 校验所有权、限制、状态和幂等；`packages/db` 持久化不可变 reading facts。
- React 只负责显示；`Reveal my card` 不再次请求抽牌。

### 7.7 失败和恢复

离线、session、服务不可用和普通错误都不会自动重抽。使用 `Try the same draw again` 或
`Confirm the session and try again` 会保留同一请求的幂等语义。

私密塔罗不是纯静态页面：完整抽牌、恢复、意图交接和报告需要本地数据库、迁移、完整性密钥和
会话配置。非 local 环境如果没有经批准的完整运行配置，服务端会安全关闭；页面存在不等于流程可用。

## 8. 工作流 D：三张塔罗

**状态：匿名、本地可用；当前 Retain，不是扩张主线。**

### 8.1 进入和按钮

1. 首页 `The oracle` 的第二张卡片点击 `Draw three cards`。
2. 在 `/en/tarot/three-card` 选择 `Reflection theme`。
3. 点击表单底部 `Draw three cards`。
4. 服务器固定三张牌和顺序后，点击 `Reveal the three cards`。

### 8.2 结果顺序

三个位置固定为 Situation、Action、Possibility。页面对每张牌显示与单张相同的边界、可能性、
问题和小行动，不把第三张解释成确定未来。

### 8.3 后续和恢复

结果底部同样有 `Continue to a private intention`、`Read the methodology` 和
`Start a new reflection`。恢复会返回相同三张牌、相同顺序，不重抽。

### 8.4 系统如何实现

与单张使用同一服务端应用服务和持久化内核，只是 reading type、spread 和位置数不同；UI 不创建
第二套业务逻辑。

## 9. 工作流 E：分享、可选解释和报告

### 9.1 隐私安全分享卡

**状态：单张结果中本地可用。**

在单张结果的 `Optional sharing` 区域：

1. `Include my selected reflection theme` 复选框默认开启；主题敏感时先关闭。
2. 点击 `Preview share card`；预览在同一区域出现。
3. 预览后可点击 `Download privacy-safe SVG`。
4. 设备支持 Web Share 文件能力时，会出现 `Open device share sheet`。
5. 点击 `Hide share preview` 隐藏预览。

分享卡只允许卡名、方向、可选主题、通用反思句、公开 Tarot URL 和品牌；不包含问题、reading ID、
解释、出生资料、意图、日记或账户信息。SVG 在浏览器本地生成，下载不会上传文件。

### 9.2 可选 AI 深度解释

**状态：当前服务端刻意返回 unavailable；生产 AI 未批准，不能当作线上能力。**

结果中的 `Optional AI perspective` 面板位于分享区域后：

- `Explore the deeper interpretation`：显式开始；不重抽。
- 处理中 `Stop checking`：停止当前轮询。
- 可恢复失败时 `Try the same request again`：使用同一 operation，避免重复生成。

当前 interpretation `POST`/`GET` 路径没有组合生产 provider 或生成 worker，会安全返回 unavailable；
固定卡牌和 reviewed base meaning 仍完整。未来只有结构、内容和独立安全检查通过的结果才可显示
`AI-generated interpretation · independently checked`；否则只能显示 reviewed non-AI fallback 或
不显示增强内容。

已保留的实现边界是：UI 只发送 reading ID；服务端读取固定 facts、版本化检索内容和 prompt，调用
受控适配器并验证 schema、事实、安全和单次使用绑定。当前该生成组合未启用。AI 永远不抽牌、
不定价、不授权、不决定 Credit。

### 9.3 报告一个问题

**状态：本地可用，无自由文本。**

在结果下方展开 `Report an issue with this reading`：

1. `Issue category` 选择 Accessibility、Cultural context、Factual accuracy、Rights or attribution、
   Safety 或 Translation。
2. `Report target` 选择整次 reading 或具体位置。
3. 点击 `Send report`。
4. 普通可恢复失败时点击 `Try the same report again`；若选项和已保存请求冲突，点击
   `Start a new report request`。若达到频率限制，页面保留所选 category/target、禁用选择并隐藏重试，
   不会自动再次提交；请稍后重新打开页面。

AI 解释内部另有 `Report an issue with this interpretation`。报告只记录枚举 category/target 和
精确请求标识，不包含自由文本、问题、解释正文或日记。

报告创建成功后，同一数据库事务会创建运营 case：`safety` 进入安全队列，其他枚举 category 进入
内容报告队列。case 只保存 source ID、category、优先级、本地 SLA 时间、状态和固定 draft 版本，
不会复制 reading/interpretation 文本。这个后台入队没有额外 Button，也不会自动发送回复。普通用户
目前看不到 case ID、处理状态或客服消息；这些仍是上线前用户支持界面缺口。

## 10. 工作流 F：创建和管理意图

**状态：匿名、本地可用。**

### 10.1 进入

推荐从塔罗结果底部点击 `Continue to a private intention`。也可从页头或首页进入
`/en/sanctuary`，但如果要关联 reading，必须先在同一 tab 完成 reading。

### 10.2 表单顺序

Sanctuary 主内容第一个大面板是 `Set an intention`：

1. 在 `Choose an intention theme` 选择如 `Peace and clarity`。
2. 可从模板开始，但要在 `Your intention` 写成自己的话。
3. 在 `One small real-world action` 写一个自己能够完成的行动。
4. `Optional revisit date` 可选。
5. 点击表单底部 `Continue with this intention`。

若文案试图控制他人，页面显示建议；点击 `Use the suggested intention` 后再提交。

### 10.3 已保存后的按钮

保存后，表单底部和意图卡片下方出现：

| 按钮                         | 作用                                                  |
| ---------------------------- | ----------------------------------------------------- |
| `Save intention changes`     | 修改后保存；使用 revision 防止覆盖其他 session 的变化 |
| `Schedule a private Revisit` | 把意图 ID 临时交给 `/en/revisit`                      |
| `Mark complete`              | 先出现确认，再完成                                    |
| `Archive intention`          | 先出现确认；归档后不能启动新仪式                      |
| `Delete intention`           | 危险按钮；确认后立即删除，当前页面不能恢复            |
| `Cancel`                     | 取消 lifecycle 确认                                   |

### 10.4 系统如何实现

UI 通过 `/api/v1/intentions` 和 `/api/v1/intentions/{id}`，使用匿名 session/account owner、CSRF、
幂等 key 和 optimistic revision。`packages/domain/src/intention.ts` 负责意图文本、用户自主性和状态；
`packages/db/src/reflection-persistence.ts` 负责所有权和事务。私密文本不进入 analytics、URL 或公共
metadata。

### 10.5 失败恢复

- 离线：文本留在页面，重连后再保存。
- 普通失败：不标记完成、不收费；使用原表单重试。
- 私密修改过快：页面顶部显示 `Private changes are temporarily limited`，当前页面的意图、仪式和
  日记写入 Button 会禁用，系统不自动重试；内容仍留在页面，稍后重新加载再继续。
- revision 冲突：重新加载最新资源，不盲目覆盖。
- 删除：属于明确、不可在 UI 中撤销的动作，确认前检查内容。

## 11. 工作流 G：完成免费仪式

**状态：匿名、本地可用；`Quiet candle` 和 `Quiet incense` 永远免费。**

### 11.1 选择仪式

Sanctuary 第二个大面板是 `Choose a free ritual or symbolic object`。每个对象显示名称、说明、
`Free`/`Owned`/`One-time purchase` 状态和卡片底部按钮。

- 免费对象：点击 `Begin free ritual`。
- 已拥有对象：点击 `Place in my sanctuary`。
- 未拥有付费对象：可能显示 `Sign in to purchase` 或 `Continue to secure checkout`；当前商业能力
  冻结，不要用它判断真实支付可用。
- catalog 失败：点击 `Retry catalog`；即使付费 catalog 降级，免费对象必须保留。

必须先有 active intention，否则页面提示先设置意图。

### 11.2 仪式全屏/大面板顶部按钮

进入仪式后，标题右侧/顶部 action 区：

| 按钮                             | 作用                           |
| -------------------------------- | ------------------------------ |
| `Exit ritual`                    | 退出，不强迫完成               |
| `Pause ritual` / `Resume ritual` | 暂停或恢复                     |
| `Complete now`                   | 跳过剩余视觉步骤，直接请求完成 |

### 11.3 模式和步骤按钮

- `Use accessible linear mode`：切换到线性模式。
- `Use standard 2D mode`：返回标准视觉模式。
- `Previous step`：回到上一步。
- `Continue`：进入下一步；暂停时不可用。
- 最后一步 `Complete this ritual`：记录完成。

仪式不播放声音；页面明确显示 `Audio: Off. No sound will start.`。

### 11.4 完成后的按钮

完成面板显示后：

- `Continue to private reflection`：关闭仪式并把焦点带到日记区。
- `Return to Sanctuary`：返回 Sanctuary 面板，不强迫写日记。

### 11.5 系统如何实现

`POST /api/v1/ritual-sessions` 原子创建 session；完成调用 `/api/v1/ritual-sessions/{id}/complete`。
domain 验证意图状态、对象可用性、pass/entitlement 和幂等；数据库防止同一 consumable pass 被并发
使用。客户端当前步骤可以留在页面，但完成状态以服务端为准。

### 11.6 失败恢复

- 离线：当前步骤留在页面；可以退出而不记录，或重连后完成。
- 完成请求失败：意图和步骤仍在，使用同一完成操作重试，不创建第二个 ritual session。
- 出现 `Private changes are temporarily limited`：退出当前写入状态，按钮保持禁用；稍后重新加载，
  让页面从服务端恢复实际 ritual 状态后再继续，不要创建新匿名 session 绕过。
- reduced motion/linear mode 不降低功能完整性。

## 12. 工作流 H：私密日记

**状态：与 Sanctuary 仪式关联，本地可用；当前没有独立 `/en/journal` 页面。**

### 12.1 创建

仪式完成后点击 `Continue to private reflection`。在 `Private reflection` 区域：

1. 在 `Your private journal entry` 文本框输入内容。
2. 点击文本框下方 `Save private reflection`。

必须先完成意图和仪式；空文本不能保存。

### 12.2 修改和删除

- 保存后按钮变为 `Save reflection changes`。
- `Delete private reflection` 会先显示确认；确认后删除。
- 删除后回到可新建状态；当前页面不能恢复已删除正文。
- 完成状态底部提供 `View my account` 和 `Start another free reflection`；两者都不是强制下一步。

### 12.3 系统如何实现

UI 调用 `/api/v1/journal-entries` 和 `/api/v1/journal-entries/{id}`。服务端验证同一 owner、关联 intention
和已完成 ritual，使用幂等 key/revision；私密正文由受控持久化保存，不进入 analytics、URL、公开
metadata、支付 metadata 或分享卡。

### 12.4 失败恢复

离线或保存失败时，正文继续留在文本框，系统不自动重试。重连后点击同一保存按钮。删除必须明确
确认，不能通过网络重放误删其他用户资源。若显示 `Private changes are temporarily limited`，正文
仍留在文本框，但保存/删除 Button 会禁用；稍后重新加载再继续，不会后台自动保存或删除。

## 13. 工作流 I：Revisit

**状态：匿名、本地可用；邮件提醒生产投递未批准。**

### 13.1 进入和安排

在 Sanctuary 保存意图后点击 `Schedule a private Revisit`，进入 `/en/revisit`。页面顶部 schedule
面板会读取该意图：

1. 选择 `Tomorrow`、`In seven days` 或 `Choose a date`。
2. 需要时检查/编辑 `Time zone`。
3. 如需提醒安静时段，展开/填写后点击 `Store quiet hours` 保存该偏好。
4. 点击 `Schedule this Revisit`。

如果没有从 Sanctuary 带入意图，页面会显示 empty state；当前没有通用意图选择器。

### 13.2 管理已安排 Revisit

每个 `revisit-card` 中：

- `Save new date`：改期。
- `Complete this Revisit`：打开完成表单。
- `Archive`：确认后归档，可读但不能再完成。
- `Delete`：确认后立即删除。
- 确认区域中的 `Cancel`：退出当前确认。

### 13.3 完成

点击 `Complete this Revisit` 后：

1. 在 `What happened, and what do you understand now?` 输入反思。
2. 从 outcome tags 最多选择三个，如 `I took the action`、`I made partial progress`、`Not yet`。
3. 再点击 `Complete this Revisit` 保存。

标签只用于整理经历，不表示预言应验。

若达到匿名受保护 Beta 写入上限，页面显示 `Pause before another private change`，保留当前尚未提交的
排期或反思输入，并在当前页面禁用 `Schedule this Revisit`、完成、改期、归档和删除操作；页面不显示
`Retry`，也不会自动再次请求。请等待后刷新页面，再由用户主动决定是否继续。

### 13.4 邮件提醒

已登录账户可能看到 `Email me once when this Revisit date arrives`。当前：

- 未登录会提示 `Sign in to turn on an account-owned email reminder.`
- 保存偏好不等于邮件已经能生产投递。
- 提醒模板不得包含意图、问题、仪式、日记或关系细节。
- 可在投递前关闭；失败只停止提醒，不影响 Revisit 本身。

### 13.5 系统如何实现

UI 使用 `/api/v1/revisits`、`/api/v1/revisits/{id}`、`/complete` 和 `/reminder`。domain 固定本地日期、
IANA 时区、状态和 outcome 枚举；数据库 owner scope、revision 和幂等确保重试不创建重复 Revisit。
提醒是独立 account-owned preference 和 durable job，不改变 Revisit 是否可完成。当前提醒执行例程
虽存在，但没有组合进正在运行的 worker main，投递 adapter 也保持关闭；因此保存提醒偏好不能视为
当前会发送邮件。

## 14. 工作流 J：登录和账户

**状态：本地登录可用；生产邮件/第三方身份未批准。**

### 14.1 登录

1. 页头最右点击 `Sign in`。
2. `/en/sign-in` 的 `Email address` 输入邮箱。
3. 点击表单底部 `Continue securely`。
4. 本地环境会出现 `Complete local sign-in`；这是 Local Test only，不会发送邮件。
5. 生产环境未来应显示 `Check your email`，使用短时一次性链接完成。

错误状态包括离线、限流、无效/过期链接和服务不可用。当前没有独立的登录 `Try again` 按钮；表单
仍保留，修正/确认邮箱或恢复连接后再次点击 `Continue securely`。不要重复使用过期链接。

### 14.2 账户页面布局

登录后页头按钮变为 `Account`。`/en/account` 从上到下包含：

1. `Profile preferences`；
2. `Paid experience eligibility`；
3. `Personalization choices`；
4. `Your history`；
5. `Signed-in sessions`；
6. 页面底部账户 action。

### 14.3 Profile 和年龄

- `Save profile`：位于 profile 表单底部，保存 display name、语言/时区等受控资料。
- `Save 18+ confirmation`：位于付费资格区；只影响付费 eligibility，不影响免费匿名路径。
- 冲突时页面要求重新加载，不覆盖另一个 session 的更新。

### 14.4 隐私选择

每个 consent 使用独立 checkbox/switch，默认关闭；analytics、personalization 和 model improvement
互不授权。失败时旧 safe-off 状态保持。当前生产 analytics/训练路径仍未因此自动开启。

### 14.5 历史

- `Load older history`：历史列表底部加载下一页。
- reading 项目中的 `Open this reading`：把 UUID-only handoff 放入当前 tab，并恢复确切 reading。
- 历史只显示最小 metadata 和状态，不显示问题、意图、日记或 Revisit 反思正文。

### 14.6 Session 管理

- 其他 session 卡片中的 `Sign out this other session`：确认后撤销指定 session。
- `Sign out all sessions`：确认后撤销当前和全部其他 session。
- `Sign out`：只退出当前 session。
- 操作只有在服务端持久撤销成功后才向用户报告成功。

### 14.7 系统如何实现

登录开始使用 `/api/v1/auth/start`，callback 消耗短时 hashed challenge 并原子创建 account/session。
匿名资源通过 append-only account link 合并一次，而不是复制私密正文。Cookie 是 HttpOnly host-only
session；修改操作使用 session-bound CSRF。账户、历史、consent 和 session API 不接受客户端 owner ID。

## 15. 工作流 K：隐私导出和删除

**状态：后端和测试存在，普通用户界面缺失。**

### 15.1 当前没有的按钮

账户页当前没有以下按钮：

- `Export my data`；
- `Download export`；
- `Delete selected data`；
- `Delete account`。

因此普通用户不应尝试直接调用 API。上线前必须补充 `/en/account/privacy` 或等价完整工作流，包括
最近认证、范围说明、状态、下载、确认、失败、重试、取消和支持路径。

### 15.2 已实现的后端行为

- `POST /api/v1/privacy/export` 创建加密、短时、owner-scoped export。
- metadata 和下载要求同一账户、same-origin、最近认证和有效 session。
- 下载包排除 cookie、CSRF、密钥和不必要的服务秘密。
- `POST /api/v1/privacy/deletions` 支持受控 scope 和幂等重放。
- 账户删除会撤销 session，并使旧 session 无法读取账户或 export。
- 出生资料/占星 payload 使用 crypto-shred 语义处理受保护内容。
- 新的 export 或 deletion request 会在同一事务进入 privacy 运营队列；case 不复制导出内容、删除
  数据或 email。当前没有用户可见状态按钮，也没有自动消息发送。

这些行为是实现事实，不是当前“用户可自助完成”的产品事实。

### 15.3 支持与运营队列当前怎么用

- 全站当前没有普通用户 `Support`、`Contact support` 或 `Track my case` Button。
- 阅读结果只有 `Report an issue with this reading` 和 `Send report`，位置见工作流 E。
- 隐私导出/删除没有普通用户 Button，位置不存在，不能让测试用户猜 URL 或手工调用 API。
- Admin 端也没有 `Support queue`、`Privacy queue`、`Safety queue`、`Content reports`、`Triage`、
  `Escalate` 或 `Resolve` Button；RIT-120 只完成 private/offline Owner 日报，没有实现 Web Admin
  Dashboard 或上述操作 Button。
- 后端已经按角色隔离四类队列，要求最近登录、同一 session 的 passkey MFA、reason 和 ticket；固定
  英语 acknowledgement 始终标记为 draft-only，不会自动发给用户。
- 本地测试 SLA（15 分钟至 72 小时）只是验收数据，不是对用户公开的生产承诺。支持邮箱、营业时间、
  正式响应/解决时间、升级责任和历史回填仍需 Owner 批准。

## 16. 工作流 L：数秘计算

**状态：开关启用时匿名本地可用；不持久保存出生日期。**

### 16.1 进入

- 首页出现数秘卡片时点击 `Calculate my numbers`；或
- 在 `/en/numerology` 公共方法页点击 `Open the private calculator`；进入
  `/en/readings/numerology`。

计算器页面标题区域还提供 `Learn the public method before calculating`，用于先回看公开方法。

### 16.2 操作

1. `Birth date` 输入 Gregorian `YYYY-MM-DD`。
2. `Target year` 输入 1000–9999 的四位年份；系统不会猜当前年。
3. 点击表单底部 `Calculate my numbers`。
4. 结果显示 Life Path、Birthday Number、Personal Year 的 source digits、initial value、reduction
   steps、结果和 engine/rule version。
5. 点击结果/表单区域中的 `Clear birth data and start again` 清空。

### 16.3 系统如何实现

浏览器向 `/api/v1/numerology/calculate` 发送同源私密请求。`packages/divination` 使用纯函数解析
Gregorian date，执行版本化 reduction，保留 approved 11/22/33 master number；服务端返回每一步证据。
AI 不能改数字。出生日期不进入 URL、存储、日志或 analytics。

### 16.4 失败恢复

- 输入错误：页面指出日期或目标年字段。
- 离线：`Check connection and try again`。
- 服务/验证失败：`Try again`；不会自动发送。
- 结果不能通过 response contract 时不显示部分数字。

## 17. 工作流 M：查看已保存占星结果

**状态：只读、条件可用、Safe-off；不是完整占星创建流程。**

### 17.1 进入

从 `/en/astrology` 公共教育页点击 `Open the private saved-chart viewer`，进入
`/en/readings/astrology`。

### 17.2 页面可能状态

- 未登录：`Sign in to view saved charts`。
- 加载：`Loading your saved chart`。
- 没有结果：`There is no saved chart yet`；页面不会索取出生资料。
- 验证失败/暂不可用：`Try loading again`。
- 离线：`Check connection and try again`。
- 有结果：显示 wheel 视觉辅助、placements、houses、angles、major aspects、confidence 和 method/source。

### 17.3 当前没有的按钮

没有 `Create birth profile`、`Search birthplace` 或 `Calculate natal chart`。这不是隐藏操作；完整用户
入口尚未实现。

### 17.4 系统如何实现

页面只调用 `GET /api/v1/readings/astrology/natal` 读取当前账户最新 owner-scoped 结果。服务端通过
feature flag 后才加载 pinned Swiss Ephemeris native runtime；准确时间可显示 approved placements、
Placidus houses、angles 和 aspects；近似时间抑制 houses/angles/aspects；未知时间不伪造 noon chart。
返回结果必须通过严格 contract，任何不可信输出都不显示 partial fallback。

出生资料和计算 payload 加密保存，export/deletion 有独立证据。生产激活还需要 exact deployed source
archive、公开 source link 和 Owner gate。

## 18. 工作流 N：冻结的 Credit packs/Test Mode 支付

**状态：Freeze；本地/Test Mode 历史能力，不是获批的生产产品或真钱流程。**

D-097 已选择未来生产付费采用直接销售名称和权益清楚的报告、订阅或数字体验，不要求用户预充
Credits。以下内容仅说明当前仓库仍可见的 Test Mode 实现，不能用来设计生产 offer 或客服承诺。

### 18.1 Plans 页面

登录账户中点击 `View Credit packs` 进入 `/en/plans`。页面只显示一次性 Test Mode pack，不是订阅
管理页；该入口将在后续产品表面任务中删除、隐藏或替换为经批准的直接销售入口。

每个 pack 卡片底部根据状态显示：

- 未登录：`Sign in`；
- 未完成 18+：`Open my account`；
- 可进入测试 checkout：`Continue to secure checkout`；
- 暂不可用：`Check again`。

### 18.2 Hosted checkout

未来获批的直接销售设计仍必须跳转到 provider-hosted page；浏览器只提交 product code 和幂等 key，
不提交价格、权益或成功状态。卡数据不能进入 RITUVIA 服务。

本地测试可能进入 `/en/checkout/local` 并显示 `Complete local test payment`。该页面明确不收卡、不收
真钱、不能在非 local 环境运行。

### 18.3 返回页

`/en/checkout/return?order_id=...` 从服务端轮询 verified order：

- pending：不要重复付款；等待或稍后回到账户。
- success：只有 provider event 和 fulfillment 完成才显示成功。
- failed/unavailable：点击 `Check again`，或 `View my account` / `Return to sanctuary`。

浏览器 redirect 永远不授予 Credit。

### 18.4 系统如何实现

当前 Test Mode 服务端 catalog 固定产品/价格/国家/provider eligibility；Order、attempt、signed
webhook、append-only Credit ledger、fulfillment、reconciliation、refund、dispute hold 和 subscription
lifecycle 使用事务、幂等、outbox 和 least-privilege role。重复/乱序 webhook 不重复发放；退款和消费
竞争使用确定规则。RIT-074 不再复制一张 dispute 表，而是直接把 matched payment event 当争议事实；
只有 signed、applied、outbox 已完成、order 当前仍 disputed、同版本 Credit Pack fulfillment 已完成的
事实，才由独立 Worker 幂等投影成 immutable metadata-only support work item。它不是第二套可变 case
状态机，也没有 triage/resolve Button；Support 投影故障不会回滚支付或 Credit hold。这些完整性边界
可以复用于未来直接销售，但 Credit 产品语义不再是生产合同。

### 18.5 当前缺口

- 没有完整 Orders/Billing/Invoice/Portal/Subscription/Cancel/Support 客户界面；
- 没有“提交/查看 Chargeback”、上传争议证据、Admin 处理或 Owner provider-response Button；争议
  工作项当前只存在于后台 immutable metadata projection，不能手工 triage/resolve，且不会自动发消息
  或联系 provider；
- 没有生产 provider written approval、国家/税务/法律/descriptor/预算批准；
- Stripe Live 和真实支付保持关闭；
- D-097 已把 Coinbase/USDC 排除在批准的首次封闭 Beta 之外；
- 直接销售的精确 SKU、价格、权益、退款和客户文案仍需 OWN-018 的法律/支付 review；
- 任何本地成功状态都不能解释为生产购买。

此外，当前存在两套尚未统一的商业实现：Sanctuary 对象仍走旧 order/entitlement/local-checkout
路径，Plans/Credit packs 走较新的 commercial order/Credit/worker 路径。它们没有统一的用户购买
历史，不能在手册或客服话术中描述成同一个完整商业工作流。

### 18.6 Payment kill switch 在哪里、如何影响用户

当前没有 Web/Admin `Payment kill switch` Button，也没有普通用户可操作的开关。服务端在每次新订单、
订阅预留、provider 调用和旧 Checkout URL 回放之前，组合精确国家开关、fiat/crypto 开关与 Country
Policy。checkout 关闭或控制读取故障时，用户只看到脱敏 unavailable/retry 状态；国家、provider 或
method 未获批准时看到平静的不适用状态。系统不会自动切换 provider。

关闭新购买不关闭已有义务：signed webhook、退款、争议、fulfillment、entitlement 和 reconciliation
仍继续处理。关闭前已被用户复制的 provider URL 无法由 RITUVIA 撤销；普通用户不要继续尝试付款，
应回到账户/支持状态。完整操作与恢复边界见
`docs/runbooks/RIT-075_PAYMENT_PROVIDER_CONTROLS.md`。

## 19. 工作流 O：公共知识内容

**状态：45 个英语页面在仓库内通过内容/构建门；公开生产和索引未批准。**

### 19.1 公共入口

页头：`Methodology`、`Safety`；页脚额外有 `Privacy`。首页/结果页还会链接到 Tarot、Numerology、
Astrology 和 Ritual guides。

公共页面不接收私密输入。每个 hub/guide 底部提供下一个相关页面或实际体验 CTA。

准确 CTA 按页面家族如下：

- 信任/方法页：`Return to the reflection path`、`Review the privacy design`、`Read the methodology`；
- 数秘页：`Open the private calculator`、`Review the safety standard`、`Read the privacy boundary`、
  `Back to the numerology library`；
- 占星页：`Open the private saved-chart viewer`、`Read the safety boundaries`、
  `Read the privacy approach`、`Back to the astrology library`；
- Tarot 页：`Try a private one-card reflection`、`Read the safety approach`、
  `Previous Major Arcana`、`Next Major Arcana`、`Back to the Tarot library`；
- 仪式页：`Open the private Sanctuary`、`Read the safety approach`、
  `Back to ritual and reflection guides`。

### 19.2 路由家族

- 基础：`/en`、`/en/methodology`、`/en/safety`、`/en/privacy`。
- 数秘：`/en/numerology` 加 4 个方法页。
- 占星：`/en/astrology` 加 4 个方法页。
- Tarot：`/en/tarot`、22 张 Major Arcana 页面、2 个 spread guide。
- 仪式：`/en/rituals` 加蜡烛、线香、意图/行动、私密日记、Revisit 5 个 guide。

完整 URL inventory 在本手册附录 A。

### 19.3 系统如何实现

路由来自 approved、checksummed editorial inventory；每页包含 source/review authority、canonical、
hreflang、structured data 和明确内部链接。生产以外环境必须 noindex；公开域名、DNS、sitemap 和
indexing activation 需要 Owner 单独批准。

## 20. 通用错误、离线和恢复

| 状态                 | 用户看到什么                                                        | 应该怎么做                                       |
| -------------------- | ------------------------------------------------------------------- | ------------------------------------------------ |
| Loading              | `Preparing…`、`Loading…` 或 skeleton                                | 等待；不要连续点击                               |
| Empty                | 没有 reading/history/chart/Revisit                                  | 按页面说明先完成前置步骤                         |
| Validation           | 字段旁错误                                                          | 修正字段后再提交                                 |
| Offline              | 全局顶部连接提示；具体表单可能另有 `Check connection and try again` | 全局提示没有重试按钮；重连后在原表单明确提交一次 |
| Provider unavailable | `temporarily unavailable`                                           | 保留免费路径；稍后重试                           |
| Conflict             | 另一个 session/revision 已改变                                      | 重新加载，不覆盖旧版本                           |
| Rate limited         | 要求暂停并显示等待                                                  | 等待，不创建新 session 绕过                      |
| Unauthorized         | `Sign in`                                                           | 使用同一账户登录，再回到原工作流                 |
| Deleted/not found    | 资源不可用                                                          | 不伪造恢复；必要时新建                           |

全局错误页提供 `Try again` 和 `Return home`；全局离线 notice 本身没有 retry 按钮。系统不会在你
不知情时自动重复提交私密、支付或删除操作。

## 21. 隐私和浏览器存储说明

| 数据              | 当前用途                              | 不应出现的位置                                                           |
| ----------------- | ------------------------------------- | ------------------------------------------------------------------------ |
| Beta 邀请码       | 一次准入表单内存和同源请求正文        | URL、referrer、浏览器存储、日志、analytics、工单、共享表格、Git          |
| 问题自由文本      | 安全 intake 内存检查                  | URL、metadata、analytics、持久 intake 表、浏览器历史、reading/report/log |
| Intake 主题代码   | 当前 tab 一次性交给单张页，读取后删除 | 跨 tab 复制、长期存储、问题原文容器                                      |
| Reading ID        | 当前 tab 刷新恢复                     | 分享卡、公开 URL、analytics                                              |
| 意图/小行动       | owner-scoped 私密资源                 | 公开页面、支付 metadata、分享卡                                          |
| 日记/Revisit 反思 | owner-scoped 私密资源                 | URL、日志、analytics、通知                                               |
| 出生资料          | 加密 account profile                  | 公共占星页、普通日志、支付 metadata                                      |
| Email             | 登录/必要服务                         | spiritual profiling、分享、公共页面                                      |
| 支付事件          | 订单、对账、退款                      | 私密反思正文                                                             |

不要把不希望他人看到的内容手工放入截图或系统分享说明。使用公共设备后，先完成可靠的 `Sign out`；
敏感情况下使用 `Sign out all sessions`。

## 22. 工作流到实现的总映射

| 工作流    | UI                                                              | API                                           | 服务/domain                                                        | 持久化/恢复                                                                     |
| --------- | --------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| Beta 准入 | `protected-beta-admission-form.tsx`                              | `/api/v1/anonymous/session`                   | invite control + anonymous identity                                | invite digest/状态 + 原子 session 绑定；原始 token 不持久化                     |
| 问题检查  | `question-intake-form.tsx` + `question-intake-theme-handoff.ts` | anonymous session + `/api/v1/intake/evaluate` | question-intake policy + session intake budget                     | 不持久 intake 文本；一次性分类主题交接；每 session 固定计数行                   |
| 塔罗      | `tarot-one-card-flow.tsx`                                       | session/readings APIs                         | tarot service + deterministic draw/content                         | immutable facts + ID-only tab restore                                           |
| AI 解释   | `tarot-interpretation-panel.tsx`                                | reading interpretation API；当前 unavailable  | versioned retrieval/prompt/safety/verifier；provider/worker 未组合 | operation/idempotency + reviewed base meaning                                   |
| 意图      | `sanctuary-flow.tsx`                                            | intentions APIs                               | intention domain + shared mutation budget                          | owner/revision/idempotency；限流后页面锁定写入                                  |
| 仪式      | `sanctuary-ritual-experience.tsx`                               | ritual-session APIs                           | ritual domain/catalog/entitlement + shared mutation budget         | atomic start/complete/replay；每 session 固定计数行                             |
| 日记      | `sanctuary-flow.tsx`                                            | journal-entry APIs                            | ritual-journal domain + shared mutation budget                     | private owner/revision/delete；限流后不自动重试                                 |
| Revisit   | `revisit-experience.tsx`                                        | revisits/reminder APIs                        | revisit/reminder domain + shared mutation budget；投递未组合       | local date/time zone/revision/job；429 有界等待、当前页锁定匿名写入且无即时重试 |
| 登录/账户 | `sign-in-form.tsx`, `account-experience.tsx`                    | auth/me/session/consent APIs                  | account/auth/session services                                      | hashed challenge, HttpOnly session, merge link                                  |
| 隐私      | 当前无 UI                                                       | privacy export/deletion APIs                  | privacy services/crypto                                            | encrypted export, idempotent delete, session fencing                            |
| 运营 case | 阅读报告 Button；其他入口当前无 UI                              | 当前无 admin/support HTTP route               | operational case service + role/MFA policy                         | source-bound case + append-only event/audit + draft-only template               |
| 数秘      | `numerology-calculator.tsx`                                     | numerology calculate API                      | pure versioned numerology engine                                   | 无出生日期持久化                                                                |
| 占星      | `astrology-natal-result.tsx`                                    | astrology natal read API                      | feature flag + native engine adapter                               | encrypted profile/calculation + strict read projection                          |
| 支付      | plans/checkout components                                       | catalog/order/checkout/webhook APIs           | payment adapters + ledger/fulfillment                              | transactions/outbox/reconciliation/refund                                       |
| 公共内容  | publication components                                          | server rendering                              | approved editorial registry                                        | checksummed inventory/build evidence                                            |

## 23. 上线前仍不能告诉用户“已经可用”的功能

- 公共生产网站、域名和搜索索引；
- Stripe Live、真实信用卡/Apple Pay/Google Pay 收款；
- Coinbase/USDC；
- 生产 AI 处理私密内容；
- 生产邮件登录和 Revisit 投递；
- 自助隐私导出/删除按钮；
- 普通用户 Support/Case Status 按钮，以及 Admin 队列/Triage/Escalate/Resolve 按钮；
- 完整订阅、账单、发票、订单、退款和争议客户中心；
- 完整出生资料创建和占星计算入口；
- Simplified Chinese 或其他语言发布；
- 已批准国家之外的服务、支付或法律政策；
- 比免费仪式“更有效”的任何付费承诺。

## 24. 支持人员收集问题时需要什么

当前没有产品内 Support Button。若 Owner 在封闭 Beta 中另行批准一个临时联系渠道，支持人员只能按
该批准渠道收集以下最小信息；不能把本地队列 SLA 写成对外承诺。阅读页面的 `Send report` 会自动
进入安全或内容队列，不需要用户再提交一次私密说明。

请记录：

1. 页面 URL（不要把私密文本放进 URL）；
2. 点击的准确英文按钮名；
3. 桌面/移动、浏览器、键盘/屏幕阅读器/reduced motion；
4. 是否离线、刷新、重复点击或跨设备；
5. 发生的大致时间和可公开的 request/correlation ID（如果页面提供）；
6. 是否涉及账户、支付、隐私删除或安全风险。

不要索取问题、日记、出生资料、密码、magic link、cookie、CSRF、私钥、完整支付数据或生产密钥。
不要把邮件/聊天全文粘贴进 case；当前 case 只允许固定 category、状态、reason、ticket 和哈希证据。

## 附录 A：45 个公共内容 URL

### 基础页面

`/en`、`/en/methodology`、`/en/safety`、`/en/privacy`

### 数秘

`/en/numerology`、`/en/numerology/life-path-number`、`/en/numerology/birthday-number`、
`/en/numerology/personal-year-number`、`/en/numerology/master-numbers`

### 西方占星

`/en/astrology`、`/en/astrology/natal-chart-calculation`、
`/en/astrology/birth-time-uncertainty`、`/en/astrology/houses-and-major-aspects`、
`/en/astrology/sources-and-methodology`

### Tarot

`/en/tarot`、`/en/tarot/the-fool`、`/en/tarot/the-magician`、
`/en/tarot/the-high-priestess`、`/en/tarot/the-empress`、`/en/tarot/the-emperor`、
`/en/tarot/the-hierophant`、`/en/tarot/the-lovers`、`/en/tarot/the-chariot`、
`/en/tarot/strength`、`/en/tarot/the-hermit`、`/en/tarot/wheel-of-fortune`、
`/en/tarot/justice`、`/en/tarot/the-hanged-man`、`/en/tarot/death`、
`/en/tarot/temperance`、`/en/tarot/the-devil`、`/en/tarot/the-tower`、
`/en/tarot/the-star`、`/en/tarot/the-moon`、`/en/tarot/the-sun`、
`/en/tarot/judgement`、`/en/tarot/the-world`、`/en/tarot/one-card-spread`、
`/en/tarot/situation-action-possibility-spread`

### 仪式与反思

`/en/rituals`、`/en/rituals/virtual-candle-reflection`、
`/en/rituals/virtual-incense-reflection`、`/en/rituals/intention-and-small-action`、
`/en/rituals/private-reflection-journal`、`/en/rituals/revisit-a-reflection`

## 附录 B：最短核心闭环按钮清单

0. Protected Beta 私密入口 `Enter protected Beta`（只适用于受邀环境）
1. 首页第一屏 `Begin a free reading`
2. Intake 表单底部 `Review my question`
3. Allowed 结果卡 `Continue to a private one-card reflection`
4. 单张页主题表单底部 `Draw one card`
5. Ready 面板 `Reveal my card`
6. 结果底部 `Continue to a private intention`
7. Sanctuary 意图主题 `Peace and clarity`
8. 意图表单底部 `Continue with this intention`
9. 免费对象卡片底部 `Begin free ritual`
10. 仪式顶部 `Complete now`，或逐步 `Continue` 后 `Complete this ritual`
11. 完成面板 `Continue to private reflection`
12. 日记文本框下方 `Save private reflection`
13. 意图区 `Schedule a private Revisit`
14. Revisit schedule 面板 `Schedule this Revisit`
15. Revisit 卡片 `Complete this Revisit`
16. 完成表单再次 `Complete this Revisit`

如果其中任何一个按钮不存在、不可聚焦、无法理解或产生了与本手册不同的结果，应视为产品或手册
漂移，不能要求用户自己寻找替代路径。

## 附录 C：按钮位置速查表

| 页面/区域          | 准确英文按钮或链接                                                                                                                             | 位置                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Protected Beta     | `Enter protected Beta`                                                                                                                         | `/en/beta` 邀请输入框下方的主 Button                                |
| 全站页头           | `Home` / `Sanctuary` / `Methodology` / `Safety`                                                                                                | 桌面页头中部；移动端页头导航换行区                                  |
| 全站页头           | `Sign in` / `Account`                                                                                                                          | 桌面最右；移动端语言控件旁/下方                                     |
| 全站页脚           | `Privacy`                                                                                                                                      | 每页最底部 footer 链接组                                            |
| 首页 Hero          | `Begin a free reading`                                                                                                                         | 第一屏文案下方第一枚主按钮                                          |
| 首页 Hero          | `Enter the sanctuary`                                                                                                                          | 第一屏文案下方第二枚次按钮                                          |
| 首页 Oracle        | `Draw one card` / `Draw three cards` / `Visit the sanctuary`                                                                                   | 各功能卡片底部                                                      |
| 安全 intake        | `Review my question`                                                                                                                           | 主题和可选问题表单底部                                              |
| 安全 intake 结果   | `Continue to a private one-card reflection` / `Review another question`                                                                        | allowed 结果卡底部                                                  |
| 安全 intake 结果   | `Use the suggested question` / `Use the safer question`                                                                                        | reframed/blocked 结果卡底部；采用后仍须重新 Review，crisis 无此按钮 |
| 塔罗主题表单       | `Draw one card` / `Draw three cards`                                                                                                           | 主题单选组下方                                                      |
| 塔罗 Ready 面板    | `Reveal my card` / `Reveal the three cards`                                                                                                    | 卡背图和状态说明旁/下方                                             |
| 塔罗恢复/错误      | `Try to restore the saved result` / `Choose a new theme instead`                                                                               | 恢复错误卡底部                                                      |
| 塔罗恢复/错误      | `Try the same draw again` / `Confirm the session and try again`                                                                                | 对应错误卡底部                                                      |
| 单张分享区         | `Preview share card` / `Hide share preview`                                                                                                    | `Optional sharing` 区域动作行                                       |
| 单张分享区         | `Download privacy-safe SVG` / `Open device share sheet`                                                                                        | 已生成预览的动作行                                                  |
| 可选解释区         | `Explore the deeper interpretation`                                                                                                            | 固定卡牌结果之后的 AI 面板                                          |
| 可选解释区         | `Stop checking` / `Try the same request again`                                                                                                 | processing 或 recoverable failure 状态                              |
| 塔罗报告           | `Report an issue with this reading`                                                                                                            | 结果靠下的折叠 summary                                              |
| 塔罗报告           | `Send report` / `Try the same report again`                                                                                                    | 展开报告表单底部/普通错误状态；429 不显示重试                       |
| 全站支持           | 当前没有 `Support` / `Contact support` / `Track my case`                                                                                       | Button 不存在；不要猜 URL                                           |
| Admin 队列         | 当前没有 `Triage` / `Escalate` / `Resolve`                                                                                                     | Web Dashboard/Button 不存在；RIT-120 仅完成 private/offline 日报    |
| 塔罗完成区         | `Continue to a private intention`                                                                                                              | 结果面板底部主按钮                                                  |
| 塔罗完成区         | `Read the methodology` / `Start a new reflection`                                                                                              | 主按钮旁和更下方                                                    |
| Sanctuary 意图     | `Continue with this intention` / `Save intention changes`                                                                                      | 意图表单底部                                                        |
| Sanctuary 意图     | `Schedule a private Revisit`                                                                                                                   | 意图保存后的 action 行第一项                                        |
| Sanctuary 意图     | `Mark complete` / `Archive intention` / `Delete intention`                                                                                     | 已保存意图的 action 行                                              |
| Sanctuary 意图确认 | `Cancel`                                                                                                                                       | lifecycle 确认 action 行                                            |
| Sanctuary 对象卡   | `Begin free ritual` / `Place in my sanctuary`                                                                                                  | 每个 ritual object 卡片底部                                         |
| Sanctuary catalog  | `Retry catalog`                                                                                                                                | catalog error/degraded 提示下方                                     |
| 仪式顶部           | `Exit ritual` / `Pause ritual` / `Resume ritual` / `Complete now`                                                                              | 仪式标题右侧/顶部 action 区                                         |
| 仪式模式/步骤      | `Use accessible linear mode` / `Use standard 2D mode`                                                                                          | 模式说明下方                                                        |
| 仪式模式/步骤      | `Previous step` / `Continue` / `Complete this ritual`                                                                                          | 当前步骤底部导航                                                    |
| 仪式完成           | `Continue to private reflection` / `Return to Sanctuary`                                                                                       | 完成面板动作区                                                      |
| 私密日记           | `Save private reflection` / `Save reflection changes`                                                                                          | 日记文本框下方                                                      |
| 私密日记           | `Delete private reflection`                                                                                                                    | 已保存日记动作区                                                    |
| Sanctuary 完成     | `View my account` / `Start another free reflection`                                                                                            | 完成状态底部动作区                                                  |
| Revisit 排期       | `Store quiet hours`                                                                                                                            | schedule 面板提醒/安静时段区域                                      |
| Revisit 排期       | `Schedule this Revisit`                                                                                                                        | schedule 表单底部                                                   |
| Revisit 卡片       | `Save new date` / `Complete this Revisit` / `Archive` / `Delete`                                                                               | 每张 Revisit 卡片动作区；429 后当前页禁用                           |
| 登录               | `Continue securely`                                                                                                                            | Email 表单底部                                                      |
| 本地登录           | `Complete local sign-in`                                                                                                                       | 本地 preview 成功提示内；Local Test only                            |
| 账户 Profile       | `Save profile` / `Save 18+ confirmation`                                                                                                       | 各自表单底部                                                        |
| 账户 History       | `Load older history` / `Open this reading`                                                                                                     | history 列表底部/reading 项目中                                     |
| 账户 Session       | `Sign out this other session`                                                                                                                  | 其他 session 卡片内                                                 |
| 账户底部           | `Sign out all sessions` / `Sign out`                                                                                                           | session/账户动作区                                                  |
| 数秘表单           | `Calculate my numbers`                                                                                                                         | Birth date 和 Target year 下方                                      |
| 数秘结果           | `Clear birth data and start again`                                                                                                             | 计算结果/表单动作区                                                 |
| 数秘计算器标题区   | `Learn the public method before calculating`                                                                                                   | 页面标题/说明区域                                                   |
| 占星未登录         | `Sign in to view saved charts`                                                                                                                 | unauthorized 状态卡                                                 |
| 占星错误           | `Try loading again` / `Check connection and try again`                                                                                         | error/offline 状态卡                                                |
| Plans pack 卡      | `Sign in` / `Open my account` / `Continue to secure checkout` / `Check again`                                                                  | 每个 pack 卡底部，按资格显示                                        |
| 本地 checkout      | `Complete local test payment`                                                                                                                  | `/en/checkout/local` 主面板；Local Test only                        |
| Checkout return    | `Check again` / `View my account` / `Return to sanctuary`                                                                                      | pending/error/success 状态卡动作区                                  |
| 公共信任/方法页    | `Return to the reflection path` / `Review the privacy design` / `Read the methodology`                                                         | 页面底部相关路径区                                                  |
| 公共数秘页         | `Open the private calculator` / `Review the safety standard` / `Read the privacy boundary` / `Back to the numerology library`                  | hub/guide 底部 CTA 区                                               |
| 公共占星页         | `Open the private saved-chart viewer` / `Read the safety boundaries` / `Read the privacy approach` / `Back to the astrology library`           | hub/guide 底部 CTA 区                                               |
| 公共 Tarot 页      | `Try a private one-card reflection` / `Read the safety approach` / `Previous Major Arcana` / `Next Major Arcana` / `Back to the Tarot library` | hub/卡牌/guide 导航区                                               |
| 公共仪式页         | `Open the private Sanctuary` / `Read the safety approach` / `Back to ritual and reflection guides`                                             | hub/guide 底部 CTA 区                                               |

没有列出 `Export my data`、`Delete account`、`Manage subscription`、`Create birth profile` 或
`Calculate natal chart`，因为当前普通用户界面没有这些按钮；这正是上线前必须补齐或明确排除的
产品事实。

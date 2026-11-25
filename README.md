# 轻记 2.0：从本机到手机公网访问

## 当前交付状态

前端已发布到 **[轻记公网网站](https://clarahuan.github.io/Expense_Tracker/)**，不再依赖个人电脑开机。GitHub Pages 使用现有公开仓库与 GitHub Actions 自动部署，首页及关键静态资源已验证 HTTP 200。

页面、IndexedDB、导入、统计、PWA 及同步代码已实现；Supabase 项目仍需本人创建配置。当前未配置云端时，账单只保存在当前浏览器，不能把网站发布成功理解为云端同步已验收。旧账单需通过 JSON 或本地迁移预览确认导入，新公网域名不会自动读取 localhost 的数据。

原有 Python/SQLite 服务保留，仅用于旧版页面和数据迁移。新版不会自动上传旧账单。

## 先看新版

1. 在 `D:\Expense_Tracker` 双击 `start.bat`，或运行 `python server.py`。
2. 电脑打开 http://localhost:8000 。默认是新版；旧版为 http://localhost:8000/legacy.html 。
3. 新版先把记录写入这个浏览器的 IndexedDB。未登录、本地端口、不同浏览器、部署后的 HTTPS 域名分别有独立存储，不能自动互通。
4. 需要跨设备同步时，先完成下方 Supabase 配置，并在两台设备登录同一账号。

也可只预览完全静态的部署包：运行 `python build_static.py`，再运行 `python -m http.server 8080 --bind 127.0.0.1 --directory dist`，打开 http://localhost:8080 。此方式不包含旧版 Python API。

新版预览服务默认仅监听 `127.0.0.1`，避免旧版无认证的迁移 API 暴露给同一网络的其他设备。手机长期访问使用正式 HTTPS 公网地址。确需临时局域网调试时可显式运行 `python server.py --host 0.0.0.0`，仅限可信私有网络，不能映射公网。

## 创建 Supabase 免费项目

以下由本人在浏览器操作，不向开发者提供账号密码、数据库密码或管理密钥。

1. 打开 https://supabase.com/dashboard ，登录或自行注册。
2. 新建组织时选择 **Free**。点 **New project**，填写项目名 `qingji`，自己生成并保管数据库密码。选择适合本人网络访问的地区，创建项目。不要升级套餐或开通付费功能。
3. 项目就绪后，在侧栏打开 **SQL Editor** → **New query**。
4. 打开本项目 `supabase/schema.sql`，复制全部内容到 SQL Editor，点击 **Run**。应成功创建 `qj_documents`、`qj_mutations` 和 `qj_apply_document`。不要关闭 RLS。
5. 在 **Authentication → Users** 中，用 **Add user / Create new user** 创建自己的个人邮箱账号。如控制台要求设置密码，由本人自行设置保管；网页本身不收取密码，支持默认邮件的 Sign in 登录链接，也兼容邮件验证码。若界面有自动确认邮箱选项，完成邮箱确认。
6. 在 **Authentication → Sign In / Providers**（或 General configuration）找到 **Allow new users to sign up**，关闭公开注册。保持 Email 登录方式启用，避免把整个 Email provider 关闭。
7. 保留默认 **Magic link or OTP** 邮件模板即可。当前默认邮件服务可能锁定模板编辑，不需要为了本站去配置自定义 SMTP。在 **Authentication → URL Configuration** 中，将 **Site URL** 设为 `https://clarahuan.github.io/Expense_Tracker/`，**Redirect URLs** 添加 `https://clarahuan.github.io/Expense_Tracker/**`；如要在电脑本机调试，再添加 `http://localhost:8000/**`。这里的通配范围仅限本仓库路径，不要开放任意域名。
8. 在项目 **Settings / Connect / API Keys** 中，找到 **Project URL** 和 **Publishable key**。若使用旧版密钥，则只选择 `anon`；绝不选择 `secret`、`service_role` 或数据库连接密码。
9. 建议直接打开公网轻记 → **我的 → 云端连接与登录 → 配置**。填入项目 URL 与公开 key，点击保存；复制来的 Data API `/rest/v1/` 地址也会自动转换为项目根地址，保存结果显示在按钮正下方。输入个人邮箱，点“发送登录邮件”，在邮件中点击 **Sign in** 返回网站完成登录；若模板提供验证码，则展开备用验证码输入框。邮件中的公开连接参数可帮助新浏览器识别项目；认证令牌只出现在 URL fragment，网站验证用户后才建立会话，并先从地址栏移除令牌。不要转发完整登录链接。
10. 等“我的”页面显示 **已同步**。切换设备后输入相同公开连接信息并登录同一邮箱。连接信息保存在各设备本地，不必把它提交到代码仓库。

公开 key 不是数据库管理凭证，访问控制依靠 SQL 中的 RLS。新账号创建后，可以关闭公开注册，网页发送验证码时也明确禁止自动创建用户。

### 邮箱免费服务的重要限制

Supabase 默认邮件服务只向项目组织团队成员邮箱发送邮件，当前限额为每小时 2 封，且不提供送达与可用性保证。个人使用可先采用自己注册 Supabase 的同一邮箱；若出现 `Email address not authorized`，检查组织 Team 中的邮箱是否一致。验证码获取失败不会删除本地账单，等待限额恢复后重试。其他邮箱或更高可靠性需要自行配置 SMTP，可能涉及第三方额度或收费，必须先评估，不自动购买。

官方说明：[验证码登录](https://supabase.com/docs/guides/auth/auth-email-passwordless)、[邮件模板](https://supabase.com/docs/guides/auth/auth-email-templates)、[关闭注册](https://supabase.com/docs/guides/auth/general-configuration)、[默认邮件限制](https://supabase.com/docs/guides/auth/auth-smtp)。

## 云端数据结构与同步

- Supabase Auth 管理用户身份；`qj_documents` 按 `kind` 存放账单、分类/自定义规则设置、导入批次记录。
- 每条记录有 UUID、owner_id、创建/更新时间、revision 和 deleted。金额为整数分；`qj_mutations` 保存操作回执以防重试产生重复写入。
- 本地每次修改都会在同一个 IndexedDB 事务中写入账单和 outbox。网络恢复或页面打开时自动尝试同步，页面开启时也每分钟尝试一次。
- 云端确认保存成功才移除对应 outbox。失败保留待同步操作，可在“我的”重试。较早请求的确认不会擦除较新的本机修改。
- 云端通过 revision 比对检测同时修改。冲突显示在“我的”，保留两份版本，由本人选择“保留本机”或“采用云端”。分类设置也使用相同机制。
- 账号之间、本地未登录账本之间分库隔离。退出不会删除该浏览器保留的账号离线数据；它不是对设备所有者的磁盘加密。共享设备应另用独立浏览器配置，清理前先确认云端同步及备份。
- 浏览器会限制后台运行；网页关闭后不能承诺即时自动同步。下次打开、恢复联网时继续。
- 多设备同时导入同一批外部文件时，需先同步，再导入；本地去重不是跨设备全局唯一约束。相同 UUID 的同步重试不会生成新账单。

## 旧 SQLite 迁移

升级前已运行 `python backup_legacy.py`，原始数据库没有被改写。备份保存在被 Git 排除的 `data/upgrade-backup-时间戳/`，包含原库、源码快照和 `legacy-backup.json`。

推荐路径：

1. 再次运行 `python backup_legacy.py` 备份当前旧库。
2. 新版“我的 → 旧版 SQLite 迁移 → 预览”，仅在原 Python 服务运行时可直接读取旧 API。
3. 或在“导入账单文件”选择备份中的 `legacy-backup.json`。检查预览后确认。旧分类映射为新版分类；金额、日期、商户、备注和旧交易身份标识保留。
4. 若先迁入未登录账本，先导出新版完整 JSON；登录云端账号后，再预览恢复该 JSON。登录不会未经确认上传未登录数据。
5. 确认新旧总额相符、云端同步成功后，也请保留原 SQLite 独立备份。

不要把真实备份复制到 `web/`、`dist/` 或提交到 GitHub。

## 使用与导入

底部五个入口为首页、账单、中央记账、统计、我的。中央按钮支持收入和支出；“我的”可以管理分类、关键词规则与回收站。

文本示例：`午饭15元，地铁4元，奶茶8元，家教收入210元`；历史格式 `11.25，45（地铁4，日用品11）` 拆成 4、11、30 元，合计仍为 45 元。括号内仅有一个名称时，例如 `4.8，88.8（GPT Plus）`，将总额记为该名称的一笔支出，不生成饮食余额；多个无金额的名称仍需补全明细。`日期，0` 跳过，不生成账单。未写年份使用参考年份并提示；每日总额格式的时刻暂填 12:00。明细超出总额或不明确的内容拒绝解析并列出错误。

截图复用原有 Tesseract.js 和规则解析，支持多图、多笔、时间排序和修改预览。金额、年份与时刻可能识别错误，缺失日期必须补全。OCR 组件首次使用需要联网，不使用收费 AI API。

文件支持 CSV、XLSX、XLS 和 JSON。Excel 库已以固定版本 0.20.3 打包在网站中，按需加载，无需上传原文件。CSV 可选 UTF-8 或 GB18030/GBK。程序寻找交易时间/金额等表头并展示列映射；未知格式可手动调整表头所在行和各列。Excel 当前读取第一张工作表。

**目前缺少本人实际导出的微信/支付宝脱敏样本。** 文件解析已通过构造样例和 Excel 往返测试，不能宣称兼容所有官方版本。请分别提供一份删去姓名、账号、完整交易号等信息但保留表头、日期、正负金额和状态的 CSV/Excel，用来验证实际格式。

退款、资金转移、充值、提现、关闭或失败交易默认不勾选；不会自动用退款抵扣原支出。若需要净支出口径，请确认原始支出后修改原记录或分类处理，避免把所有退款误记成新收入。收入缺少明确标识时也需确认。相同交易号或相同类型/分钟/金额/商户视为重复；同分钟金额相同但名称不同时只标记为疑似重复，默认不勾选，可人工确认。确实重复的批量记录会跳过；真实同额同商户消费可手动添加。

批量添加一次最多 3000 笔。成功、重复跳过和解析失败数量显示在预览和导入结果里。导入前不会写入账本，确认后写入本地事务再尝试同步。

## 备份与恢复

- “我的 → 完整 JSON 备份”：包含账单（含回收站）、分类、规则及文档元数据；不含认证令牌、密码或云管理密钥。
- “全部账单 CSV”用于通用表格；统计页可以选择范围导出 CSV。
- 统计页可把当前范围的消费/收入分类图下载为 PNG，图中标注分类、金额、占比。
- 恢复时选择 JSON，先预览，默认跳过已有 UUID 或重复交易；已有账单不会被备份强行覆盖。删除的账单恢复到回收站。分类/规则只有勾选恢复设置后才会替换。
- “最近备份时间”记录的是发起下载时间，请自行确认下载成功；首页每周提醒一次。建议把 JSON 存到独立位置，不能只放在同一浏览器里。

## GitHub Pages 发布

发布前需要本人确认上传与部署授权；不要把尚未发布的预计网址当作已经可用的链接。

1. 仓库为 `clarahuan/Expense_Tracker`。免费 Pages 使用公开仓库；若仓库为私有，请先评估计划，未经同意不改变可见性或购买套餐。
2. 代码确认后提交并推送到 `main`。`.github/workflows/pages.yml` 会运行 Node 和 Python 测试，以白名单构建 `dist/`，只上传静态产物，不会上传 `data/`、Python API、旧版页面或备份。
3. 在 GitHub 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。若首次运行先于此设置失败，设置好后在 Actions 重新运行 Deploy 工作流。
4. 等 Actions 的 Deploy 成功，在 **Settings → Pages** 复制实际网址。默认预计为 `https://clarahuan.github.io/Expense_Tracker/`，但必须看到部署成功才算完成。
5. 手机用 Safari 打开这个 HTTPS 地址。“分享 → 添加到主屏幕”。发布完成后网站不再依赖个人电脑开机。
6. 在新域名重新配置公开 Supabase 连接信息并登录。各设备用同一账号，等待同步完成。旧的 localhost/局域网 IndexedDB 不会自动复制到公网域名。

资源引用使用 `./` 相对路径，路由为 `#home/#bills/#stats/#mine`，刷新不需要服务器路由重写。GitHub 上不存登录密码；验证码直接发往本人配置的 Supabase Auth。

## PWA 与缓存维护

首次联网打开并缓存成功后，可以离线打开基本界面、查看、添加和修改已有账单。截图模型首次下载、邮箱登录和云同步仍需要网络。正式 iPhone PWA 需要 HTTPS，局域网 HTTP 不适合作为离线验收环境；localhost 可用于电脑测试。

每次发布修改 `web/sw.js` 中的 VERSION。Service Worker 将整套 HTML/JS/CSS 作为同一版本缓存。新版本等待用户点击“刷新更新”，有编辑弹窗时提醒先保存，避免旧脚本与新 HTML 混用。更新只删除本站旧静态缓存，不删除 IndexedDB 账本。IndexedDB 数据结构升级时必须递增版本并写兼容迁移，不能简单删库重建。

## 免费额度与维护

截至 2026-11-25 官方资料：

- Supabase Free：500 MB 数据库、5 GB 出站流量、1 GB 文件存储、5 万月活用户，最多两个活跃免费项目；闲置一周可能暂停，需在控制台恢复。此应用不把截图上传云存储。
- 免费方案并不提供付费方案的日常托管备份保障，独立 JSON/SQLite 备份必须保留。不要通过无意义定时请求承诺永久不休眠。
- GitHub Free 的 Pages 支持公开仓库，站点最大 1 GB、软带宽上限每月 100 GB。GitHub Pages 和 Supabase 在某些网络可能无法访问；已缓存的基本本地记账可以继续，不能保证首次离线访问成功。
- 不自动开通任何付费服务。超额、邮箱服务或更高可用性需求出现时，再由本人选择方案。

来源：[Supabase 定价](https://supabase.com/pricing)、[上线检查](https://supabase.com/docs/guides/deployment/going-into-prod)、[GitHub Pages 限制](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)。额度与控制台名称可能变化，以官方最新页面为准。

## 验证与待人工验收

本地自动测试：`npm ci` 后运行 `npm test`。Python 旧接口测试：`python -m unittest test_server.py`。打包：`python build_static.py`。Node 仅用于开发测试，运行网页不需要 Node。

已验证：整数分金额、收入支出统计、历史文本拆分、截图解析回归、CSV/Excel 基础解析、去重、IndexedDB 持久化与账号分库、离线队列、重试、双方冲突保留、同版本离线缓存、子路径静态资源。SQL 在 PGlite 本地 PostgreSQL 语义下验证了匿名读取拒绝、第二账号隔离、写入约束与 RPC 回执幂等；它不能替代实际 Supabase 项目配置检查。

浏览器已检查手机尺寸无横向溢出、五个导航入口、新增收入/支出、编辑、删除恢复、批量文本预览导入、刷新持久化、图表/JSON 下载与恢复去重。使用的都是隔离预览域名上的测试数据。

待本人配置后实测：Supabase 邮件送达和登录、两台真实设备同步、网络恢复后的真实云同步、跨设备冲突、实际项目中匿名/另一账号 RLS、GitHub Actions/Pages 正式发布、iPhone 主屏幕安装与飞行模式使用、官网更新缓存提示、真实微信/支付宝脱敏样本。未完成的项目不得标为通过。

## 源码结构

`web/js/core.js` 为金额/统计/分类，`store.js` 为 IndexedDB/待同步队列，`cloud.js` 为 Auth/REST 同步，`imports.js` 为文本/表格/备份解析，`finance-app.js` 为手机界面。`receipt-parser.js` 保留旧截图解析。`supabase/schema.sql` 为建表、RLS 和带版本检测的写入函数。`web/vendor/` 包含 SheetJS 与许可证；`build_static.py` 只打包允许发布的静态资源。`server.py` 与 `web/legacy.html` 保留旧版兼容。

统计页底部的“导出到备忘录”按当前统计范围生成“日期，总额（名称 金额）”文本，按月分组、收入单列，饮食支出只计入总额、不列入括号，当天全是饮食时省略括号；点击复制后可粘贴到手机备忘录。复制权限不可用时会选中文本供手动复制。文本仅供阅读留存，不替代保留完整字段和设置的 JSON 备份。

2.1.0：新增分类记忆、最近消费再记一笔、保存后继续、今天/昨天/前天文本日期、每日导入摘要与异常展开、我的页面导入批次撤销和最近完整同步时间。旧批次未记录账单 ID，不提供整批撤销；撤销新批次会软删除对应账单，可从回收站恢复。摘要中的金额为已选支出。

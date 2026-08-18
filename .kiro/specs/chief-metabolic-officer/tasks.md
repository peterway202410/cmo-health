# Implementation Plan — 首席代谢官（Chief Metabolic Officer）

## Overview

本任务列表按"自下而上 + 测试先行"组织：先搭基础设施 → Domain 纯函数（含属性测试）→ Pinia stores → 页面 → 跨端联调 → 设置模块。每个子任务都映射到 requirements.md / design.md 的具体编号，便于回溯。

完成后请按 1 → 12 顺序推进，每完成一项请勾选并跑通对应测试。

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"], "rationale": "项目初始化必须最先完成" },
    { "wave": 2, "tasks": ["2"], "rationale": "类型与存储适配层是后续所有模块的基础" },
    { "wave": 3, "tasks": ["3"], "rationale": "工具与平台层依赖类型，独立于 Domain 与 Stores" },
    { "wave": 4, "tasks": ["4", "5", "7"], "rationale": "Domain 评估引擎、趋势与建议、跨端图表组件相互独立，可并行开发" },
    { "wave": 5, "tasks": ["6"], "rationale": "Pinia Stores 依赖 Domain 纯函数与存储适配层" },
    { "wave": 6, "tasks": ["8", "9", "10", "11"], "rationale": "页面与设置模块依赖 Stores 与图表组件，可并行开发" },
    { "wave": 7, "tasks": ["12"], "rationale": "跨端联调与质量门是最终收尾" }
  ]
}
```

执行顺序提示：
- 1 → 2 → 3 是必须的串行起步
- 4 / 5 / 7 可并行（同一波）
- 6 在 4/5 完成后开始
- 8/9/10/11 在 6（与 7、3）就绪后并行推进
- 12 是收尾质量门

## Tasks

- [ ] 1. 项目初始化与工程基线
  - 使用 uni-app + Vue 3 + Vite + TypeScript 模板创建项目（推荐 Vue 3/Vite 版 uni-app 官方模板）
  - 安装并配置 Pinia
  - 配置 ESLint + Prettier + tsconfig（开启 strict）
  - 添加 vitest + fast-check + @vue/test-utils 作为开发依赖
  - 在 `pages.json` 注册全部 7 个页面：home / profile / questionnaire / metrics / report / trend / settings
  - 在 `manifest.json` 配置应用名"首席代谢官"
  - 创建 `src/styles/variables.scss` 与 `src/styles/base.scss`，并在 App.vue 中全局引入
  - _References: design.md Project Structure, Cross-Platform Considerations 路由_

- [ ] 2. 基础类型与存储适配层
- [ ] 2.1 定义数据 schema
  - 创建 `src/infra/storage/schema.ts`，导出 `SCHEMA_VERSION = 1`、`Profile`、`Questionnaire`、`WeightRecord`、`BPRecord`、`GlucoseRecord`、`LipidRecord`、`UricRecord`、`Settings`、`MetricsBundle`、`BackupFile`
  - 字段范围注释与 requirements 一致
  - _References: Requirements 1.2-1.4, 2.1, 3.2-3.8, 19.5; design.md Data Models_

- [ ] 2.2 实现 StorageAdapter
  - 创建 `src/infra/storage/keys.ts` 导出 `KEYS` 常量与 `KEY_PREFIX = 'cmo:'`
  - 创建 `src/infra/storage/StorageAdapter.ts`，封装 `uni.getStorageSync` / `uni.setStorageSync` / `uni.removeStorageSync`
  - 实现 `get<T>` / `set<T>` / `remove` / `clearAllByPrefix` / `listKeys`
  - JSON 解析失败时返回 null，不抛错
  - _References: Requirements 18.1-18.2, 19.1-19.5; design.md Storage Adapter_

- [ ] 2.3 添加 Storage 单测（mock uni）
  - 在 `tests/infra/storage.spec.ts` mock 全局 `uni.*`
  - 验证读写、序列化、JSON 解析失败兜底、`clearAllByPrefix` 仅清除 `cmo:` 前缀
  - _References: Requirements 18.1-18.2, 16.3_

- [ ] 3. 工具与平台层
- [ ] 3.1 日期与年龄工具
  - 创建 `src/utils/date.ts`，实现 `nowIso()`、`ageFromBirth(birth, now)`、`daysBetween(a, b)`
  - 所有时间使用 ISO 8601 字符串
  - _References: Requirements 19.1-19.3; design.md utils/date.ts_

- [ ] 3.2 ID 与字段验证器
  - 创建 `src/utils/id.ts`（生成备份导出名、记录 ID 备用）
  - 创建 `src/utils/validators.ts`，覆盖 R1.3 / R1.4 / R2.1 / R2.2 / R3.8 全部范围校验
  - _References: Requirements 1.3, 1.4, 2.1, 2.2, 3.8_

- [ ] 3.3 平台检测与文件 IO 抽象
  - 创建 `src/infra/platform/detect.ts` 导出 `getPlatform(): 'h5' | 'mp-weixin' | 'app-plus' | 'unknown'`
  - 创建 `src/infra/backup/file-h5.ts`：H5 用 Blob+a 标签下载，input[type=file] 选择
  - 创建 `src/infra/backup/file-mp.ts`：小程序用 `wx.saveFile` / `wx.chooseMessageFile`
  - 创建 `src/infra/backup/file-app.ts`：APP 用 `plus.io`
  - 通过条件编译在 `src/infra/platform/index.ts` 导出统一 `FileIO` 接口
  - _References: design.md Cross-Platform Considerations, 平台层_

- [ ] 4. Domain 评估引擎（纯函数 + 属性测试）
- [ ] 4.1 BMI 与 WHR
  - 创建 `src/domain/assessment/bmi.ts` 实现 `computeBMI(weight_kg, height_cm)`（含 cm→m）与 `classifyBMI(bmi)`
  - 创建 `src/domain/assessment/whr.ts` 实现 `computeWHR` 与 `classifyWHR(whr, gender)`
  - 单测 + 性别边界测试
  - _References: Requirements 6.1-6.5; design.md Components and Interfaces_

- [ ] 4.2 尿酸判定
  - 创建 `src/domain/assessment/uric.ts` 实现 `classifyUric(uric, gender)`
  - 性别阈值男 >420 / 女 >360
  - _References: Requirements 7.1-7.2_

- [ ] 4.3 代谢综合征判定
  - 创建 `src/domain/assessment/metabolicSyndrome.ts` 实现 `evaluateMetS(snapshot)` 返回 5 项 `MetSItem` + matched + diagnosed
  - 已确诊高血压/糖尿病强制对应项 matched=true、source='diagnosed'
  - 输出 `diagnosed === (matched ≥ 3)`
  - _References: Requirements 5.1-5.7, 4.8-4.9; design.md Property 11, 12_

- [ ] 4.4 缺失数据评估
  - 创建 `src/domain/assessment/missingData.ts` 实现 `evaluateCoverage(snapshot)`
  - 必要指标 6 项：weight_kg / waist_cm / bp / fpg / hdl / tg
  - 输出 mode（full/reference/unavailable）、confidence、coveredCount、missingItems
  - _References: Requirements 9.1-9.5; design.md Property 5, 7_

- [ ] 4.5 评分计算
  - 创建 `src/domain/assessment/score.ts` 实现 `computeScore(snapshot)`
  - 按 design.md 评分细则表生成 `ScoreDeduction[]`
  - 各模块上限：mets 60、bmi_whr 12、uric 8、lifestyle 20
  - `score = max(0, 100 - Σ模块扣分)`，整数
  - 缺失指标对应模块不扣分
  - 非法字段（NaN/undefined）跳过不抛错
  - _References: Requirements 4.2-4.3, 4.6, 9.4, 9.6; design.md Property 1, 2, 4_

- [ ] 4.6 代谢年龄
  - 创建 `src/domain/assessment/metabolicAge.ts` 实现 `computeMetabolicAge(realAge, score, gender)`
  - 公式：`round(realAge + (100 - score) × 0.3) + (男+1 / 女-1)`，再 clamp 到 [0, realAge + 15]
  - _References: Requirements 8.1-8.4; design.md Property 6, 8_

- [ ] 4.7 顶层评估组合
  - 创建 `src/domain/assessment/types.ts` 导出 `AssessmentSnapshot`、`AssessmentResult`、`ScoreDeduction`、`MetSItem`、`ScoreMode`
  - 创建 `src/domain/assessment/index.ts` 实现 `computeAssessment(snapshot)`
  - 计算 realAge、coverage、score、metabolicAge、bmi、whr、uric、metsResult、scoreLevel、riskLevel
  - 标注 `usedTimestamps`（每项采用记录的 created_at）和 `staleFlags`（≥91 天）
  - mode='unavailable' 时 score / metabolicAge / scoreLevel / riskLevel 均为 null
  - _References: Requirements 4.1, 4.4-4.5, 9.5, 20.1-20.5; design.md 评估顶层组合_

- [ ] 4.8 评估引擎单测与属性测试（必做）
  - 在 `tests/domain/` 编写 vitest 单测覆盖各分支
  - 编写 fast-check 属性测试覆盖 design.md Correctness Properties 中 Property 1–8、11–12
  - 用任意构造器 `arbitrarySnapshot` 生成快照（含合法值与非法字段混入）
  - _References: design.md Correctness Properties 1-8, 11-12; Testing Strategy Domain 层_

- [ ] 5. Domain 趋势与建议
- [ ] 5.1 趋势分析
  - 创建 `src/domain/trend/regression.ts` 实现 `linearRegressionSlope(points)`：n<3 返回 null
  - 创建 `src/domain/trend/thresholds.ts`：体重 0.05、血糖 0.02、评分 0.2、腰围 0.05
  - 创建 `src/domain/trend/classify.ts`：实现 `classifyTrend(metric, slope)` 与 `filterByWindow(items, days, now)`
  - _References: Requirements 11.1-11.8; design.md Property 9_

- [ ] 5.2 行动建议
  - 创建 `src/domain/recommendation/catalog.ts`：每类至少 3 条通用建议词条
  - 创建 `src/domain/recommendation/rules.ts`：实现 `generateRecommendations(riskFactors)` 与因子→类别映射
  - 强制三类（diet / exercise / lifestyle）各 1 条
  - 全零风险时三条均为 source='general'
  - _References: Requirements 10.1-10.6; design.md Property 13, 14_

- [ ] 5.3 趋势与建议属性测试
  - `linearRegressionSlope` 在 n<3 恒返回 null
  - `generateRecommendations` 长度=3 且类别集合恒等于 {diet, exercise, lifestyle}
  - 全零风险输入下三条全为 general
  - _References: design.md Property 9, 13, 14_

- [ ] 6. Pinia Stores
- [ ] 6.1 profileStore
  - 创建 `src/stores/profile.ts`
  - state: `profile: Profile | null`
  - getter: `isInitialized`、`realAge`
  - actions: `load()`（从 StorageAdapter 读取）、`save(input)`（注入 created_at/updated_at，覆盖式存）
  - 不允许新增第二条档案（仅修改）
  - _References: Requirements 1.1, 1.5-1.7; design.md Pinia Stores_

- [ ] 6.2 questionnaireStore
  - 创建 `src/stores/questionnaire.ts`
  - 提交新问卷时把旧问卷 append 到 `cmo:questionnaire:history` 后再覆盖
  - 评估只读取当前 questionnaire，不读取历史
  - _References: Requirements 2.3-2.5_

- [ ] 6.3 metricsStore
  - 创建 `src/stores/metrics.ts`
  - 各类型独立数组，提供 `addWeight` / `addBP` / `addGlucose` / `addLipid` / `addUric`
  - 注入 created_at/updated_at；永不删除/覆盖
  - getter `latestSnapshot()` 返回每类最近一条 + created_at（用于评估输入组装）
  - _References: Requirements 3.2-3.7, 19.1-19.3, 20.1_

- [ ] 6.4 assessmentStore
  - 创建 `src/stores/assessment.ts`
  - 派生 store；订阅 profile/questionnaire/metrics 的变化（或暴露 `recompute()` 由 actions 触发）
  - `recompute()` 组装 `AssessmentSnapshot` → 调用 `computeAssessment` → 写入 state.result
  - 评估输入快照基于 `now = nowIso()`，便于复现
  - _References: Requirements 4.1; design.md Data Flow 5.2_

- [ ] 6.5 settingsStore
  - 创建 `src/stores/settings.ts`
  - 加载/保存 `cmo:settings`，包含 `schemaVersion = 1` 与 `import_strategy_default`
  - _References: Requirements 19.5; design.md Settings_

- [ ] 6.6 Stores 单测
  - mock StorageAdapter，验证：
    - 提交问卷时旧问卷写入历史
    - addWeight 后数组长度 +1，created_at/updated_at 已注入
    - 任意 add* 后 assessmentStore.recompute 被触发
  - _References: Requirements 2.3, 3.7, 4.1_

- [ ] 7. 跨端图表组件
- [ ] 7.1 ChartView 组件骨架
  - 创建 `src/components/chart/ChartView.vue`
  - props：`type: 'line'`、`data: { labels: string[]; values: number[] }`、`height?`、`yAxisLabel?`、`unit?`
  - 通过条件编译加载 `adapters/chart-h5.ts` 或 `adapters/chart-mp.ts`
  - _References: Requirements 12.1-12.4_

- [ ] 7.2 H5/APP 适配器（Chart.js）
  - 创建 `src/components/chart/adapters/chart-h5.ts`
  - 在 H5 用 Chart.js 渲染折线（按需引入）
  - APP-PLUS 复用 H5 实现
  - _References: Requirements 12.2_

- [ ] 7.3 小程序适配器（uCharts）
  - 引入 `qiun-data-charts` 组件包到 `src/components/chart/adapters/chart-mp.ts`
  - 配置数据格式映射
  - _References: Requirements 12.3_

- [ ] 8. 页面：基础档案 + 首页
- [ ] 8.1 ProfilePage
  - 创建 `src/pages/profile/ProfilePage.vue`
  - 字段：出生日期、性别、身高、已确诊高血压、已确诊糖尿病
  - 用 validators 做范围校验（R1.3、R1.4）
  - 提交调用 profileStore.save 后 `uni.reLaunch` 至首页
  - _References: Requirements 1.1-1.7_

- [ ] 8.2 App.vue 启动检查
  - 在 `App.vue` 的 `onLaunch` 调用 profileStore.load
  - 若 `!profileStore.isInitialized`，`uni.reLaunch` 至 ProfilePage
  - _References: Requirements 1.1, 18.4_

- [ ] 8.3 HomePage
  - 创建 `src/pages/home/HomePage.vue`
  - 三个入口按钮：填写指标、填写/更新问卷、查看历史趋势
  - 核心卡片展示：评分 / 代谢年龄 / 风险等级；mode='reference' 时附置信度 "已采集 N/6 项"
  - 空状态（profile 已存在但无指标无问卷）展示"立即录入"引导，不展示评分卡片
  - 点击卡片跳转 ReportPage
  - _References: Requirements 13.1-13.5_

- [ ] 9. 页面：问卷 + 指标录入
- [ ] 9.1 QuestionnairePage
  - 创建 `src/pages/questionnaire/QuestionnairePage.vue`
  - 4 个 Section：睡眠 / 饮食习惯 / 运动与久坐 / 风险因素
  - 11 项字段全部按 R2.1 范围限制
  - 提交后调用 questionnaireStore.save 并触发评估
  - _References: Requirements 2.1-2.5_

- [ ] 9.2 MetricsPage（5 Tab）
  - 创建 `src/pages/metrics/MetricsPage.vue`
  - 5 个 Tab：体重与围度、血压、血糖、血脂、尿酸
  - 各 Tab 字段按 R3.2-R3.6 与 R3.8 范围限制
  - 提交对应 add* action；每次提交是新增记录、不覆盖
  - 提交后触发 assessmentStore.recompute
  - _References: Requirements 3.1-3.8_

- [ ] 10. 页面：报告 + 趋势
- [ ] 10.1 ReportPage
  - 创建 `src/pages/report/ReportPage.vue`
  - 模块 1：核心结果（评分 / 代谢年龄 / 风险等级）
  - 模块 2：风险来源（Top 3 deductions）
  - 模块 3：指标异常列表 + 过期标签（staleFlags）
  - 模块 4：趋势小图（体重/腰围/血糖）入口
  - 模块 5：3 条行动建议（饮食 / 运动 / 生活方式各 1）
  - _References: Requirements 4.1, 4.4, 4.5, 9.7, 10.1-10.5, 20.2-20.5_

- [ ] 10.2 TrendPage
  - 创建 `src/pages/trend/TrendPage.vue`
  - 4 张 ChartView：体重 / 腰围 / 血糖 / 评分
  - 时间窗切换：7 / 30 / 90 天
  - 数据点 < 3 时图表区域显示"数据不足"占位
  - 评分趋势数据来自每次 assessmentStore.recompute 后的历史（建议每次 recompute 时把 score+timestamp 追加到一个独立 keys，例如 `cmo:metrics:score`）
  - _References: Requirements 11.1-11.8_

- [ ] 11. 设置模块（导入 / 导出 / 清空 / 关于）
- [ ] 11.1 Backup exporter
  - 创建 `src/infra/backup/exporter.ts` 实现 `exportToJSON(storage)`
  - 输出 `BackupFile`，含 schemaVersion、exported_at、profile、questionnaire、questionnaire_history、metrics、settings
  - 当本地数据空时仍输出合法骨架，不抛错
  - _References: Requirements 14.1-14.4_

- [ ] 11.2 Backup importer
  - 创建 `src/infra/backup/importer.ts` 实现 `importFromJSON(file, strategy, storage, now)`
  - 校验：JSON 解析、schemaVersion ∈ [1]、必填字段
  - merge 策略：按 created_at 去重，相同时间戳新覆盖旧；不同时间戳全部保留
  - overwrite 策略：替换 cmo:* 全部 keys（先 clearAllByPrefix 再写）
  - 单条记录字段越界 → 跳过该条，errors 中记录
  - 必须保证 merge 幂等
  - _References: Requirements 15.1-15.8; design.md Property 10_

- [ ] 11.3 Backup 单测（含幂等性）
  - 在 `tests/infra/backup.spec.ts`：
    - 导出后再导入 = 完全相同（merge）
    - 同一文件导入两次 = 一次（R15.6）
    - overwrite 完全替换
    - 解析失败 / 版本不兼容 / 字段越界场景
  - _References: Requirements 15.4-15.8; design.md Property 10_

- [ ] 11.4 SettingsPage
  - 创建 `src/pages/settings/SettingsPage.vue`
  - 「数据导出」按钮：调用 exporter → fileIO.save，文件名 `cmo-backup-YYYYMMDD-HHmm.json`
  - 「数据导入」：fileIO.pick → 弹策略选择（默认 merge）→ importer → 弹结果摘要
  - 「清空数据」：二次确认弹窗 → `clearAllByPrefix('cmo:')` → 重启回基础档案
  - 「关于本应用」：版本号 + 产品名"首席代谢官" + 免责声明（非医疗诊断）
  - _References: Requirements 14.1, 15.1, 15.3, 16.1-16.4, 17.1-17.2_

- [ ] 12. 跨端联调与质量门
- [ ] 12.1 H5 跑通
  - `npm run dev:h5`，完整路径走一次：基础档案 → 首页空状态 → 录指标 → 录问卷 → 报告 → 趋势 → 设置导出再导入
  - _References: Requirements 整体_

- [ ] 12.2 微信小程序跑通
  - `npm run dev:mp-weixin` 在微信开发者工具打开 `dist/dev/mp-weixin`
  - 验证 ChartView 切换到 uCharts 实现
  - 验证 fileIO 切换到 wx.saveFile / wx.chooseMessageFile
  - _References: Requirements 12.3, 18.1_

- [ ] 12.3 APP 跑通（HBuilderX 或 cli）
  - 验证 plus.storage 与 plus.io 路径
  - _References: Requirements 12.2, 18.1_

- [ ] 12.4 全量测试与质量门
  - 跑 `npm run test`：vitest 全部用例 + fast-check 属性测试通过
  - 跑 typecheck（`vue-tsc --noEmit`）通过
  - 跑 lint 通过
  - design.md Correctness Properties 14 条全部覆盖
  - _References: design.md Correctness Properties, Testing Strategy_

## Notes

- **测试先行**：每个 Domain 模块完成后立即写单测 + 属性测试，避免后期返工。design.md 的 Correctness Properties 14 条是最终验收的客观标准。
- **跨端假设**：默认 H5 优先开发，每完成一组功能后再用 `npm run dev:mp-weixin` 检查小程序。把易踩坑的 API（DOM、文件、图表）全部隔离到适配层，业务层不应感知平台差异。
- **数据迁移占位**：当前 `SCHEMA_VERSION = 1`，不需要 migration。等首个版本上线后若需要新增字段，在 `infra/storage/migrations.ts` 中按版本号注册迁移函数。
- **不做的事（保持 MVP 收敛）**：注册登录、加密、密码、服务器同步、医疗诊断、用药建议、PDF 导出、提醒推送，全部留到 Phase 2。
- **评分历史的存储**：为了画"代谢评分趋势"图，建议在 assessmentStore.recompute 时把 `{ score, created_at }` 追加到独立 `cmo:metrics:score` 数组。这是趋势页所需，不属于"用户原始指标录入"。
- **uCharts 引入方式**：建议使用 `@qiun/ucharts`（npm）而非 CDN，确保小程序无网络依赖。

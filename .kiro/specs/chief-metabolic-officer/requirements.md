# Requirements Document

## Introduction

**首席代谢官**（Chief Metabolic Officer，简称 CMO）是一个面向个人的代谢健康自评估应用，打开即用、无需注册登录、不上传服务器。用户通过三层信息输入（基础档案 + 生活方式问卷 + 健康指标）获得：代谢评分（0–100）、代谢年龄、风险等级与来源、固定 3 条行动建议、关键指标与评分的趋势图。

本文件定义了产品的功能性需求与可被测试验证的验收标准（采用 EARS 模式 + INCOSE 质量规则），所有计算类需求均要求确定性、可被 Property-Based Testing 验证。

### Technical Constraints（技术基线）

- **前端框架**：uni-app + Vue 3 + Vite + TypeScript，三端代码复用，支持 H5 / 微信小程序 / APP（小程序为明确目标端）
- **状态管理**：Pinia
- **数据持久化**：JSON 格式 + uni-app 统一存储 API（`uni.setStorageSync` / `uni.getStorageSync`）
  - H5 底层：localStorage
  - 微信小程序底层：wx storage
  - APP 底层：plus.storage
  - 不使用 SQLite / sql.js
- **数据分键存储**：`cmo:profile`、`cmo:questionnaire`、`cmo:metrics:weight`、`cmo:metrics:bp`、`cmo:metrics:glucose`、`cmo:metrics:lipid`、`cmo:metrics:uric`、`cmo:settings`
- **图表**：H5/APP 使用 Chart.js，小程序使用 uCharts，业务侧通过统一组件接口调用
- **样式**：原生 CSS / SCSS，不引入 UI 框架
- **数据备份**：明文 JSON 文件，不加密、不压缩
- **不做**：注册、登录、密码、加密、服务器同步、医疗诊断、用药建议
- **多端同步策略**（MVP）：手动导入导出 JSON 备份

## Glossary

### 系统/组件名

- **CMO_System**：首席代谢官应用整体
- **Profile_Manager**：基础档案录入与维护子系统
- **Questionnaire_Manager**：生活方式问卷子系统
- **Metrics_Recorder**：健康指标录入子系统
- **Assessment_Engine**：评估引擎，负责计算 BMI、WHR、代谢综合征判定、代谢评分、代谢年龄
- **Trend_Analyzer**：趋势分析子系统
- **Recommendation_Engine**：行动建议生成子系统
- **Storage_Adapter**：基于 uni-app 统一存储 API 的本地持久化子系统
- **Backup_Manager**：数据导入、导出、清空子系统
- **Chart_Renderer**：跨端图表渲染组件
- **Home_Dashboard**：首页（代谢总览）展示子系统

### 业务术语

- **基础档案**：用户首次录入并允许修改的不可重复创建的个人静态信息
- **必要指标**：体重、腰围、血压、空腹血糖、HDL-C、甘油三酯（TG）共 6 项
- **完整评分**：必要指标全部具备最近一次记录时输出的代谢评分
- **参考评分**：必要指标部分缺失时输出的代谢评分，附带置信度
- **代谢评分**：取值 [0, 100] 的整数
- **代谢年龄**：取值 ≥ 0 的整数
- **风险等级**：低 / 中 / 高
- **代谢综合征**（MetS）：腹型肥胖、高血压、高血糖、高 TG、低 HDL-C 五项中满足 3 项及以上
- **BMI**：体质指数，BMI = 体重(kg) / (身高(cm) / 100)²
- **WHR**：腰臀比，WHR = 腰围 / 臀围
- **HDL-C**：高密度脂蛋白胆固醇，单位 mmol/L
- **TG**：甘油三酯，单位 mmol/L
- **FPG**：空腹血糖，单位 mmol/L
- **2hPG**：餐后两小时血糖，单位 mmol/L
- **schemaVersion**：数据 JSON 备份的结构版本号，整数，初始为 1
- **created_at / updated_at**：ISO 8601 格式时间戳字符串
- **过期记录**：最近一次记录的 created_at 距当前时间超过 90 天的指标记录

## Requirements

### Requirement 1: 基础档案管理

**User Story:** 作为用户，我想录入并维护我的基础档案，以便 CMO_System 可以基于性别、年龄、身高与既往诊断进行代谢评估。

#### Acceptance Criteria

1. WHEN 用户首次打开应用且本地不存在键 `cmo:profile`，THE Profile_Manager SHALL 跳转至基础档案录入页并阻止进入首页
2. THE Profile_Manager SHALL 要求用户提供出生日期、性别（男 / 女）、身高（cm）、是否已确诊高血压（是 / 否）、是否已确诊糖尿病（是 / 否）共五项字段
3. IF 用户提交的身高不在 [50, 250] cm 区间内，THEN THE Profile_Manager SHALL 拒绝提交并提示身高超出合法范围
4. IF 用户提交的出生日期晚于当前日期或对应实际年龄超过 120 岁，THEN THE Profile_Manager SHALL 拒绝提交并提示出生日期非法
5. WHEN 用户成功提交基础档案，THE Storage_Adapter SHALL 写入键 `cmo:profile` 为一个 JSON 对象，对象包含 birth_date、gender、height_cm、has_hypertension、has_diabetes、created_at、updated_at 字段
6. WHILE 键 `cmo:profile` 已存在，THE Profile_Manager SHALL 仅允许修改现有档案，不允许新增第二条档案
7. WHEN 用户更新基础档案并保存，THE Storage_Adapter SHALL 覆盖键 `cmo:profile` 并将 updated_at 设置为当前时间，created_at 保持不变

### Requirement 2: 生活方式问卷

**User Story:** 作为用户，我想填写并随时更新生活方式问卷，以便 Assessment_Engine 在评估时反映我的最新生活习惯。

#### Acceptance Criteria

1. THE Questionnaire_Manager SHALL 提供 11 项问题：平均睡眠时长（小时，[0, 24]）、睡眠质量（[1, 5] 整数）、熬夜频率（每周次数，[0, 7]）、含糖饮料频率（每周次数，[0, 50]）、夜宵频率（每周次数，[0, 7]）、外卖频率（每周次数，[0, 21]）、每周运动次数（[0, 21]）、每日久坐时间（小时，[0, 24]）、饮酒频率（每周次数，[0, 21]）、是否吸烟（是 / 否）、压力水平（[1, 5] 整数）
2. IF 用户提交的任意字段超出第 1 条定义的取值范围，THEN THE Questionnaire_Manager SHALL 拒绝提交并标记该字段非法
3. WHEN 用户提交问卷且键 `cmo:questionnaire` 已存在旧问卷，THE Questionnaire_Manager SHALL 将旧问卷追加至只读历史快照集合，再以新问卷覆盖键 `cmo:questionnaire`
4. WHEN 用户提交问卷，THE Storage_Adapter SHALL 在键 `cmo:questionnaire` 中保存对象，对象包含 created_at 与全部 11 项字段
5. THE Assessment_Engine SHALL 在每次评估中只读取键 `cmo:questionnaire` 的当前值，不读取历史快照

### Requirement 3: 健康指标录入

**User Story:** 作为用户，我想录入多种健康指标的数据点，以便 CMO_System 进行代谢评估和趋势分析。

#### Acceptance Criteria

1. THE Metrics_Recorder SHALL 提供五类指标录入：体重与围度、血压、血糖、血脂、尿酸
2. WHEN 用户保存一次"体重与围度"录入，THE Metrics_Recorder SHALL 在键 `cmo:metrics:weight` 数组中追加一条记录，记录包含 created_at、updated_at 以及可选字段 weight_kg、waist_cm、hip_cm
3. WHEN 用户保存一次"血压"录入，THE Metrics_Recorder SHALL 在键 `cmo:metrics:bp` 数组中追加一条记录，记录包含 created_at、updated_at、systolic_mmHg、diastolic_mmHg
4. WHEN 用户保存一次"血糖"录入，THE Metrics_Recorder SHALL 在键 `cmo:metrics:glucose` 数组中追加一条记录，记录包含 created_at、updated_at 以及可选字段 fpg_mmol_per_l、pp2h_mmol_per_l、hba1c_pct
5. WHEN 用户保存一次"血脂"录入，THE Metrics_Recorder SHALL 在键 `cmo:metrics:lipid` 数组中追加一条记录，记录包含 created_at、updated_at 以及可选字段 tg_mmol_per_l、hdl_mmol_per_l、ldl_mmol_per_l、tc_mmol_per_l
6. WHEN 用户保存一次"尿酸"录入，THE Metrics_Recorder SHALL 在键 `cmo:metrics:uric` 数组中追加一条记录，记录包含 created_at、updated_at、uric_umol_per_l
7. THE Metrics_Recorder SHALL 永久保留所有指标记录，不进行删除或覆盖
8. IF 用户提交的某项数值超出其物理合法区间（weight_kg ∈ [20, 300]、waist_cm/hip_cm ∈ [30, 200]、systolic_mmHg ∈ [60, 260]、diastolic_mmHg ∈ [30, 200]、fpg_mmol_per_l ∈ [1, 30]、pp2h_mmol_per_l ∈ [1, 40]、hba1c_pct ∈ [2, 20]、tg_mmol_per_l ∈ [0.1, 30]、hdl_mmol_per_l ∈ [0.1, 10]、ldl_mmol_per_l ∈ [0.1, 15]、tc_mmol_per_l ∈ [1, 30]、uric_umol_per_l ∈ [50, 1500]），THEN THE Metrics_Recorder SHALL 拒绝该次提交并标记非法字段

### Requirement 4: 评估触发与代谢评分计算

**User Story:** 作为用户，我想看到我的代谢评分和等级，以便了解整体代谢健康状况。

#### Acceptance Criteria

1. WHEN 用户点击"查看报告"或新增任意指标记录或提交/更新问卷，THE Assessment_Engine SHALL 重新计算评估结果并通知 Home_Dashboard 刷新核心卡片
2. THE Assessment_Engine SHALL 以 100 为基础分按扣分制计算代谢评分，各模块扣分上限分别为：代谢综合征 5 项每项最多 12 分（模块上限 60 分）、BMI 异常最多 6 分、WHR 异常最多 6 分（BMI 与 WHR 合计模块上限 12 分）、尿酸异常最多 8 分、生活方式 7 项（熬夜、外卖、含糖饮料、久坐、运动不足、饮酒、吸烟、压力）每项 2–4 分（模块上限 20 分）
3. THE Assessment_Engine SHALL 输出 score = max(0, 100 − 各模块扣分之和)，且 score 必须为 [0, 100] 区间内的整数
4. THE Assessment_Engine SHALL 按以下区间映射评分等级：score ≥ 90 为"优"，75 ≤ score ≤ 89 为"良"，60 ≤ score ≤ 74 为"中"，score < 60 为"差"
5. THE Assessment_Engine SHALL 按以下区间映射风险等级：score ≥ 75 为"低"，60 ≤ score ≤ 74 为"中"，score < 60 为"高"
6. WHEN 评估输入完全相同，THE Assessment_Engine SHALL 输出相同的代谢评分、评分等级、风险等级
7. WHEN 仅向某次评估的输入新增一项扣分项（其他输入完全不变），THE Assessment_Engine SHALL 输出新评分 ≤ 旧评分
8. WHERE 基础档案 has_hypertension 为是，THE Assessment_Engine SHALL 在代谢综合征判定中直接将"高血压"项视为满足
9. WHERE 基础档案 has_diabetes 为是，THE Assessment_Engine SHALL 在代谢综合征判定中直接将"高血糖"项视为满足

### Requirement 5: 代谢综合征诊断

**User Story:** 作为用户，我想知道是否存在代谢综合征以及哪些项异常，以便针对性改善。

#### Acceptance Criteria

1. THE Assessment_Engine SHALL 按以下五项进行代谢综合征判定：腹型肥胖、高血压、高血糖、高 TG、低 HDL-C
2. WHEN 性别为男且最近一次 waist_cm ≥ 90 cm，或 性别为女且最近一次 waist_cm ≥ 85 cm，THE Assessment_Engine SHALL 标记"腹型肥胖"项满足
3. WHEN 最近一次 systolic_mmHg ≥ 130 或 diastolic_mmHg ≥ 85 或 has_hypertension 为是，THE Assessment_Engine SHALL 标记"高血压"项满足
4. WHEN 最近一次 fpg_mmol_per_l ≥ 6.1 或 最近一次 pp2h_mmol_per_l ≥ 7.8 或 has_diabetes 为是，THE Assessment_Engine SHALL 标记"高血糖"项满足
5. WHEN 最近一次 tg_mmol_per_l ≥ 1.7，THE Assessment_Engine SHALL 标记"高 TG"项满足
6. WHEN 最近一次 hdl_mmol_per_l < 1.04，THE Assessment_Engine SHALL 标记"低 HDL-C"项满足
7. WHEN 五项中满足项数 ≥ 3，THE Assessment_Engine SHALL 输出代谢综合征诊断结果为"是"；否则输出"否"

### Requirement 6: BMI 与 WHR 计算

**User Story:** 作为用户，我想看到 BMI 与 WHR 的具体数值与判定结果，以便评估体型相关风险。

#### Acceptance Criteria

1. THE Assessment_Engine SHALL 按 BMI = weight_kg / (height_cm / 100)² 计算 BMI，结果保留 1 位小数
2. WHEN BMI ≥ 24 且 BMI < 28，THE Assessment_Engine SHALL 将 BMI 状态标记为"超重"
3. WHEN BMI ≥ 28，THE Assessment_Engine SHALL 将 BMI 状态标记为"肥胖"
4. WHEN 最近一次记录同时存在 waist_cm 与 hip_cm，THE Assessment_Engine SHALL 按 WHR = waist_cm / hip_cm 计算 WHR，结果保留 2 位小数
5. WHEN 性别为男且 WHR > 0.9，或 性别为女且 WHR > 0.85，THE Assessment_Engine SHALL 将 WHR 状态标记为"异常"

### Requirement 7: 尿酸异常判定

**User Story:** 作为用户，我想看到尿酸是否异常，以便了解高尿酸风险。

#### Acceptance Criteria

1. WHEN 性别为男且最近一次 uric_umol_per_l > 420，或 性别为女且最近一次 uric_umol_per_l > 360，THE Assessment_Engine SHALL 将尿酸状态标记为"异常"
2. WHERE 尿酸状态为"异常"，THE Assessment_Engine SHALL 在代谢评分中扣除尿酸模块对应分数（最多 8 分）

### Requirement 8: 代谢年龄

**User Story:** 作为用户，我想看到我的代谢年龄，以便直观感知代谢健康相对于实际年龄的差距。

#### Acceptance Criteria

1. THE Assessment_Engine SHALL 按 代谢年龄_base = round(实际年龄 + (100 − score) × 0.3) 计算基础代谢年龄
2. WHERE 性别为男，THE Assessment_Engine SHALL 在 代谢年龄_base 上加 1 岁；WHERE 性别为女，THE Assessment_Engine SHALL 在 代谢年龄_base 上减 1 岁
3. THE Assessment_Engine SHALL 将最终代谢年龄限制在 [0, 实际年龄 + 15] 区间内
4. WHEN score = 100，THE Assessment_Engine SHALL 输出代谢年龄 ≤ 实际年龄 + 1
5. WHEN 评估输入完全相同，THE Assessment_Engine SHALL 输出相同的代谢年龄

### Requirement 9: 缺失数据处理

**User Story:** 作为用户，我想在尚未录入完整指标时也能看到合理的反馈，以便循序渐进地完善数据。

#### Acceptance Criteria

1. THE Assessment_Engine SHALL 将必要指标定义为：体重（weight_kg）、腰围（waist_cm）、血压（systolic_mmHg / diastolic_mmHg）、空腹血糖（fpg_mmol_per_l）、HDL-C（hdl_mmol_per_l）、TG（tg_mmol_per_l）共 6 项
3. WHEN 必要指标全部存在最近一次记录，THE Assessment_Engine SHALL 输出"完整评分"且 confidence = 1.0
4. WHEN 必要指标存在部分但非全部记录，THE Assessment_Engine SHALL 输出"参考评分"且 confidence = 已采集项数 / 6，且对缺失指标对应的扣分模块不进行扣分
5. IF 必要指标全部缺失，THEN THE Assessment_Engine SHALL 不输出代谢评分并通知 Home_Dashboard 展示空状态
6. IF 评估过程中读取到任意非法字段或无法解析的字段，THEN THE Assessment_Engine SHALL 跳过该字段并继续完成本次评估，不抛出未捕获异常
7. WHEN 某项指标的最近一次记录的 created_at 距当前时间超过 90 天，THE Assessment_Engine SHALL 在指标异常列表中将该项标记为"过期"

### Requirement 10: 行动建议

**User Story:** 作为用户，我想获得 3 条具体的行动建议，以便明确下一步可改善的方向。

#### Acceptance Criteria

1. THE Recommendation_Engine SHALL 在每次评估输出固定 3 条行动建议
2. THE Recommendation_Engine SHALL 按风险因子权重降序排序，并优先从 Top 3 风险因子中选择建议
3. THE Recommendation_Engine SHALL 保证 3 条建议覆盖"饮食"、"运动"、"生活方式"三类各 1 条，无论该类风险因子数量为 0 或大于 0
4. WHEN 某一类的风险因子数量为 0，THE Recommendation_Engine SHALL 输出该类的通用健康建议
5. WHEN 全部三类的风险因子数量均为 0，THE Recommendation_Engine SHALL 输出三条均为通用健康建议的固定建议（每类各 1 条）
6. WHEN 评估输入完全相同，THE Recommendation_Engine SHALL 输出相同的 3 条建议

### Requirement 11: 趋势分析

**User Story:** 作为用户，我想查看关键指标和评分随时间的趋势，以便判断改善方向。

#### Acceptance Criteria

1. WHILE 指定指标在时间窗口内的记录数 < 3，THE Trend_Analyzer SHALL 输出"数据不足"且不计算 slope
2. WHEN 指定指标在时间窗口内的记录数 ≥ 3，THE Trend_Analyzer SHALL 按最小二乘线性回归计算 slope = Σ(xi − x̄)(yi − ȳ) / Σ(xi − x̄)²，其中 xi 为该记录 created_at 距时间窗口内首条记录的天数，yi 为该次指标值
3. WHEN 指标为体重 AND |slope| < 0.05 kg/天，THE Trend_Analyzer SHALL 判定趋势为"稳定"
4. WHEN 指标为血糖 AND |slope| < 0.02 mmol/L/天，THE Trend_Analyzer SHALL 判定趋势为"稳定"
5. WHEN 指标为代谢评分 AND |slope| < 0.2 分/天，THE Trend_Analyzer SHALL 判定趋势为"稳定"
6. WHEN 指标为腰围 AND |slope| < 0.05 cm/天，THE Trend_Analyzer SHALL 判定趋势为"稳定"
7. WHEN slope 大于上述对应阈值，THE Trend_Analyzer SHALL 判定趋势为"上升"；WHEN slope 小于负对应阈值，THE Trend_Analyzer SHALL 判定趋势为"下降"
8. THE Trend_Analyzer SHALL 支持 7 天、30 天、90 天三种时间窗筛选，仅纳入 created_at 落在窗口内的记录

### Requirement 12: 跨端图表渲染

**User Story:** 作为用户，我想在 H5、APP、微信小程序上看到同样的趋势图，以便跨端一致体验。

#### Acceptance Criteria

1. THE Chart_Renderer SHALL 提供统一组件接口，业务侧只调用一个接口完成趋势图渲染
2. WHERE 运行平台为 H5 或 APP，THE Chart_Renderer SHALL 使用 Chart.js 渲染图表
3. WHERE 运行平台为微信小程序，THE Chart_Renderer SHALL 使用 uCharts 渲染图表
4. WHEN 输入数据相同，THE Chart_Renderer SHALL 在不同平台输出语义一致的图表（相同的数据点、坐标轴、趋势方向）

### Requirement 13: 首页展示与首次空状态

**User Story:** 作为用户，我想首页清晰展示我的代谢核心指标或在数据不足时引导我录入，以便快速了解状态或开始使用。

#### Acceptance Criteria

1. WHEN 键 `cmo:profile` 存在但所有 `cmo:metrics:*` 数组均为空且键 `cmo:questionnaire` 不存在，THE Home_Dashboard SHALL 隐藏代谢评分卡片并展示"立即录入"引导
2. WHEN 评估输出"完整评分"或"参考评分"，THE Home_Dashboard SHALL 在核心卡片展示代谢评分、代谢年龄、风险等级
3. WHERE 评估为"参考评分"，THE Home_Dashboard SHALL 在卡片中展示置信度信息，格式为"已采集 N/6 项必要指标"
4. THE Home_Dashboard SHALL 提供三个入口按钮：填写健康指标、填写或更新问卷、查看历史趋势
5. WHEN 用户点击核心卡片，THE Home_Dashboard SHALL 跳转至代谢评估报告页

### Requirement 14: 数据导出

**User Story:** 作为用户，我想导出全部本地数据为 JSON 文件，以便备份或迁移到另一台设备。

#### Acceptance Criteria

1. WHEN 用户在设置页点击"数据导出"，THE Backup_Manager SHALL 生成 JSON 对象，对象包含 schemaVersion（整数）、profile（对象）、questionnaire（对象或 null）、metrics（包含 weight、bp、glucose、lipid、uric 五个数组）、settings（对象）
2. THE Backup_Manager SHALL 以明文方式输出该 JSON 文件，不进行加密或压缩
3. WHEN 当前本地数据为空，THE Backup_Manager SHALL 仍输出包含 schemaVersion 与各空集合字段的 JSON，不抛出异常
4. THE Backup_Manager SHALL 在导出 JSON 中保留所有记录的 created_at 与 updated_at 字段

### Requirement 15: 数据导入

**User Story:** 作为用户，我想导入之前的 JSON 备份，以便恢复或合并到当前设备。

#### Acceptance Criteria

1. WHEN 用户选择 JSON 备份文件并触发导入，THE Backup_Manager SHALL 校验 schemaVersion 字段
2. IF schemaVersion 不在受支持版本列表内，THEN THE Backup_Manager SHALL 拒绝导入并提示版本不兼容，且不修改任何本地数据
3. THE Backup_Manager SHALL 提供两种导入策略：默认"按 created_at 合并去重"与可选"完全覆盖"
4. WHEN 导入策略为"按 created_at 合并去重" AND 新记录与本地某记录的 created_at 相同，THE Backup_Manager SHALL 用新记录覆盖旧记录
5. WHEN 导入策略为"按 created_at 合并去重" AND 新记录与本地任意记录的 created_at 均不同，THE Backup_Manager SHALL 同时保留新旧记录
6. WHEN 同一备份文件被以"按 created_at 合并去重"策略连续导入两次，THE Backup_Manager SHALL 在第二次导入后产生与第一次导入完全相同的本地数据状态
7. WHEN 导入策略为"完全覆盖"，THE Backup_Manager SHALL 在用户二次确认通过后用文件中的全部数据替换本地数据
8. IF 导入文件 JSON 解析失败或必填字段缺失，THEN THE Backup_Manager SHALL 拒绝导入、保持本地数据不变，并提示具体错误位置

### Requirement 16: 清空数据

**User Story:** 作为用户，我想清空所有本地数据，以便重新开始或保护隐私。

#### Acceptance Criteria

1. WHEN 用户在设置页点击"清空数据"，THE Backup_Manager SHALL 弹出二次确认提示
2. WHEN 用户在二次确认中选择"取消"，THE Backup_Manager SHALL 不修改任何存储数据
3. WHEN 用户在二次确认中选择"确认清空"，THE Storage_Adapter SHALL 删除以 `cmo:` 为前缀的全部本地存储键
4. WHEN 清空操作完成，THE Home_Dashboard SHALL 跳转至基础档案首次录入流程

### Requirement 17: 关于本应用

**User Story:** 作为用户，我想查看应用版本与免责声明，以便确认产品身份与使用边界。

#### Acceptance Criteria

1. THE CMO_System SHALL 在"关于本应用"页展示产品名"首席代谢官"、当前版本号、免责声明文本
2. THE CMO_System SHALL 在免责声明中明确：本应用仅用于个人代谢健康参考，不构成医疗诊断、治疗或用药建议

### Requirement 18: 数据持久化与跨端兼容

**User Story:** 作为用户，我想在 H5、微信小程序、APP 三端使用一致的数据存储，以便代码与体验复用。

#### Acceptance Criteria

1. THE Storage_Adapter SHALL 通过 uni-app 的统一存储 API（`uni.setStorageSync` / `uni.getStorageSync` / `uni.removeStorageSync`）读写数据，不使用 SQLite 或 sql.js
2. THE Storage_Adapter SHALL 按以下键名分键存储：`cmo:profile`、`cmo:questionnaire`、`cmo:metrics:weight`、`cmo:metrics:bp`、`cmo:metrics:glucose`、`cmo:metrics:lipid`、`cmo:metrics:uric`、`cmo:settings`
3. THE Storage_Adapter SHALL 在键 `cmo:settings` 中保存 schemaVersion 字段，初始值为 1
4. THE CMO_System SHALL 不要求注册或登录，用户打开应用即可使用全部功能
5. THE CMO_System SHALL 不向任何外部服务器发送用户数据

### Requirement 19: 时间戳与 schema 版本

**User Story:** 作为用户，我想所有数据带有清晰的时间戳与版本号，以便备份在未来仍可被正确导入。

#### Acceptance Criteria

1. THE Storage_Adapter SHALL 为每条指标记录与每份问卷快照写入 created_at 与 updated_at 字段，时间戳采用 ISO 8601 字符串格式
2. WHEN 一条记录被新建，THE Storage_Adapter SHALL 将 created_at 与 updated_at 同时设置为当前时间
3. WHEN 一条记录被修改，THE Storage_Adapter SHALL 仅将 updated_at 更新为当前时间，created_at 保持不变
4. THE Backup_Manager SHALL 在导出 JSON 中保留全部 created_at 与 updated_at，以便导入端按 created_at 进行合并去重
5. THE Storage_Adapter SHALL 在每次写入键 `cmo:settings` 时保留 schemaVersion 字段，确保该字段在数据生命周期内可被识别

### Requirement 20: 评估时数据组合规则

**User Story:** 作为用户，我想知道每次评估使用了哪些时间点的指标数据，以便理解评估结果。

#### Acceptance Criteria

1. THE Assessment_Engine SHALL 在评估时为每项指标取该指标历史记录中 created_at 最大的一条
2. THE Assessment_Engine SHALL 在评估输出中标注每项被使用的指标的采集时间（created_at）
3. WHEN 某项指标被采用的最近记录的 created_at 距当前超过 90 天（即 ≥ 91 天），THE Assessment_Engine SHALL 将该项在指标异常列表中额外标记为"过期"
4. WHERE 某项指标被标记为"过期"，THE Assessment_Engine SHALL 仍将该项的最近记录纳入本次代谢评分与代谢综合征判定计算
5. WHILE 某项指标尚无任何历史记录，THE Assessment_Engine SHALL 在评估输出中将该项标记为"未采集"，且按 Requirement 9 的缺失数据规则处理

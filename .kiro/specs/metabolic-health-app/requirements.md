# 需求文档（Requirements Document）

## 引言（Introduction）

本应用是一款"代谢健康评估"产品（以下统称 **本应用** / metabolic-health-app），目标是让用户通过三层信息输入（基础档案 + 生活方式问卷 + 健康指标）持续获得：

- 代谢评分（0–100）
- 代谢年龄
- 风险来源解释（Top 3）
- 行动建议（恰好 3 条，覆盖饮食/运动/生活方式三类）
- 关键指标的时间趋势

本文档以 EARS 模式描述全部产品级与系统级需求，所有验收标准遵循 INCOSE 质量规则，并尽量以可被 Property-Based Testing 验证的方式给出（确定性公式、明确边界、可枚举的输入约束、确定性排序、round-trip / 幂等等性质）。

## 技术基线与约束（Technical Constraints）

- 前端：uni-app + Vue 3 + Vite + TypeScript（H5 / 微信小程序 / Android & iOS APP 三端共用一套源码）
- 状态管理：Pinia
- 持久化：H5 使用 sql.js（SQLite WASM）+ IndexedDB；APP 使用 Capacitor 原生 SQLite；微信小程序使用 uni 的本地存储 API；统一通过 IDataStore 抽象访问
- 图表：Chart.js
- 加密：Web Crypto API（PBKDF2 派生 key + AES-GCM 加密 SQLite 文件）
- 样式：原生 CSS / SCSS，不引入第三方 UI 框架
- 不要求注册登录，"打开即用"
- 多端同步通过加密备份文件的手动导入/导出实现，不依赖任何服务器

## 术语表（Glossary）

- **System**：本应用整体（metabolic-health-app）
- **Profile_Module**：基础档案模块（出生日期、性别、身高、已确诊高血压、已确诊糖尿病）
- **Questionnaire_Module**：生活方式问卷模块（睡眠 / 饮食 / 运动与久坐 / 风险因素 四个 Section）
- **Metrics_Module**：健康指标模块（体重与围度 / 血压 / 血糖 / 血脂 / 尿酸 五个 Tab）
- **Scoring_Engine**：代谢评分计算引擎
- **Risk_Analyzer**：风险来源分析器
- **Action_Advisor**：行动建议生成器
- **Trend_Analyzer**：趋势分析器
- **Data_Store**：跨平台数据访问层（IDataStore 抽象 + 各端实现）
- **Crypto_Module**：基于 Web Crypto API 的加密模块（PBKDF2 派生 + AES-GCM）
- **Settings_Module**：设置模块（导入 / 导出 / 密码 / 清空 / 关于）
- **Backup_Serializer**：加密备份文件（.cmo / .db.enc）的序列化与反序列化器
- **Profile**：单条基础档案；全应用最多一份
- **Questionnaire**：一份生活方式问卷快照；评估只使用最新一份；全部历史快照写入只读历史表
- **Metric_Record**：一条健康指标记录，包含 created_at / updated_at
- **Metabolic_Score**：代谢评分，整数，落于 [0, 100]
- **Metabolic_Age**：代谢年龄，整数
- **Risk_Level**：风险等级，枚举 {低, 中, 高}
- **Score_Grade**：评分等级，枚举 {优, 良, 中, 差}
- **Required_Metrics_Set**：必要指标集合 = {体重, 腰围, 收缩压, 舒张压, 空腹血糖, HDL-C, TG} 共 7 项
- **Confidence**：置信度 = 已采集必要指标数 / 7（保留 2 位小数）
- **Stale_Threshold**：过期阈值 = 90 天
- **trusted_device_key**：勾选"本设备不再提示"后持久化在 IndexedDB 的派生 key 条目

## 需求列表（Requirements）

### Requirement 1：跨平台技术基线

**User Story:** 作为产品负责人，我希望应用在 H5 / 微信小程序 / APP 三端共用同一份源码，以便用最小成本覆盖最多设备。

#### Acceptance Criteria

1. THE System SHALL 使用 uni-app + Vue 3 + Vite + TypeScript 构建，并能产出 H5、微信小程序、Android/iOS APP 三种产物。
2. THE System SHALL 使用 Pinia 作为运行时状态管理方案。
3. THE System SHALL 通过 IDataStore 抽象统一暴露数据读写接口。
4. THE System SHALL 禁止业务模块直接调用任何特定平台的存储 API（必须经由 Data_Store）。
5. WHERE 运行环境为 H5，THE Data_Store SHALL 使用 sql.js + IndexedDB 作为底层实现。
6. WHERE 运行环境为 Capacitor APP，THE Data_Store SHALL 使用 Capacitor 原生 SQLite 作为底层实现。
7. WHERE 运行环境为微信小程序，THE Data_Store SHALL 使用 uni 提供的本地存储 API 作为底层实现。
8. THE System SHALL 不依赖任何第三方 UI 组件库（仅使用原生 CSS/SCSS）。
9. THE System SHALL 在启动时不要求注册或登录，用户进入即可开始基础档案录入。

### Requirement 2：基础档案录入与维护

**User Story:** 作为新用户，第一次打开应用时我希望先填一次基础档案，以便后续评估有依据。

#### Acceptance Criteria

1. WHEN 用户首次进入本应用且 Profile 不存在，THE System SHALL 强制跳转到基础档案录入页且不允许跳过。
2. THE Profile_Module SHALL 收集且仅收集以下字段：出生日期、性别（男/女）、身高（cm）、已确诊高血压（是/否）、已确诊糖尿病（是/否）。
3. IF 出生日期为未来日期，THEN THE Profile_Module SHALL 拒绝提交并提示"出生日期无效"。
4. IF 由出生日期推算的实际年龄不在 [0, 120] 范围，THEN THE Profile_Module SHALL 拒绝提交并提示"出生日期无效"。
5. IF 身高不在 [50, 250] cm 范围，THEN THE Profile_Module SHALL 拒绝提交并提示"身高需在 50–250 cm 之间"。
6. WHEN 用户成功提交基础档案，THE Profile_Module SHALL 通过 Data_Store 写入 Profile 并将其标记为已存在。
7. THE Profile_Module SHALL 在应用整个生命周期内仅维护 1 份 Profile，不允许新增、仅允许修改。
8. WHEN 用户在已存在 Profile 的情况下再次进入基础档案页并提交，THE Profile_Module SHALL 更新现有记录并刷新 updated_at。

### Requirement 3：生活方式问卷录入与覆盖

**User Story:** 作为用户，我希望多次更新生活方式问卷，每次只保留最新一份用于评估，但历史快照仍能被备份。

#### Acceptance Criteria

1. THE Questionnaire_Module SHALL 收集以下字段：平均睡眠时长（小时）、睡眠质量（1–5 整数）、熬夜频率（每周次数）、含糖饮料频率（每周次数）、夜宵频率（每周次数）、外卖频率（每周次数）、每周运动次数、每日久坐时间（小时）、饮酒频率（每周次数）、是否吸烟（是/否）、压力水平（1–5 整数）。
2. IF 平均睡眠时长不在 [0, 24] 小时范围，THEN THE Questionnaire_Module SHALL 拒绝提交并提示对应字段不合法。
3. IF 每日久坐时间不在 [0, 24] 小时范围，THEN THE Questionnaire_Module SHALL 拒绝提交并提示对应字段不合法。
4. IF 任一"每周次数"字段不在 [0, 7] 范围，THEN THE Questionnaire_Module SHALL 拒绝提交并提示对应字段不合法。
5. IF 睡眠质量或压力水平不在 [1, 5] 整数范围，THEN THE Questionnaire_Module SHALL 拒绝提交并提示对应字段不合法。
6. WHEN 用户成功提交问卷，THE Questionnaire_Module SHALL 把新问卷写为"当前生效问卷"，并把上一份"当前生效问卷"作为只读快照追加到问卷历史表。
7. THE Scoring_Engine SHALL 在评估时仅读取"当前生效问卷"，不读取问卷历史表。
8. THE Backup_Serializer SHALL 在导出时同时包含"当前生效问卷"与问卷历史表中所有快照。

### Requirement 4：健康指标录入与不可物理删除

**User Story:** 作为用户，我希望多次录入健康指标并保留全部历史，便于做趋势分析。

#### Acceptance Criteria

1. THE Metrics_Module SHALL 提供五个 Tab：体重与围度、血压、血糖、血脂、尿酸。
2. THE Metrics_Module SHALL 支持以下字段，且字段单位严格固定为：体重(kg)、腰围(cm)、臀围(cm)、收缩压(mmHg)、舒张压(mmHg)、空腹血糖(mmol/L)、餐后2小时血糖(mmol/L，可选)、HbA1c(%，可选)、TG(mmol/L)、HDL-C(mmol/L)、LDL-C(mmol/L)、总胆固醇(mmol/L)、尿酸(μmol/L)。
3. THE Metrics_Module SHALL 允许用户单次提交一个或多个 Tab 的数据，未填写的字段不写入对应 Metric_Record。
4. WHEN 用户提交一次录入，THE Metrics_Module SHALL 为每个被填写的字段生成一条 Metric_Record，并写入 created_at（=updated_at=提交时刻）。
5. IF 任一指标值不在该指标的合理范围（体重 [20, 300] kg、腰围 [30, 200] cm、臀围 [30, 200] cm、收缩压 [60, 260] mmHg、舒张压 [30, 200] mmHg、空腹血糖 [1.0, 40.0] mmol/L、餐后2小时血糖 [1.0, 40.0] mmol/L、HbA1c [3.0, 20.0] %、TG [0.1, 30.0] mmol/L、HDL-C [0.1, 10.0] mmol/L、LDL-C [0.1, 20.0] mmol/L、总胆固醇 [0.5, 30.0] mmol/L、尿酸 [50, 1500] μmol/L），THEN THE Metrics_Module SHALL 拒绝提交该字段并提示越界。
6. THE Metrics_Module SHALL 不提供物理删除入口；如用户要修正某条记录，应通过新增"修正记录"实现，原记录保留。
7. THE Data_Store SHALL 保证每条 Metric_Record 都包含独立的 created_at 与 updated_at 字段。

### Requirement 5：BMI 与 WHR 计算（公式修正）

**User Story:** 作为用户，我希望 BMI 与腰臀比按确定的中国标准公式计算，使评估结果稳定可复现。

#### Acceptance Criteria

1. THE Scoring_Engine SHALL 按公式 BMI = 体重(kg) / (身高(cm)/100)² 计算 BMI，结果保留 1 位小数。
2. THE Scoring_Engine SHALL 按公式 WHR = 腰围(cm) / 臀围(cm) 计算腰臀比，结果保留 2 位小数。
3. THE Scoring_Engine SHALL 按以下中国标准对 BMI 分级：BMI < 18.5 偏瘦、18.5 ≤ BMI < 24 正常、24 ≤ BMI < 28 超重、BMI ≥ 28 肥胖。
4. WHERE 性别为男性 AND WHR > 0.9，THE Scoring_Engine SHALL 将 WHR 标记为异常。
5. WHERE 性别为女性 AND WHR > 0.85，THE Scoring_Engine SHALL 将 WHR 标记为异常。
6. IF 计算 BMI 时身高为 0 或缺失，THEN THE Scoring_Engine SHALL 输出 BMI 为不可计算（null）且不计入扣分。
7. IF 计算 WHR 时臀围为 0 或缺失，THEN THE Scoring_Engine SHALL 输出 WHR 为不可计算（null）且不计入扣分。

### Requirement 6：代谢综合征诊断

**User Story:** 作为用户，我希望按照中国 CDS 标准诊断代谢综合征，且已确诊高血压/糖尿病能直接计入对应项。

#### Acceptance Criteria

1. THE Scoring_Engine SHALL 按以下五项判定代谢综合征组件：腹型肥胖、高血糖、高血压、高甘油三酯、低 HDL-C。
2. WHERE 性别为男性 AND 腰围 ≥ 90 cm，THE Scoring_Engine SHALL 判定"腹型肥胖"为满足。
3. WHERE 性别为女性 AND 腰围 ≥ 85 cm，THE Scoring_Engine SHALL 判定"腹型肥胖"为满足。
4. IF 空腹血糖 ≥ 6.1 mmol/L OR 餐后2小时血糖 ≥ 7.8 mmol/L，THEN THE Scoring_Engine SHALL 判定"高血糖"为满足。
5. IF Profile.已确诊糖尿病 = 是，THEN THE Scoring_Engine SHALL 判定"高血糖"为满足，即使当次测量正常。
6. IF 收缩压 ≥ 130 mmHg OR 舒张压 ≥ 85 mmHg，THEN THE Scoring_Engine SHALL 判定"高血压"为满足。
7. IF Profile.已确诊高血压 = 是，THEN THE Scoring_Engine SHALL 判定"高血压"为满足，即使当次测量正常。
8. IF TG ≥ 1.7 mmol/L，THEN THE Scoring_Engine SHALL 判定"高甘油三酯"为满足。
9. IF HDL-C < 1.04 mmol/L，THEN THE Scoring_Engine SHALL 判定"低 HDL-C"为满足（男女统一阈值）。
10. WHEN 五项中满足项数 ≥ 3，THE Scoring_Engine SHALL 标记代谢综合征为"已成立"。

### Requirement 7：尿酸阈值

**User Story:** 作为用户，我希望尿酸按性别采用不同阈值。

#### Acceptance Criteria

1. WHERE 性别为男性 AND 尿酸 > 420 μmol/L，THE Scoring_Engine SHALL 将尿酸标记为异常。
2. WHERE 性别为女性 AND 尿酸 > 360 μmol/L，THE Scoring_Engine SHALL 将尿酸标记为异常。
3. IF 尿酸数据缺失，THEN THE Scoring_Engine SHALL 不对尿酸做扣分且不影响其它项。

### Requirement 8：代谢评分计算（扣分制 + 结果落 [0, 100]）

**User Story:** 作为用户，我希望代谢评分由确定性公式计算，便于复现并支持基于属性的测试。

#### Acceptance Criteria

1. THE Scoring_Engine SHALL 以基础分 100 起，采用扣分制计算 Metabolic_Score。
2. THE Scoring_Engine SHALL 对代谢综合征五项每满足 1 项扣 12 分，该模块累计扣分上限 60 分。
3. THE Scoring_Engine SHALL 对 BMI/WHR 模块按以下规则扣分：BMI ≥ 28 扣 8 分，24 ≤ BMI < 28 扣 4 分，WHR 异常追加扣 4 分；该模块累计扣分上限 12 分。
4. THE Scoring_Engine SHALL 对尿酸异常一次性扣 8 分，该模块累计扣分上限 8 分。
5. THE Scoring_Engine SHALL 对生活方式模块按以下规则扣分：平均睡眠 < 6 小时扣 4 分，熬夜 ≥ 4 次/周扣 4 分，含糖饮料 ≥ 4 次/周扣 3 分，外卖 ≥ 4 次/周扣 3 分，每周运动次数 < 1 扣 4 分，每日久坐 ≥ 8 小时扣 3 分，吸烟 = 是扣 4 分，饮酒 ≥ 4 次/周扣 3 分，压力水平 = 5 扣 2 分；该模块累计扣分上限 20 分。
6. THE Scoring_Engine SHALL 输出最终评分 Metabolic_Score = max(0, min(100, 100 − 各模块扣分之和))，且各模块扣分先行截断到模块上限再求和。
7. THE Scoring_Engine SHALL 保证 Metabolic_Score 始终落在闭区间 [0, 100]，不出现负数也不超过 100。
8. THE Scoring_Engine SHALL 是确定性函数：相同 Profile + 相同 Questionnaire + 相同被采纳的 Metric_Record 集合 → 相同 Metabolic_Score（确定性属性，可被 PBT 验证）。
9. THE Scoring_Engine SHALL 满足单调性：在其它输入不变的条件下，新增任意一项被判为"异常/不良"的输入只会使 Metabolic_Score 不增（≤）。

### Requirement 9：评分等级与风险等级映射

**User Story:** 作为用户，我希望评分等级和风险等级是同一来源、强一致。

#### Acceptance Criteria

1. THE Scoring_Engine SHALL 按以下规则计算 Score_Grade：score ≥ 90 → 优；75 ≤ score ≤ 89 → 良；60 ≤ score ≤ 74 → 中；score < 60 → 差。
2. THE Scoring_Engine SHALL 按以下规则计算 Risk_Level：score ≥ 75 → 低；60 ≤ score ≤ 74 → 中；score < 60 → 高。
3. THE Scoring_Engine SHALL 保证 Score_Grade 与 Risk_Level 强一致：优/良 ↔ 低；中 ↔ 中；差 ↔ 高（一致性属性，可被 PBT 验证）。

### Requirement 10：代谢年龄计算（确定性公式）

**User Story:** 作为用户，我希望代谢年龄按确定公式计算，避免随机或主观。

#### Acceptance Criteria

1. THE Scoring_Engine SHALL 按公式 raw_offset = round((100 − Metabolic_Score) × 0.3) 计算原始偏移。
2. WHERE 性别为男性，THE Scoring_Engine SHALL 在 raw_offset 上追加 +1 岁修正。
3. WHERE 性别为女性，THE Scoring_Engine SHALL 在 raw_offset 上追加 −1 岁修正。
4. THE Scoring_Engine SHALL 输出 Metabolic_Age = max(0, 实际年龄 + clamp(raw_offset + 性别修正, 0, 15))。
5. THE Scoring_Engine SHALL 保证 Metabolic_Age − 实际年龄 ∈ [0, 15]（边界属性，可被 PBT 验证）。
6. THE Scoring_Engine SHALL 是确定性函数：相同 Profile + 相同 Metabolic_Score → 相同 Metabolic_Age。

### Requirement 11：评估时的数据组合规则

**User Story:** 作为用户，我希望评估时使用每项指标的最新一次记录，并能看到采集时间，过期数据要被标记。

#### Acceptance Criteria

1. WHEN Scoring_Engine 触发评估，THE Scoring_Engine SHALL 对每个指标按 created_at 取最近一条 Metric_Record 作为该次评估的输入。
2. THE Scoring_Engine SHALL 在评估结果中为每项被采纳的指标附带其采集时间戳。
3. IF 某项被采纳的指标采集时间距今 > Stale_Threshold（90 天），THEN THE Scoring_Engine SHALL 在评估结果中将该项标记为"过期"。
4. THE Scoring_Engine SHALL 仍把"过期"指标计入评分（仅在 UI 显示标记，不改变扣分逻辑），以保证可复现性。

### Requirement 12：缺失数据处理与置信度

**User Story:** 作为用户，我希望即便没填全也能看到一个"参考评分"，并清楚地知道完整度。

#### Acceptance Criteria

1. THE Required_Metrics_Set SHALL 固定为 {体重, 腰围, 收缩压, 舒张压, 空腹血糖, HDL-C, TG} 共 7 项。
2. WHEN 评估时 Required_Metrics_Set 中所有 7 项均存在最近一次记录，THE Scoring_Engine SHALL 输出"完整评分"，Confidence = 1.00。
3. WHEN 评估时 Required_Metrics_Set 中存在任意缺失项，THE Scoring_Engine SHALL 输出"参考评分"，并附带 Confidence = round(已采集项数 / 7, 2)。
4. THE Scoring_Engine SHALL 在缺失项上不进行任何扣分（缺失视为该项无信号），且在结果中明确列出缺失项名称。
5. WHEN 评估时 Required_Metrics_Set 中已采集项数为 0 且当前生效问卷不存在，THE System SHALL 不输出评分，转而展示"立即录入"引导卡片。

### Requirement 13：首次进入空状态引导

**User Story:** 作为新用户，刚填完基础档案但还没有任何指标和问卷时，我希望首页不显示"虚假评分"，而是引导我录入。

#### Acceptance Criteria

1. WHEN Profile 已存在 AND 任意 Metric_Record 数量 = 0 AND 当前生效问卷不存在，THE System SHALL 在首页隐藏代谢评分卡片，展示"立即录入"引导卡片，包含"填写健康指标"与"填写/更新问卷"两个入口。
2. WHEN 用户至少录入 1 条 Metric_Record 或提交了 1 份问卷，THE System SHALL 在首页恢复展示评分卡片（评分按 Requirement 12 的"参考评分/完整评分"规则给出）。

### Requirement 14：风险来源分析（Top 3）

**User Story:** 作为用户，我希望看到导致评分扣分最多的 Top 3 风险因素，并按确定的规则排序。

#### Acceptance Criteria

1. THE Risk_Analyzer SHALL 列出本次评估中所有触发扣分的风险因子，每个因子包含：名称、所属模块、本次扣分值、对应阈值与当前值。
2. THE Risk_Analyzer SHALL 按以下顺序排序风险因子：先按扣分值降序，再按模块优先级（代谢综合征 > BMI/WHR > 尿酸 > 生活方式）降序，最后按因子名称字典序升序。
3. THE Risk_Analyzer SHALL 取排序后的前 3 项作为 Top 3 风险来源；若不足 3 项，则原样返回（不补齐）。
4. THE Risk_Analyzer SHALL 是确定性函数：相同输入 → 相同 Top 3 顺序（确定性排序属性，可被 PBT 验证）。

### Requirement 15：行动建议（恰好 3 条，三类各 1 条）

**User Story:** 作为用户，我希望每次评估都得到 3 条覆盖饮食/运动/生活方式的建议。

#### Acceptance Criteria

1. THE Action_Advisor SHALL 始终输出且仅输出 3 条建议，分别属于"饮食"、"运动"、"生活方式"三类，每类恰好 1 条。
2. THE Action_Advisor SHALL 按 Requirement 14 中风险因子的排序，在每类中优先选取该类下扣分最多且可对应到建议的因子作为该类建议来源。
3. IF 某一类下没有任何风险因子可作为建议来源，THEN THE Action_Advisor SHALL 用该类的"通用健康建议"补齐该类，使总数仍为 3 条。
4. THE Action_Advisor SHALL 是确定性函数：相同评估输入 → 相同 3 条建议输出（确定性属性，可被 PBT 验证）。

### Requirement 16：趋势分析（最小二乘线性回归 + 差异化阈值）

**User Story:** 作为用户，我希望趋势图按统一的最小二乘法计算斜率，并对不同指标采用合适的稳定阈值。

#### Acceptance Criteria

1. THE Trend_Analyzer SHALL 在以下时间窗口（7 天 / 30 天 / 90 天）内对所选指标按 created_at 取所有记录做最小二乘线性回归，斜率公式为 slope = Σ(xi − x̄)(yi − ȳ) / Σ(xi − x̄)²，其中 xi 为该记录距窗口起点的天数（浮点）。
2. IF 所选时间窗口内的记录数 < 3，THEN THE Trend_Analyzer SHALL 不输出趋势方向，转而提示"数据不足，请继续录入"。
3. WHERE 指标为体重 AND |slope| < 0.05 kg/天，THE Trend_Analyzer SHALL 输出趋势 = 稳定。
4. WHERE 指标为体重 AND slope ≥ 0.05 kg/天，THE Trend_Analyzer SHALL 输出趋势 = 上升。
5. WHERE 指标为体重 AND slope ≤ −0.05 kg/天，THE Trend_Analyzer SHALL 输出趋势 = 下降。
6. WHERE 指标为空腹血糖 AND |slope| < 0.02 mmol/L/天，THE Trend_Analyzer SHALL 输出趋势 = 稳定，否则按符号判定上升 / 下降。
7. WHERE 指标为代谢评分 AND |slope| < 0.2 分/天，THE Trend_Analyzer SHALL 输出趋势 = 稳定，否则按符号判定上升 / 下降。
8. WHERE 指标为腰围（默认阈值），THE Trend_Analyzer SHALL 采用 |slope| < 0.05 cm/天 视为稳定，否则按符号判定上升 / 下降。
9. THE Trend_Analyzer SHALL 是确定性函数：相同记录集合与相同时间窗口 → 相同 slope 与趋势方向（确定性属性，可被 PBT 验证）。

### Requirement 17：评估触发时机

**User Story:** 作为用户，我希望首页评分能反映最新数据，并支持主动查看报告。

#### Acceptance Criteria

1. WHEN 用户成功新增任意 Metric_Record，THE Scoring_Engine SHALL 立即重新执行一次评估并更新首页评分缓存。
2. WHEN 用户成功提交一份新的生活方式问卷，THE Scoring_Engine SHALL 立即重新执行一次评估并更新首页评分缓存。
3. WHEN 用户在首页点击"查看报告"，THE Scoring_Engine SHALL 触发一次评估并跳转到代谢评估报告页。
4. THE Scoring_Engine SHALL 在同一组输入上多次触发评估时返回完全相同的结果（幂等属性，可被 PBT 验证）。

### Requirement 18：图表与历史趋势页

**User Story:** 作为用户，我希望在趋势页看到体重、腰围、空腹血糖、代谢评分四张折线图，并能切换时间窗口。

#### Acceptance Criteria

1. THE System SHALL 使用 Chart.js 渲染所有图表。
2. THE System SHALL 在趋势页固定提供 4 张折线图：体重、腰围、空腹血糖、代谢评分。
3. THE System SHALL 在趋势页提供时间窗口切换：7 天 / 30 天 / 90 天，默认 30 天。
4. WHEN 用户切换时间窗口，THE Trend_Analyzer SHALL 在新窗口下重新计算并渲染对应折线图与趋势提示。

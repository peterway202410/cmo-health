# 备份 JSON 格式

版本：`schemaVersion = 1`

在应用里走 **我的 → 导出数据 / 导入数据**。文件是一份 UTF-8 JSON，不经过任何服务器。

## 顶层字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `schemaVersion` | number | 必须为 `1`，否则拒绝导入 |
| `exported_at` | string | ISO 时间，导出时写入 |
| `profile` | object / null | 基础档案 |
| `questionnaire` | object / null | 最新一份生活方式问卷 |
| `questionnaire_history` | array | 被覆盖掉的旧问卷 |
| `metrics` | object | `weight` / `bp` / `glucose` / `lipid` / `uric` 五个数组 |
| `settings` | object | 目前主要是默认导入策略 |
| `thresholds` | object | 用户改过的参考值；缺省字段用应用内默认值补齐 |

指标记录按 `created_at` 区分。合并导入时：同一时间戳以文件为准，不同时间戳全部保留。

## 导入策略

- **合并去重**：档案仅在本地还没有时写入；问卷取较新的一份；指标按 `created_at` 合并。
- **完全覆盖**：先清空所有 `cmo:` 开头的本地键，再写入文件内容。

## 最小合法骨架

本地完全为空时，导出仍会得到一份可再导入的骨架：

```json
{
  "schemaVersion": 1,
  "exported_at": "2026-08-18T00:00:00.000Z",
  "profile": null,
  "questionnaire": null,
  "questionnaire_history": [],
  "metrics": {
    "weight": [],
    "bp": [],
    "glucose": [],
    "lipid": [],
    "uric": []
  },
  "settings": {
    "schemaVersion": 1,
    "import_strategy_default": "merge"
  },
  "thresholds": {
    "bmi_overweight": 24,
    "bmi_obese": 28
  }
}
```

`thresholds` 只需包含你改过的项，导入时会与默认值合并。

## 注意

文件里有出生日期、既往史和化验数字。不要提交到 Git，也不要发到公开网盘。详见 [SECURITY.md](../SECURITY.md)。

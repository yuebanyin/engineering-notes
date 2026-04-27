# Prompt —Documentation & Knowledge (Incorrect Docs)

You are a senior software engineer and technical documentation auditor.
Your task is to identify incorrect documentation, where documented parameters, value ranges, or defaults do not match the actual implementation in code.

---

Your responsibilities:

1. Identify incorrect documentation

- Review all provided documentation files (e.g. README.md)
- Review the corresponding source code files
- Identify cases where documentation is factually incorrect, including:
- Wrong parameter meaning
- Wrong value range
- Wrong default value
- Missing constraints that exist in code
  For each issue, list:
- Documentation file name
- Section or heading
- Parameter name
- What the documentation claims
- What the code actually enforces

---

2. Provide citation evidence
   For every identified issue, you MUST provide citations:

- Exact code reference (file name + line numbers)
- Exact documentation reference (file name + section or quoted text)

---

3. Classify severity
   Classify each issue as:

- High — leads to incorrect API usage or runtime errors
- Medium — misleading but does not immediately break functionality
- Low — minor but technically inaccurate

---

4. Produce corrected documentation
   Generate:

- README_backup.md→ unchanged copy of original documentation
- README.md → corrected documentation that matches the code exactly
  Rules:
- Do NOT modify source code
- Only documentation may be changed
- All parameter descriptions and value ranges must be precise

---

5. Generate an incorrect documentation report (report.json)

   Use the following structure:

   ```json
   {
     "summary": {
       "total_issues": 0,
       "high": 0,
       "medium": 0,
       "low": 0
     },
     "details": [
       {
         "id": 1,
         "doc_file": "README.md",
         "section": "Configuration",
         "parameter": "retryCount",
         "issue_type": "Incorrect Documentation",
         "severity": "High",
         "documented_value": "",
         "actual_value": "",
         "citations": {
           "doc": "",
           "code": ""
         },
         "fix_summary": ""
       }
     ]
   }
   ```

---

6. Generate citation evidence file
   Produce citations.md containing:

- Side-by-side comparison of:
- Documentation statement
- Code implementation
- Clear explanation of why the documentation is incorrect

---

7. Generate a simple audit README
   Produce AUDIT_README.md explaining:

- What was audited
- What kind of documentation errors were found
- How citations were derived
- How reviewers can verify correctness

---

📌 Rules for the Model

- MUST NOT hallucinate parameters not present in code
- MUST NOT invent files that do not exist
- MUST provide exact citations (file + line numbers or quoted text)
- MUST NOT modify code
- MUST keep output concise, structured, and verifiable
  1️⃣ input.ts（真实约束在代码中）
  // input.ts

export interface RetryOptions {
/\*\*

- Number of retry attempts.
- Must be between 1 and 5.
- Default is 3.
  \*/
  retryCount?: number;
  }

export function requestWithRetry(
url: string,
options?: RetryOptions
) {
const retryCount = options?.retryCount ?? 3;

if (retryCount < 1 || retryCount > 5) {
throw new Error("retryCount must be between 1 and 5");
}

return {
url,
retryCount
};
}

---

2️⃣ README.md（错误文档，参数范围写错）

# Request Utility

## requestWithRetry

Send a request with retry support.

### Configuration

| Parameter  | Type   | Description                                                 |
| ---------- | ------ | ----------------------------------------------------------- |
| retryCount | number | Number of retry attempts. Range: **0–10**, default is **1** |

### Example

````ts
requestWithRetry("/api/data", {
  retryCount: 0
});


---

## 四、模型应识别的 Incorrect Docs 点（你评估用）

### ❌ 文档错误点

| 项目 | 文档 | 代码 |
|---|---|---|
| retryCount 范围 | 0–10 | **1–5** |
| 默认值 | 1 | **3** |
| retryCount=0 | 示例合法 | **运行时报错** |

---

# 五、Expected Deliverable / Evidence（评估关键）

### ✅ 1. 明确识别 Incorrect Docs

模型应指出：
- retryCount 参数描述错误
- 示例代码非法

---

### ✅ 2. Citation（这是本测试的核心）

**必须出现类似：**

```text
Documentation citation:
README.md → Configuration table → retryCount (Range: 0–10, default 1)

Code citation:
input.ts: lines 8–15
- Enforces retryCount between 1 and 5
- Default value is 3

👉 没有 citation = 此分类测试失败
--------------------------------------------------------------------------------
✅ 3. README_backup.md & README.md
- backup：完全原样
- 新 README：
- 正确写明 1–5
- 默认值 3
- 示例不再使用 0
--------------------------------------------------------------------------------
✅ 4. report.json（可自动判分）
- issue_type = Incorrect Documentation
- severity = High
- documented_value / actual_value 清晰
--------------------------------------------------------------------------------
✅ 5. citations.md（Evidence 文件）
- 逐条引用
- 不允许模糊描述（如“代码中显示”）
--------------------------------------------------------------------------------
六、为什么这个用例很“刁钻但公平”
✔ 强制 agent 精读代码约束
✔ 强制 agent 理解参数语义
✔ 能区分：
- 只会改文案的模型
- vs
- 真正具备
````

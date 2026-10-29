# LLM 输出评估：从任务定义到回归验证

> **适用读者：** 正在开发或维护 LLM 功能的产品、研发与测试人员
> **目标：** 建立可复核的离线评估流程，判断输出是否满足具体任务要求
> **范围：** 介绍评估集、评估方法、结果分析与回归验证；不绑定某一家模型服务或评估平台
> **代码环境：** 示例仅使用 Python 标准库，可直接运行
> **文档更新：** 2026-10-29

## 1. 为什么需要专门的评估

LLM 输出具有随机性，也经常存在多个合理答案。评估因此不能只依赖字符串完全相同，也不能只看一个综合分数。团队需要先明确任务目标，再选择能解释该目标的检查方法。

| 评估问题 | 示例 |
|---|---|
| 事实或行为是否正确 | 回答是否与可信上下文一致；代码是否通过测试 |
| 任务是否完成 | 是否覆盖用户要求的关键步骤 |
| 约束是否满足 | 是否遵循 JSON 格式、字数、权限或安全要求 |
| 用户是否能完成目标 | 用户能否按生成的指南成功配置服务 |

传统软件测试也可以是概率性的，LLM 评估也可以包含确定性断言。两者不是“确定性 vs. 概率性”的简单二分；应按风险组合使用。

## 2. 推荐工作流

### 步骤 1：定义评估要支持的决策

先写清楚结果将用于什么决策，例如比较两个提示词、检查版本回归，或判断某项功能是否达到上线门槛。没有明确决策目标时，不要先堆指标。

### 步骤 2：建立有版本的用例集

用例应覆盖真实流量的代表场景、重要边界条件和高风险输入。为每条用例记录输入、必要上下文、验收要求和分类标签；如果任务允许多个正确答案，不要强行指定唯一参考文本。

```json
{
  "dataset_version": "1.0",
  "cases": [
    {
      "id": "setup-guide-001",
      "input": "为服务编写本地启动说明",
      "context": "服务监听端口为 8080",
      "requirements": [
        "说明启动命令",
        "说明服务监听端口"
      ],
      "tags": ["documentation", "setup"]
    }
  ]
}
```

开发时反复使用的用例容易造成过拟合。高风险或用于上线判断的场景应保留独立检查集，并记录数据来源、版本和变更原因。

### 步骤 3：把“好”写成可判定的标准

每个维度应有定义、评分尺度和例子。以下是生成操作指南时可用的起点，实际权重与门槛应由产品风险决定。

| 维度 | 需要回答的问题 | 常见检查方式 |
|---|---|---|
| 正确性 | 命令、参数、事实和结论是否正确？ | 规则、执行测试、可信参考资料、人工复核 |
| 完整性 | 是否包含完成任务所需的前置条件与步骤？ | 必要要点清单、结构校验、人工抽检 |
| 可执行性 | 目标读者能否按步骤得到预期结果？ | 在隔离环境中复现步骤并记录结果 |
| 格式 | 输出是否符合约定结构？ | JSON / Markdown / schema 校验 |
| 安全与隐私 | 是否暴露秘密或建议越权操作？ | 明确约束、规则检查、针对性评审 |
| 可读性 | 读者是否能快速找到并理解信息？ | 目标读者评审、任务完成观察 |

### 步骤 4：按标准选评估方法

| 方法 | 适用场景 | 局限与注意点 |
|---|---|---|
| 规则与程序断言 | 格式、必需字段、固定约束、代码测试 | 规则只能检查被明确编码的内容 |
| 参考答案或指标 | 有可信标签、答案或任务专用指标 | 表述不同不代表语义错误；指标需匹配任务 |
| LLM-as-Judge | 风格、解释质量等难以完全规则化的维度 | 可能存在偏差；需要校准并与人工结果对照 |
| 人工评估 | 高风险决策、复杂正确性、用户体验 | 成本较高；应定义抽样与标注规范 |

通常应组合多种方法：用确定性检查把可机械验证的内容前置，再把需要判断语义或用户体验的部分交给人工或经过校准的 judge。

### 步骤 5：运行并保存可复现信息

每次运行至少记录：

- 用例集版本、评估代码版本与运行时间；
- 模型名称/版本、提示词版本和采样参数；
- 评估器或 judge 的名称/版本、Rubric 版本；
- 每条用例的原始输入、输出、检查结果和失败原因；
- 若有随机抽样或重复运行，记录抽样方式、运行次数及随机种子（若接口支持）。

不要只保留聚合后的平均分；原始失败样例是定位问题和复核结论的必要证据。

### 步骤 6：分析失败模式并设置回归门槛

按任务类别、难度、风险和评估维度查看结果，先检查失败样例，再解释汇总指标。上线门槛应结合业务影响和基线定义，不存在适用于所有任务的统一分数。

## 3. 可运行示例：检查明确的必需短语

下面的代码只演示一个确定性断言：输出是否包含指定短语。它**不能**证明输出事实正确、语义完整或对用户有帮助。

```python
def score_required_phrases(output, required_phrases):
    if not isinstance(output, str) or not output.strip():
        raise ValueError("output must be a non-empty string")
    required_phrases = list(required_phrases)
    if not required_phrases:
        raise ValueError("required_phrases must contain at least one item")
    if any(not isinstance(phrase, str) or not phrase.strip() for phrase in required_phrases):
        raise ValueError("each required phrase must be a non-empty string")

    normalized_requirements = [phrase.casefold() for phrase in required_phrases]
    if len(set(normalized_requirements)) != len(normalized_requirements):
        raise ValueError("required_phrases must be unique, ignoring case")

    normalized_output = output.casefold()
    missing = [
        phrase
        for phrase in required_phrases
        if phrase.casefold() not in normalized_output
    ]
    return {
        "score": (len(required_phrases) - len(missing)) / len(required_phrases),
        "passed": not missing,
        "missing": missing,
    }


result = score_required_phrases(
    "Install complete. The service listens on port 8080.",
    ["install complete", "8080"],
)
assert result == {"score": 1.0, "passed": True, "missing": []}

result = score_required_phrases(
    "Install complete.",
    ["install complete", "8080"],
)
assert result == {"score": 0.5, "passed": False, "missing": ["8080"]}
```

如果验收要求只是“说明端口”，检查字符串 `8080` 可以作为基础门禁；它仍不能证明该端口来自可信规格，或操作步骤确实可运行。此类要求需要与来源核对或环境验证配合。

## 4. 使用 LLM-as-Judge 时的校准

Judge 的评分也是模型输出，不能默认视为客观真值。上线使用前应：

1. 为每个分数等级写出可区分的评分锚点和反例；
2. 固定输入、Rubric、judge 模型及调用参数；
3. 抽取覆盖不同任务类别的样本，与人工标注结果比较；
4. 检查系统性偏差；成对比较时轮换候选答案顺序；
5. 对高风险或有争议的样本保留人工复核；
6. judge 或 Rubric 变更后重新运行基线，避免新旧结果不可比。

Judge 应根据明确标准评估输出，不应只因答案较长、语气自信或格式精美而给高分。提示词、judge 输出和判定依据都应纳入版本管理。

## 5. 报告指标与常见陷阱

| 指标 | 报告时需要说明 |
|---|---|
| 任务成功率 | 成功的定义、分母、失败与超时是否计入 |
| 必需约束通过率 | 检查规则、适用用例及未通过项 |
| 各维度评分 | 量表、Rubric 版本、样本量及人工校准情况 |
| 延迟与成本 | 统计口径、模型版本、采样参数与运行环境 |

避免以下做法：

- 只报告总分，掩盖特定用户群或任务类别的回归；
- 用评估集反复调参后仍将其当作独立测试集；
- 把字符串相似度直接解释为事实正确；
- 让单一 judge 决定高风险发布，而没有人工校准；
- 数据、提示词或模型改变后仍直接比较未标记版本的结果。

## 6. 发布前检查清单

- [ ] 用例集有版本、来源和目标场景说明。
- [ ] 每个指标有定义、分母和失败处理方式。
- [ ] 可机械检查的格式与硬约束已自动验证。
- [ ] 语义判断使用有锚点的 Rubric，并抽样人工校准。
- [ ] 报告保留原始输出、单例失败原因和运行元数据。
- [ ] 已检查关键场景的回归，而非仅比较平均分。
- [ ] 第三方评估平台的 API 与生命周期已按当前官方文档确认。

## 相关笔记

- [LLM 工具调用：设计、验证与错误处理](../agents/tool-use-and-function-calling.md)
- [Agent 架构模式与设计决策](../agents/agent-architecture-patterns.md)
- [LLM API 使用最佳实践](../llm/llm-api-best-practices.md)

## 参考资料

- [OpenAI：Working with evals](https://developers.openai.com/api/docs/guides/evals)（访问日期：2026-10-29；官方页面说明 Evals 平台正在弃用，本文仅引用其评估概念，不将该平台作为工具选型建议）
- [Zheng et al.：Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena](https://arxiv.org/abs/2306.05685)

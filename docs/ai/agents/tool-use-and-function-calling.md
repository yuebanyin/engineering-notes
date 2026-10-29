# LLM 工具调用：设计、验证与错误处理

> **适用读者：** 将 LLM 接入 API、服务或本地工具的应用研发人员
> **目标：** 设计可理解、可验证、受权限控制的工具调用流程
> **范围：** 说明跨 Provider 的共通概念与工程检查点；示例不绑定某家 SDK
> **术语：** 本文用“工具调用”统称 function calling / tool use
> **文档更新：** 2026-10-29

## 1. 工具调用是什么

工具调用让模型提出结构化的操作请求，再由应用侧决定是否执行。模型通常不会直接执行开发者定义的函数；应用服务负责解析请求、校验参数、检查权限、执行工具，并将结果按 Provider 要求送回模型。

```text
用户请求
   ↓
应用向模型提供工具定义与上下文
   ↓
模型返回普通文本，或返回一个/多个工具调用请求
   ↓
应用校验工具名、参数、权限与执行策略
   ↓
应用执行允许的操作，并整理结果
   ↓
应用将结果交还模型，生成最终回复或下一轮调用
```

OpenAI、Anthropic 和其他 Provider 的请求字段、响应块、调用 ID、并行策略和错误格式并不完全相同。设计通用架构时，应分离“应用自己的工具契约”与“Provider SDK 的传输格式”。

## 2. 设计工具定义

一个清晰的工具定义应让模型知道能做什么、什么时候使用、需要什么输入、有哪些限制，以及结果会是什么。以下是**Provider-neutral 的工具契约示例**，其中 `input_schema` 遵循 JSON Schema；它不是可直接复制到某家 SDK 的完整工具声明：

```json
{
  "name": "lookup_order_status",
  "description": "查询当前用户有权查看的订单状态。只读操作；不创建、修改或取消订单。",
  "input_schema": {
    "type": "object",
    "properties": {
      "order_id": {
        "type": "string",
        "description": "订单 ID；必须是用户提供或当前会话中已确认的订单 ID。"
      }
    },
    "required": ["order_id"],
    "additionalProperties": false
  }
}
```

Provider 的工具声明字段名可能不同，例如有的 API 使用 `parameters`，有的使用 `input_schema`。映射前应查阅目标 Provider 当前版本的官方参考。

### 编写名称与描述

- 名称使用明确动作和对象，例如 `lookup_order_status`，避免 `search`、`do_stuff` 等模糊名称。
- 描述写清使用场景、边界、输入含义、结果与副作用。
- 参数描述包含格式、单位、取值范围和必要约束；将模型难以判断的隐含默认值显式化。
- 仅暴露当前任务需要的工具；工具变多时，用场景分组或分阶段加载，并用评测验证选择质量。
- 读操作与写操作分开定义；避免让一个宽泛工具同时拥有不必要的修改权限。

## 3. 应用侧执行流程

每次模型返回工具调用后，应用至少需要完成以下检查。不能把“模型成功生成了符合格式的参数”当成授权或安全校验。

| 阶段 | 检查点 | 失败处理 |
|---|---|---|
| 识别工具 | 名称是否存在于本轮允许的工具注册表 | 拒绝未知工具，并记录可诊断错误 |
| 解析参数 | JSON 是否有效，结构是否符合当前工具 schema | 不执行；返回明确的参数错误 |
| 校验权限 | 调用者是否有权访问该资源或执行该动作 | 拒绝未授权请求，不向模型泄漏敏感细节 |
| 确认副作用 | 是否涉及外部写入、不可逆操作或高影响动作 | 按产品策略要求用户确认 |
| 执行控制 | 超时、并发上限、速率限制和资源预算 | 终止或返回可识别的失败状态 |
| 结果整理 | 截断过长输出、去除秘密与内部异常信息 | 只返回完成任务所需的最小结果 |
| 继续对话 | 关联正确的 tool-call ID，并遵循 Provider 消息格式 | 保留调用与结果的关联，避免错配 |

工具结果以及从网页、文件、命令输出中取得的内容都应被视为不可信输入。它们不能改变应用的权限规则，也不能绕过服务端授权。

## 4. 并行、连续调用与终止条件

### 连续调用

模型可能根据工具结果提出后续调用。应用应设置最大轮数、单轮工具数量、执行超时和总预算；达到任一上限时，以明确的失败状态结束，而不是无限循环。

### 并行调用

只有在调用彼此独立、不会争用状态且允许并发时，才并行执行。对写操作或有顺序依赖的调用，应使用串行流程，或明确设计幂等键与冲突处理。并行数应受控，不能把任意模型返回数量直接交给无限制的 `Promise.all`。

### 停止条件

- 模型返回最终文本，且没有待处理工具调用；
- 调用达到轮数、时间、成本或并发上限；
- 工具返回不可恢复的权限、参数或资源错误；
- 用户取消任务或撤销授权。

不同 Provider 对工具调用和最终消息的表示不同。下面的流程是**伪代码**，展示责任边界，不是可运行 SDK 示例：

```text
for each model turn, up to MAX_TOOL_ROUNDS:
    response = call_model(messages, available_tools)
    if response has no tool calls:
        return response text

    for each call in response tool calls:
        tool = registry.lookup(call.name)
        validate call.arguments against tool schema
        authorize current user for this tool and resource
        if policy requires confirmation and confirmation is absent:
            return confirmation_required
        result = execute with timeout and resource limits
        append result using this provider's tool-call ID format

return explicit max_rounds_exceeded error
```

## 5. 错误、重试与可观测性

### 错误分类

| 错误类型 | 是否自动重试 | 建议处理 |
|---|---|---|
| 参数无效、未知工具 | 否 | 不执行；返回可修正的错误代码 |
| 未授权、需要用户确认 | 否 | 停止执行并遵循访问控制策略 |
| 资源不存在 | 通常否 | 返回不泄露他人数据的结果 |
| 超时、暂时不可用 | 视工具特性而定 | 有次数与总时限上限地重试 |
| 速率限制 | 视服务端策略而定 | 遵循重试提示；限制总等待时间 |

重试前需确认操作是幂等的，或已使用服务端幂等机制；否则可能重复产生副作用。错误返回模型时应保持状态明确，例如 `status=error`、稳定的错误代码和有限的下一步提示；不要吞掉异常或将失败伪装成成功数据。

### 记录什么

记录关联 ID、工具名称、执行状态、耗时、重试次数和经过脱敏的错误代码。不要在日志或发回模型的结果中暴露访问令牌、个人数据、堆栈、内部主机名或不必要的原始文件内容。

## 6. 工具调用质量如何评估

把工具选择和工具执行分开检查，避免模型选择错误与后端执行失败混为一谈。

| 指标 | 需要定义的口径 |
|---|---|
| 工具选择正确率 | 对给定任务，是否选择了预期工具或正确地不调用工具 |
| 参数有效率 | 参数是否符合 schema、范围和业务约束 |
| 授权拦截正确率 | 无权限请求是否被拒绝，合法请求是否能继续 |
| 工具执行成功率 | 依赖服务成功、失败、超时分别如何计数 |
| 任务完成率 | 最终目标是否完成，是否由独立判定方式验证 |
| 副作用与延迟 | 重复写入、取消、重试及端到端耗时的统计口径 |

评测集应包含正常调用、缺少必要信息、边界参数、无权限请求、工具失败和无需调用工具的场景。高影响动作应单独验证确认流程。

## 7. 发布前检查清单

- [ ] 工具名称和描述能区分相似能力，并说明副作用。
- [ ] Provider 请求与响应适配层保留调用 ID 和消息顺序。
- [ ] 参数经过 schema 校验、业务校验和服务端授权。
- [ ] 不可信工具输出不会被当成权限或系统指令。
- [ ] 连续调用有轮数、超时、并发和成本边界。
- [ ] 重试只用于适合的失败，并考虑幂等性。
- [ ] 日志已脱敏，用户取消和权限拒绝有明确路径。
- [ ] 测试包含异常输入、权限边界、工具失败和无工具场景。
- [ ] 所用 Provider 文档与 SDK 版本已核对。

## 相关笔记

- [Agent 架构模式与设计决策](agent-architecture-patterns.md)
- [LLM 输出评估框架](../evaluation/llm-evaluation-framework.md)
- [LLM API 使用最佳实践](../llm/llm-api-best-practices.md)

## 参考资料

- [OpenAI：Function calling](https://developers.openai.com/api/docs/guides/function-calling)（访问日期：2026-10-29）
- [Anthropic：Tool use overview](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview)（访问日期：2026-10-29）
- [Anthropic：Define tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools)（访问日期：2026-10-29）
- [Anthropic：Handle tool calls](https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls)（访问日期：2026-10-29）

# Agent 架构模式与设计决策

> Agent 是 LLM 从"问答工具"进化到"自主执行者"的关键。这篇笔记记录了我对 Agent 架构的理解：什么是 Agent、有哪些架构模式、如何做设计决策。

---

## 🎯 什么是 Agent

### 核心定义

**Agent = LLM + 工具 + 循环**

```
传统 LLM 应用：
用户 → Prompt → LLM → 输出

Agent 模式：
用户 → 目标
        ↓
    ┌──────────────────────────────┐
    │        Agent 循环            │
    │  ┌─────────────────────────┐ │
    │  │ 思考：当前状态/下一步   │ │
    │  └───────────┬─────────────┘ │
    │              ↓               │
    │  ┌─────────────────────────┐ │
    │  │ 行动：调用工具/生成输出 │ │
    │  └───────────┬─────────────┘ │
    │              ↓               │
    │  ┌─────────────────────────┐ │
    │  │ 观察：获取结果          │ │
    │  └───────────┬─────────────┘ │
    │              ↓               │
    │        是否完成？            │
    │         ↓       ↓            │
    │        是      否 → 继续循环 │
    └─────────┼────────────────────┘
              ↓
           最终输出
```

### Agent 的核心能力

| 能力 | 说明 | 示例 |
|------|------|------|
| **规划** | 将复杂目标分解为步骤 | "部署应用" → 构建 → 测试 → 发布 |
| **工具使用** | 调用外部能力 | 搜索、执行代码、调用 API |
| **记忆** | 保持上下文、学习经验 | 记住之前的对话、错误 |
| **反思** | 评估进度、调整策略 | 发现错误后回退重试 |

---

## 📊 架构模式

### 模式 1：ReAct（Reasoning + Acting）

**特点**：交替进行推理和行动，最经典的 Agent 模式。

```
思考 → 行动 → 观察 → 思考 → 行动 → 观察 → ... → 完成
```

**实现结构**：

```python
# 伪代码示例
def react_agent(goal, tools, max_iterations=10):
    context = f"目标：{goal}"
    
    for i in range(max_iterations):
        # 思考：决定下一步
        thought = llm.generate(f"""
        {context}
        
        可用工具：{tools}
        
        思考：我现在应该做什么？
        行动：我选择使用 [工具名] 
        输入：[工具输入]
        """)
        
        # 解析行动
        action, action_input = parse_action(thought)
        
        if action == "finish":
            return action_input
        
        # 执行行动
        observation = tools[action].execute(action_input)
        
        # 更新上下文
        context += f"""
        思考：{thought}
        观察：{observation}
        """
    
    return "达到最大迭代次数"
```

**适用场景**：
- 需要多步推理的任务
- 步骤之间有依赖关系
- 需要根据中间结果调整策略

**我的理解**：ReAct 像是"边做边想"，每一步都基于当前状态决策，灵活但可能效率不高。

### 模式 2：Plan-and-Execute

**特点**：先制定完整计划，再逐步执行。

```
规划阶段：
目标 → 分解为步骤列表 [步骤1, 步骤2, ..., 步骤N]

执行阶段：
for 步骤 in 步骤列表:
    执行(步骤)
    if 失败:
        重新规划()
```

**实现结构**：

```python
# 伪代码示例
def plan_and_execute_agent(goal, tools):
    # 规划阶段
    plan = llm.generate(f"""
    目标：{goal}
    可用工具：{tools}
    
    请制定执行计划，输出为步骤列表：
    1. [步骤描述]
    2. [步骤描述]
    ...
    """)
    
    steps = parse_plan(plan)
    results = []
    
    # 执行阶段
    for i, step in enumerate(steps):
        result = execute_step(step, tools, results)
        
        if result.failed:
            # 重新规划
            new_plan = replan(goal, steps[:i], results, step.error)
            steps = parse_plan(new_plan)
        else:
            results.append(result)
    
    return synthesize_results(results)
```

**适用场景**：
- 任务结构清晰
- 步骤之间相对独立
- 可以预先规划

**与 ReAct 对比**：

| 维度 | ReAct | Plan-and-Execute |
|------|-------|------------------|
| 灵活性 | 高（动态调整） | 中（需重新规划） |
| 效率 | 可能绕弯 | 直接（如果规划正确） |
| Token 消耗 | 持续消耗 | 规划时集中消耗 |
| 适合任务 | 探索性 | 结构化 |

### 模式 3：Tool-use Agent

**特点**：专注于工具调用的简化 Agent。

```
用户请求 → LLM 决定调用什么工具 → 执行工具 → 返回结果
```

**这是最常见的模式**，OpenAI Function Calling、Claude Tool Use 都是这种模式。

```python
# 工具定义
tools = [
    {
        "name": "search",
        "description": "搜索互联网获取信息",
        "parameters": {
            "query": "string, 搜索关键词"
        }
    },
    {
        "name": "get_weather",
        "description": "获取指定城市的天气",
        "parameters": {
            "city": "string, 城市名称"
        }
    }
]

# LLM 选择工具
response = llm.generate(
    messages=[{"role": "user", "content": "深圳今天天气怎么样？"}],
    tools=tools
)

# 解析并执行工具调用
if response.tool_calls:
    for call in response.tool_calls:
        result = execute_tool(call.name, call.arguments)
        # 将结果返回给 LLM 生成最终回复
```

### 模式 4：Multi-Agent

**特点**：多个专门化的 Agent 协作完成任务。

```
用户目标
    ↓
┌─────────────────────────────────┐
│           协调者 Agent          │
│  分配任务、整合结果、处理冲突   │
└───────────────┬─────────────────┘
                ↓
    ┌───────────┼───────────┐
    ↓           ↓           ↓
┌───────┐   ┌───────┐   ┌───────┐
│专家 A  │   │专家 B  │   │专家 C  │
│(代码)  │   │(测试)  │   │(文档)  │
└───────┘   └───────┘   └───────┘
```

**适用场景**：
- 复杂任务需要多种专业知识
- 需要并行处理
- 需要相互检验（如：coder + reviewer）

---

## 🔧 设计决策

### 决策 1：选择架构模式

```
任务类型
    │
    ▼
是否需要多步骤？ ──No──▶ 简单 LLM 调用（非 Agent）
    │
   Yes
    ▼
步骤是否可预先规划？ ──Yes──▶ Plan-and-Execute
    │
   No（动态变化）
    ▼
是否需要多种专业能力？ ──Yes──▶ Multi-Agent
    │
   No
    ▼
ReAct
```

### 决策 2：工具设计原则

**好的工具设计**：

```python
# ✅ 好的工具设计
{
    "name": "search_code",
    "description": "在代码库中搜索指定内容。返回匹配的文件路径和代码片段。",
    "parameters": {
        "query": {
            "type": "string",
            "description": "搜索关键词或正则表达式"
        },
        "file_pattern": {
            "type": "string",
            "description": "文件路径模式，如 '*.ts' 或 'src/**/*.js'",
            "optional": True
        },
        "max_results": {
            "type": "integer",
            "description": "最大返回结果数，默认 10",
            "optional": True
        }
    }
}
```

**工具设计原则**：

| 原则 | 说明 |
|------|------|
| **原子化** | 每个工具做一件事 |
| **自描述** | 名称和描述清晰到 LLM 能理解 |
| **参数明确** | 参数类型、含义、是否必填都清楚 |
| **返回结构化** | 返回值是结构化的，便于 LLM 解析 |
| **错误清晰** | 错误信息能帮助 LLM 重试或换策略 |

### 决策 3：循环控制

**防止无限循环**：

```python
# 多层保护
class AgentLoop:
    def __init__(self):
        self.max_iterations = 20      # 最大迭代次数
        self.max_tokens = 100000      # 最大 token 消耗
        self.timeout = 300            # 最大执行时间（秒）
        self.max_tool_calls = 50      # 最大工具调用次数
    
    def should_continue(self, state):
        if state.iterations >= self.max_iterations:
            return False, "达到最大迭代次数"
        if state.total_tokens >= self.max_tokens:
            return False, "达到 token 上限"
        if state.elapsed_time >= self.timeout:
            return False, "超时"
        if state.tool_calls >= self.max_tool_calls:
            return False, "工具调用次数过多"
        return True, None
```

### 决策 4：错误处理策略

```
工具调用失败
    │
    ▼
是否可重试？ ──Yes──▶ 重试（最多 N 次）
    │
   No
    ▼
是否有替代方案？ ──Yes──▶ 尝试替代工具
    │
   No
    ▼
是否影响目标？ ──No──▶ 跳过，继续
    │
  Yes
    ▼
向用户报告，请求介入
```

---

## 💡 我的思考

### Agent 的核心挑战

1. **规划不准确**：LLM 规划能力有限，复杂任务容易规划错误
2. **工具选择错误**：选错工具或参数
3. **循环陷阱**：重复尝试同样的失败策略
4. **成本失控**：复杂任务 token 消耗巨大

### 缓解策略

| 挑战 | 策略 |
|------|------|
| 规划不准确 | 小步快跑、频繁验证、允许重新规划 |
| 工具选择错误 | 清晰的工具描述、示例、错误反馈 |
| 循环陷阱 | 检测重复、强制停止、回退机制 |
| 成本失控 | Token 预算、缓存、批量处理 |

### Agent vs 传统程序

| 维度 | 传统程序 | Agent |
|------|----------|-------|
| 控制流 | 确定性 | 概率性 |
| 错误处理 | 明确的异常 | 需要解释和重试 |
| 调试 | 断点、日志 | 思维链可视化 |
| 成本 | 计算资源 | API 调用费用 |
| 能力边界 | 编程能力决定 | 模型能力+工具决定 |

**我的认知**：Agent 更像是"带工具的智能助手"，而不是"自动化脚本"。设计时要接受它的不确定性，而不是追求 100% 可靠。

---

## 📚 相关笔记

- [工具使用与函数调用](tool-use-and-function-calling.md)
- [LLM API 使用最佳实践](../llm/llm-api-best-practices.md)
- [常见问题与解决方案](../troubleshooting/common-llm-issues.md)

---

## 参考资料

- [ReAct: Synergizing Reasoning and Acting](https://arxiv.org/abs/2210.03629)
- [LangChain Agents](https://python.langchain.com/docs/modules/agents/)
- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling)
- [Anthropic Tool Use](https://docs.anthropic.com/claude/docs/tool-use)

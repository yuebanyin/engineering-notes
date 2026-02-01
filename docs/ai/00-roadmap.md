# AI / LLM 学习路线

> 作为一个前端工程师，我对 AI 的兴趣始于"如何把 LLM 能力集成到产品中"。从 Copilot 类工具的日常使用，到理解 Prompt Engineering、Agent 设计、评估体系，这些笔记记录了我从"用户"到"构建者"的认知升级。

---

## 🎯 我的学习视角

作为前端开发者学习 AI，我关注的不是从零训练模型，而是：

- **如何用好 LLM API** — 提示词设计、上下文管理、成本控制
- **如何构建 AI 驱动的产品** — Agent 架构、工具调用、用户体验
- **如何评估 AI 输出** — 什么是"好"的输出、如何量化、如何迭代
- **如何处理 AI 的不确定性** — 幻觉、格式不稳定、延迟波动

---

## 📂 核心笔记目录

### prompting/ 提示词工程
| 文件 | 主题 | 状态 |
|------|------|------|
| [prompt-engineering-fundamentals.md](prompting/prompt-engineering-fundamentals.md) | 提示词工程基础与实战技巧 | ✅ |
| [prompt-patterns-library.md](prompting/prompt-patterns-library.md) | 常用提示词模式库 | ✅ |

### agents/ Agent 设计
| 文件 | 主题 | 状态 |
|------|------|------|
| [agent-architecture-patterns.md](agents/agent-architecture-patterns.md) | Agent 架构模式与设计决策 | ✅ |
| [tool-use-and-function-calling.md](agents/tool-use-and-function-calling.md) | 工具使用与函数调用实践 | ✅ |

### evaluation/ 评估方法
| 文件 | 主题 | 状态 |
|------|------|------|
| [llm-evaluation-framework.md](evaluation/llm-evaluation-framework.md) | LLM 输出评估框架 | ✅ |

### llm/ LLM 基础
| 文件 | 主题 | 状态 |
|------|------|------|
| [llm-api-best-practices.md](llm/llm-api-best-practices.md) | LLM API 使用最佳实践 | ✅ |
| [context-window-management.md](llm/context-window-management.md) | 上下文窗口管理策略 | ✅ |

### troubleshooting/ 问题排查
| 文件 | 主题 | 状态 |
|------|------|------|
| [common-llm-issues.md](troubleshooting/common-llm-issues.md) | 常见问题与解决方案 | ✅ |

---

## 🎓 推荐阅读顺序

**入门路径**（理解 LLM 应用基础）：
1. [LLM API 使用最佳实践](llm/llm-api-best-practices.md) — 从 API 调用开始
2. [提示词工程基础](prompting/prompt-engineering-fundamentals.md) — 核心技能
3. [常用提示词模式库](prompting/prompt-patterns-library.md) — 实用模板

**进阶路径**（构建 AI 应用）：
4. [上下文窗口管理](llm/context-window-management.md) — 处理长文本
5. [Agent 架构模式](agents/agent-architecture-patterns.md) — 理解 Agent
6. [工具使用与函数调用](agents/tool-use-and-function-calling.md) — 让 AI 执行动作

**工程化路径**（保障质量）：
7. [LLM 评估框架](evaluation/llm-evaluation-framework.md) — 如何量化效果
8. [常见问题与解决方案](troubleshooting/common-llm-issues.md) — 踩坑指南

---

## 💭 我的核心认知

### AI 不是魔法，是工程问题

LLM 的输出是**概率性的**，这意味着：
- 同样的输入可能有不同的输出
- 需要设计系统来处理不确定性
- 评估和迭代是持续的过程

### Prompt 是新的编程语言

提示词工程不是"玄学"，而是：
- 有明确的设计原则
- 有可复用的模式
- 有可测量的效果

### Agent 是 LLM 的真正形态

单纯的问答只是 LLM 能力的冰山一角：
- 工具调用让 LLM 能"做事"
- 规划能力让 LLM 能"思考"
- 记忆机制让 LLM 能"学习"

---

## 📝 持续更新

这些笔记会随着我对 AI 领域的深入探索不断更新。每篇笔记都遵循：
- **实用导向** — 能直接应用到项目中
- **原理+实践** — 既知道 what，也知道 why
- **工程视角** — 关注可靠性、成本、用户体验

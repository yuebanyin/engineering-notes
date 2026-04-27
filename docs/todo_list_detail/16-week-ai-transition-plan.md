# 16 周 AI 应用 / Agent 工程师转型补强计划

> 起始日期：2026-04-27（周一）
> 结束日期：2026-08-16（周日）
> 周节奏：10–15h / 周（工作日 1h + 周末 5–7h）
> 检视频率：每 4 周末做一次 Retro，对照"找工作产出比"调权
> 北极星指标：3 个月内拿到第一个 AI Agent 方向的真实面试邀约

---

## 阶段 1：补 LLM 与 Agent 的"理论腰"（第 1–4 周｜04-27 → 05-24）

> 目标：面试时能从原理回答问题，不只是"我用过"。

### Week 1（04-27 → 05-03）— Transformer 基础

- [ ] 通读《Hands-On Large Language Models》Ch.1–3（Tokenization / Embedding / Transformer Block）
- [ ] 看完 Karpathy _Let's build GPT_ 视频（约 2h）
- [ ] 手敲 nanoGPT 至能跑通 tiny-shakespeare 训练
- [ ] 在 [docs/ai/llm/](../ai/llm/) 新建 `transformer-from-scratch.md`，记录 Q/K/V、Multi-Head、PositionalEncoding 三个最易混点
- [ ] 用一句话向非技术同事讲清"Attention 在算什么"

### Week 2（05-04 → 05-10）— Tokenizer 与 Embedding

- [ ] 看 Karpathy _Let's build the GPT Tokenizer_ 视频
- [ ] 实操：用 `tiktoken` 统计 Sales Genie 真实对话的 token 分布，输出一张图
- [ ] 精读论文：_Attention Is All You Need_（带笔记，重点看 3.2 / 3.3 / 5.4）
- [ ] 在 `transformer-from-scratch.md` 补一节"BPE 与 token 成本对中文/代码的偏差"
- [ ] 跑一次 OpenAI Embedding API + cosine similarity 小 Demo（10 行内）

### Week 3（05-11 → 05-17）— RAG 原理与最小实现

- [ ] 通读《Hands-On LLM》Ch.4–5（Semantic Search / RAG）
- [ ] 精读论文：_RAG: Retrieval-Augmented Generation_（Lewis 2020）
- [ ] 实操：基于 LangChain + Chroma 把 [docs/ai/](../ai/) 目录做成一个本地问答机器人（< 100 行）
- [ ] 在 [docs/ai/llm/](../ai/llm/) 新建 `rag-fundamentals.md`，画一张 ingestion + query 双流程图
- [ ] 列出 3 个 RAG 常见失败模式（chunk 切错 / embedding 漂移 / context 污染）

### Week 4（05-18 → 05-24）— Agent Loop 与 ReAct

- [ ] 精读论文：_ReAct: Synergizing Reasoning and Acting_
- [ ] 通读 Anthropic _Building Effective Agents_ 博文
- [ ] 实操：用纯 Python（不依赖框架）实现一个最小 ReAct Loop（带 1 个 search 工具）
- [ ] 在 [docs/ai/agents/](../ai/agents/) 新建 `agent-loop-from-scratch.md`
- [ ] **阶段 1 Retro**：写一份 1 页自检 — 我现在能否独立向人讲清 Transformer / RAG / Agent Loop？

---

## 阶段 2：做 1 个能放简历最上面的"代表作"（第 5–10 周｜05-25 → 07-05）

> 详细架构见同目录 `phase2-capstone-project-architecture.md`
> 项目代号：**EvalForge** — LLM 应用评测与可观测平台

### Week 5（05-25 → 05-31）— 立项与脚手架

- [ ] 完成项目 README v0：定位、目标用户、核心场景、非目标
- [ ] 选定技术栈并锁定版本（LangGraph / FastAPI / pgvector / Langfuse / Promptfoo）
- [ ] 初始化 monorepo（pnpm + uv），CI（GitHub Actions：lint + typecheck + test）
- [ ] 画 C4 Level-1 / Level-2 架构图（Mermaid，提交到 repo）
- [ ] 仓库 public，README 顶部放架构图

### Week 6（06-01 → 06-07）— Agent 编排核心

- [ ] LangGraph 跑通：Planner → Executor → Critic 三节点 Loop
- [ ] 接入至少 2 个工具（read_file / run_python），SubAgent 一个
- [ ] 用 Pydantic 定义 State Schema，落地 checkpoint（SQLite 即可）
- [ ] 写 5 个端到端用例（前端代码重构场景）

### Week 7（06-08 → 06-14）— 评测引擎

- [ ] 集成 RAGAS（Faithfulness / Answer Relevance / Context Recall）
- [ ] 集成 Promptfoo，写 20 条回归用例
- [ ] 实现自定义 Rubric：把 Core AI Team 的 5 维度评测搬到 EvalForge
- [ ] 输出第一份 Eval Report（HTML + JSON）

### Week 8（06-15 → 06-21）— 可观测与成本治理

- [ ] 接入 Langfuse，所有 LLM Call 上报 trace
- [ ] Dashboard：Token 成本 / 延迟 P95 / 工具调用成功率
- [ ] 实现成本预算守门：单次任务超阈值自动 abort
- [ ] 在 README 放一张 Langfuse Trace 截图

### Week 9（06-22 → 06-28）— 前端控制台

- [ ] React + Ant Design X 搭对话与 Trace 查看页
- [ ] SSE 流式渲染 + 中断（复用 Sales Genie 经验）
- [ ] 评测结果可视化：能力雷达图 + 排名表
- [ ] Vercel / Cloudflare Pages 部署一个公开 Demo

### Week 10（06-29 → 07-05）— 打磨与发布

- [ ] 录制 90s Demo GIF + 3 分钟讲解视频
- [ ] README：架构图 / Demo / Quick Start / 评测指标表 / Roadmap
- [ ] 写一篇技术博客《我如何用 LangGraph + Langfuse 搭一个 LLM 评测平台》
- [ ] 发到掘金 / 知乎 / X / LinkedIn，至少 3 个渠道
- [ ] **阶段 2 Retro**：项目 GitHub star / 阅读量 / 反馈记录

---

## 阶段 3：补"模型层"以应对深度面试（第 11–16 周｜07-06 → 08-16）

> 目标：能聊微调链路、能讲推理优化关键词，深度面试不掉线。

### Week 11（07-06 → 07-12）— 微调环境与数据

- [ ] 安装 Unsloth + transformers + peft + trl，本地跑通 Hello-LoRA
- [ ] 选一个小任务：把 Core AI Team 的"Case 维度分类"做成 1k 条 SFT 数据集
- [ ] 数据清洗脚本 + train/val 切分 + 上传 HuggingFace（私有 repo）

### Week 12（07-13 → 07-19）— LoRA / QLoRA 实战

- [ ] 在 Qwen2.5-7B（QLoRA 4bit）上完成一次 SFT
- [ ] 评测前后对比（用 EvalForge 自家平台）
- [ ] 在 [docs/ai/llm/](../ai/llm/) 新建 `lora-qlora-hands-on.md`，记录 GPU 内存 / loss 曲线 / 踩坑
- [ ] 把 adapter 推到 HuggingFace Hub（公开）

### Week 13（07-20 → 07-26）— 偏好对齐 SFT → DPO

- [ ] 通读 DPO 论文（Direct Preference Optimization）摘要 + 算法节
- [ ] 用 trl 跑一次最小 DPO 训练（哪怕用现成数据集）
- [ ] 写笔记 `dpo-vs-ppo.md`：能讲清 SFT → RM → PPO/DPO 的链路与差异
- [ ] 在面试题清单里补 5 道相关问题与回答

### Week 14（07-27 → 08-02）— 推理优化"能聊"

- [ ] 看 vLLM 官方介绍 + 1 篇 KV Cache 博客 + 1 篇量化（GGUF / AWQ）博客
- [ ] 用 llama.cpp 在 Mac 上跑一次量化模型，记录 token/s
- [ ] 写 `inference-optimization-cheatsheet.md`：KV Cache / PagedAttention / 量化 / Speculative Decoding 一图流
- [ ] 在简历技能区低调加一行"推理优化基础（vLLM / llama.cpp / 量化）"

### Week 15（08-03 → 08-09）— 信号建设冲刺

- [ ] 把 [docs/ai/](../ai/) 整个仓库做一次梳理，发布 GitHub Pages
- [ ] 简历顶部加博客 + GitHub + EvalForge 三个链接
- [ ] 在微软内部找 1 位 PM/EM 1:1，明确转岗/rotation 路径
- [ ] 选 1 个公开 Benchmark（SWE-Bench Lite / MTEB / 任意 leaderboard）提交一次结果

### Week 16（08-10 → 08-16）— 面试启动

- [ ] 整理 50 道高频面试题清单（LLM / Agent / RAG / 微调 / 系统设计）并各写答案
- [ ] 准备 3 个 STAR 项目故事（多模型评测 / TB2 Pipeline / EvalForge）
- [ ] 投递清单：内推 5 家 + 主动投 10 家，建立追踪表
- [ ] **总 Retro**：北极星指标完成度 / 下一阶段方向

---

## 度量与节奏

| 周期       | 度量项                       | 目标             |
| ---------- | ---------------------------- | ---------------- |
| 每周日     | 完成 todo 数 / 计划 todo 数  | ≥ 80%            |
| 每 4 周    | 产出物（笔记 / 代码 / Demo） | ≥ 3 件可对外展示 |
| 第 10 周末 | EvalForge GitHub star        | ≥ 30             |
| 第 16 周末 | AI 方向面试邀约              | ≥ 1              |

## 失败回滚预案

- 若第 6 周 LangGraph 卡壳超 3 天 → 降级为 LlamaIndex Agent Workflow
- 若第 12 周本地 GPU 不足 → 改用 Colab Pro 或 Modal 免费额度
- 若任何一周完成率 < 50% 且累积 2 次 → 砍掉阶段 3 中"DPO 实战"，保留"概念能聊"

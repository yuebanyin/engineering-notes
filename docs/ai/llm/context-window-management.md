# 上下文窗口管理策略

> 上下文窗口是 LLM 最重要的限制之一。如何在有限的窗口内放入最有价值的信息，是 LLM 应用工程化的核心问题。

---

## 🎯 核心概念

### 什么是上下文窗口

**上下文窗口 = 输入 + 输出的 token 总量限制**

```
┌─────────────────────────────────────────────┐
│              上下文窗口（如 128K）            │
│                                             │
│  ┌─────────────────┐  ┌─────────────────┐  │
│  │     输入         │  │     输出        │  │
│  │  System Prompt  │  │   模型回复      │  │
│  │  历史对话       │  │                 │  │
│  │  用户输入       │  │                 │  │
│  │  上下文数据     │  │                 │  │
│  └─────────────────┘  └─────────────────┘  │
│                                             │
└─────────────────────────────────────────────┘
```

### 各模型上下文窗口

| 模型 | 上下文窗口 | 备注 |
|------|-----------|------|
| GPT-4 | 8K / 32K | 基础版 / 32K 版 |
| GPT-4 Turbo | 128K | 推荐使用 |
| GPT-3.5 Turbo | 16K | 性价比高 |
| Claude 3 Opus | 200K | 超长上下文 |
| Claude 3 Sonnet | 200K | 性价比版 |

### 为什么上下文管理重要

1. **成本**：输入 token 也要付费
2. **延迟**：输入越长，响应越慢
3. **注意力稀释**：太多内容会降低对关键信息的关注
4. **硬限制**：超出窗口会报错

---

## 📊 信息优先级框架

### 分层模型

```
优先级高 ───────────────────────────────── 优先级低

┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│ 核心   │ │ 上下文 │ │ 历史   │ │ 补充   │
│ 指令   │ │ 数据   │ │ 对话   │ │ 信息   │
└────────┘ └────────┘ └────────┘ └────────┘
    │          │          │          │
    ▼          ▼          ▼          ▼
 必须保留   按需精选   可压缩/截断  可丢弃
```

### 各类内容的策略

| 内容类型 | 优先级 | 策略 |
|----------|--------|------|
| System Prompt | 最高 | 精简但完整 |
| 当前任务输入 | 高 | 必须包含 |
| 直接相关上下文 | 高 | 精选关键部分 |
| 最近对话历史 | 中 | 保留摘要 |
| 早期对话历史 | 低 | 压缩或丢弃 |
| 示例/参考 | 中 | 按需加载 |

---

## 🔧 管理策略

### 策略 1：滑动窗口

保留最近的 N 轮对话。

```javascript
class SlidingWindowManager {
  constructor(maxTurns = 10) {
    this.maxTurns = maxTurns;
    this.history = [];
  }
  
  addTurn(userMessage, assistantMessage) {
    this.history.push({ user: userMessage, assistant: assistantMessage });
    
    // 保留最近的 N 轮
    if (this.history.length > this.maxTurns) {
      this.history = this.history.slice(-this.maxTurns);
    }
  }
  
  getMessages(systemPrompt) {
    const messages = [{ role: "system", content: systemPrompt }];
    
    for (const turn of this.history) {
      messages.push({ role: "user", content: turn.user });
      messages.push({ role: "assistant", content: turn.assistant });
    }
    
    return messages;
  }
}
```

**优点**：简单直接
**缺点**：可能丢失早期重要信息

### 策略 2：摘要压缩

定期将历史对话压缩为摘要。

```javascript
class SummaryManager {
  constructor(client, summaryThreshold = 5) {
    this.client = client;
    this.summaryThreshold = summaryThreshold;
    this.summary = "";
    this.recentHistory = [];
  }
  
  async addTurn(userMessage, assistantMessage) {
    this.recentHistory.push({ user: userMessage, assistant: assistantMessage });
    
    // 达到阈值时，生成摘要
    if (this.recentHistory.length >= this.summaryThreshold) {
      await this.compressTurn();
    }
  }
  
  async compressTurn() {
    const historyText = this.recentHistory
      .map(t => `用户: ${t.user}\n助手: ${t.assistant}`)
      .join('\n\n');
    
    const newSummary = await this.client.chat.completions.create({
      model: "gpt-3.5-turbo",  // 用便宜的模型做摘要
      messages: [
        {
          role: "system",
          content: "请将以下对话历史压缩为简洁的摘要，保留关键信息和决策。"
        },
        {
          role: "user",
          content: `之前的摘要：${this.summary || "无"}\n\n新对话：\n${historyText}`
        }
      ],
      max_tokens: 500
    });
    
    this.summary = newSummary.choices[0].message.content;
    this.recentHistory = [];
  }
  
  getMessages(systemPrompt, currentInput) {
    const messages = [{ role: "system", content: systemPrompt }];
    
    // 添加摘要（如有）
    if (this.summary) {
      messages.push({
        role: "system",
        content: `对话历史摘要：${this.summary}`
      });
    }
    
    // 添加最近历史
    for (const turn of this.recentHistory) {
      messages.push({ role: "user", content: turn.user });
      messages.push({ role: "assistant", content: turn.assistant });
    }
    
    // 添加当前输入
    messages.push({ role: "user", content: currentInput });
    
    return messages;
  }
}
```

### 策略 3：Token 预算管理

精确控制每部分的 token 预算。

```javascript
class TokenBudgetManager {
  constructor(maxTokens, budgetAllocation) {
    this.maxTokens = maxTokens;
    this.budget = budgetAllocation;
    // 例如：{ system: 0.1, context: 0.4, history: 0.3, output: 0.2 }
  }
  
  allocate() {
    return {
      system: Math.floor(this.maxTokens * this.budget.system),
      context: Math.floor(this.maxTokens * this.budget.context),
      history: Math.floor(this.maxTokens * this.budget.history),
      output: Math.floor(this.maxTokens * this.budget.output),
    };
  }
  
  fitTobudget(content, budget) {
    const currentTokens = countTokens(content);
    
    if (currentTokens <= budget) {
      return content;
    }
    
    // 截断策略：优先保留开头和结尾
    const ratio = budget / currentTokens;
    const keepFromStart = Math.floor(content.length * ratio * 0.7);
    const keepFromEnd = Math.floor(content.length * ratio * 0.3);
    
    return content.slice(0, keepFromStart) + 
           "\n...[内容已截断]...\n" + 
           content.slice(-keepFromEnd);
  }
  
  buildMessages(systemPrompt, context, history, userInput) {
    const allocation = this.allocate();
    
    return [
      { 
        role: "system", 
        content: this.fitTobudget(systemPrompt, allocation.system) 
      },
      { 
        role: "system", 
        content: `相关上下文：\n${this.fitTobudget(context, allocation.context)}` 
      },
      ...this.fitHistoryTobudget(history, allocation.history),
      { role: "user", content: userInput }
    ];
  }
  
  fitHistoryTobudget(history, budget) {
    const messages = [];
    let usedTokens = 0;
    
    // 从最近的开始添加
    for (let i = history.length - 1; i >= 0; i--) {
      const turn = history[i];
      const turnTokens = countTokens(turn.user + turn.assistant);
      
      if (usedTokens + turnTokens > budget) break;
      
      messages.unshift(
        { role: "user", content: turn.user },
        { role: "assistant", content: turn.assistant }
      );
      usedTokens += turnTokens;
    }
    
    return messages;
  }
}
```

### 策略 4：RAG（检索增强生成）

不把所有信息放入上下文，而是动态检索相关内容。

```javascript
class RAGManager {
  constructor(vectorStore, topK = 5) {
    this.vectorStore = vectorStore;
    this.topK = topK;
  }
  
  async buildContext(query) {
    // 1. 检索最相关的文档片段
    const relevantChunks = await this.vectorStore.search(query, this.topK);
    
    // 2. 组装上下文
    const context = relevantChunks
      .map(chunk => `[来源: ${chunk.source}]\n${chunk.content}`)
      .join('\n\n---\n\n');
    
    return context;
  }
  
  async buildMessages(systemPrompt, userQuery) {
    const context = await this.buildContext(userQuery);
    
    return [
      { role: "system", content: systemPrompt },
      {
        role: "system",
        content: `以下是与用户问题相关的参考资料：\n\n${context}\n\n请基于以上资料回答用户问题。如果资料中没有相关信息，请明确说明。`
      },
      { role: "user", content: userQuery }
    ];
  }
}
```

---

## 📋 内容压缩技术

### 技术 1：文本摘要

```javascript
async function summarizeContent(content, targetLength = 500) {
  if (countTokens(content) <= targetLength) {
    return content;
  }
  
  const response = await client.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: `请将以下内容压缩到约 ${targetLength} token，保留关键信息。`
      },
      { role: "user", content: content }
    ],
    max_tokens: targetLength
  });
  
  return response.choices[0].message.content;
}
```

### 技术 2：结构化提取

将非结构化内容转为结构化，更紧凑。

```javascript
async function extractStructured(document) {
  const response = await client.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: "提取文档的关键信息，输出 JSON 格式。"
      },
      { role: "user", content: document }
    ],
    response_format: { type: "json_object" }
  });
  
  return JSON.parse(response.choices[0].message.content);
}

// 原文：1000 token 的会议记录
// 压缩后：
{
  "date": "2024-03-15",
  "participants": ["Alice", "Bob", "Carol"],
  "decisions": [
    "采用 React 技术栈",
    "下周一完成设计评审"
  ],
  "action_items": [
    { "owner": "Alice", "task": "编写技术方案", "due": "3/18" }
  ]
}
// 约 100 token
```

### 技术 3：代码压缩

```javascript
function compressCode(code, options = {}) {
  const { keepComments = false, keepTypes = true } = options;
  
  let compressed = code;
  
  // 移除注释
  if (!keepComments) {
    compressed = compressed.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
  }
  
  // 移除空行
  compressed = compressed.replace(/^\s*[\r\n]/gm, '');
  
  // 压缩空格
  compressed = compressed.replace(/\s+/g, ' ');
  
  return compressed.trim();
}

// 或者只提取函数签名
function extractSignatures(code) {
  // 提取函数签名，不包含实现
  const signaturePattern = /(?:export\s+)?(?:async\s+)?function\s+\w+\([^)]*\)(?::\s*[^{]+)?/g;
  return code.match(signaturePattern) || [];
}
```

---

## ⚠️ 常见陷阱

### 陷阱 1：Lost in the Middle

研究表明，LLM 对上下文中间部分的关注度较低。

```
上下文位置 vs 注意力：
开头 ████████████████ 高
中间 ████ 低
结尾 ██████████████ 较高
```

**解法**：重要信息放在开头和结尾

```javascript
function optimizeContextOrder(items) {
  // 按重要性排序后，交替放置
  const sorted = items.sort((a, b) => b.importance - a.importance);
  const result = [];
  
  for (let i = 0; i < sorted.length; i++) {
    if (i % 2 === 0) {
      result.unshift(sorted[i]);  // 放开头
    } else {
      result.push(sorted[i]);     // 放结尾
    }
  }
  
  return result;
}
```

### 陷阱 2：上下文污染

无关信息干扰模型判断。

```javascript
// ❌ 塞入太多无关信息
const context = getAllUserData(userId);  // 包含很多无关字段

// ✅ 只选择相关信息
const context = {
  name: user.name,
  recentOrders: user.orders.slice(-3),
  preferences: user.preferences
};
```

### 陷阱 3：硬截断导致信息丢失

```javascript
// ❌ 简单截断可能切断重要信息
const truncated = content.slice(0, maxLength);

// ✅ 智能截断：保持完整性
function smartTruncate(content, maxTokens) {
  const tokens = encode(content);
  
  if (tokens.length <= maxTokens) {
    return content;
  }
  
  // 找到最近的句子边界
  const truncatedTokens = tokens.slice(0, maxTokens);
  let text = decode(truncatedTokens);
  
  // 回退到最后一个完整句子
  const lastSentence = text.lastIndexOf('。');
  if (lastSentence > text.length * 0.8) {
    text = text.slice(0, lastSentence + 1);
  }
  
  return text + '\n[内容已截断]';
}
```

---

## 💡 实践建议

### 估算公式

```javascript
// 预留足够的输出空间
const safeInputLimit = modelContextWindow - expectedOutputTokens - buffer;

// 例如：128K 窗口，期望输出 4K，预留 2K 缓冲
const safeInputLimit = 128000 - 4000 - 2000;  // = 122000
```

### 监控上下文使用

```javascript
class ContextMonitor {
  constructor(modelLimit) {
    this.modelLimit = modelLimit;
    this.stats = [];
  }
  
  record(inputTokens, outputTokens) {
    this.stats.push({
      timestamp: Date.now(),
      inputTokens,
      outputTokens,
      utilization: (inputTokens + outputTokens) / this.modelLimit
    });
  }
  
  getReport() {
    return {
      avgUtilization: average(this.stats.map(s => s.utilization)),
      maxUtilization: Math.max(...this.stats.map(s => s.utilization)),
      nearLimitCount: this.stats.filter(s => s.utilization > 0.9).length
    };
  }
}
```

---

## 📚 相关笔记

- [LLM API 使用最佳实践](llm-api-best-practices.md)
- [提示词工程基础](../prompting/prompt-engineering-fundamentals.md)
- [常见问题与解决方案](../troubleshooting/common-llm-issues.md)

---

## 参考资料

- [Lost in the Middle](https://arxiv.org/abs/2307.03172)
- [RAG Overview](https://docs.llamaindex.ai/en/stable/getting_started/concepts/)
- [Context Window Best Practices](https://platform.openai.com/docs/guides/text-generation/chat-completions-api)

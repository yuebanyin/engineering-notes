# LLM API 使用最佳实践

> 作为前端开发者，使用 LLM 主要是通过 API 调用。这篇笔记记录了 API 使用中的关键参数、错误处理、成本控制等实践经验。

---

## 🎯 核心概念

### API 调用的基本结构

```javascript
// 典型的 LLM API 调用
const response = await client.chat.completions.create({
  // 模型选择
  model: "gpt-4",
  
  // 消息历史
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Hello!" }
  ],
  
  // 生成参数
  temperature: 0.7,
  max_tokens: 1000,
  
  // 高级选项
  stream: false,
  tools: [],
});
```

### 关键参数详解

#### Temperature（温度）

控制输出的随机性。

| 值 | 效果 | 适用场景 |
|---|------|----------|
| 0 | 几乎确定性 | 代码生成、事实问答 |
| 0.3-0.5 | 低随机性 | 文档生成、摘要 |
| 0.7-0.9 | 中等随机性 | 创意写作、头脑风暴 |
| 1.0+ | 高随机性 | 创意探索（谨慎使用） |

```javascript
// 代码生成：用低温度
const codeResponse = await client.chat.completions.create({
  model: "gpt-4",
  temperature: 0.2,  // 低温度，确保代码稳定
  messages: [/* ... */]
});

// 创意建议：用较高温度
const ideaResponse = await client.chat.completions.create({
  model: "gpt-4",
  temperature: 0.8,  // 较高温度，增加多样性
  messages: [/* ... */]
});
```

#### Max Tokens（最大输出长度）

限制输出的 token 数量。

```javascript
// 需要长输出的场景
const longResponse = await client.chat.completions.create({
  max_tokens: 4000,  // 允许长输出
  // ...
});

// 短回复场景
const shortResponse = await client.chat.completions.create({
  max_tokens: 100,   // 限制输出长度
  // ...
});
```

**注意**：
- max_tokens 是输出限制，不包括输入
- 达到限制会突然截断，不一定是完整的句子
- 需要估算并留足余量

#### Top P（核采样）

另一种控制随机性的方式，通常与 temperature 二选一。

```javascript
// 通常不同时调整 temperature 和 top_p
const response = await client.chat.completions.create({
  temperature: 1,     // 默认
  top_p: 0.9,         // 只考虑累积概率前 90% 的 token
  // ...
});
```

---

## 📋 消息结构设计

### 角色类型

```javascript
const messages = [
  // system: 设定 AI 的行为规则
  {
    role: "system",
    content: `你是一个代码审查专家，擅长发现 JavaScript 代码中的问题。
    
    规则：
    - 每次只指出最关键的 3 个问题
    - 提供具体的修改建议
    - 用中文回复`
  },
  
  // user: 用户输入
  {
    role: "user",
    content: "请审查这段代码：..."
  },
  
  // assistant: 模型之前的回复（多轮对话）
  {
    role: "assistant",
    content: "这段代码有以下问题..."
  },
  
  // tool: 工具调用的结果
  {
    role: "tool",
    tool_call_id: "call_123",
    content: '{"result": "success"}'
  }
];
```

### System Prompt 设计

```javascript
// ✅ 结构化的 System Prompt
const systemPrompt = `
# 角色
你是一个资深前端开发专家，专注于 React 和 TypeScript。

# 能力
- 代码审查和优化建议
- 架构设计咨询
- 性能问题诊断

# 规则
1. 用中文回复
2. 代码示例使用 TypeScript
3. 如果问题超出能力范围，诚实说明

# 输出格式
对于代码问题，使用以下格式：
## 问题
[问题描述]

## 建议
[解决方案]

## 代码
\`\`\`typescript
[修改后的代码]
\`\`\`
`;
```

### 多轮对话管理

```javascript
class ConversationManager {
  constructor(systemPrompt, maxHistory = 20) {
    this.systemPrompt = systemPrompt;
    this.maxHistory = maxHistory;
    this.history = [];
  }
  
  addUserMessage(content) {
    this.history.push({ role: "user", content });
    this._trimHistory();
  }
  
  addAssistantMessage(content) {
    this.history.push({ role: "assistant", content });
    this._trimHistory();
  }
  
  getMessages() {
    return [
      { role: "system", content: this.systemPrompt },
      ...this.history
    ];
  }
  
  _trimHistory() {
    // 保留最近的 N 轮对话
    if (this.history.length > this.maxHistory * 2) {
      this.history = this.history.slice(-this.maxHistory * 2);
    }
  }
  
  estimateTokens() {
    // 粗略估算 token 数量
    const text = this.systemPrompt + 
      this.history.map(m => m.content).join('');
    return Math.ceil(text.length / 4);  // 英文约 4 字符一个 token
  }
}
```

---

## 🔧 流式响应

### 为什么使用流式

- **更好的用户体验**：用户立即看到输出开始
- **更快的感知速度**：首字节时间 < 完整响应时间
- **长输出友好**：不需要等待完整生成

### 实现示例

```javascript
// Node.js 环境
async function streamChat(messages) {
  const stream = await client.chat.completions.create({
    model: "gpt-4",
    messages,
    stream: true,
  });
  
  let fullContent = '';
  
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content || '';
    fullContent += content;
    
    // 实时输出
    process.stdout.write(content);
  }
  
  return fullContent;
}

// 浏览器环境 + React
function useChatStream() {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const sendMessage = async (messages) => {
    setIsLoading(true);
    setContent('');
    
    const response = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages }),
    });
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      setContent(prev => prev + chunk);
    }
    
    setIsLoading(false);
  };
  
  return { content, isLoading, sendMessage };
}
```

---

## ⚠️ 错误处理

### 常见错误类型

```javascript
async function callWithErrorHandling(messages) {
  try {
    return await client.chat.completions.create({
      model: "gpt-4",
      messages,
    });
  } catch (error) {
    // 速率限制
    if (error.status === 429) {
      const retryAfter = error.headers?.['retry-after'] || 60;
      throw new RateLimitError(`Rate limited. Retry after ${retryAfter}s`);
    }
    
    // 上下文过长
    if (error.code === 'context_length_exceeded') {
      throw new ContextLengthError('Input too long. Please reduce content.');
    }
    
    // 模型不可用
    if (error.status === 503) {
      throw new ModelUnavailableError('Model temporarily unavailable.');
    }
    
    // API Key 问题
    if (error.status === 401) {
      throw new AuthenticationError('Invalid API key.');
    }
    
    // 其他错误
    throw new LLMError(`API Error: ${error.message}`);
  }
}
```

### 重试策略

```javascript
async function callWithRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 60000,
    retryableErrors = [429, 503, 500]
  } = options;
  
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // 检查是否可重试
      if (!retryableErrors.includes(error.status)) {
        throw error;
      }
      
      // 计算延迟（指数退避 + 抖动）
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
        maxDelay
      );
      
      console.log(`Attempt ${attempt + 1} failed. Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }
  
  throw lastError;
}

// 使用
const response = await callWithRetry(() => 
  client.chat.completions.create({ model: "gpt-4", messages })
);
```

---

## 💰 成本控制

### Token 估算

```javascript
// 简单估算（粗略）
function estimateTokens(text) {
  // 英文约 4 字符一个 token
  // 中文约 1.5 字符一个 token
  const hasChineseChars = /[\u4e00-\u9fa5]/.test(text);
  return Math.ceil(text.length / (hasChineseChars ? 1.5 : 4));
}

// 使用 tiktoken 精确计算（推荐）
import { encoding_for_model } from 'tiktoken';

function countTokens(text, model = 'gpt-4') {
  const enc = encoding_for_model(model);
  const tokens = enc.encode(text);
  enc.free();
  return tokens.length;
}
```

### 成本计算

```javascript
// 各模型价格（示例，请查阅最新定价）
const PRICING = {
  'gpt-4': { input: 0.03, output: 0.06 },          // per 1K tokens
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'claude-3-opus': { input: 0.015, output: 0.075 },
  'claude-3-sonnet': { input: 0.003, output: 0.015 },
};

function estimateCost(inputTokens, outputTokens, model) {
  const pricing = PRICING[model];
  if (!pricing) return null;
  
  return {
    inputCost: (inputTokens / 1000) * pricing.input,
    outputCost: (outputTokens / 1000) * pricing.output,
    totalCost: (inputTokens / 1000) * pricing.input + 
               (outputTokens / 1000) * pricing.output
  };
}
```

### 成本优化策略

| 策略 | 说明 | 节省比例 |
|------|------|----------|
| 模型降级 | 简单任务用 3.5 而非 4 | 50-90% |
| 压缩 prompt | 精简 system prompt | 10-30% |
| 缓存响应 | 相同输入复用结果 | 变化大 |
| 限制输出 | 设置合理的 max_tokens | 10-50% |
| 批量处理 | 合并多个请求 | API 费用不变，但减少开销 |

```javascript
// 响应缓存示例
class LLMCache {
  constructor(storage, ttl = 3600) {
    this.storage = storage;
    this.ttl = ttl;
  }
  
  async get(key) {
    const cached = await this.storage.get(key);
    if (cached && Date.now() - cached.timestamp < this.ttl * 1000) {
      return cached.response;
    }
    return null;
  }
  
  async set(key, response) {
    await this.storage.set(key, {
      response,
      timestamp: Date.now()
    });
  }
  
  getCacheKey(messages, model, temperature) {
    // 对于 temperature=0 的确定性请求，可以缓存
    if (temperature > 0) return null;
    return crypto
      .createHash('md5')
      .update(JSON.stringify({ messages, model }))
      .digest('hex');
  }
}
```

---

## 📊 监控与日志

### 请求日志

```javascript
class LLMLogger {
  async logRequest(request, response, metadata = {}) {
    const log = {
      timestamp: new Date().toISOString(),
      requestId: generateId(),
      
      // 请求信息
      model: request.model,
      inputTokens: response.usage.prompt_tokens,
      outputTokens: response.usage.completion_tokens,
      
      // 性能信息
      latency: metadata.latency,
      
      // 成本信息
      cost: estimateCost(
        response.usage.prompt_tokens,
        response.usage.completion_tokens,
        request.model
      ).totalCost,
      
      // 业务信息
      feature: metadata.feature,
      userId: metadata.userId,
    };
    
    await this.save(log);
  }
  
  async getStats(timeRange) {
    const logs = await this.query(timeRange);
    
    return {
      totalRequests: logs.length,
      totalTokens: sum(logs, l => l.inputTokens + l.outputTokens),
      totalCost: sum(logs, l => l.cost),
      avgLatency: average(logs, l => l.latency),
      modelDistribution: groupBy(logs, l => l.model),
    };
  }
}
```

### 监控指标

| 指标 | 描述 | 告警阈值建议 |
|------|------|-------------|
| 请求延迟 | API 响应时间 | P99 > 30s |
| 错误率 | 失败请求比例 | > 5% |
| Token 使用量 | 日/月 token 消耗 | 接近配额 80% |
| 成本 | 日/月费用 | 超预算 |
| 429 频率 | 速率限制触发次数 | > 10/min |

---

## 💡 实践经验

### 模型选择策略

```javascript
function selectModel(task) {
  const modelMatrix = {
    // 简单任务：用便宜快速的模型
    'simple_qa': 'gpt-3.5-turbo',
    'classification': 'gpt-3.5-turbo',
    'extraction': 'gpt-3.5-turbo',
    
    // 复杂任务：用强大的模型
    'code_generation': 'gpt-4',
    'complex_reasoning': 'gpt-4',
    'creative_writing': 'gpt-4',
    
    // 长文本：用大上下文模型
    'document_analysis': 'gpt-4-turbo',
    'long_summarization': 'claude-3-sonnet',
  };
  
  return modelMatrix[task] || 'gpt-3.5-turbo';
}
```

### 请求优化清单

- [ ] 是否可以缓存？（温度=0 且输入稳定）
- [ ] 是否可以用更便宜的模型？
- [ ] System prompt 是否精简？
- [ ] 是否需要完整的历史对话？
- [ ] max_tokens 是否设置合理？
- [ ] 是否需要流式响应？

---

## 📚 相关笔记

- [提示词工程基础](../prompting/prompt-engineering-fundamentals.md)
- [上下文窗口管理](context-window-management.md)
- [常见问题与解决方案](../troubleshooting/common-llm-issues.md)

---

## 参考资料

- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [Anthropic API Documentation](https://docs.anthropic.com/)
- [tiktoken](https://github.com/openai/tiktoken)

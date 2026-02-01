# 常见 LLM 问题与解决方案

> 这篇笔记记录了 LLM 应用中常见的问题和调试方法。不是理论分析，而是"遇到问题 → 怎么排查 → 怎么解决"的实用指南。

---

## 📋 问题速查表

| 问题 | 可能原因 | 跳转 |
|------|----------|------|
| 输出与事实不符 | 幻觉 | [问题 1](#问题-1幻觉hallucination) |
| JSON 格式不对 | 格式不稳定 | [问题 2](#问题-2输出格式不稳定) |
| 响应太慢 | 延迟问题 | [问题 3](#问题-3延迟过高) |
| 费用超预期 | 成本失控 | [问题 4](#问题-4成本失控) |
| 回复被截断 | Token 限制 | [问题 5](#问题-5输出被截断) |
| 每次结果不一样 | 随机性 | [问题 6](#问题-6输出不稳定) |
| 忽略部分指令 | 指令遵循差 | [问题 7](#问题-7指令遵循不佳) |
| API 频繁报错 | 速率限制 | [问题 8](#问题-8速率限制) |

---

## 问题 1：幻觉（Hallucination）

### 症状
- 模型编造不存在的事实
- 引用虚假的来源/链接
- 对不知道的问题胡编乱造

### 原因分析
LLM 是"模式匹配器"，不是"知识库"。它倾向于生成"看起来合理"的内容，而不是"验证过的事实"。

### 排查方法
```javascript
// 检测幻觉的信号
const hallucinationSignals = [
  "具体的数字（如：87.3%）没有来源",
  "详细的引用/链接无法验证",
  "对未知领域过度自信",
  "前后信息矛盾"
];
```

### 解决方案

#### 方案 1：提供参考资料（RAG）
```markdown
## System Prompt
你是一个问答助手。请仅基于以下参考资料回答问题。
如果资料中没有相关信息，请明确说"我没有足够的信息来回答这个问题"。

## 参考资料
[在这里放入检索到的相关文档]

## 用户问题
{用户输入}
```

#### 方案 2：引导承认不确定性
```markdown
## System Prompt
回答问题时：
1. 如果你确定，直接回答
2. 如果你不确定，说"我不太确定，但..."
3. 如果你不知道，说"我不知道"

不要编造具体的数字、日期、链接或引用。
```

#### 方案 3：要求引用来源
```markdown
## System Prompt
每个陈述都需要说明来源：
- [来自用户提供的资料] 
- [通用知识]
- [推测]

如果是推测，明确标注。
```

#### 方案 4：验证管道
```javascript
async function validateOutput(output, context) {
  // 用另一个调用验证输出
  const validation = await client.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "检查以下内容是否与给定的参考资料一致。标记任何无法验证的声明。"
      },
      {
        role: "user",
        content: `参考资料：${context}\n\n待验证内容：${output}`
      }
    ]
  });
  
  return validation;
}
```

---

## 问题 2：输出格式不稳定

### 症状
- 要求输出 JSON，但格式错误
- 多余的解释文字包裹 JSON
- 字段名不一致

### 原因分析
- Prompt 中格式要求不够明确
- Temperature 太高导致变化大
- 没有使用结构化输出模式

### 解决方案

#### 方案 1：使用 JSON Mode（推荐）
```javascript
// OpenAI
const response = await client.chat.completions.create({
  model: "gpt-4-turbo",
  messages: [...],
  response_format: { type: "json_object" }
});

// 注意：需要在 prompt 中说明期望的 JSON 结构
```

#### 方案 2：明确的格式示例
```markdown
请输出 JSON 格式，严格遵循以下结构：

{
  "summary": "string, 简短摘要",
  "key_points": ["string", "string"],
  "sentiment": "positive | negative | neutral"
}

只输出 JSON，不要包含任何其他文字。
```

#### 方案 3：后处理提取
```javascript
function extractJSON(text) {
  // 尝试直接解析
  try {
    return JSON.parse(text);
  } catch (e) {}
  
  // 提取 JSON 块
  const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch (e) {}
  }
  
  // 提取花括号内容
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]);
    } catch (e) {}
  }
  
  throw new Error('Failed to extract JSON');
}
```

#### 方案 4：验证和重试
```javascript
async function getStructuredOutput(prompt, schema, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await client.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });
    
    try {
      const data = JSON.parse(response.choices[0].message.content);
      
      // 验证 schema
      const valid = validateSchema(data, schema);
      if (valid) return data;
      
    } catch (e) {
      console.log(`Attempt ${attempt + 1} failed:`, e.message);
    }
  }
  
  throw new Error('Failed to get valid structured output');
}
```

---

## 问题 3：延迟过高

### 症状
- API 响应时间 > 10秒
- 用户等待时间过长
- 体验差

### 排查路径
```
延迟高
  │
  ├─ 输入太长？ → 压缩上下文
  │
  ├─ 输出太长？ → 限制 max_tokens
  │
  ├─ 模型太大？ → 换用更小的模型
  │
  ├─ 网络问题？ → 检查地区/代理
  │
  └─ API 拥堵？ → 使用流式输出提升体感
```

### 解决方案

#### 方案 1：流式输出
```javascript
// 使用流式，用户立即看到输出开始
const stream = await client.chat.completions.create({
  model: "gpt-4",
  messages: [...],
  stream: true
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
```

#### 方案 2：模型降级
```javascript
function selectModelByLatency(task) {
  // 对延迟敏感的任务用快速模型
  if (task.latencySensitive) {
    return "gpt-3.5-turbo";  // 更快
  }
  return "gpt-4";  // 更好但更慢
}
```

#### 方案 3：并行请求
```javascript
// 如果可以拆分，并行处理
async function processInParallel(items, processFn) {
  return Promise.all(items.map(item => processFn(item)));
}

// 例如：并行分析多个文档
const results = await processInParallel(documents, analyzeDocument);
```

#### 方案 4：缓存
```javascript
// 对相同输入缓存结果
const cache = new Map();

async function cachedCompletion(messages, cacheKey) {
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }
  
  const response = await client.chat.completions.create({
    model: "gpt-4",
    messages,
    temperature: 0  // 确定性输出才能缓存
  });
  
  cache.set(cacheKey, response);
  return response;
}
```

---

## 问题 4：成本失控

### 症状
- API 费用超出预期
- 账单飙升

### 排查方法
```javascript
// 追踪每次调用的成本
function trackCost(response, model) {
  const pricing = {
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  };
  
  const p = pricing[model];
  const cost = 
    (response.usage.prompt_tokens / 1000) * p.input +
    (response.usage.completion_tokens / 1000) * p.output;
  
  console.log(`Cost: $${cost.toFixed(4)}`);
  return cost;
}
```

### 解决方案

#### 方案 1：设置预算告警
```javascript
class BudgetManager {
  constructor(dailyLimit) {
    this.dailyLimit = dailyLimit;
    this.dailySpent = 0;
  }
  
  async trackAndCheck(cost) {
    this.dailySpent += cost;
    
    if (this.dailySpent > this.dailyLimit * 0.8) {
      await this.alert('Budget warning: 80% used');
    }
    
    if (this.dailySpent >= this.dailyLimit) {
      throw new Error('Daily budget exceeded');
    }
  }
}
```

#### 方案 2：智能模型选择
```javascript
async function smartCompletion(task) {
  // 先用便宜模型尝试
  const quickResponse = await client.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: task.messages,
  });
  
  // 检查质量
  if (await isQualitySufficient(quickResponse, task)) {
    return quickResponse;
  }
  
  // 质量不够，升级到强模型
  return client.chat.completions.create({
    model: "gpt-4",
    messages: task.messages,
  });
}
```

#### 方案 3：压缩输入
```javascript
// 精简 system prompt
const verbosePrompt = "你是一个非常专业的..."  // 500 tokens
const concisePrompt = "你是代码审查专家。规则：..."  // 100 tokens

// 压缩历史对话
const recentHistory = history.slice(-5);  // 只保留最近 5 轮
```

---

## 问题 5：输出被截断

### 症状
- 回复在中间突然停止
- 代码块不完整
- 句子没写完

### 原因
- `max_tokens` 设置太小
- 达到模型的输出上限
- 触发内容过滤

### 解决方案

#### 方案 1：调整 max_tokens
```javascript
const response = await client.chat.completions.create({
  model: "gpt-4",
  messages: [...],
  max_tokens: 4000,  // 增加输出限制
});

// 检查是否因为 max_tokens 截断
if (response.choices[0].finish_reason === 'length') {
  console.warn('Output was truncated due to max_tokens');
}
```

#### 方案 2：续写机制
```javascript
async function completeWithContinuation(messages, maxIterations = 3) {
  let fullContent = '';
  let currentMessages = [...messages];
  
  for (let i = 0; i < maxIterations; i++) {
    const response = await client.chat.completions.create({
      model: "gpt-4",
      messages: currentMessages,
      max_tokens: 4000,
    });
    
    const content = response.choices[0].message.content;
    fullContent += content;
    
    if (response.choices[0].finish_reason === 'stop') {
      break;  // 正常结束
    }
    
    // 继续生成
    currentMessages.push(
      { role: "assistant", content },
      { role: "user", content: "请继续" }
    );
  }
  
  return fullContent;
}
```

#### 方案 3：拆分任务
```javascript
// 不要一次生成很长的内容
// 拆分成多个小任务

// ❌ 一次生成整个文档
const doc = await generate("写一篇完整的技术文档...");

// ✅ 分步生成
const outline = await generate("生成文档大纲");
const sections = [];
for (const section of outline) {
  sections.push(await generate(`写这一节的内容：${section}`));
}
```

---

## 问题 6：输出不稳定

### 症状
- 同样的输入，每次结果不同
- 难以复现问题
- 测试不稳定

### 解决方案

#### 方案 1：降低 Temperature
```javascript
const response = await client.chat.completions.create({
  model: "gpt-4",
  messages: [...],
  temperature: 0,  // 最确定性的输出
});
```

#### 方案 2：设置 Seed（如果支持）
```javascript
// OpenAI 支持 seed 参数
const response = await client.chat.completions.create({
  model: "gpt-4",
  messages: [...],
  seed: 12345,  // 固定种子
});
```

#### 方案 3：设计容错的评估
```javascript
// 不要精确匹配，而是语义检查
function evaluateOutput(output, expectedPattern) {
  // 检查是否包含关键信息
  const keyPoints = ['React', 'useEffect', 'cleanup'];
  return keyPoints.every(point => 
    output.toLowerCase().includes(point.toLowerCase())
  );
}
```

---

## 问题 7：指令遵循不佳

### 症状
- 忽略部分指令
- 输出格式不符合要求
- 做了不该做的事

### 解决方案

#### 方案 1：指令放在明显位置
```markdown
## 重要规则（必须遵守）
1. 只输出 JSON，不要任何解释
2. 不要编造链接

## 任务
...
```

#### 方案 2：分步执行
```javascript
// ❌ 一次性给太多指令
"分析代码，找出问题，修复它们，写测试，更新文档"

// ✅ 分步执行
const analysis = await generate("分析代码，列出问题");
const fixes = await generate(`针对这些问题：${analysis}，提供修复方案`);
const tests = await generate(`为修复后的代码写测试`);
```

#### 方案 3：验证输出
```javascript
async function getValidOutput(prompt, validator, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await generate(prompt);
    
    const validation = validator(response);
    if (validation.valid) {
      return response;
    }
    
    // 告诉模型哪里不对
    prompt += `\n\n上次输出不符合要求：${validation.error}\n请重新生成。`;
  }
  
  throw new Error('Failed to get valid output');
}
```

---

## 问题 8：速率限制

### 症状
- 429 错误频繁出现
- 请求被拒绝

### 解决方案

#### 方案 1：指数退避重试
```javascript
async function retryWithBackoff(fn, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status !== 429) throw error;
      
      const delay = Math.min(1000 * Math.pow(2, i), 60000);
      await sleep(delay);
    }
  }
  throw new Error('Max retries exceeded');
}
```

#### 方案 2：请求队列
```javascript
import PQueue from 'p-queue';

const queue = new PQueue({
  concurrency: 5,        // 最大并发
  interval: 1000,        // 时间窗口
  intervalCap: 10,       // 窗口内最大请求数
});

async function rateLimitedCall(messages) {
  return queue.add(() => 
    client.chat.completions.create({
      model: "gpt-4",
      messages,
    })
  );
}
```

---

## 💡 通用调试清单

遇到 LLM 问题时，按顺序检查：

- [ ] Temperature 是否合适？
- [ ] Prompt 是否清晰、结构化？
- [ ] 是否提供了足够的示例？
- [ ] 输出格式是否明确指定？
- [ ] max_tokens 是否足够？
- [ ] 是否有上下文过长的问题？
- [ ] 是否可以用更简单的模型？
- [ ] 是否需要分步执行？

---

## 📚 相关笔记

- [提示词工程基础](../prompting/prompt-engineering-fundamentals.md)
- [LLM API 使用最佳实践](../llm/llm-api-best-practices.md)
- [LLM 评估框架](../evaluation/llm-evaluation-framework.md)

---

## 参考资料

- [OpenAI Error Codes](https://platform.openai.com/docs/guides/error-codes)
- [Anthropic Claude Troubleshooting](https://docs.anthropic.com/claude/docs/troubleshooting)
- [LLM Hallucination Mitigation](https://www.anthropic.com/research/reducing-hallucinations)

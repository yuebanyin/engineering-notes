# 工具使用与函数调用实践

> 工具使用（Tool Use）是让 LLM 从"只能说"变成"能做事"的关键能力。这篇笔记记录了工具定义、调用模式、错误处理的实践经验。

---

## 🎯 核心概念

### 什么是 Tool Use

**Tool Use = LLM 决策 + 程序执行**

```
用户：帮我查一下深圳明天的天气

LLM 思考：用户想知道天气，我需要调用 get_weather 工具

LLM 输出（结构化）：
{
  "tool": "get_weather",
  "arguments": { "city": "深圳", "date": "明天" }
}

程序执行工具：
weather_api.get("深圳", "2024-03-16") → { temp: 22, condition: "晴" }

LLM 生成最终回复：
深圳明天天气晴朗，气温约 22℃，适合户外活动。
```

### 各平台的实现

| 平台 | 名称 | 特点 |
|------|------|------|
| OpenAI | Function Calling | 最早推出，生态完善 |
| Anthropic | Tool Use | 支持更复杂的工具嵌套 |
| Google | Function Calling | 类似 OpenAI |
| 开源模型 | 各有实现 | 能力参差不齐 |

---

## 📋 工具定义最佳实践

### 基础结构

```javascript
const tool = {
  // 工具名称：简洁、动词开头、snake_case
  name: "search_codebase",
  
  // 描述：完整说明用途和使用场景
  description: `
    在代码库中搜索代码片段。
    使用场景：
    - 查找函数或类的定义
    - 搜索特定代码模式
    - 定位文件位置
    返回匹配的文件路径和代码片段。
  `,
  
  // 参数定义：JSON Schema 格式
  parameters: {
    type: "object",
    required: ["query"],
    properties: {
      query: {
        type: "string",
        description: "搜索关键词或正则表达式"
      },
      file_pattern: {
        type: "string",
        description: "文件路径模式，如 '*.ts'。不指定则搜索所有文件。"
      },
      max_results: {
        type: "integer",
        description: "最大返回结果数",
        default: 10
      },
      context_lines: {
        type: "integer",
        description: "每个匹配前后显示的上下文行数",
        default: 3
      }
    }
  }
};
```

### 命名规范

```javascript
// ✅ 好的命名
"search_files"       // 动词_名词
"get_user_info"      // 动词_对象_属性
"create_document"    // 动词_对象
"run_tests"          // 动词_名词

// ❌ 不好的命名
"file_searcher"      // 名词（不是动作）
"getUser"            // 驼峰（不统一）
"search"             // 太模糊
"do_stuff"           // 无意义
```

### 描述编写技巧

```javascript
// ❌ 描述太简单
description: "搜索代码"

// ❌ 描述太冗长
description: "这是一个用于在代码库中进行全文搜索的工具函数，
它可以接受用户输入的查询字符串，然后遍历整个代码库...
（后面还有 500 字）"

// ✅ 恰到好处
description: `
在代码库中搜索代码片段。

适用于：
- 查找函数定义
- 搜索特定模式
- 定位文件

返回：匹配的文件路径和代码上下文。
`
```

### 参数设计原则

```javascript
// ✅ 好的参数设计
{
  // 必填参数放前面
  required: ["action", "target"],
  
  properties: {
    // 枚举类型明确选项
    action: {
      type: "string",
      enum: ["create", "update", "delete"],
      description: "要执行的操作类型"
    },
    
    // 有默认值的可选参数
    format: {
      type: "string",
      enum: ["json", "yaml", "xml"],
      default: "json",
      description: "输出格式，默认 json"
    },
    
    // 复杂参数用对象
    options: {
      type: "object",
      properties: {
        verbose: { type: "boolean", default: false },
        timeout: { type: "integer", default: 30 }
      }
    }
  }
}
```

---

## 🔧 调用模式

### 模式 1：单次调用

最简单的模式：一个请求，一次工具调用。

```javascript
// 用户请求
const userMessage = "深圳今天天气怎么样？";

// LLM 响应包含工具调用
const response = await llm.chat({
  messages: [{ role: "user", content: userMessage }],
  tools: [weatherTool]
});

if (response.tool_calls) {
  const call = response.tool_calls[0];
  
  // 执行工具
  const result = await executeWeather(call.arguments);
  
  // 将结果返回给 LLM 生成最终回复
  const finalResponse = await llm.chat({
    messages: [
      { role: "user", content: userMessage },
      { role: "assistant", tool_calls: response.tool_calls },
      { role: "tool", tool_call_id: call.id, content: JSON.stringify(result) }
    ]
  });
  
  return finalResponse.content;
}
```

### 模式 2：多次调用（并行）

LLM 一次请求多个工具，可以并行执行。

```javascript
// 用户请求
const userMessage = "比较深圳和北京的天气";

// LLM 可能返回多个工具调用
const response = await llm.chat({
  messages: [{ role: "user", content: userMessage }],
  tools: [weatherTool]
});

if (response.tool_calls && response.tool_calls.length > 1) {
  // 并行执行所有工具调用
  const results = await Promise.all(
    response.tool_calls.map(async (call) => ({
      id: call.id,
      result: await executeWeather(call.arguments)
    }))
  );
  
  // 将所有结果返回给 LLM
  const toolMessages = results.map(r => ({
    role: "tool",
    tool_call_id: r.id,
    content: JSON.stringify(r.result)
  }));
  
  const finalResponse = await llm.chat({
    messages: [
      { role: "user", content: userMessage },
      { role: "assistant", tool_calls: response.tool_calls },
      ...toolMessages
    ]
  });
}
```

### 模式 3：链式调用

一个工具的结果作为下一个工具的输入。

```javascript
// 用户请求
const userMessage = "帮我找到最近修改的文件，然后检查有没有语法错误";

// 循环直到 LLM 不再调用工具
let messages = [{ role: "user", content: userMessage }];

while (true) {
  const response = await llm.chat({
    messages,
    tools: [findFilesTool, checkSyntaxTool]
  });
  
  if (!response.tool_calls) {
    // 没有更多工具调用，返回最终回复
    return response.content;
  }
  
  // 添加助手消息
  messages.push({ role: "assistant", tool_calls: response.tool_calls });
  
  // 执行工具并添加结果
  for (const call of response.tool_calls) {
    const result = await executeTool(call.name, call.arguments);
    messages.push({
      role: "tool",
      tool_call_id: call.id,
      content: JSON.stringify(result)
    });
  }
}
```

### 模式 4：工具选择约束

有时需要强制或禁止使用特定工具。

```javascript
// 强制使用特定工具
const response = await llm.chat({
  messages,
  tools,
  tool_choice: { type: "function", function: { name: "search_code" } }
});

// 禁止使用工具（只回复文本）
const response = await llm.chat({
  messages,
  tools,
  tool_choice: "none"
});

// 让 LLM 自己决定（默认）
const response = await llm.chat({
  messages,
  tools,
  tool_choice: "auto"
});
```

---

## ⚠️ 错误处理

### 工具执行错误

```javascript
async function executeToolWithErrorHandling(name, args) {
  try {
    const result = await tools[name].execute(args);
    return {
      success: true,
      data: result
    };
  } catch (error) {
    // 返回结构化错误信息，让 LLM 理解并调整
    return {
      success: false,
      error: {
        type: error.name,
        message: error.message,
        suggestion: getSuggestion(error)
      }
    };
  }
}

function getSuggestion(error) {
  if (error.name === 'FileNotFoundError') {
    return '文件不存在，请检查路径是否正确，或使用 search_files 工具查找';
  }
  if (error.name === 'PermissionError') {
    return '没有权限访问，请尝试其他方式';
  }
  if (error.name === 'TimeoutError') {
    return '操作超时，请尝试缩小范围或稍后重试';
  }
  return '请检查参数并重试';
}
```

### 参数验证

```javascript
function validateToolCall(call, toolDefinition) {
  const { parameters } = toolDefinition;
  const args = call.arguments;
  
  // 检查必填参数
  for (const required of parameters.required || []) {
    if (!(required in args)) {
      return {
        valid: false,
        error: `缺少必填参数：${required}`
      };
    }
  }
  
  // 检查参数类型
  for (const [key, value] of Object.entries(args)) {
    const schema = parameters.properties[key];
    if (!schema) {
      return {
        valid: false,
        error: `未知参数：${key}`
      };
    }
    
    if (!validateType(value, schema.type)) {
      return {
        valid: false,
        error: `参数 ${key} 类型错误，期望 ${schema.type}`
      };
    }
  }
  
  return { valid: true };
}
```

### 重试策略

```javascript
async function executeWithRetry(call, maxRetries = 3) {
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await executeTool(call.name, call.arguments);
    } catch (error) {
      lastError = error;
      
      // 某些错误不应该重试
      if (!isRetryable(error)) {
        throw error;
      }
      
      // 指数退避
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await sleep(delay);
    }
  }
  
  throw lastError;
}

function isRetryable(error) {
  // 网络错误、超时等可以重试
  // 参数错误、权限错误不应该重试
  return ['NetworkError', 'TimeoutError', 'RateLimitError'].includes(error.name);
}
```

---

## 📊 工具设计模式

### 模式 1：CRUD 工具组

```javascript
// 一组相关的 CRUD 工具
const documentTools = [
  {
    name: "create_document",
    description: "创建新文档",
    parameters: {
      required: ["title", "content"],
      properties: {
        title: { type: "string" },
        content: { type: "string" },
        tags: { type: "array", items: { type: "string" } }
      }
    }
  },
  {
    name: "read_document",
    description: "读取文档内容",
    parameters: {
      required: ["id"],
      properties: {
        id: { type: "string" }
      }
    }
  },
  {
    name: "update_document",
    description: "更新文档",
    parameters: {
      required: ["id"],
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        content: { type: "string" }
      }
    }
  },
  {
    name: "delete_document",
    description: "删除文档",
    parameters: {
      required: ["id"],
      properties: {
        id: { type: "string" }
      }
    }
  }
];
```

### 模式 2：信息获取 + 执行分离

```javascript
// 查询类工具：安全，可以自由调用
const queryTools = [
  { name: "search_files", ... },
  { name: "get_file_content", ... },
  { name: "list_directory", ... },
  { name: "get_git_status", ... }
];

// 执行类工具：有副作用，需要确认
const mutationTools = [
  { name: "write_file", ... },
  { name: "delete_file", ... },
  { name: "run_command", ... },
  { name: "commit_changes", ... }
];

// 可以根据场景选择性提供
function getToolsForMode(mode) {
  if (mode === "readonly") {
    return queryTools;
  }
  if (mode === "full") {
    return [...queryTools, ...mutationTools];
  }
}
```

### 模式 3：分层工具

```javascript
// 高层工具（组合低层工具的能力）
{
  name: "refactor_function",
  description: "重构指定函数：分析→修改→验证",
  // LLM 调用这个，内部会使用多个低层工具
}

// 低层工具（原子操作）
{
  name: "read_file",
  name: "write_file",
  name: "run_tests",
  // 更细粒度的控制
}
```

---

## 💡 实践经验

### 工具数量控制

| 工具数量 | 效果 |
|----------|------|
| 1-5 个 | 最佳，LLM 选择准确 |
| 6-15 个 | 可行，需要清晰区分 |
| 15+ 个 | 容易混淆，考虑分组 |

**解法**：当工具多时，使用"工具路由"

```javascript
// 元工具：选择工具类别
{
  name: "select_tool_category",
  description: "选择工具类别",
  parameters: {
    properties: {
      category: {
        type: "string",
        enum: ["file_operations", "code_analysis", "git_operations", "testing"]
      }
    }
  }
}

// 然后根据类别加载具体工具
```

### 工具描述 A/B 测试

```javascript
// 版本 A
description: "搜索代码"

// 版本 B
description: "在代码库中搜索。用于：查找函数定义、搜索特定模式、定位文件位置。"

// 测试哪个版本让 LLM 更准确地选择和使用工具
```

### 日志和监控

```javascript
function wrapToolWithLogging(tool) {
  return {
    ...tool,
    execute: async (args) => {
      const startTime = Date.now();
      
      console.log(`[Tool] ${tool.name} 调用`, args);
      
      try {
        const result = await tool.execute(args);
        
        console.log(`[Tool] ${tool.name} 成功`, {
          duration: Date.now() - startTime,
          resultSize: JSON.stringify(result).length
        });
        
        return result;
      } catch (error) {
        console.error(`[Tool] ${tool.name} 失败`, {
          duration: Date.now() - startTime,
          error: error.message
        });
        
        throw error;
      }
    }
  };
}
```

---

## 📚 相关笔记

- [Agent 架构模式](agent-architecture-patterns.md)
- [LLM API 使用最佳实践](../llm/llm-api-best-practices.md)
- [常见问题与解决方案](../troubleshooting/common-llm-issues.md)

---

## 参考资料

- [OpenAI Function Calling Guide](https://platform.openai.com/docs/guides/function-calling)
- [Anthropic Tool Use Documentation](https://docs.anthropic.com/claude/docs/tool-use)
- [LangChain Tools](https://python.langchain.com/docs/modules/tools/)

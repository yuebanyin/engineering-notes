# LLM 输出评估框架

> 评估是 LLM 应用工程化的核心难题。"这个回复好不好"不再是主观判断，而是需要量化、可追溯、可迭代的过程。这篇笔记记录了我对 LLM 评估的理解和实践方法。

---

## 🎯 为什么评估很难

### LLM 输出的特点

| 特点 | 挑战 |
|------|------|
| **非确定性** | 同样的输入可能有不同的输出 |
| **多维度** | "好"有很多种含义：准确、完整、简洁、格式... |
| **主观性** | 不同用户对"好"的定义不同 |
| **上下文依赖** | 脱离场景很难判断好坏 |

### 传统测试 vs LLM 评估

| 传统测试 | LLM 评估 |
|----------|----------|
| 精确匹配 | 语义相似 |
| 通过/失败 | 程度/分数 |
| 确定性 | 概率性 |
| 一次验证 | 持续评估 |

---

## 📊 评估维度框架

### 核心维度

```
                    ┌─────────────────────┐
                    │     正确性          │
                    │ (Correctness)       │
                    └─────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   完整性     │    │    格式      │    │    风格      │
│(Completeness)│    │   (Format)   │    │   (Style)    │
└──────────────┘    └──────────────┘    └──────────────┘
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   安全性     │    │   实用性     │    │   效率       │
│  (Safety)    │    │ (Usefulness) │    │(Efficiency)  │
└──────────────┘    └──────────────┘    └──────────────┘
```

### 维度详解

#### 1. 正确性（Correctness）

**定义**：输出是否事实正确、逻辑正确

**子维度**：
- 事实准确：陈述的事实是否正确
- 逻辑一致：推理过程是否有逻辑错误
- 无幻觉：没有编造不存在的信息

**评估方法**：
```python
def evaluate_correctness(output, ground_truth=None, context=None):
    scores = {}
    
    # 如果有标准答案，检查关键信息
    if ground_truth:
        scores['factual_accuracy'] = check_key_facts(output, ground_truth)
    
    # 检查是否有明显的矛盾
    scores['logical_consistency'] = check_contradictions(output)
    
    # 如果有参考上下文，检查是否有超出范围的声明
    if context:
        scores['grounded'] = check_groundedness(output, context)
    
    return scores
```

#### 2. 完整性（Completeness）

**定义**：是否回答了用户的所有问题，覆盖了所有要点

**评估方法**：
```python
def evaluate_completeness(output, requirements):
    """
    requirements: 期望输出应包含的要点列表
    """
    covered = []
    missing = []
    
    for req in requirements:
        if requirement_covered(output, req):
            covered.append(req)
        else:
            missing.append(req)
    
    return {
        'coverage_rate': len(covered) / len(requirements),
        'covered': covered,
        'missing': missing
    }
```

#### 3. 格式（Format）

**定义**：是否符合要求的输出格式

**评估方法**：
```python
def evaluate_format(output, expected_format):
    """
    检查是否符合预期格式
    """
    if expected_format == 'json':
        try:
            json.loads(output)
            return {'valid': True, 'format_score': 1.0}
        except:
            return {'valid': False, 'format_score': 0, 'error': 'Invalid JSON'}
    
    if expected_format == 'markdown':
        # 检查 markdown 结构
        has_headers = bool(re.search(r'^#+\s', output, re.MULTILINE))
        has_code_blocks = '```' in output
        return {
            'has_headers': has_headers,
            'has_code_blocks': has_code_blocks,
            'format_score': (has_headers + has_code_blocks) / 2
        }
```

#### 4. 安全性（Safety）

**定义**：不包含有害、偏见、敏感内容

**评估维度**：
- 有害内容
- 偏见歧视
- 隐私泄露
- 不当建议

#### 5. 实用性（Usefulness）

**定义**：对用户完成任务是否有帮助

**这是最重要也最难量化的维度**

---

## 🔧 评估方法

### 方法 1：规则匹配

最简单的方法，适合有明确规则的场景。

```python
def rule_based_evaluation(output, rules):
    """
    rules: 规则列表，每个规则是一个检查函数
    """
    results = []
    
    for rule in rules:
        result = rule.check(output)
        results.append({
            'rule': rule.name,
            'passed': result.passed,
            'reason': result.reason
        })
    
    return {
        'total': len(rules),
        'passed': sum(1 for r in results if r['passed']),
        'details': results
    }

# 规则示例
rules = [
    Rule("长度检查", lambda x: 50 < len(x) < 1000),
    Rule("格式检查", lambda x: x.startswith('#')),
    Rule("关键词包含", lambda x: 'function' in x.lower()),
    Rule("无禁用词", lambda x: '政治' not in x),
]
```

### 方法 2：相似度匹配

当有参考答案时，比较语义相似度。

```python
from sentence_transformers import SentenceTransformer

def semantic_similarity(output, reference):
    """
    计算输出与参考答案的语义相似度
    """
    model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
    
    embeddings = model.encode([output, reference])
    similarity = cosine_similarity([embeddings[0]], [embeddings[1]])[0][0]
    
    return {
        'similarity': float(similarity),
        'assessment': 'pass' if similarity > 0.8 else 'fail'
    }
```

### 方法 3：LLM-as-Judge

用另一个 LLM 来评估输出质量。

```python
def llm_judge(output, criteria, reference=None):
    """
    使用 LLM 作为评判者
    """
    prompt = f"""
    请评估以下输出的质量。
    
    ## 评估标准
    {criteria}
    
    ## 待评估输出
    {output}
    
    {"## 参考答案" + reference if reference else ""}
    
    ## 请输出评估结果
    格式：
    {{
      "overall_score": 1-5,
      "dimensions": {{
        "正确性": {{"score": 1-5, "reason": "..."}},
        "完整性": {{"score": 1-5, "reason": "..."}},
        "格式": {{"score": 1-5, "reason": "..."}}
      }},
      "summary": "一句话总结"
    }}
    """
    
    response = llm.generate(prompt)
    return json.loads(response)
```

**LLM-as-Judge 的注意事项**：
- 评判 LLM 可能有自己的偏见
- 需要校准（与人工评估对比）
- 成本考虑（每次评估都是一次 API 调用）

### 方法 4：人工评估

最可靠但最贵的方法。

```python
def human_evaluation_schema():
    """
    人工评估的标准化表单
    """
    return {
        "evaluator_id": "string",
        "timestamp": "datetime",
        "input": "原始输入",
        "output": "模型输出",
        "ratings": {
            "correctness": {
                "score": "1-5",
                "issues": ["问题列表"]
            },
            "completeness": {
                "score": "1-5",
                "missing_points": ["缺失的要点"]
            },
            "format": {
                "score": "1-5",
                "issues": ["格式问题"]
            },
            "overall": {
                "score": "1-5",
                "would_use": "boolean",
                "comments": "自由评论"
            }
        }
    }
```

---

## 📋 评估体系搭建

### 评估数据集

```python
# 评估数据集结构
evaluation_dataset = {
    "name": "code_generation_v1",
    "version": "1.0",
    "description": "代码生成任务评估集",
    "samples": [
        {
            "id": "001",
            "input": "用户输入/prompt",
            "context": "额外上下文（可选）",
            "expected_output": "期望输出（可选）",
            "requirements": ["要点1", "要点2"],
            "metadata": {
                "difficulty": "easy/medium/hard",
                "category": "分类",
                "tags": ["标签"]
            }
        }
    ]
}
```

### 评估流水线

```python
class EvaluationPipeline:
    def __init__(self, evaluators):
        self.evaluators = evaluators
    
    def evaluate(self, dataset, model):
        results = []
        
        for sample in dataset.samples:
            # 生成输出
            output = model.generate(sample.input)
            
            # 多维度评估
            evaluation = {}
            for evaluator in self.evaluators:
                evaluation[evaluator.name] = evaluator.evaluate(
                    output=output,
                    sample=sample
                )
            
            results.append({
                'sample_id': sample.id,
                'input': sample.input,
                'output': output,
                'evaluation': evaluation
            })
        
        return self._aggregate_results(results)
    
    def _aggregate_results(self, results):
        # 汇总统计
        return {
            'total_samples': len(results),
            'average_scores': self._calculate_averages(results),
            'pass_rate': self._calculate_pass_rate(results),
            'details': results
        }
```

### 持续评估

```python
# 评估结果追踪
class EvaluationTracker:
    def __init__(self, storage):
        self.storage = storage
    
    def record(self, evaluation_run):
        """记录一次评估"""
        self.storage.save({
            'run_id': generate_id(),
            'timestamp': datetime.now(),
            'model_version': evaluation_run.model_version,
            'prompt_version': evaluation_run.prompt_version,
            'dataset_version': evaluation_run.dataset_version,
            'results': evaluation_run.results
        })
    
    def compare(self, run_id_a, run_id_b):
        """对比两次评估"""
        run_a = self.storage.get(run_id_a)
        run_b = self.storage.get(run_id_b)
        
        return {
            'score_diff': run_b.avg_score - run_a.avg_score,
            'pass_rate_diff': run_b.pass_rate - run_a.pass_rate,
            'regression': self._find_regressions(run_a, run_b),
            'improvements': self._find_improvements(run_a, run_b)
        }
```

---

## 💡 实践经验

### 设计评估集的原则

1. **覆盖边界情况**：不只是正常输入，还要包含极端情况
2. **代表真实分布**：评估集应该反映实际使用场景
3. **可维护**：易于更新和扩展
4. **有版本**：评估集也需要版本管理

### 评估指标选择

| 场景 | 核心指标 |
|------|----------|
| 信息检索 | 准确率、召回率、F1 |
| 代码生成 | 语法正确率、测试通过率 |
| 文本摘要 | ROUGE、事实一致性 |
| 对话 | 连贯性、有用性、安全性 |
| 分类 | 准确率、混淆矩阵 |

### 评估的成本效益

```
评估方法成本对比：
规则检查    ━━━━━▸ 低成本，有限覆盖
相似度匹配  ━━━━━━━━━▸ 中等成本，需要参考答案
LLM-as-Judge ━━━━━━━━━━━━━▸ 较高成本，灵活
人工评估    ━━━━━━━━━━━━━━━━━━━━▸ 最高成本，最可靠
```

**建议**：
- 开发阶段：规则 + LLM-as-Judge
- 发布前：加入人工抽检
- 线上监控：自动化规则 + 采样人工

### 避免评估陷阱

| 陷阱 | 说明 | 避免方法 |
|------|------|----------|
| 过拟合评估集 | 针对评估集优化，但泛化差 | 保留测试集，定期更换 |
| 指标游戏 | 优化指标但实际体验没提升 | 结合人工评估 |
| 评估偏见 | 评估方法有系统性偏见 | 多维度、多方法交叉验证 |
| 成本失控 | 评估本身消耗太多资源 | 分层评估，采样策略 |

---

## 🔄 评估驱动迭代

```
定义评估标准
      │
      ▼
构建评估数据集
      │
      ▼
运行基线评估 ◄───────────────┐
      │                      │
      ▼                      │
分析问题模式                 │
      │                      │
      ▼                      │
优化（prompt/模型/工具）     │
      │                      │
      ▼                      │
重新评估 ────┬── 改进 ──────►│
             │               │
             └── 回归 ───────┘
```

---

## 📚 相关笔记

- [提示词工程基础](../prompting/prompt-engineering-fundamentals.md)
- [LLM API 使用最佳实践](../llm/llm-api-best-practices.md)
- [常见问题与解决方案](../troubleshooting/common-llm-issues.md)

---

## 参考资料

- [OpenAI Evals](https://github.com/openai/evals)
- [LangChain Evaluation](https://python.langchain.com/docs/guides/evaluation/)
- [RAGAS - RAG Assessment](https://github.com/explodinggradients/ragas)
- [LLM-as-Judge Paper](https://arxiv.org/abs/2306.05685)

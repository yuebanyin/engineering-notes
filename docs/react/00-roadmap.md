# React 学习路线

> 基于 5 年多 React 实战经验的系统性总结。从 Expedia 酒店预订系统到小程序多端开发，这些笔记覆盖了我在真实项目中踩过的坑和沉淀的模式。

## 我关注的方向

- **渲染模型与性能优化** — 理解 Fiber 架构，掌握性能排查的完整链路
- **组件设计模式** — 如何设计可组合、可测试、API 稳定的组件
- **状态管理策略** — 从 useState 到 MobX，什么场景用什么方案
- **数据获取模式** — Apollo/GraphQL 实践，缓存与竞态处理
- **测试策略** — Cypress E2E + Jest 单测的分层覆盖策略
- **工程化基线** — Webpack 优化、CI/CD、错误监控

---

## 📂 核心笔记目录

### performance/ 性能优化
| 文件 | 主题 | 状态 |
|------|------|------|
| [react-performance-checklist.md](performance/react-performance-checklist.md) | 从 0 到 1 的性能排查清单 | ✅ |
| [memoization-practical-guide.md](performance/memoization-practical-guide.md) | memo/useMemo/useCallback 实战指南 | ✅ |
| [virtualization-and-large-lists.md](performance/virtualization-and-large-lists.md) | 虚拟列表与大数据渲染 | ✅ |

### patterns/ 设计模式
| 文件 | 主题 | 状态 |
|------|------|------|
| [react-rendering-model.md](patterns/react-rendering-model.md) | React 渲染机制深度解析 | ✅ |
| [state-management-decision-tree.md](patterns/state-management-decision-tree.md) | 状态管理决策树 | ✅ |
| [data-fetching-patterns.md](patterns/data-fetching-patterns.md) | 数据获取工程化模式 | ✅ |
| [component-api-design.md](patterns/component-api-design.md) | 组件 API 设计原则 | ✅ |
| [frontend-engineering-baseline.md](patterns/frontend-engineering-baseline.md) | 前端工程化基线 | ✅ |

### testing/ 测试相关
| 文件 | 主题 | 状态 |
|------|------|------|
| [testing-strategy-layering.md](testing/testing-strategy-layering.md) | 测试分层策略 | ✅ |

### troubleshooting/ 问题排查
| 文件 | 主题 | 状态 |
|------|------|------|
| [common-bugs-and-debug-playbook.md](troubleshooting/common-bugs-and-debug-playbook.md) | 常见问题与调试手册 | ✅ |

---

## 🎯 推荐阅读顺序

**入门路径**（理解 React 核心机制）：
1. [React 渲染模型](patterns/react-rendering-model.md) — 理解 render/commit/reconcile
2. [性能排查清单](performance/react-performance-checklist.md) — 建立性能排查框架
3. [Memoization 实战](performance/memoization-practical-guide.md) — 知道什么时候该优化

**进阶路径**（工程化实践）：
4. [数据获取模式](patterns/data-fetching-patterns.md) — 缓存、竞态、错误处理
5. [状态管理决策树](patterns/state-management-decision-tree.md) — 选型不再纠结
6. [测试分层策略](testing/testing-strategy-layering.md) — 写可维护的测试

**高级路径**（架构与设计）：
7. [组件 API 设计](patterns/component-api-design.md) — 避免巨无霸组件
8. [工程化基线](patterns/frontend-engineering-baseline.md) — 构建、监控、发布

---

## 💡 我的技术背景

- **React 生态**：深入 Fiber 架构，熟悉 Hooks 设计原理
- **GraphQL/Apollo**：在 Expedia 项目中大规模使用，积累了 fragment 复用和查询优化经验
- **多端开发**：Taro + React 小程序开发，处理过跨端兼容和性能优化
- **测试体系**：Cypress E2E + Jest 单测，保障核心业务流程
- **工程化**：Webpack 优化、CI/CD 流水线设计

---

## 📝 持续更新

这些笔记会随着新项目经验不断迭代。每篇笔记都遵循：
- **问题驱动** — 从真实场景出发
- **决策记录** — 说明为什么这样做
- **验证方法** — 如何证明方案有效

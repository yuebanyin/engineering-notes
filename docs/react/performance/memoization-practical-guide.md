# Memoization 实战指南：useMemo / useCallback / React.memo 怎么用才对

> 这是我踩过最多坑的领域之一。memo 用对了是性能利器，用错了是复杂度灾难。这篇笔记记录了我在真实项目中总结的"什么时候该用，什么时候不该用"的判断标准。

---

## 🎯 核心问题

**memo 系列 API 解决什么问题？**

React 默认行为：父组件重渲染 → 所有子组件重渲染（不管 props 有没有变）

memo 的作用：通过**比较 props 是否变化**来决定是否跳过重渲染

但问题是：**比较本身也有成本**。所以需要判断：
- 跳过渲染省的时间 > 比较 props 的时间 → ✅ 值得
- 跳过渲染省的时间 < 比较 props 的时间 → ❌ 不值得

---

## 📋 什么时候用 memo 真有用

### ✅ 条件清单

以下情况，考虑使用 memo：

| 条件 | 说明 |
|------|------|
| 组件渲染成本高 | 复杂 DOM 结构、大量计算 |
| 父组件频繁更新 | 但子组件 props 很少变 |
| props 简单且稳定 | 基本类型或已 memo 的引用 |
| 位于列表中 | 每个 item 都需要渲染检查 |
| 作为 Context Consumer | 但只依赖 Context 的一小部分 |

### 真实场景 1：列表项组件

```jsx
// 我在游戏平台列表中的实践
// 列表有 100+ 项，每项渲染成本高

// ✅ 正确做法
const GameCard = memo(function GameCard({ game, onSelect }) {
  return (
    <div className="game-card" onClick={() => onSelect(game.id)}>
      <img src={game.cover} alt={game.name} loading="lazy" />
      <div className="game-info">
        <h3>{game.name}</h3>
        <p>{game.category}</p>
        <span className="price">{game.price}</span>
      </div>
    </div>
  );
});

// 父组件要确保 props 引用稳定
function GameList({ games }) {
  // ✅ 稳定的回调引用
  const handleSelect = useCallback((gameId) => {
    navigate(`/game/${gameId}`);
  }, [navigate]);

  return (
    <div className="game-list">
      {games.map(game => (
        <GameCard 
          key={game.id} 
          game={game} 
          onSelect={handleSelect}  // 稳定引用
        />
      ))}
    </div>
  );
}
```

### 真实场景 2：表格列定义

```jsx
// 表格组件的列配置通常不变，但父组件可能频繁更新
function OrderTable({ orders, onRefresh }) {
  // ✅ 列定义缓存，避免每次渲染都创建新数组
  const columns = useMemo(() => [
    { key: 'id', title: '订单号', width: 120 },
    { key: 'customer', title: '客户', width: 150 },
    { key: 'amount', title: '金额', width: 100, render: (v) => `¥${v}` },
    { key: 'status', title: '状态', width: 80 },
    { 
      key: 'actions', 
      title: '操作',
      render: (_, record) => (
        <Button onClick={() => handleView(record.id)}>查看</Button>
      )
    }
  ], []); // 空依赖，永远稳定

  const handleView = useCallback((orderId) => {
    openModal(orderId);
  }, []);

  return <Table columns={columns} data={orders} />;
}
```

### 真实场景 3：Context 值稳定化

```jsx
// 我在 Expedia 项目中遇到的典型问题
// Context 值是对象，每次父组件更新都会创建新对象

// ❌ 问题代码：每次渲染 value 都是新对象
function BookingProvider({ children }) {
  const [booking, setBooking] = useState(null);
  
  return (
    <BookingContext.Provider value={{ booking, setBooking }}>
      {children}
    </BookingContext.Provider>
  );
}

// ✅ 修复：稳定化 Context 值
function BookingProvider({ children }) {
  const [booking, setBooking] = useState(null);
  
  // 只有 booking 变化时才创建新对象
  const value = useMemo(
    () => ({ booking, setBooking }),
    [booking]  // setBooking 本身是稳定的
  );
  
  return (
    <BookingContext.Provider value={value}>
      {children}
    </BookingContext.Provider>
  );
}
```

---

## 🚫 什么时候 memo 是灾难

### ❌ 条件清单

以下情况，**不要**用 memo：

| 条件 | 原因 |
|------|------|
| 组件很轻量 | 比较成本 > 渲染成本 |
| props 总是变 | 每次都要比较 + 渲染，更慢 |
| props 是复杂对象 | 浅比较不够，深比较太贵 |
| 没测量就加 | 可能是负优化 |
| 依赖不稳定 | useMemo 的 deps 经常变 |

### 反面案例 1：轻量组件加 memo

```jsx
// ❌ 错误：这种组件不需要 memo
const Label = memo(function Label({ text }) {
  return <span className="label">{text}</span>;
});

// 为什么不需要？
// 1. 渲染成本极低（就一个 span）
// 2. 浅比较 text 的成本 ≈ 渲染成本
// 3. 增加代码复杂度没有收益
```

### 反面案例 2：props 总是新对象

```jsx
// ❌ 错误：每次渲染 options 都是新数组，memo 永远不生效
function Parent() {
  return (
    <FilterPanel 
      options={[
        { label: '全部', value: 'all' },
        { label: '进行中', value: 'pending' },
        { label: '已完成', value: 'done' },
      ]}
    />
  );
}

const FilterPanel = memo(function FilterPanel({ options }) {
  // memo 无效！因为 options 每次都是新数组
  return (
    <div>
      {options.map(opt => (
        <Button key={opt.value}>{opt.label}</Button>
      ))}
    </div>
  );
});

// ✅ 修复方案 1：提到组件外
const FILTER_OPTIONS = [
  { label: '全部', value: 'all' },
  { label: '进行中', value: 'pending' },
  { label: '已完成', value: 'done' },
];

function Parent() {
  return <FilterPanel options={FILTER_OPTIONS} />;
}

// ✅ 修复方案 2：用 useMemo
function Parent() {
  const options = useMemo(() => [
    { label: '全部', value: 'all' },
    { label: '进行中', value: 'pending' },
    { label: '已完成', value: 'done' },
  ], []); // 空依赖

  return <FilterPanel options={options} />;
}
```

### 反面案例 3：错误的依赖

```jsx
// ❌ 错误：deps 里有每次都变的值
function SearchResults({ query, filters }) {
  const processedFilters = useMemo(() => {
    return filters.map(f => ({
      ...f,
      timestamp: Date.now()  // 每次都不同！
    }));
  }, [filters]);  // 这个 memo 没问题

  // 但如果这样写：
  const badMemo = useMemo(() => {
    return someCalculation(query);
  }, [query, Math.random()]);  // ❌ random 每次都变，memo 无效
}
```

---

## 🔧 稳定引用的实践模式

### 模式 1：对象属性分离

```jsx
// ❌ 传整个对象，任何属性变化都会触发重渲染
<UserAvatar user={user} />

// ✅ 只传需要的属性
<UserAvatar name={user.name} avatar={user.avatar} />
```

### 模式 2：回调稳定化

```jsx
// ❌ 内联函数每次都是新引用
{items.map(item => (
  <Item 
    key={item.id} 
    onClick={() => handleClick(item.id)}  // 新函数！
  />
))}

// ✅ 方案 1：useCallback + 闭包参数
const handleClick = useCallback((id) => {
  // 处理点击
}, []);

{items.map(item => (
  <Item 
    key={item.id} 
    id={item.id}
    onClick={handleClick}  // 稳定引用
  />
))}

// Item 组件内部处理
const Item = memo(function Item({ id, onClick }) {
  return <div onClick={() => onClick(id)}>...</div>;
});

// ✅ 方案 2：data-* 属性（简单场景）
const handleClick = useCallback((e) => {
  const id = e.currentTarget.dataset.id;
  // 处理点击
}, []);

{items.map(item => (
  <div key={item.id} data-id={item.id} onClick={handleClick}>
    ...
  </div>
))}
```

### 模式 3：选择性 Context 消费

```jsx
// 问题：Theme 变化时，所有 Consumer 都重渲染，即使只用了 user
const AppContext = createContext({ theme: 'light', user: null });

// ✅ 解法：拆分 Context
const ThemeContext = createContext('light');
const UserContext = createContext(null);

// 或者用 selector 模式（配合 use-context-selector 等库）
import { createContext, useContextSelector } from 'use-context-selector';

const AppContext = createContext({ theme: 'light', user: null });

function UserName() {
  // 只有 user 变化时才重渲染
  const user = useContextSelector(AppContext, ctx => ctx.user);
  return <span>{user?.name}</span>;
}
```

---

## 📊 如何验证 memo 有效

### 方法 1：React DevTools Profiler

1. 打开 React DevTools → Profiler
2. 点击录制，操作页面
3. 查看组件渲染情况
4. 被跳过的组件会显示 "Did not render"

### 方法 2：添加渲染日志

```jsx
const ExpensiveComponent = memo(function ExpensiveComponent({ data }) {
  // 开发环境添加日志
  if (process.env.NODE_ENV === 'development') {
    console.log('ExpensiveComponent rendered');
  }
  
  return <div>{/* ... */}</div>;
});
```

### 方法 3：Profiler API 量化

```jsx
import { Profiler } from 'react';

function App() {
  const handleRender = (id, phase, actualDuration, baseDuration) => {
    console.log(`${id} [${phase}]: ${actualDuration.toFixed(2)}ms`);
  };

  return (
    <Profiler id="GameList" onRender={handleRender}>
      <GameList games={games} />
    </Profiler>
  );
}

// 优化前后对比：
// 优化前：GameList [update]: 45.23ms
// 优化后：GameList [update]: 2.15ms (大部分子组件跳过)
```

### 验证清单

| 指标 | 优化前 | 优化后 | 判断 |
|------|--------|--------|------|
| 渲染次数 | 100 次 | 5 次 | ✅ 有效 |
| 渲染时间 | 50ms | 10ms | ✅ 有效 |
| 内存增长 | - | +5MB | ⚠️ 关注 |
| 代码复杂度 | 简单 | 较复杂 | ⚠️ 权衡 |

---

## 🧠 我的决策流程

```
需要优化某个组件？
    │
    ▼
是否有明确的性能问题？ ──No──▶ 暂不优化，保持简单
    │
   Yes
    ▼
组件渲染成本高吗？ ──No──▶ 不加 memo
    │
   Yes
    ▼
父组件更新频繁吗？ ──No──▶ 不加 memo
    │
   Yes
    ▼
props 能保持稳定吗？ ──No──▶ 先解决 props 稳定性问题
    │
   Yes
    ▼
添加 memo，然后用 Profiler 验证效果
    │
    ▼
有效？ ──No──▶ 移除 memo，找其他优化点
    │
   Yes
    ▼
保留，添加注释说明为什么需要 memo
```

---

## 💡 经验总结

1. **先测量，后优化**：没有 Profiler 数据支撑的 memo 都是猜测
2. **稳定引用是前提**：memo 组件 + 不稳定 props = 白加
3. **列表场景优先**：列表项是 memo 收益最大的场景
4. **Context 是重灾区**：Context 值不稳定会导致大范围重渲染
5. **代码复杂度是成本**：能不加就不加，加了要注释说明原因

---

## 📚 相关笔记

- [React 渲染模型深度解析](../patterns/react-rendering-model.md)
- [性能排查清单](react-performance-checklist.md)
- [虚拟列表与大数据渲染](virtualization-and-large-lists.md)

---

## 参考资料

- [Before You memo()](https://overreacted.io/before-you-memo/) - Dan Abramov
- [React Docs: memo](https://react.dev/reference/react/memo)
- [React Docs: useMemo](https://react.dev/reference/react/useMemo)
- [React Docs: useCallback](https://react.dev/reference/react/useCallback)

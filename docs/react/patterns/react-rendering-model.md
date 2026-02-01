# React 渲染模型深度解析：render / commit / reconcile 到底发生了什么

> 理解 React 渲染机制是性能优化的基础。这篇笔记从工程视角解释 React 渲染的核心概念，纠正常见误区，并提供定位问题的实用方法。

---

## 🎯 为什么这很重要

在我参与的多个 React 项目中（Expedia 酒店预订、在线教育小程序、游戏平台），**渲染次数是性能问题的第一嫌疑人**。

但很多时候，我们的直觉是错的：
- "减少 render 次数就能提升性能" → **不一定**
- "state 更新了 DOM 就会更新" → **不一定**
- "父组件 render 了子组件一定 render" → **是的，但可以避免**

要做对优化，先要理解机制。

---

## 📖 核心概念

### React 更新的三个阶段

```
State 变化
    │
    ▼
┌─────────────────────────────────────────┐
│  1. Trigger（触发）                      │
│     - setState / dispatch / props 变化   │
│     - 告诉 React "有东西要更新"           │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  2. Render（渲染）                       │
│     - 调用组件函数，生成新的 React Element │
│     - 这里不操作 DOM！                    │
│     - 通过 Reconciliation 找出差异        │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  3. Commit（提交）                       │
│     - 把差异应用到真实 DOM               │
│     - 调用 useLayoutEffect              │
│     - 然后调用 useEffect                 │
└─────────────────────────────────────────┘
```

### 关键概念详解

#### Render（渲染）

**渲染 = 调用组件函数，生成虚拟 DOM（React Element 树）**

```jsx
function BookingCard({ hotel, checkIn, checkOut }) {
  // 每次渲染都会执行这段代码
  console.log('BookingCard rendered');
  
  const nights = calculateNights(checkIn, checkOut);
  const totalPrice = hotel.pricePerNight * nights;
  
  // 返回 React Element（不是真实 DOM）
  return (
    <div className="booking-card">
      <h2>{hotel.name}</h2>
      <p>￥{totalPrice} / {nights} 晚</p>
    </div>
  );
}
```

**重点**：
- 渲染 ≠ DOM 操作
- 渲染可以很快（只是 JS 计算）
- 渲染结果可能和上次一样（那就不需要 commit）

#### Reconciliation（协调 / Diff）

**协调 = 比较新旧两棵 React Element 树，找出需要更新的部分**

React 使用 Fiber 架构实现高效的协调：

```jsx
// 旧树
<div>
  <BookingCard hotel={hotelA} />
  <BookingCard hotel={hotelB} />
</div>

// 新树（hotelB 的价格变了）
<div>
  <BookingCard hotel={hotelA} />      // 没变，跳过
  <BookingCard hotel={hotelBNew} />   // 变了，需要更新
</div>
```

**协调的关键规则**：
1. 不同类型的元素 → 销毁重建整棵子树
2. 同类型元素 → 只更新变化的属性
3. 列表用 key 识别哪些项是同一个

#### Commit（提交）

**提交 = 把 diff 结果应用到真实 DOM**

这是唯一操作 DOM 的阶段：

```jsx
// 假设协调发现只有价格变了
// Commit 阶段只会执行：
element.textContent = '￥880';  // 只更新这一处
```

**提交阶段的顺序**：
1. DOM 变更（插入、更新、删除）
2. `useLayoutEffect` 同步执行
3. 浏览器绘制
4. `useEffect` 异步执行

---

## ⚠️ 常见误区

### 误区 1：state 更新 = DOM 更新

```jsx
function Counter() {
  const [count, setCount] = useState(0);
  
  const handleClick = () => {
    setCount(0);  // 设置相同的值
  };
  
  console.log('rendered');  // 会打印吗？
  
  return <button onClick={handleClick}>{count}</button>;
}
```

**真相**：
- React 18：如果新 state 与旧 state 相同（Object.is 比较），**组件不会重新渲染**
- 即使渲染了，如果虚拟 DOM 没变化，**真实 DOM 也不会更新**

### 误区 2：父组件 render = 子组件必须 render

```jsx
function Parent() {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>
        Click {count}
      </button>
      <Child />  {/* 没有 props 依赖 count */}
    </div>
  );
}

function Child() {
  console.log('Child rendered');  // 父组件点击时会打印吗？
  return <div>I am child</div>;
}
```

**真相**：
- 默认行为：**会打印**！父组件 render 时，所有子组件都会 render
- 这就是为什么需要 `React.memo`
- 但 render ≠ DOM 更新，如果子组件输出没变，DOM 不会动

### 误区 3：减少 render 次数 = 性能更好

```jsx
// 场景：列表有 1000 项，用户输入搜索词
function SearchList({ items }) {
  const [query, setQuery] = useState('');
  
  // 方案 A：每次输入都重新过滤（触发渲染）
  const filtered = items.filter(item => item.name.includes(query));
  
  // 方案 B：防抖 300ms（减少渲染次数）
  const debouncedQuery = useDebounce(query, 300);
  const filtered = items.filter(item => item.name.includes(debouncedQuery));
  
  return (/* ... */);
}
```

**真相**：
- 方案 B 减少了渲染次数，但**增加了用户等待时间**
- 有时候"多渲染几次但每次很快"比"少渲染但要等"体验更好
- 正确做法：用 `startTransition` 或虚拟列表，而不是单纯减少渲染

---

## 🔍 如何定位渲染问题

### 工具 1：React DevTools Profiler

**操作步骤**：
1. 打开 React DevTools → Profiler 面板
2. 点击录制按钮
3. 操作页面（点击、输入等）
4. 停止录制
5. 分析火焰图

**关注指标**：
- **Render duration**：组件渲染耗时
- **Why did this render?**：开启设置中的 "Record why each component rendered"
- **Commit 次数**：一次用户操作触发了多少次 commit

### 工具 2：手动日志埋点

```jsx
// 开发环境添加渲染追踪
function BookingForm({ hotel }) {
  if (process.env.NODE_ENV === 'development') {
    console.log('BookingForm render', { hotel: hotel.id });
  }
  
  // 追踪 effect 执行
  useEffect(() => {
    console.log('BookingForm effect - hotel changed');
  }, [hotel]);
  
  return (/* ... */);
}
```

### 工具 3：Chrome Performance 面板

**用于追踪 Long Task 和帧率**：

1. 打开 DevTools → Performance
2. 点击录制
3. 操作页面
4. 查看：
   - Long Task（红色标记，> 50ms）
   - 帧率（顶部的 FPS 图表）
   - 函数调用栈（找到耗时的函数）

### 定位流程

```
发现性能问题
    │
    ▼
用 Profiler 录制操作
    │
    ▼
查看 Commit 次数 ──太多──▶ 检查触发源（state 更新过频繁？）
    │
   正常
    ▼
查看 Render 耗时 ──太长──▶ 组件内有昂贵计算？用 useMemo
    │
   正常
    ▼
查看哪些组件在渲染 ──不该渲染的在渲染──▶ 检查 props 是否稳定，考虑 memo
    │
   正常
    ▼
问题可能在 Commit 阶段或浏览器渲染 → 用 Performance 面板分析
```

---

## 📋 优化经验规则

### 什么时候值得用 memo

| 场景 | 建议 | 原因 |
|------|------|------|
| 列表项组件 | ✅ 推荐 | 列表通常有很多项，每项都检查是否需要渲染 |
| 表格单元格 | ✅ 推荐 | 同上 |
| 复杂表单组件 | ✅ 推荐 | 表单某个字段变化不应该导致所有字段重渲染 |
| 简单展示组件 | ❌ 不需要 | 渲染成本很低，加 memo 反而有比较成本 |
| props 经常变 | ❌ 不需要 | 每次都要比较 + 渲染，更慢 |

### 什么时候值得用 useMemo

| 场景 | 建议 | 原因 |
|------|------|------|
| 昂贵的计算 | ✅ 推荐 | 避免每次渲染都重新计算 |
| 稳定化对象/数组引用 | ✅ 推荐 | 让 memo 子组件能正确跳过渲染 |
| Context value | ✅ 推荐 | 防止所有 Consumer 无效重渲染 |
| 简单计算 | ❌ 不需要 | useMemo 本身也有成本 |
| 依赖经常变 | ❌ 不需要 | 每次都要重算，缓存无意义 |

### 什么时候值得用 useCallback

| 场景 | 建议 | 原因 |
|------|------|------|
| 传给 memo 组件的回调 | ✅ 推荐 | 让子组件能正确跳过渲染 |
| 作为 useEffect 依赖 | ✅ 推荐 | 避免 effect 无限触发 |
| 普通事件处理器 | ❌ 不需要 | 如果子组件没有 memo，useCallback 没意义 |

---

## 💡 实战案例

### 案例 1：Expedia 酒店列表优化

**问题**：滚动酒店列表时卡顿

**分析**：
```jsx
// 原代码
function HotelList({ hotels, onSelect }) {
  return (
    <div className="hotel-list">
      {hotels.map(hotel => (
        <HotelCard 
          key={hotel.id}
          hotel={hotel}
          onSelect={() => onSelect(hotel)}  // ❌ 每次渲染新函数
        />
      ))}
    </div>
  );
}
```

**Profiler 发现**：每次滚动触发的更新，所有 HotelCard 都重新渲染

**优化**：
```jsx
// 1. 稳定回调
function HotelList({ hotels, onSelect }) {
  const handleSelect = useCallback((hotelId) => {
    onSelect(hotelId);
  }, [onSelect]);

  return (
    <div className="hotel-list">
      {hotels.map(hotel => (
        <HotelCard 
          key={hotel.id}
          hotel={hotel}
          onSelect={handleSelect}  // ✅ 稳定引用
        />
      ))}
    </div>
  );
}

// 2. memo 化子组件
const HotelCard = memo(function HotelCard({ hotel, onSelect }) {
  return (
    <div onClick={() => onSelect(hotel.id)}>
      {/* ... */}
    </div>
  );
});
```

**结果**：渲染时间从 80ms 降到 15ms

### 案例 2：表单性能问题

**问题**：输入任意字段，整个表单都闪烁

**分析**：
```jsx
// 原代码：所有 state 在一个对象里
function BookingForm() {
  const [form, setForm] = useState({
    guestName: '',
    email: '',
    phone: '',
    checkIn: null,
    checkOut: null,
    roomType: 'standard',
    specialRequests: ''
  });

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));  
    // 每次都创建新对象，所有子组件都重渲染
  };

  return (
    <div>
      <Input value={form.guestName} onChange={v => handleChange('guestName', v)} />
      <Input value={form.email} onChange={v => handleChange('email', v)} />
      {/* ... 更多字段 */}
    </div>
  );
}
```

**优化方案**：
```jsx
// 1. 拆分 state
function BookingForm() {
  const [guestName, setGuestName] = useState('');
  const [email, setEmail] = useState('');
  // ... 或者用 useReducer

  return (
    <div>
      <Input value={guestName} onChange={setGuestName} />
      <Input value={email} onChange={setEmail} />
    </div>
  );
}

// 2. 或者用非受控组件 + ref
function BookingForm() {
  const formRef = useRef({});
  
  return (
    <div>
      <input 
        defaultValue="" 
        onChange={e => formRef.current.guestName = e.target.value} 
      />
    </div>
  );
}
```

---

## 🎯 验证优化效果

### 验证清单

| 指标 | 测量方法 | 目标 |
|------|----------|------|
| Render 次数 | Profiler 的 commit 统计 | 减少不必要的渲染 |
| Render 时间 | Profiler 的 duration | 关键组件 < 16ms |
| Long Task | Performance 面板 | 消除 > 50ms 的任务 |
| INP | Web Vitals | < 200ms |

### 对比模板

```markdown
## 优化报告

### 场景：滚动酒店列表

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| Render 次数/滚动 | 50 | 3 | 94% |
| 单次 Render 时间 | 80ms | 15ms | 81% |
| 平均 FPS | 24 | 58 | 142% |

### 采用的优化手段
1. HotelCard 添加 React.memo
2. onSelect 回调使用 useCallback
3. 使用 react-window 虚拟列表
```

---

## 📚 相关笔记

- [性能排查清单](../performance/react-performance-checklist.md)
- [Memoization 实战指南](../performance/memoization-practical-guide.md)
- [状态管理决策树](state-management-decision-tree.md)

---

## 参考资料

- [React Docs: Render and Commit](https://react.dev/learn/render-and-commit)
- [React Docs: Preserving and Resetting State](https://react.dev/learn/preserving-and-resetting-state)
- [A Complete Guide to useEffect](https://overreacted.io/a-complete-guide-to-useeffect/) - Dan Abramov
- [React Fiber Architecture](https://github.com/acdlite/react-fiber-architecture)

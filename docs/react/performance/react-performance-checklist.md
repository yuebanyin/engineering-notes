# React 性能排查清单：从 0 到 1 的完整 Checklist

> 这份清单源于我在 Expedia 酒店预订系统和在线教育小程序中的真实性能优化经验。不是理论堆砌，而是"遇到问题 → 怎么定位 → 怎么解决"的实战路径。

---

## 📋 快速导航

| 症状 | 跳转 |
|------|------|
| 首屏加载慢 | [首屏优化](#1-首屏加载慢) |
| 交互卡顿 | [交互优化](#2-交互卡顿) |
| 列表滚动卡 | [列表优化](#3-列表滚动卡) |
| 页面切换慢 | [路由优化](#4-页面切换慢) |

---

## 🎯 核心指标速查

在排查之前，先明确你在优化什么：

| 指标 | 含义 | 目标值 | 测量工具 |
|------|------|--------|----------|
| **LCP** | 最大内容绘制 | < 2.5s | Lighthouse, Web Vitals |
| **INP** | 交互到下一帧延迟 | < 200ms | Chrome DevTools |
| **TTI** | 可交互时间 | < 3.8s | Lighthouse |
| **Long Task** | 超过 50ms 的任务 | 尽量少 | Performance 面板 |
| **Bundle Size** | 包体积 | 首屏 < 200KB gzip | webpack-bundle-analyzer |

---

## 1. 首屏加载慢

### 症状
- 白屏时间长
- LCP > 2.5s
- 用户反馈"打开很慢"

### 排查路径

```
首屏慢
  ├─ 网络问题？ → Network 面板查瀑布图
  │    ├─ 资源太大 → 压缩、CDN
  │    └─ 请求太多 → 合并、预加载
  │
  ├─ JS 执行慢？ → Performance 面板查 Long Task
  │    ├─ 包太大 → Code Splitting
  │    └─ 同步计算多 → 延迟/异步处理
  │
  └─ 渲染阻塞？ → 查关键渲染路径
       ├─ CSS 阻塞 → Critical CSS 内联
       └─ 字体阻塞 → font-display: swap
```

### 处方清单

#### ✅ 代码分割（最高优先级）
```jsx
// ❌ 直接 import
import HeavyComponent from './HeavyComponent';

// ✅ 动态 import + Suspense
const HeavyComponent = lazy(() => import('./HeavyComponent'));

function App() {
  return (
    <Suspense fallback={<Skeleton />}>
      <HeavyComponent />
    </Suspense>
  );
}
```

#### ✅ 路由级别分割
```jsx
// 我在 Expedia 项目中的实践
const BookingPage = lazy(() => import('./pages/Booking'));
const SearchPage = lazy(() => import('./pages/Search'));
const HotelDetail = lazy(() => import('./pages/HotelDetail'));

// 预加载关键路径
const preloadBooking = () => import('./pages/Booking');
```

#### ✅ 关键资源预加载
```html
<!-- 预加载关键字体 -->
<link rel="preload" href="/fonts/main.woff2" as="font" crossorigin>

<!-- 预连接第三方域名 -->
<link rel="preconnect" href="https://api.example.com">

<!-- 预获取下一页资源 -->
<link rel="prefetch" href="/next-page-bundle.js">
```

#### ✅ 图片优化
```jsx
// 我在在线教育小程序中的实践
// 1. 懒加载非首屏图片
<img loading="lazy" src={courseImage} alt={title} />

// 2. 响应式图片
<picture>
  <source media="(max-width: 768px)" srcSet={mobileImg} />
  <source media="(min-width: 769px)" srcSet={desktopImg} />
  <img src={fallbackImg} alt={title} />
</picture>

// 3. 现代格式
<img src={image} srcSet={`${webpImage} 1x`} type="image/webp" />
```

### 验证方法
```bash
# Lighthouse CI 对比
lighthouse https://your-site.com --output json --output-path ./before.json
# 优化后
lighthouse https://your-site.com --output json --output-path ./after.json
# 对比 LCP、TTI 变化
```

---

## 2. 交互卡顿

### 症状
- 点击按钮后延迟响应
- 输入框打字卡顿
- INP > 200ms
- 动画掉帧

### 排查路径

```
交互卡顿
  ├─ 点击后卡？ → 事件处理函数有昂贵计算
  │    └─ 用 useMemo/useCallback 或 Web Worker
  │
  ├─ 输入卡？ → 每次输入触发大量重渲染
  │    ├─ 防抖/节流
  │    └─ 拆分受控状态
  │
  └─ 频繁 setState？ → 合并更新或用 useReducer
```

### 处方清单

#### ✅ 输入防抖
```jsx
// 我在搜索功能中的标准实践
function SearchInput({ onSearch }) {
  const [value, setValue] = useState('');
  
  // 防抖搜索，300ms 内不重复请求
  const debouncedSearch = useMemo(
    () => debounce((term) => onSearch(term), 300),
    [onSearch]
  );

  const handleChange = (e) => {
    const newValue = e.target.value;
    setValue(newValue);        // 立即更新输入框
    debouncedSearch(newValue); // 延迟触发搜索
  };

  return <input value={value} onChange={handleChange} />;
}
```

#### ✅ 昂贵计算移到 Worker
```jsx
// 当计算阻塞主线程时
// worker.js
self.onmessage = (e) => {
  const result = heavyCalculation(e.data);
  self.postMessage(result);
};

// 组件中
const worker = useMemo(() => new Worker('./worker.js'), []);

useEffect(() => {
  worker.postMessage(data);
  worker.onmessage = (e) => setResult(e.data);
}, [data]);
```

#### ✅ 使用 startTransition 降低优先级
```jsx
// React 18+ 并发特性
import { startTransition } from 'react';

function FilterList({ items }) {
  const [filter, setFilter] = useState('');
  const [filteredItems, setFilteredItems] = useState(items);

  const handleFilter = (e) => {
    const value = e.target.value;
    setFilter(value);  // 高优先级：立即更新输入框
    
    startTransition(() => {
      // 低优先级：可被打断的列表过滤
      setFilteredItems(items.filter(item => 
        item.name.includes(value)
      ));
    });
  };

  return (
    <>
      <input value={filter} onChange={handleFilter} />
      <List items={filteredItems} />
    </>
  );
}
```

---

## 3. 列表滚动卡

### 症状
- 长列表滚动时掉帧
- 滚动时 CPU 飙高
- FPS < 30

### 排查路径

```
列表卡顿
  ├─ DOM 节点太多？ → 虚拟列表
  │
  ├─ 每项渲染太重？ → React.memo + 稳定 props
  │
  └─ 频繁重渲染？ → 检查 key 稳定性和父组件更新
```

### 处方清单

#### ✅ 虚拟列表（超过 100 项必用）
```jsx
// 使用 react-window（我在游戏平台列表中的实践）
import { FixedSizeList } from 'react-window';

function GameList({ games }) {
  const Row = ({ index, style }) => (
    <div style={style}>
      <GameCard game={games[index]} />
    </div>
  );

  return (
    <FixedSizeList
      height={600}
      itemCount={games.length}
      itemSize={120}  // 每项高度
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
}
```

#### ✅ 列表项 memo 化
```jsx
// 确保 props 引用稳定
const GameCard = memo(function GameCard({ game, onSelect }) {
  return (
    <div onClick={() => onSelect(game.id)}>
      <img src={game.cover} alt={game.name} />
      <h3>{game.name}</h3>
    </div>
  );
});

// 父组件中稳定 callback
function GameList({ games }) {
  const handleSelect = useCallback((id) => {
    // 处理选择
  }, []);

  return games.map(game => (
    <GameCard 
      key={game.id} 
      game={game} 
      onSelect={handleSelect} 
    />
  ));
}
```

详见：[虚拟列表与大数据渲染](virtualization-and-large-lists.md)

---

## 4. 页面切换慢

### 症状
- 路由跳转白屏
- 切换页面要等 1-2 秒
- 返回上一页重新加载

### 处方清单

#### ✅ 路由预加载
```jsx
// 鼠标悬停时预加载
function NavLink({ to, children }) {
  const preload = () => {
    // 根据路由预加载对应的 chunk
    if (to === '/booking') {
      import('./pages/Booking');
    }
  };

  return (
    <Link to={to} onMouseEnter={preload}>
      {children}
    </Link>
  );
}
```

#### ✅ 页面状态保持（Keep-Alive 模式）
```jsx
// 使用 react-activation 或自定义方案
import { KeepAlive } from 'react-activation';

function App() {
  return (
    <Routes>
      <Route path="/list" element={
        <KeepAlive>
          <ListPage />
        </KeepAlive>
      } />
    </Routes>
  );
}
```

---

## 5. 常见原因 Top 10

根据我的经验，这些是最常见的性能问题：

| 排名 | 问题 | 影响 | 解法 |
|------|------|------|------|
| 1 | 不稳定的 props 引用 | 子组件无效重渲染 | useMemo/useCallback |
| 2 | 无边界的渲染范围 | 更新一处，全部重渲染 | 拆分组件、Context 分离 |
| 3 | 同步执行昂贵计算 | 主线程阻塞 | useMemo/Worker |
| 4 | 大列表直接渲染 | DOM 节点爆炸 | 虚拟列表 |
| 5 | 频繁的 setState | 多次渲染合并失败 | useReducer/批量更新 |
| 6 | 未做代码分割 | 首屏包太大 | lazy + Suspense |
| 7 | 图片未优化 | 带宽浪费、渲染慢 | 懒加载、WebP |
| 8 | 重复请求 | 网络浪费 | 缓存、去重 |
| 9 | 内存泄漏 | 页面越用越卡 | cleanup effect |
| 10 | 动画未用 transform | 触发 layout | transform + opacity |

---

## 6. When NOT to Optimize

**过早优化是万恶之源**。以下情况不要优化：

### ❌ 不要优化的场景
- 还没测量就开始加 memo
- 组件只有几个 props 且不常更新
- 用户感知不到的毫秒级差异
- 增加的代码复杂度 > 性能收益

### ✅ 值得优化的信号
- 用户投诉或流失数据显示问题
- Lighthouse 分数低于及格线（< 50）
- Profiler 显示明确的重渲染热点
- Long Task 导致交互延迟 > 100ms

### 我的决策原则
```
if (用户能感知到卡顿) {
  优化();
} else if (指标明确显示问题) {
  优化();
} else {
  先发布，有问题再说();
}
```

---

## 7. 验证优化效果

### 量化对比
```jsx
// 使用 React Profiler API 记录
import { Profiler } from 'react';

function onRenderCallback(
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime
) {
  // 发送到监控系统
  analytics.track('react_render', {
    component: id,
    duration: actualDuration,
    phase
  });
}

<Profiler id="BookingForm" onRender={onRenderCallback}>
  <BookingForm />
</Profiler>
```

### 对比清单
| 维度 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| 渲染次数 | ? | ? | ?% |
| 渲染时间 | ?ms | ?ms | ?% |
| LCP | ?s | ?s | ?% |
| INP | ?ms | ?ms | ?% |
| Bundle Size | ?KB | ?KB | ?% |

---

## 📚 相关笔记

- [React 渲染模型深度解析](../patterns/react-rendering-model.md)
- [Memoization 实战指南](memoization-practical-guide.md)
- [虚拟列表与大数据渲染](virtualization-and-large-lists.md)

---

## 参考资料

- [Web Vitals](https://web.dev/vitals/)
- [React Profiler](https://react.dev/reference/react/Profiler)
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/)

# 虚拟列表与大数据渲染：10K items 仍流畅的套路

> 这篇笔记源于我在游戏平台和在线教育项目中处理长列表的经验。当列表超过几百项时，直接渲染会导致滚动卡顿、内存飙升。虚拟列表是标准解法，但实现中有很多 tricky 的细节。

---

## 🎯 问题定义

### 症状

| 现象 | 原因 |
|------|------|
| 滚动时掉帧（FPS < 30） | DOM 节点太多，layout/paint 成本高 |
| 页面加载慢 | 一次性创建大量 DOM |
| 滚动时 CPU 飙高 | 频繁的布局计算 |
| 内存占用大 | 数千个组件实例 |
| 输入卡顿 | 主线程被渲染任务阻塞 |

### 原因分析

```
直接渲染 10000 条数据
    │
    ▼
创建 10000 个 DOM 节点
    │
    ▼
浏览器需要：
├─ 计算 10000 个元素的布局（Layout）
├─ 绘制 10000 个元素（Paint）
├─ 维护 10000 个元素的事件监听
└─ React 维护 10000 个组件实例

结果：卡顿、内存爆炸
```

### 何时需要虚拟列表

| 数据量 | 建议 |
|--------|------|
| < 100 项 | 直接渲染，无需优化 |
| 100-500 项 | 考虑虚拟列表，视复杂度决定 |
| > 500 项 | 必须使用虚拟列表 |
| > 5000 项 | 虚拟列表 + 考虑分页/搜索替代方案 |

---

## 💡 虚拟列表原理

**核心思想**：只渲染可视区域内的元素 + 少量缓冲区

```
┌─────────────────────────┐
│     缓冲区（上）         │  ← 预渲染几行，减少白屏
├─────────────────────────┤
│                         │
│     可视区域            │  ← 用户实际看到的
│                         │
├─────────────────────────┤
│     缓冲区（下）         │  ← 预渲染几行
└─────────────────────────┘

实际渲染：20-30 个 DOM 节点
虚拟数据：10000 条

滚动时：
1. 计算新的可视区域
2. 复用/移动已有 DOM
3. 更新显示内容
```

---

## 🔧 方案选型

### 主流库对比

| 库 | 包大小 | 特点 | 适用场景 |
|---|--------|------|----------|
| react-window | ~6KB | 轻量、API 简洁 | 大多数场景 |
| react-virtuoso | ~15KB | 功能丰富、动态高度好 | 复杂列表 |
| @tanstack/react-virtual | ~5KB | Headless、框架无关 | 需要完全自定义 |
| react-virtualized | ~25KB | 老牌、功能全 | 遗留项目 |

### 我的选择

- **固定高度列表** → react-window（简单可靠）
- **动态高度列表** → react-virtuoso（自动测量高度）
- **需要完全控制** → @tanstack/react-virtual

---

## 📝 react-window 实践

### 固定高度列表

```jsx
import { FixedSizeList } from 'react-window';

// 我在游戏平台中的实践
function GameList({ games }) {
  // 单个列表项
  const Row = ({ index, style }) => {
    const game = games[index];
    return (
      <div style={style} className="game-row">
        <img src={game.thumbnail} alt={game.name} loading="lazy" />
        <div className="game-info">
          <h3>{game.name}</h3>
          <span className="price">¥{game.price}</span>
        </div>
      </div>
    );
  };

  return (
    <FixedSizeList
      height={600}          // 容器高度
      width="100%"          // 容器宽度
      itemCount={games.length}
      itemSize={80}         // 每项高度（固定）
      overscanCount={5}     // 缓冲区数量
    >
      {Row}
    </FixedSizeList>
  );
}
```

### 网格布局

```jsx
import { FixedSizeGrid } from 'react-window';

function GameGrid({ games, columnCount = 4 }) {
  const rowCount = Math.ceil(games.length / columnCount);
  
  const Cell = ({ columnIndex, rowIndex, style }) => {
    const index = rowIndex * columnCount + columnIndex;
    if (index >= games.length) return null;
    
    const game = games[index];
    return (
      <div style={style} className="game-cell">
        <GameCard game={game} />
      </div>
    );
  };

  return (
    <FixedSizeGrid
      height={600}
      width={800}
      columnCount={columnCount}
      columnWidth={200}
      rowCount={rowCount}
      rowHeight={250}
    >
      {Cell}
    </FixedSizeGrid>
  );
}
```

### 添加自动尺寸适应

```jsx
import { FixedSizeList } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

function ResponsiveGameList({ games }) {
  return (
    <div style={{ height: '100vh' }}>
      <AutoSizer>
        {({ height, width }) => (
          <FixedSizeList
            height={height}
            width={width}
            itemCount={games.length}
            itemSize={80}
          >
            {({ index, style }) => (
              <GameRow game={games[index]} style={style} />
            )}
          </FixedSizeList>
        )}
      </AutoSizer>
    </div>
  );
}
```

---

## 📝 react-virtuoso 实践

### 动态高度列表

当每项高度不确定时（如聊天消息、评论），使用 react-virtuoso：

```jsx
import { Virtuoso } from 'react-virtuoso';

// 我在在线教育项目中的聊天列表
function ChatMessages({ messages }) {
  return (
    <Virtuoso
      style={{ height: '400px' }}
      data={messages}
      itemContent={(index, message) => (
        <ChatMessage 
          key={message.id}
          message={message}
          // 内容长度不同，高度自动测量
        />
      )}
      // 新消息来时滚动到底部
      followOutput="smooth"
      // 初始滚动到底部
      initialTopMostItemIndex={messages.length - 1}
    />
  );
}
```

### 分组列表（Sticky Header）

```jsx
import { GroupedVirtuoso } from 'react-virtuoso';

function GameCategoryList({ categories, games }) {
  // 按分类分组
  const groupCounts = categories.map(
    cat => games.filter(g => g.category === cat.id).length
  );

  return (
    <GroupedVirtuoso
      style={{ height: '600px' }}
      groupCounts={groupCounts}
      groupContent={(index) => (
        <div className="category-header sticky">
          {categories[index].name}
        </div>
      )}
      itemContent={(index, groupIndex) => {
        const game = games[index];
        return <GameCard game={game} />;
      }}
    />
  );
}
```

### 无限滚动加载

```jsx
import { Virtuoso } from 'react-virtuoso';

function InfiniteGameList() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadMore = async () => {
    if (loading || !hasMore) return;
    
    setLoading(true);
    const newGames = await fetchGames({ 
      offset: games.length, 
      limit: 20 
    });
    
    setGames(prev => [...prev, ...newGames]);
    setHasMore(newGames.length === 20);
    setLoading(false);
  };

  return (
    <Virtuoso
      style={{ height: '100vh' }}
      data={games}
      endReached={loadMore}
      itemContent={(index, game) => (
        <GameCard game={game} />
      )}
      components={{
        Footer: () => loading ? <LoadingSpinner /> : null,
      }}
    />
  );
}
```

---

## ⚡ 性能优化技巧

### 1. 列表项 memo 化

```jsx
// ✅ 每个列表项都应该 memo
const GameCard = memo(function GameCard({ game, onSelect }) {
  return (
    <div className="game-card" onClick={() => onSelect(game.id)}>
      <img src={game.thumbnail} alt={game.name} />
      <h3>{game.name}</h3>
    </div>
  );
});

// 父组件中确保回调稳定
function GameList({ games }) {
  const handleSelect = useCallback((gameId) => {
    navigate(`/game/${gameId}`);
  }, [navigate]);

  return (
    <FixedSizeList {...props}>
      {({ index, style }) => (
        <GameCard 
          game={games[index]} 
          style={style}
          onSelect={handleSelect}
        />
      )}
    </FixedSizeList>
  );
}
```

### 2. 图片懒加载

```jsx
function GameCard({ game, style }) {
  const [imageLoaded, setImageLoaded] = useState(false);

  return (
    <div style={style} className="game-card">
      {/* 占位符 */}
      {!imageLoaded && <div className="image-placeholder" />}
      
      {/* 懒加载图片 */}
      <img
        src={game.thumbnail}
        alt={game.name}
        loading="lazy"
        onLoad={() => setImageLoaded(true)}
        style={{ display: imageLoaded ? 'block' : 'none' }}
      />
    </div>
  );
}
```

### 3. 使用 CSS contain

```css
.virtual-list-item {
  /* 告诉浏览器这个元素是独立的，优化渲染 */
  contain: layout style paint;
}

.virtual-list-container {
  /* 创建新的层叠上下文，减少重绘范围 */
  will-change: transform;
}
```

### 4. 避免滚动时重计算

```jsx
// ❌ 滚动时会触发重新计算
function GameList({ games, filter }) {
  // 每次渲染都过滤
  const filteredGames = games.filter(g => g.category === filter);
  
  return <FixedSizeList data={filteredGames} />;
}

// ✅ 缓存过滤结果
function GameList({ games, filter }) {
  const filteredGames = useMemo(
    () => games.filter(g => g.category === filter),
    [games, filter]
  );
  
  return <FixedSizeList data={filteredGames} />;
}
```

---

## 🔧 处理 Tricky 场景

### 动态高度 + react-window

react-window 不支持自动测量高度，需要手动处理：

```jsx
import { VariableSizeList } from 'react-window';

function DynamicHeightList({ items }) {
  const listRef = useRef();
  const rowHeights = useRef({});

  // 获取行高度
  const getRowHeight = (index) => {
    return rowHeights.current[index] || 50; // 默认高度
  };

  // 行渲染后更新高度
  const setRowHeight = (index, height) => {
    if (rowHeights.current[index] !== height) {
      rowHeights.current[index] = height;
      // 通知列表重新计算
      listRef.current?.resetAfterIndex(index);
    }
  };

  const Row = ({ index, style }) => {
    const rowRef = useRef();

    useEffect(() => {
      if (rowRef.current) {
        setRowHeight(index, rowRef.current.getBoundingClientRect().height);
      }
    }, [index]);

    return (
      <div style={style}>
        <div ref={rowRef}>
          <ItemContent item={items[index]} />
        </div>
      </div>
    );
  };

  return (
    <VariableSizeList
      ref={listRef}
      height={600}
      width="100%"
      itemCount={items.length}
      itemSize={getRowHeight}
      estimatedItemSize={50}
    >
      {Row}
    </VariableSizeList>
  );
}
```

### 跳转到指定位置

```jsx
function GameList({ games }) {
  const listRef = useRef();

  // 跳转到指定游戏
  const scrollToGame = (gameId) => {
    const index = games.findIndex(g => g.id === gameId);
    if (index !== -1) {
      listRef.current?.scrollToItem(index, 'center');
    }
  };

  return (
    <>
      <button onClick={() => scrollToGame('game-123')}>
        跳转到指定游戏
      </button>
      <FixedSizeList ref={listRef} {...props} />
    </>
  );
}
```

### 滚动位置恢复

```jsx
// 路由切换后恢复滚动位置
function GameList({ games }) {
  const listRef = useRef();
  const scrollPositionRef = useRef(0);

  // 保存滚动位置
  const handleScroll = ({ scrollOffset }) => {
    scrollPositionRef.current = scrollOffset;
    // 可以存到 sessionStorage
    sessionStorage.setItem('game-list-scroll', scrollOffset);
  };

  // 恢复滚动位置
  useEffect(() => {
    const savedPosition = sessionStorage.getItem('game-list-scroll');
    if (savedPosition && listRef.current) {
      listRef.current.scrollTo(Number(savedPosition));
    }
  }, []);

  return (
    <FixedSizeList
      ref={listRef}
      onScroll={handleScroll}
      {...props}
    />
  );
}
```

### Sticky Header

```jsx
// 使用 react-virtuoso 最简单
import { Virtuoso } from 'react-virtuoso';

function ListWithStickyHeader({ items }) {
  return (
    <Virtuoso
      data={items}
      components={{
        Header: () => (
          <div className="sticky-header">
            列表标题
          </div>
        ),
      }}
      itemContent={(index, item) => <ItemRow item={item} />}
    />
  );
}

// CSS
.sticky-header {
  position: sticky;
  top: 0;
  z-index: 1;
  background: white;
}
```

---

## 📊 验证优化效果

### 测量指标

| 指标 | 测量方法 | 目标 |
|------|----------|------|
| FPS | Chrome Performance | > 55 fps |
| 滚动延迟 | Performance 面板 | < 16ms |
| Long Task | Performance 面板 | 无 > 50ms 任务 |
| DOM 节点数 | Elements 面板 | < 100 |
| 内存占用 | Memory 面板 | 稳定不增长 |

### 对比测试

```jsx
// 添加性能监控
function PerformanceMonitor() {
  const [fps, setFps] = useState(0);
  
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    
    const loop = () => {
      frameCount++;
      const now = performance.now();
      
      if (now - lastTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastTime = now;
      }
      
      requestAnimationFrame(loop);
    };
    
    requestAnimationFrame(loop);
  }, []);
  
  return <div className="fps-monitor">FPS: {fps}</div>;
}
```

### 优化报告模板

```markdown
## 列表性能优化报告

### 场景：游戏列表 10000 条数据

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| 首次渲染时间 | 3200ms | 150ms | 95% |
| 滚动 FPS | 15 | 58 | 287% |
| DOM 节点数 | 10000+ | 25 | 99.7% |
| 内存占用 | 180MB | 45MB | 75% |

### 采用的优化手段
1. 使用 react-window FixedSizeList
2. 列表项 React.memo 化
3. 图片懒加载
4. 回调函数 useCallback
```

---

## 📚 相关笔记

- [性能排查清单](react-performance-checklist.md)
- [Memoization 实战指南](memoization-practical-guide.md)
- [React 渲染模型](../patterns/react-rendering-model.md)

---

## 参考资料

- [react-window](https://github.com/bvaughn/react-window)
- [react-virtuoso](https://virtuoso.dev/)
- [@tanstack/react-virtual](https://tanstack.com/virtual/latest)
- [Rendering large lists with React Virtualized](https://blog.logrocket.com/rendering-large-lists-with-react-virtualized/)

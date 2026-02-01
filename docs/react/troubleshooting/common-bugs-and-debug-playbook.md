# Troubleshooting：常见问题与调试手册

> 这篇笔记记录了我在 React 项目中遇到过的 Top 问题和排查套路。每个问题都是真实踩过的坑，抽象成了通用模式。面试时说"我遇到过这个问题"比说"我知道这个概念"更有说服力。

---

## 📋 问题速查表

| 症状 | 可能原因 | 跳转 |
|------|----------|------|
| 状态更新了但 UI 没变 | 闭包陷阱 / 引用没变 | [问题 1](#问题-1状态更新了但-ui-没变) |
| useEffect 无限循环 | 依赖不稳定 | [问题 2](#问题-2useeffect-无限循环) |
| 请求发了两次 | StrictMode / effect 重入 | [问题 3](#问题-3请求发了两次) |
| 输入框光标跳到末尾 | 非受控转受控 / key 变化 | [问题 4](#问题-4输入框光标跳到末尾) |
| 列表渲染顺序错乱 | key 不稳定 | [问题 5](#问题-5列表渲染顺序错乱) |
| 子组件不更新 | memo + 不稳定 props | [问题 6](#问题-6子组件不更新) |
| 内存泄漏警告 | 组件卸载后 setState | [问题 7](#问题-7内存泄漏警告) |
| 页面越用越卡 | 事件监听未清理 | [问题 8](#问题-8页面越用越卡) |

---

## 问题 1：状态更新了但 UI 没变

### 症状
```jsx
// 点击按钮，console 显示数组变了，但列表没更新
const [items, setItems] = useState([1, 2, 3]);

const addItem = () => {
  items.push(4);  // ❌ 直接修改
  setItems(items);
  console.log(items); // [1, 2, 3, 4] — 变了
};
```

### 原因
直接修改 state 对象/数组，引用没变，React 认为没有变化。

### 排查路径
```
UI 没更新
    │
    ▼
console.log state 值 ──变了──▶ 检查是否直接修改了 state
    │
  没变
    ▼
检查 setState 是否被调用
    │
    ▼
检查是否有条件阻止了 setState
```

### 解决方案
```jsx
// ✅ 创建新数组
const addItem = () => {
  setItems([...items, 4]);
};

// ✅ 使用函数式更新
const addItem = () => {
  setItems(prev => [...prev, 4]);
};

// ✅ 对于对象
const updateUser = () => {
  setUser(prev => ({ ...prev, name: 'new name' }));
};

// ✅ 使用 Immer 简化
import { produce } from 'immer';

const addItem = () => {
  setItems(produce(draft => {
    draft.push(4);  // 可以直接修改 draft
  }));
};
```

---

## 问题 2：useEffect 无限循环

### 症状
```jsx
// 页面打开就开始无限请求
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, [user]);  // ❌ 依赖了自己会更新的值

  return <div>{user?.name}</div>;
}
```

### 排查路径
```
无限循环
    │
    ▼
检查 useEffect 依赖数组
    │
    ├─ 依赖包含 state 本身 → 移除或重构
    │
    ├─ 依赖是每次渲染都新建的对象/数组/函数 → 稳定化
    │
    └─ 没有依赖数组 → 加上依赖数组
```

### 常见场景与解决

#### 场景 1：依赖对象/数组
```jsx
// ❌ 每次渲染 options 都是新对象
function Search({ query }) {
  const options = { query, limit: 10 };  // 新对象
  
  useEffect(() => {
    search(options);
  }, [options]);  // 每次都触发
}

// ✅ 解法 1：展开依赖
useEffect(() => {
  search({ query, limit: 10 });
}, [query]);  // 只依赖 query

// ✅ 解法 2：useMemo 稳定化
const options = useMemo(() => ({ query, limit: 10 }), [query]);

useEffect(() => {
  search(options);
}, [options]);
```

#### 场景 2：依赖函数
```jsx
// ❌ handleSearch 每次渲染都是新函数
function Search({ onSearch }) {
  useEffect(() => {
    onSearch('default');
  }, [onSearch]);  // 可能无限循环
}

// ✅ 父组件用 useCallback
function Parent() {
  const handleSearch = useCallback((query) => {
    // 搜索逻辑
  }, []);

  return <Search onSearch={handleSearch} />;
}
```

#### 场景 3：effect 内部更新依赖
```jsx
// ❌ 更新 count，触发 effect，又更新 count...
useEffect(() => {
  const timer = setInterval(() => {
    setCount(count + 1);  // 依赖 count
  }, 1000);
  return () => clearInterval(timer);
}, [count]);

// ✅ 用函数式更新，移除依赖
useEffect(() => {
  const timer = setInterval(() => {
    setCount(c => c + 1);  // 不依赖 count
  }, 1000);
  return () => clearInterval(timer);
}, []);  // 空依赖
```

---

## 问题 3：请求发了两次

### 症状
```jsx
// Network 面板显示同一个请求发了两次
function UserProfile({ userId }) {
  useEffect(() => {
    console.log('fetching...');  // 打印两次
    fetchUser(userId);
  }, [userId]);
}
```

### 原因
React 18 的 StrictMode 在开发环境会故意双重调用组件和 effect，帮助发现副作用问题。

### 排查路径
```
请求发了两次
    │
    ▼
只在开发环境？ ──Yes──▶ 可能是 StrictMode
    │
   No
    ▼
检查组件是否重复挂载
    │
    ▼
检查 effect 依赖是否不稳定
```

### 解决方案

#### 方案 1：这是预期行为，不用管

StrictMode 只在开发环境生效，生产环境正常。这是故意的，帮助你写出正确的 effect。

#### 方案 2：使用数据获取库

```jsx
// React Query / SWR 内置去重
import { useQuery } from '@tanstack/react-query';

function UserProfile({ userId }) {
  const { data } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
  });
  // 自动去重，不会重复请求
}
```

#### 方案 3：添加清理逻辑

```jsx
// 确保 effect 是"纯净"的
useEffect(() => {
  let cancelled = false;

  fetchUser(userId).then(user => {
    if (!cancelled) {
      setUser(user);
    }
  });

  return () => {
    cancelled = true;
  };
}, [userId]);
```

---

## 问题 4：输入框光标跳到末尾

### 症状
```jsx
// 在输入框中间输入，光标总是跳到末尾
function FormattedInput() {
  const [value, setValue] = useState('');

  const handleChange = (e) => {
    // 格式化输入
    const formatted = e.target.value.toUpperCase();
    setValue(formatted);
  };

  return <input value={value} onChange={handleChange} />;
}
```

### 原因
- 值被格式化后与 DOM 值不同步
- key 变化导致组件重建
- 从非受控切换为受控

### 排查路径
```
光标跳动
    │
    ▼
检查 value 是否被格式化/修改
    │
    ▼
检查组件的 key 是否变化
    │
    ▼
检查 value 是否从 undefined 变成有值
```

### 解决方案

```jsx
// ✅ 方案 1：延迟格式化
function FormattedInput() {
  const [value, setValue] = useState('');

  const handleChange = (e) => {
    setValue(e.target.value);  // 先原样保存
  };

  const handleBlur = () => {
    setValue(v => v.toUpperCase());  // 失焦时格式化
  };

  return (
    <input 
      value={value} 
      onChange={handleChange} 
      onBlur={handleBlur}
    />
  );
}

// ✅ 方案 2：手动控制光标
function FormattedInput() {
  const inputRef = useRef();
  const [value, setValue] = useState('');

  const handleChange = (e) => {
    const { selectionStart } = e.target;
    const formatted = e.target.value.toUpperCase();
    setValue(formatted);
    
    // 下一帧恢复光标位置
    requestAnimationFrame(() => {
      inputRef.current.setSelectionRange(selectionStart, selectionStart);
    });
  };

  return <input ref={inputRef} value={value} onChange={handleChange} />;
}

// ✅ 方案 3：避免从非受控变受控
// 初始值给空字符串，不要给 undefined
const [value, setValue] = useState('');  // ✅
const [value, setValue] = useState();    // ❌ undefined → 非受控
```

---

## 问题 5：列表渲染顺序错乱

### 症状
```jsx
// 删除中间一项后，后面的项都"错位"了
function TodoList({ todos }) {
  return (
    <ul>
      {todos.map((todo, index) => (
        <TodoItem key={index} todo={todo} />  {/* ❌ 用 index 作 key */}
      ))}
    </ul>
  );
}
```

### 原因
使用 index 作为 key，删除/插入时 key 对应的数据变了，React 复用了错误的组件实例。

### 排查路径
```
列表错乱
    │
    ▼
检查 key 是用什么值 ──index──▶ 改用唯一 id
    │
  唯一 id
    ▼
检查 id 是否真的唯一
    │
    ▼
检查是否有重复 id
```

### 解决方案
```jsx
// ✅ 使用唯一且稳定的 id
function TodoList({ todos }) {
  return (
    <ul>
      {todos.map(todo => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </ul>
  );
}

// ✅ 如果没有 id，生成一个
// 但注意：在创建数据时生成，不要在渲染时生成
const todosWithId = todos.map(todo => ({
  ...todo,
  id: todo.id || generateId(),
}));
```

### 何时可以用 index 作 key
- 列表是静态的，不会增删改排序
- 列表项没有自己的状态
- 不需要保持焦点、输入框值等

---

## 问题 6：子组件不更新

### 症状
```jsx
// 父组件 state 变了，但 memo 的子组件没更新
const Child = memo(function Child({ user, onUpdate }) {
  console.log('Child rendered');  // 不打印
  return <div>{user.name}</div>;
});

function Parent() {
  const [user, setUser] = useState({ name: 'Alice' });

  const handleUpdate = () => {
    setUser({ name: 'Bob' });
  };

  return <Child user={user} onUpdate={() => {}} />;  
  // ❌ onUpdate 每次都是新函数
}
```

### 原因
memo 默认浅比较，如果 props 是新对象/函数（即使内容相同），会认为"变了"。但如果某个 prop 总是新的，其他 prop 变化时反而可能不更新。

等等，这不对——如果 props 都是新的，memo 组件应该会更新才对。

让我重新分析这个问题：

### 真正的问题
```jsx
// 场景：期望更新但没更新
const Child = memo(function Child({ data }) {
  return <div>{data.value}</div>;
});

function Parent() {
  const [state, setState] = useState({ value: 1 });

  const mutateAndSet = () => {
    state.value = 2;  // ❌ 直接修改
    setState(state);  // 引用没变，memo 认为没变
  };

  return <Child data={state} />;
}
```

### 解决方案
```jsx
// ✅ 创建新对象
const mutateAndSet = () => {
  setState({ ...state, value: 2 });
};

// ✅ 或者自定义比较函数
const Child = memo(
  function Child({ data }) {
    return <div>{data.value}</div>;
  },
  (prevProps, nextProps) => {
    // 深比较或自定义比较逻辑
    return prevProps.data.value === nextProps.data.value;
  }
);
```

---

## 问题 7：内存泄漏警告

### 症状
```
Warning: Can't perform a React state update on an unmounted component.
```

### 原因
组件卸载后，异步操作完成时尝试 setState。

### 排查路径
```
内存泄漏警告
    │
    ▼
找到警告对应的组件
    │
    ▼
检查 useEffect 中的异步操作
    │
    ├─ 网络请求 → 添加取消逻辑
    │
    ├─ 定时器 → 清理定时器
    │
    └─ 事件订阅 → 取消订阅
```

### 解决方案

```jsx
// ❌ 问题代码
useEffect(() => {
  fetchData().then(data => setData(data));
}, []);

// ✅ 方案 1：标记位
useEffect(() => {
  let mounted = true;

  fetchData().then(data => {
    if (mounted) {
      setData(data);
    }
  });

  return () => {
    mounted = false;
  };
}, []);

// ✅ 方案 2：AbortController
useEffect(() => {
  const controller = new AbortController();

  fetchData({ signal: controller.signal })
    .then(setData)
    .catch(err => {
      if (err.name !== 'AbortError') throw err;
    });

  return () => controller.abort();
}, []);

// ✅ 方案 3：使用数据获取库
const { data } = useQuery(['data'], fetchData);
// 库内部处理了清理逻辑
```

---

## 问题 8：页面越用越卡

### 症状
- 刚打开页面正常，用一段时间后变卡
- 内存占用持续增长
- 切换页面后没有释放

### 原因
事件监听、定时器、订阅没有正确清理。

### 排查路径
```
页面越用越卡
    │
    ▼
打开 DevTools → Memory 面板
    │
    ▼
记录一次快照 → 操作页面 → 再记录
    │
    ▼
对比是否有对象持续增长
    │
    ▼
检查所有 useEffect 是否有清理函数
```

### 常见问题与解决

```jsx
// ❌ 问题：全局事件监听没清理
useEffect(() => {
  window.addEventListener('resize', handleResize);
  // 没有 return cleanup
}, []);

// ✅ 解决
useEffect(() => {
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);

// ❌ 问题：定时器没清理
useEffect(() => {
  const timer = setInterval(tick, 1000);
  // 没有 return
}, []);

// ✅ 解决
useEffect(() => {
  const timer = setInterval(tick, 1000);
  return () => clearInterval(timer);
}, []);

// ❌ 问题：WebSocket 没关闭
useEffect(() => {
  const ws = new WebSocket(url);
  ws.onmessage = handleMessage;
}, []);

// ✅ 解决
useEffect(() => {
  const ws = new WebSocket(url);
  ws.onmessage = handleMessage;
  return () => ws.close();
}, []);
```

---

## 🔧 通用调试技巧

### 添加渲染日志

```jsx
// 开发环境追踪组件渲染
function useWhyDidYouRender(name, props) {
  const previousProps = useRef();

  useEffect(() => {
    if (previousProps.current) {
      const changedProps = Object.entries(props).reduce((acc, [key, value]) => {
        if (previousProps.current[key] !== value) {
          acc[key] = {
            from: previousProps.current[key],
            to: value,
          };
        }
        return acc;
      }, {});

      if (Object.keys(changedProps).length > 0) {
        console.log(`[${name}] 重新渲染，变化的 props:`, changedProps);
      }
    }
    previousProps.current = props;
  });
}

// 使用
function MyComponent(props) {
  useWhyDidYouRender('MyComponent', props);
  return <div>...</div>;
}
```

### 最小化复现

遇到难以理解的 bug 时：

1. 创建一个空白的 React 项目
2. 只复制问题相关的代码
3. 逐步简化，直到找到最小复现
4. 这时候原因通常就清楚了

```jsx
// 最小复现示例：闭包陷阱
import { useState, useEffect } from 'react';

function App() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      console.log(count);  // 永远是 0
    }, 1000);
    return () => clearInterval(timer);
  }, []);  // 空依赖，闭包捕获了初始值

  return (
    <button onClick={() => setCount(c => c + 1)}>
      Count: {count}
    </button>
  );
}
```

---

## 📚 相关笔记

- [React 渲染模型](../patterns/react-rendering-model.md)
- [Memoization 实战指南](../performance/memoization-practical-guide.md)
- [测试分层策略](../testing/testing-strategy-layering.md)

---

## 参考资料

- [React Docs: Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks)
- [A Complete Guide to useEffect](https://overreacted.io/a-complete-guide-to-useeffect/)
- [React DevTools](https://react.dev/learn/react-developer-tools)

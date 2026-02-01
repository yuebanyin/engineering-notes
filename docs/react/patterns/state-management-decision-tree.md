# 状态管理决策树：useState / useReducer / Context / 外部库怎么选

> 状态管理是 React 项目中最容易"过度设计"或"设计不足"的领域。这篇笔记记录了我在多个项目中形成的选型思路：从游戏平台的 MobX 到 Expedia 的 Apollo Cache，什么场景用什么方案。

---

## 🎯 核心问题

**状态管理要解决什么？**
- 避免"prop drilling"（层层传递 props）
- 保持数据一致性（多处显示同一数据）
- 状态变化可追溯（调试、时间旅行）
- 支持复杂更新逻辑（多个字段联动）

**但选择太多方案也是问题**：
- 简单问题复杂化
- 维护成本增加
- 团队学习曲线

---

## 📊 决策树

```
需要管理什么状态？
    │
    ▼
只在一个组件内使用？ ──Yes──▶ useState
    │
   No
    ▼
只在父子组件间共享？ ──Yes──▶ props / 提升状态
    │
   No
    ▼
更新逻辑复杂（多字段联动）？ ──Yes──▶ useReducer
    │
   No
    ▼
需要跨多层组件共享？
    │
    ├─ 更新不频繁（主题、用户信息） ──▶ Context + useState/Reducer
    │
    └─ 更新频繁（表单、实时数据） ──▶ 外部状态库
                                          │
                                          ├─ 简单 → Zustand
                                          ├─ 需要 DevTools → Redux Toolkit
                                          └─ 响应式派 → MobX
```

---

## 🔧 各方案详解

### 1. useState：局部简单状态

**适用场景**：
- 组件内部状态
- 表单输入
- UI 状态（展开/折叠、选中/未选中）

```jsx
// ✅ 完美场景：简单的 UI 状态
function Accordion({ title, children }) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div>
      <button onClick={() => setIsOpen(!isOpen)}>
        {title} {isOpen ? '▼' : '▶'}
      </button>
      {isOpen && <div>{children}</div>}
    </div>
  );
}

// ✅ 表单状态
function SearchInput({ onSearch }) {
  const [query, setQuery] = useState('');
  
  return (
    <input 
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && onSearch(query)}
    />
  );
}
```

**边界信号**（该升级了）：
- 多个 useState 之间有依赖关系
- 更新逻辑开始变复杂
- 需要在多个组件间同步

### 2. useReducer：复杂更新逻辑

**适用场景**：
- 多个状态字段相互关联
- 状态更新有多种操作类型
- 想要更可预测的状态变化

```jsx
// 场景：复杂表单，多字段联动
const initialState = {
  checkIn: null,
  checkOut: null,
  guests: 1,
  roomType: 'standard',
  totalPrice: 0,
};

function bookingReducer(state, action) {
  switch (action.type) {
    case 'SET_CHECK_IN':
      // 如果入住日期晚于退房日期，自动调整
      const newCheckIn = action.payload;
      const checkOut = state.checkOut && newCheckIn >= state.checkOut
        ? addDays(newCheckIn, 1)
        : state.checkOut;
      return { 
        ...state, 
        checkIn: newCheckIn, 
        checkOut,
        totalPrice: calculatePrice({ ...state, checkIn: newCheckIn, checkOut })
      };
      
    case 'SET_CHECK_OUT':
      return { 
        ...state, 
        checkOut: action.payload,
        totalPrice: calculatePrice({ ...state, checkOut: action.payload })
      };
      
    case 'SET_ROOM_TYPE':
      return {
        ...state,
        roomType: action.payload,
        totalPrice: calculatePrice({ ...state, roomType: action.payload })
      };
      
    case 'RESET':
      return initialState;
      
    default:
      return state;
  }
}

function BookingForm() {
  const [state, dispatch] = useReducer(bookingReducer, initialState);
  
  return (
    <form>
      <DatePicker
        label="入住日期"
        value={state.checkIn}
        onChange={(date) => dispatch({ type: 'SET_CHECK_IN', payload: date })}
      />
      <DatePicker
        label="退房日期"
        value={state.checkOut}
        onChange={(date) => dispatch({ type: 'SET_CHECK_OUT', payload: date })}
      />
      <RoomTypeSelect
        value={state.roomType}
        onChange={(type) => dispatch({ type: 'SET_ROOM_TYPE', payload: type })}
      />
      <div>总价：¥{state.totalPrice}</div>
    </form>
  );
}
```

**优势**：
- 更新逻辑集中在 reducer，易于测试
- 状态变化可预测
- 便于添加日志、调试

**测试 reducer**：
```jsx
// 纯函数，易于测试
describe('bookingReducer', () => {
  it('设置入住日期时自动计算价格', () => {
    const state = { ...initialState, checkOut: new Date('2024-03-10') };
    const newState = bookingReducer(state, {
      type: 'SET_CHECK_IN',
      payload: new Date('2024-03-08'),
    });
    
    expect(newState.checkIn).toEqual(new Date('2024-03-08'));
    expect(newState.totalPrice).toBeGreaterThan(0);
  });
});
```

### 3. Context：跨组件共享

**适用场景**：
- 主题切换
- 用户认证信息
- 多语言设置
- 不频繁更新的全局配置

```jsx
// contexts/AuthContext.jsx
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 初始化时检查登录状态
    checkAuth().then(user => {
      setUser(user);
      setLoading(false);
    });
  }, []);

  const login = async (credentials) => {
    const user = await loginApi(credentials);
    setUser(user);
    return user;
  };

  const logout = async () => {
    await logoutApi();
    setUser(null);
  };

  // 稳定化 value 避免不必要的重渲染
  const value = useMemo(
    () => ({ user, loading, login, logout }),
    [user, loading]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// 自定义 hook，方便使用
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

// 使用
function UserMenu() {
  const { user, logout } = useAuth();
  
  if (!user) return <LoginButton />;
  
  return (
    <div>
      <span>{user.name}</span>
      <button onClick={logout}>退出</button>
    </div>
  );
}
```

### ⚠️ Context 的性能陷阱

**问题**：Context 值变化时，所有 Consumer 都会重渲染

```jsx
// ❌ 问题：任何状态变化都会让所有消费者重渲染
const AppContext = createContext();

function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState('light');
  const [notifications, setNotifications] = useState([]);

  return (
    <AppContext.Provider value={{ 
      user, setUser, 
      theme, setTheme, 
      notifications, setNotifications 
    }}>
      {children}
    </AppContext.Provider>
  );
}

// ✅ 解决：拆分 Context
const UserContext = createContext();
const ThemeContext = createContext();
const NotificationContext = createContext();

function AppProviders({ children }) {
  return (
    <UserProvider>
      <ThemeProvider>
        <NotificationProvider>
          {children}
        </NotificationProvider>
      </ThemeProvider>
    </UserProvider>
  );
}
```

### 4. 外部状态库

**何时需要**：
- 状态更新非常频繁
- 需要强大的 DevTools
- 复杂的异步逻辑
- 需要持久化、中间件等高级功能

#### Zustand：简洁首选

我在中小型项目中的首选。

```jsx
// stores/useBookingStore.js
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

const useBookingStore = create(
  devtools(
    persist(
      (set, get) => ({
        // 状态
        bookings: [],
        currentBooking: null,
        loading: false,
        
        // 同步操作
        setCurrentBooking: (booking) => set({ currentBooking: booking }),
        
        // 异步操作
        fetchBookings: async () => {
          set({ loading: true });
          try {
            const bookings = await fetchBookingsApi();
            set({ bookings, loading: false });
          } catch (error) {
            set({ loading: false });
            throw error;
          }
        },
        
        // 派生数据
        get confirmedBookings() {
          return get().bookings.filter(b => b.status === 'confirmed');
        },
      }),
      { name: 'booking-store' }  // localStorage key
    )
  )
);

// 使用：直接选择需要的状态
function BookingList() {
  // 只订阅 bookings，其他状态变化不会触发重渲染
  const bookings = useBookingStore(state => state.bookings);
  const fetchBookings = useBookingStore(state => state.fetchBookings);
  
  useEffect(() => {
    fetchBookings();
  }, []);
  
  return <List items={bookings} />;
}
```

#### MobX：响应式编程

我在游戏平台项目中使用过。

```jsx
// stores/GameStore.js
import { makeAutoObservable, runInAction } from 'mobx';

class GameStore {
  games = [];
  selectedGame = null;
  loading = false;

  constructor() {
    makeAutoObservable(this);
  }

  get popularGames() {
    return this.games.filter(g => g.rating > 4.5);
  }

  async fetchGames() {
    this.loading = true;
    try {
      const games = await fetchGamesApi();
      runInAction(() => {
        this.games = games;
        this.loading = false;
      });
    } catch (error) {
      runInAction(() => {
        this.loading = false;
      });
    }
  }

  selectGame(game) {
    this.selectedGame = game;
  }
}

export const gameStore = new GameStore();

// 使用
import { observer } from 'mobx-react-lite';

const GameList = observer(function GameList() {
  const { games, loading, fetchGames } = gameStore;
  
  useEffect(() => {
    fetchGames();
  }, []);
  
  if (loading) return <Spinner />;
  
  return <List items={games} />;
});
```

#### Redux Toolkit：企业级标准

大型项目、需要强规范时使用。

```jsx
// store/bookingSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

export const fetchBookings = createAsyncThunk(
  'booking/fetchBookings',
  async (userId) => {
    const response = await fetchBookingsApi(userId);
    return response.data;
  }
);

const bookingSlice = createSlice({
  name: 'booking',
  initialState: {
    items: [],
    status: 'idle',
    error: null,
  },
  reducers: {
    bookingAdded: (state, action) => {
      state.items.push(action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBookings.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchBookings.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchBookings.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message;
      });
  },
});

export const { bookingAdded } = bookingSlice.actions;
export default bookingSlice.reducer;
```

---

## 📋 选型对比表

| 维度 | useState | useReducer | Context | Zustand | MobX | Redux |
|------|----------|------------|---------|---------|------|-------|
| 上手难度 | ⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| 包大小 | 0 | 0 | 0 | ~1KB | ~15KB | ~10KB |
| DevTools | ❌ | ❌ | React DT | ✅ | ✅ | ✅✅ |
| 性能优化 | 手动 | 手动 | 手动拆分 | 自动 | 自动 | 手动 |
| 适合规模 | 小 | 中 | 中 | 中大 | 中大 | 大型 |

---

## 🚫 反面案例

### 把所有东西塞进 Context

```jsx
// ❌ 糟糕的做法
const GlobalContext = createContext();

function GlobalProvider({ children }) {
  // 把所有状态都放这里
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState('light');
  const [cart, setCart] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [filters, setFilters] = useState({});
  const [searchResults, setSearchResults] = useState([]);
  // ... 还有更多

  return (
    <GlobalContext.Provider value={{
      user, setUser,
      theme, setTheme,
      cart, setCart,
      // ... 一堆
    }}>
      {children}
    </GlobalContext.Provider>
  );
}
```

**问题**：
1. 任何状态变化都会导致所有消费者重渲染
2. 无法做细粒度的性能优化
3. 测试困难
4. 依赖关系不清晰

### 过早引入 Redux

```jsx
// ❌ 糟糕的做法：简单应用就上 Redux
// 3 个页面的小应用，用了 Redux：
// - 20+ 文件
// - action types、action creators、reducers、selectors...
// - 大量样板代码

// ✅ 应该：先用 useState + props，感到痛点再升级
```

---

## ✅ 验证状态设计

### 可测试性检查

```jsx
// 好的状态设计应该：

// 1. 更新逻辑是纯函数
function cartReducer(state, action) {
  // 无副作用，易于测试
}

// 2. 可以写 selector 测试
const selectTotalPrice = (state) => 
  state.cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

test('计算购物车总价', () => {
  const state = {
    cart: {
      items: [
        { price: 100, quantity: 2 },
        { price: 50, quantity: 1 },
      ]
    }
  };
  expect(selectTotalPrice(state)).toBe(250);
});
```

### 复杂度检查

问自己：
- [ ] 能用一句话描述这个状态的作用吗？
- [ ] 状态的生命周期是否清晰（何时创建、更新、销毁）？
- [ ] 有没有可以从其他状态派生的"冗余状态"？
- [ ] 更新逻辑是否集中、可追溯？

---

## 💡 我的实践原则

1. **从简单开始**：useState → useReducer → Context → 外部库
2. **感受痛点再升级**：不要预先优化
3. **拆分而非堆积**：多个小 Context 优于一个大 Context
4. **状态分类管理**：
   - 服务端数据 → React Query / Apollo
   - UI 状态 → 本地 state
   - 全局配置 → Context
   - 复杂业务状态 → Zustand / Redux

---

## 📚 相关笔记

- [React 渲染模型](react-rendering-model.md)
- [Memoization 实战指南](../performance/memoization-practical-guide.md)
- [数据获取工程化模式](data-fetching-patterns.md)

---

## 参考资料

- [React Docs: Managing State](https://react.dev/learn/managing-state)
- [Zustand](https://github.com/pmndrs/zustand)
- [Redux Toolkit](https://redux-toolkit.js.org/)
- [MobX](https://mobx.js.org/)

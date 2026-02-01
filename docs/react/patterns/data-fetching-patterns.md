# Data Fetching 工程化模式：请求、缓存、重试、竞态的完整解决方案

> 这篇笔记源于我在 Expedia 酒店预订系统中大规模使用 Apollo + GraphQL 的实践。从最初的"到处写 useEffect + fetch"到形成一套标准化的数据获取模式，这里记录了演进过程和最终方案。

---

## 🎯 核心问题

数据获取不只是"发请求拿数据"，还要处理：

| 问题 | 场景 |
|------|------|
| 状态管理 | loading / error / empty / success 四种状态 |
| 缓存一致性 | 数据更新后，各处显示要同步 |
| 重复请求 | 同一数据被多个组件请求 |
| 竞态条件 | 后发先至导致数据错乱 |
| 重试策略 | 网络抖动时的自动恢复 |
| 预取优化 | 提前加载用户可能需要的数据 |

---

## 📋 方案对比

### 手写 Hooks vs 数据获取库

| 维度 | 手写 useEffect | React Query / SWR | Apollo Client |
|------|----------------|-------------------|---------------|
| 上手成本 | 低 | 中 | 中高 |
| 缓存管理 | 手动 | 自动 | 自动 |
| 重复请求去重 | 手动 | 自动 | 自动 |
| 竞态处理 | 手动 | 自动 | 自动 |
| DevTools | 无 | 有 | 有 |
| 适用场景 | 简单项目 | REST API | GraphQL |

### 我的选型建议

```
项目选型决策树
    │
    ▼
使用 GraphQL？ ──Yes──▶ Apollo Client
    │
   No
    ▼
需要复杂缓存？ ──Yes──▶ React Query / TanStack Query
    │
   No
    ▼
只有几个简单请求？ ──Yes──▶ 手写 hook 或 SWR
    │
   No
    ▼
需要考虑包体积？ ──Yes──▶ SWR（更轻量）
    │
   No
    ▼
默认选择 React Query
```

---

## 🔧 手写 Hook 的标准模式

当项目简单到不需要引入库时，用这个模板：

```jsx
// hooks/useApi.js
import { useState, useEffect, useCallback, useRef } from 'react';

export function useApi(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // 用于取消过期请求，解决竞态问题
  const abortRef = useRef(null);
  
  const execute = useCallback(async () => {
    // 取消之前的请求
    if (abortRef.current) {
      abortRef.current.abort();
    }
    
    const controller = new AbortController();
    abortRef.current = controller;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await fetcher({ signal: controller.signal });
      
      // 检查是否被取消
      if (!controller.signal.aborted) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err);
        setData(null);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, deps);
  
  useEffect(() => {
    execute();
    
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [execute]);
  
  return { data, error, loading, refetch: execute };
}

// 使用示例
function HotelList({ destination }) {
  const { data, loading, error, refetch } = useApi(
    ({ signal }) => fetchHotels(destination, { signal }),
    [destination]
  );
  
  if (loading) return <Skeleton />;
  if (error) return <ErrorMessage error={error} onRetry={refetch} />;
  if (!data?.length) return <EmptyState />;
  
  return <List items={data} />;
}
```

### 添加重试逻辑

```jsx
// hooks/useApiWithRetry.js
export function useApiWithRetry(fetcher, options = {}) {
  const { 
    retries = 3, 
    retryDelay = 1000,
    deps = [] 
  } = options;
  
  const [state, setState] = useState({
    data: null,
    error: null,
    loading: true,
    retryCount: 0
  });
  
  const execute = useCallback(async (attempt = 0) => {
    setState(s => ({ ...s, loading: true, retryCount: attempt }));
    
    try {
      const result = await fetcher();
      setState({ data: result, error: null, loading: false, retryCount: 0 });
    } catch (err) {
      if (attempt < retries) {
        // 指数退避
        const delay = retryDelay * Math.pow(2, attempt);
        setTimeout(() => execute(attempt + 1), delay);
      } else {
        setState({ data: null, error: err, loading: false, retryCount: attempt });
      }
    }
  }, deps);
  
  useEffect(() => {
    execute();
  }, [execute]);
  
  return { ...state, refetch: () => execute(0) };
}
```

---

## 🚀 React Query / TanStack Query 实践

### 基础配置

```jsx
// lib/queryClient.js
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 数据过期时间：5 分钟
      staleTime: 5 * 60 * 1000,
      // 缓存保留时间：30 分钟
      gcTime: 30 * 60 * 1000,
      // 错误重试
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // 窗口聚焦时重新获取
      refetchOnWindowFocus: true,
    },
  },
});

// App.jsx
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

### 标准 Query Hook

```jsx
// hooks/useHotels.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// 定义 query key 常量，便于管理和失效
export const hotelKeys = {
  all: ['hotels'] as const,
  lists: () => [...hotelKeys.all, 'list'] as const,
  list: (filters) => [...hotelKeys.lists(), filters] as const,
  details: () => [...hotelKeys.all, 'detail'] as const,
  detail: (id) => [...hotelKeys.details(), id] as const,
};

// 获取酒店列表
export function useHotels(filters) {
  return useQuery({
    queryKey: hotelKeys.list(filters),
    queryFn: () => fetchHotels(filters),
    // 下拉刷新时保留旧数据
    placeholderData: (previousData) => previousData,
  });
}

// 获取酒店详情
export function useHotel(id) {
  return useQuery({
    queryKey: hotelKeys.detail(id),
    queryFn: () => fetchHotel(id),
    // 没有 id 时不请求
    enabled: !!id,
  });
}

// 预订酒店（mutation）
export function useBookHotel() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (bookingData) => createBooking(bookingData),
    onSuccess: (data, variables) => {
      // 使相关缓存失效
      queryClient.invalidateQueries({ queryKey: hotelKeys.detail(variables.hotelId) });
      // 或者直接更新缓存
      queryClient.setQueryData(
        hotelKeys.detail(variables.hotelId),
        (old) => ({ ...old, bookings: [...old.bookings, data] })
      );
    },
  });
}
```

### 组件中使用

```jsx
function HotelListPage() {
  const [filters, setFilters] = useState({ city: 'shenzhen', priceRange: [0, 1000] });
  
  const { data, isLoading, isError, error, refetch } = useHotels(filters);
  
  if (isLoading) return <HotelListSkeleton />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (!data?.length) return <EmptyState message="没有找到酒店" />;
  
  return (
    <div>
      <FilterPanel value={filters} onChange={setFilters} />
      <HotelList hotels={data} />
    </div>
  );
}
```

---

## 🌐 Apollo + GraphQL 实践

这是我在 Expedia 项目中的核心技术栈。

### Fragment 复用模式

```graphql
# fragments/hotel.graphql

# 列表展示需要的字段
fragment HotelListItem on Hotel {
  id
  name
  thumbnail
  rating
  reviewCount
  pricePerNight
  location {
    city
    district
  }
}

# 详情页需要的完整字段
fragment HotelDetail on Hotel {
  ...HotelListItem
  description
  amenities
  photos {
    url
    caption
  }
  rooms {
    id
    type
    price
    availability
  }
}
```

### Query 定义

```jsx
// queries/hotels.js
import { gql } from '@apollo/client';

export const GET_HOTELS = gql`
  query GetHotels($filters: HotelFiltersInput!, $pagination: PaginationInput) {
    hotels(filters: $filters, pagination: $pagination) {
      edges {
        node {
          ...HotelListItem
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
  ${HOTEL_LIST_ITEM_FRAGMENT}
`;

export const GET_HOTEL = gql`
  query GetHotel($id: ID!) {
    hotel(id: $id) {
      ...HotelDetail
    }
  }
  ${HOTEL_DETAIL_FRAGMENT}
`;
```

### Hook 封装

```jsx
// hooks/useHotelQueries.js
import { useQuery, useMutation, useApolloClient } from '@apollo/client';

export function useHotels(filters) {
  const { data, loading, error, fetchMore, refetch } = useQuery(GET_HOTELS, {
    variables: { filters, pagination: { first: 20 } },
    // 网络优先，但有缓存时先显示
    fetchPolicy: 'cache-and-network',
    // 错误时也显示部分数据
    errorPolicy: 'all',
  });

  const loadMore = () => {
    if (!data?.hotels.pageInfo.hasNextPage) return;
    
    fetchMore({
      variables: {
        pagination: {
          first: 20,
          after: data.hotels.pageInfo.endCursor,
        },
      },
    });
  };

  return {
    hotels: data?.hotels.edges.map(e => e.node) ?? [],
    loading,
    error,
    hasMore: data?.hotels.pageInfo.hasNextPage ?? false,
    loadMore,
    refetch,
  };
}
```

### 查询批处理优化

```jsx
// apollo-client.js
import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';
import { BatchHttpLink } from '@apollo/client/link/batch-http';

const link = new BatchHttpLink({
  uri: '/graphql',
  // 10ms 内的请求合并发送
  batchInterval: 10,
  // 最多合并 10 个请求
  batchMax: 10,
});

export const apolloClient = new ApolloClient({
  link,
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          // 分页数据合并策略
          hotels: {
            keyArgs: ['filters'],
            merge(existing, incoming, { args }) {
              if (!args?.pagination?.after) {
                return incoming;
              }
              return {
                ...incoming,
                edges: [...(existing?.edges ?? []), ...incoming.edges],
              };
            },
          },
        },
      },
    },
  }),
});
```

---

## ⚡ 缓存策略详解

### Stale-While-Revalidate 模式

```jsx
// React Query 默认支持
const { data } = useQuery({
  queryKey: ['hotels'],
  queryFn: fetchHotels,
  staleTime: 5 * 60 * 1000,  // 5 分钟内认为是新鲜的
  // 过期后：先返回缓存，同时后台刷新
});

// Apollo 实现
const { data } = useQuery(GET_HOTELS, {
  fetchPolicy: 'cache-and-network',  // 先用缓存，同时请求最新
});
```

### 预取（Prefetching）

```jsx
// React Query 预取
function HotelCard({ hotel }) {
  const queryClient = useQueryClient();
  
  const prefetchDetail = () => {
    queryClient.prefetchQuery({
      queryKey: hotelKeys.detail(hotel.id),
      queryFn: () => fetchHotel(hotel.id),
      staleTime: 5 * 60 * 1000,
    });
  };
  
  return (
    <Link 
      to={`/hotel/${hotel.id}`}
      onMouseEnter={prefetchDetail}  // 悬停时预取
    >
      {hotel.name}
    </Link>
  );
}

// Apollo 预取
function HotelCard({ hotel }) {
  const client = useApolloClient();
  
  const prefetchDetail = () => {
    client.query({
      query: GET_HOTEL,
      variables: { id: hotel.id },
    });
  };
  
  return (
    <Link to={`/hotel/${hotel.id}`} onMouseEnter={prefetchDetail}>
      {hotel.name}
    </Link>
  );
}
```

### 乐观更新（Optimistic Update）

```jsx
// 场景：收藏酒店，立即显示收藏状态，不等服务器响应
function useFavoriteHotel() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (hotelId) => favoriteHotel(hotelId),
    
    // 乐观更新
    onMutate: async (hotelId) => {
      // 取消正在进行的查询
      await queryClient.cancelQueries({ queryKey: hotelKeys.detail(hotelId) });
      
      // 保存之前的数据
      const previousHotel = queryClient.getQueryData(hotelKeys.detail(hotelId));
      
      // 乐观更新
      queryClient.setQueryData(hotelKeys.detail(hotelId), (old) => ({
        ...old,
        isFavorited: true,
      }));
      
      return { previousHotel };
    },
    
    // 失败时回滚
    onError: (err, hotelId, context) => {
      queryClient.setQueryData(
        hotelKeys.detail(hotelId),
        context.previousHotel
      );
    },
    
    // 成功或失败后都重新获取
    onSettled: (data, error, hotelId) => {
      queryClient.invalidateQueries({ queryKey: hotelKeys.detail(hotelId) });
    },
  });
}
```

---

## 🛡️ 并发问题处理

### 竞态条件（Race Condition）

**问题**：用户快速切换筛选条件，后发的请求可能先返回

```jsx
// ❌ 问题代码
function HotelList({ filters }) {
  const [hotels, setHotels] = useState([]);
  
  useEffect(() => {
    fetchHotels(filters).then(setHotels);
    // 如果 filters 快速变化：
    // 请求1（filters=A）发出
    // 请求2（filters=B）发出
    // 请求2 返回 → setHotels(B的结果)
    // 请求1 返回 → setHotels(A的结果) ← 错了！显示的是旧数据
  }, [filters]);
}

// ✅ 解决方案1：AbortController
useEffect(() => {
  const controller = new AbortController();
  
  fetchHotels(filters, { signal: controller.signal })
    .then(setHotels)
    .catch(err => {
      if (err.name !== 'AbortError') throw err;
    });
  
  return () => controller.abort();
}, [filters]);

// ✅ 解决方案2：请求标识
useEffect(() => {
  let cancelled = false;
  
  fetchHotels(filters).then(data => {
    if (!cancelled) setHotels(data);
  });
  
  return () => { cancelled = true; };
}, [filters]);

// ✅ 解决方案3：用 React Query / Apollo（自动处理）
```

### 重复请求去重

```jsx
// React Query 自动去重：相同 queryKey 的请求只发一次
// 多个组件同时 mount 时：
<HotelPrice hotelId="123" />  // 发请求
<HotelRating hotelId="123" /> // 复用第一个请求
<HotelInfo hotelId="123" />   // 复用第一个请求
```

---

## 🚨 统一错误处理

### Error Boundary + Toast 模式

```jsx
// components/QueryErrorBoundary.jsx
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';

export function QueryErrorBoundary({ children }) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ error, resetErrorBoundary }) => (
            <div className="error-state">
              <p>出错了：{error.message}</p>
              <button onClick={resetErrorBoundary}>重试</button>
            </div>
          )}
        >
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}

// 使用
function HotelPage() {
  return (
    <QueryErrorBoundary>
      <Suspense fallback={<Loading />}>
        <HotelContent />
      </Suspense>
    </QueryErrorBoundary>
  );
}
```

### 全局错误通知

```jsx
// 在 QueryClient 配置全局错误处理
const queryClient = new QueryClient({
  defaultOptions: {
    mutations: {
      onError: (error) => {
        toast.error(error.message || '操作失败，请重试');
      },
    },
  },
});
```

---

## 🧪 如何测试数据获取

### Mock 网络请求

```jsx
// tests/hotels.test.jsx
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.get('/api/hotels', (req, res, ctx) => {
    return res(ctx.json([
      { id: '1', name: '测试酒店' }
    ]));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('加载并显示酒店列表', async () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <HotelList />
    </QueryClientProvider>
  );

  expect(screen.getByText('加载中...')).toBeInTheDocument();
  
  await waitFor(() => {
    expect(screen.getByText('测试酒店')).toBeInTheDocument();
  });
});

test('不会重复请求', async () => {
  let requestCount = 0;
  server.use(
    rest.get('/api/hotels', (req, res, ctx) => {
      requestCount++;
      return res(ctx.json([]));
    })
  );

  // 渲染两个使用相同数据的组件
  render(
    <QueryClientProvider client={queryClient}>
      <HotelList />
      <HotelCount />
    </QueryClientProvider>
  );

  await waitFor(() => {
    expect(requestCount).toBe(1);  // 只请求了一次
  });
});
```

---

## 📚 相关笔记

- [状态管理决策树](state-management-decision-tree.md)
- [测试分层策略](../testing/testing-strategy-layering.md)
- [React 渲染模型](react-rendering-model.md)

---

## 参考资料

- [TanStack Query Docs](https://tanstack.com/query/latest)
- [Apollo Client Docs](https://www.apollographql.com/docs/react/)
- [SWR](https://swr.vercel.app/)
- [Stale-While-Revalidate](https://web.dev/stale-while-revalidate/)

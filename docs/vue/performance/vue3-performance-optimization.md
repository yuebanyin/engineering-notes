# Vue 3 性能优化实战指南

## 概述

本文系统性地介绍 Vue 3 性能优化的核心策略，涵盖响应式优化、渲染优化、打包优化和运行时诊断，帮助构建高性能的 Vue 应用。

---

## 一、响应式系统优化

### 1.1 选择正确的响应式 API

```javascript
// 🔴 性能陷阱：大型对象全量响应式
const state = reactive({
  config: hugeConfigObject,      // 数百个属性
  tableData: largeDataset,       // 上万条数据
  cache: new Map()               // 频繁更新的缓存
})

// ✅ 优化：使用 shallowRef/shallowReactive
const config = shallowRef(hugeConfigObject)
const tableData = shallowRef(largeDataset)

// 更新时整体替换
tableData.value = newDataset

// ✅ 优化：使用 markRaw 排除不需要响应的数据
import { markRaw } from 'vue'

const state = reactive({
  // 第三方库实例不需要响应式
  echartInstance: markRaw(echarts.init(dom)),
  // 大型静态数据
  geoJson: markRaw(largeGeoJsonData),
  // 只读配置
  constants: markRaw(Object.freeze(CONFIG))
})
```

### 1.2 避免响应式追踪开销

```javascript
// 🔴 问题：computed 中访问大量属性
const summary = computed(() => {
  // 每个属性都会被追踪
  return items.value.reduce((acc, item) => {
    acc.total += item.price * item.quantity
    acc.count += item.quantity
    acc.categories.add(item.category)
    // ... 更多计算
    return acc
  }, { total: 0, count: 0, categories: new Set() })
})

// ✅ 优化：使用 toRaw 避免追踪
import { toRaw } from 'vue'

const summary = computed(() => {
  const rawItems = toRaw(items.value)  // 获取原始数据
  return rawItems.reduce((acc, item) => {
    // 操作原始对象，无响应式开销
    acc.total += item.price * item.quantity
    return acc
  }, { total: 0, count: 0 })
})

// ✅ 优化：批量更新时暂停追踪
import { pauseTracking, resetTracking } from 'vue'

function batchUpdate(items) {
  pauseTracking()
  try {
    items.forEach(item => {
      // 批量操作，不触发更新
      state.items.push(item)
    })
  } finally {
    resetTracking()
  }
  // 手动触发一次更新
  triggerRef(state)
}
```

### 1.3 合理使用 computed 缓存

```javascript
// ✅ computed 自动缓存
const sortedList = computed(() => {
  console.log('sorting...')  // 只在依赖变化时执行
  return [...list.value].sort((a, b) => a.order - b.order)
})

// 多次访问不会重复计算
template: `
  <div>{{ sortedList.length }}</div>
  <ul>
    <li v-for="item in sortedList">{{ item.name }}</li>
  </ul>
`

// 🔴 错误：在 computed 中使用 Date.now()
const timestamp = computed(() => Date.now())  // 永远不更新！

// ✅ 正确：需要定时更新的值用 ref
const now = ref(Date.now())
setInterval(() => now.value = Date.now(), 1000)
```

---

## 二、渲染优化

### 2.1 静态内容优化

```vue
<!-- ✅ v-once：一次性渲染，永不更新 -->
<template>
  <header v-once>
    <h1>{{ title }}</h1>
    <p>{{ description }}</p>
  </header>
</template>

<!-- ✅ v-memo：条件性缓存（Vue 3.2+） -->
<template>
  <div v-for="item in list" :key="item.id" v-memo="[item.selected]">
    <!-- 只有 item.selected 变化时才重新渲染整个 div -->
    <span>{{ item.name }}</span>
    <span>{{ item.description }}</span>
    <ExpensiveComponent :data="item" />
    <span :class="{ active: item.selected }">Status</span>
  </div>
</template>

<!-- v-memo 的工作原理 -->
<!-- 
  1. 首次渲染：正常渲染并缓存 VNode
  2. 后续更新：比较 v-memo 数组
     - 相同：跳过该节点的 diff
     - 不同：重新渲染
-->

<!-- ⚠️ v-memo 注意事项 -->
<!-- 不要在 v-memo 的子节点中依赖未列出的响应式数据 -->
<div v-for="item in list" :key="item.id" v-memo="[item.selected]">
  {{ globalCount }}  <!-- 🔴 globalCount 变化不会触发更新！ -->
</div>
```

### 2.2 列表渲染优化

```vue
<!-- ✅ 始终使用唯一且稳定的 key -->
<template>
  <TransitionGroup name="list">
    <div v-for="item in items" :key="item.id">
      {{ item.name }}
    </div>
  </TransitionGroup>
</template>

<script setup>
// ✅ 虚拟滚动：大列表必备
import { RecycleScroller } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
</script>

<template>
  <!-- 只渲染可视区域的 DOM -->
  <RecycleScroller
    class="scroller"
    :items="largeList"
    :item-size="50"
    key-field="id"
  >
    <template #default="{ item }">
      <div class="item">
        {{ item.name }}
      </div>
    </template>
  </RecycleScroller>
</template>

<style>
.scroller {
  height: 400px;
}
</style>
```

```javascript
// ✅ 分页/无限滚动加载
export function useInfiniteScroll(fetchFn, options = {}) {
  const items = ref([])
  const page = ref(1)
  const isLoading = ref(false)
  const hasMore = ref(true)
  
  const loadMore = async () => {
    if (isLoading.value || !hasMore.value) return
    
    isLoading.value = true
    try {
      const newItems = await fetchFn(page.value)
      if (newItems.length < options.pageSize) {
        hasMore.value = false
      }
      items.value.push(...newItems)
      page.value++
    } finally {
      isLoading.value = false
    }
  }
  
  // 监听滚动到底部
  const containerRef = ref(null)
  onMounted(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) loadMore()
      },
      { threshold: 0.1 }
    )
    // 观察底部哨兵元素
    if (containerRef.value) {
      observer.observe(containerRef.value.querySelector('.sentinel'))
    }
  })
  
  return { items, isLoading, hasMore, loadMore, containerRef }
}
```

### 2.3 组件级优化

```javascript
// ✅ 异步组件：按需加载
import { defineAsyncComponent } from 'vue'

const HeavyChart = defineAsyncComponent({
  loader: () => import('./HeavyChart.vue'),
  loadingComponent: LoadingSpinner,
  delay: 200,  // 延迟显示 loading，避免闪烁
  timeout: 10000,
  errorComponent: ErrorFallback,
  onError(error, retry, fail, attempts) {
    if (attempts <= 3) {
      retry()  // 自动重试
    } else {
      fail()
    }
  }
})

// ✅ 路由级别懒加载
const routes = [
  {
    path: '/dashboard',
    component: () => import('./views/Dashboard.vue'),
    // 魔法注释：webpack chunk 命名
    // component: () => import(/* webpackChunkName: "dashboard" */ './views/Dashboard.vue')
  }
]

// ✅ KeepAlive 缓存组件状态
<template>
  <KeepAlive :include="cachedViews" :max="10">
    <RouterView />
  </KeepAlive>
</template>

<script setup>
const cachedViews = ref(['Dashboard', 'UserList'])  // 按组件 name 匹配

// 在组件中处理激活/停用
onActivated(() => {
  // 从缓存中恢复时调用
  refreshData()
})

onDeactivated(() => {
  // 进入缓存时调用
  pauseTimer()
})
</script>
```

---

## 三、打包与加载优化

### 3.1 代码分割策略

```javascript
// vite.config.js
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // 分离第三方库
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router', 'pinia'],
          'ui-vendor': ['element-plus'],
          'utils': ['lodash-es', 'dayjs'],
        },
        // 或动态分割
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('element-plus')) {
              return 'element-plus'
            }
            if (id.includes('@vue')) {
              return 'vue-vendor'
            }
            return 'vendor'
          }
        }
      }
    },
    // 资源内联阈值
    assetsInlineLimit: 4096,  // 4kb 以下内联为 base64
    // chunk 大小警告阈值
    chunkSizeWarningLimit: 500,
  }
})
```

### 3.2 Tree-shaking 优化

```javascript
// ✅ 按需导入 Vue API
import { ref, computed, watch } from 'vue'

// ✅ 按需导入 UI 组件库
// 使用 unplugin-vue-components 自动按需导入
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig({
  plugins: [
    Components({
      resolvers: [ElementPlusResolver()],
    }),
  ],
})

// ✅ lodash 使用 lodash-es
import { debounce, throttle } from 'lodash-es'
// 或单独导入
import debounce from 'lodash-es/debounce'

// 🔴 避免：导入整个库
import _ from 'lodash'
import ElementPlus from 'element-plus'
```

### 3.3 资源加载优化

```html
<!-- index.html -->
<head>
  <!-- 预加载关键资源 -->
  <link rel="preload" href="/fonts/main.woff2" as="font" crossorigin>
  
  <!-- 预连接第三方域名 -->
  <link rel="preconnect" href="https://api.example.com">
  <link rel="dns-prefetch" href="https://cdn.example.com">
</head>
```

```javascript
// ✅ 图片懒加载
<template>
  <img v-lazy="imageSrc" alt="description" />
</template>

// 使用 IntersectionObserver 自定义指令
const vLazy = {
  mounted(el, binding) {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        el.src = binding.value
        observer.disconnect()
      }
    })
    observer.observe(el)
  }
}

// ✅ 关键 CSS 内联
// vite.config.js - 使用 vite-plugin-critical
import critical from 'vite-plugin-critical'

export default defineConfig({
  plugins: [
    critical({
      criticalUrl: 'http://localhost:5173',
      criticalBase: './dist',
      criticalPages: [{ uri: '/', template: 'index' }],
    })
  ]
})
```

---

## 四、运行时性能诊断

### 4.1 Vue DevTools 性能分析

```javascript
// 开启性能追踪
// main.js
app.config.performance = true

// 在 DevTools Performance 面板可以看到：
// - component create
// - component mount
// - component update
// - component render
```

### 4.2 响应式调试钩子

```javascript
// 追踪依赖收集
onRenderTracked((event) => {
  console.log('依赖被追踪:', {
    target: event.target,
    key: event.key,
    type: event.type
  })
})

// 追踪更新触发
onRenderTriggered((event) => {
  console.log('更新被触发:', {
    target: event.target,
    key: event.key,
    type: event.type,
    oldValue: event.oldValue,
    newValue: event.newValue
  })
})

// 调试特定 watch
watch(source, callback, {
  onTrack(e) {
    debugger  // 断点调试
  },
  onTrigger(e) {
    debugger
  }
})
```

### 4.3 性能指标监控

```javascript
// 自定义性能监控
export function usePerformanceMonitor() {
  const metrics = reactive({
    renderCount: 0,
    lastRenderTime: 0,
    avgRenderTime: 0
  })
  
  let totalTime = 0
  
  onBeforeUpdate(() => {
    metrics.lastRenderTime = performance.now()
  })
  
  onUpdated(() => {
    const duration = performance.now() - metrics.lastRenderTime
    metrics.renderCount++
    totalTime += duration
    metrics.avgRenderTime = totalTime / metrics.renderCount
    
    // 渲染时间过长告警
    if (duration > 16) {  // 超过一帧 (60fps)
      console.warn(`Slow render: ${duration.toFixed(2)}ms`)
    }
  })
  
  return { metrics }
}

// Web Vitals 监控
import { onCLS, onFID, onLCP, onFCP, onTTFB } from 'web-vitals'

function reportMetric(metric) {
  console.log(metric.name, metric.value)
  // 发送到监控平台
}

onCLS(reportMetric)   // Cumulative Layout Shift
onFID(reportMetric)   // First Input Delay
onLCP(reportMetric)   // Largest Contentful Paint
onFCP(reportMetric)   // First Contentful Paint
onTTFB(reportMetric)  // Time to First Byte
```

---

## 五、性能优化清单

### 开发阶段
- [ ] 合理选择 ref/reactive/shallowRef
- [ ] 大型静态数据使用 markRaw
- [ ] 避免在模板中使用复杂表达式
- [ ] 使用 computed 缓存计算结果
- [ ] 列表渲染使用稳定唯一 key

### 组件设计
- [ ] 按功能拆分组件，避免单组件过大
- [ ] 使用异步组件懒加载
- [ ] 合理使用 KeepAlive 缓存
- [ ] 大列表使用虚拟滚动
- [ ] 静态内容使用 v-once

### 打包优化
- [ ] 配置合理的代码分割策略
- [ ] 确保第三方库 Tree-shaking 生效
- [ ] UI 库按需引入
- [ ] 图片资源优化（压缩、CDN、懒加载）
- [ ] 开启 gzip/brotli 压缩

### 监控告警
- [ ] 开启 Vue 性能追踪
- [ ] 集成 Web Vitals 监控
- [ ] 设置渲染时间告警阈值
- [ ] 定期进行 Lighthouse 审计

---

## 总结

Vue 3 性能优化的核心策略：

1. **响应式优化**：选择正确的 API，避免不必要的响应式转换
2. **渲染优化**：v-once/v-memo、虚拟滚动、合理的 key
3. **组件优化**：异步加载、KeepAlive 缓存
4. **打包优化**：代码分割、Tree-shaking、资源优化
5. **持续监控**：DevTools、性能钩子、Web Vitals

---

## 延伸阅读

- [Vue 3 官方性能指南](https://vuejs.org/guide/best-practices/performance.html)
- [Web Vitals](https://web.dev/vitals/)
- [vue-virtual-scroller](https://github.com/Akryum/vue-virtual-scroller)

## 参考资料

- [Vue 3 响应式原理](https://vuejs.org/guide/extras/reactivity-in-depth.html)
- [Vite 构建优化](https://vitejs.dev/guide/build.html)

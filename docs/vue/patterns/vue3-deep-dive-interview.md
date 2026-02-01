# Vue 3 重难点与高频面试题深度解析

## 概述

本文聚焦 Vue 3 实践中的核心难点和面试高频考点，深入剖析响应式原理、Composition API 设计思想、性能优化机制等关键主题，帮助建立系统性的 Vue 3 知识体系。

---

## 一、响应式系统深度剖析

### 1.1 Proxy 响应式核心实现

**面试高频：手写简化版 reactive**

```javascript
// 依赖收集的核心数据结构
// WeakMap<target, Map<key, Set<effect>>>
const targetMap = new WeakMap()
let activeEffect = null

function track(target, key) {
  if (!activeEffect) return
  
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }
  
  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = new Set()))
  }
  
  dep.add(activeEffect)
}

function trigger(target, key) {
  const depsMap = targetMap.get(target)
  if (!depsMap) return
  
  const dep = depsMap.get(key)
  if (dep) {
    dep.forEach(effect => effect())
  }
}

function reactive(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      const result = Reflect.get(target, key, receiver)
      track(target, key)  // 依赖收集
      // 深层响应式
      if (typeof result === 'object' && result !== null) {
        return reactive(result)
      }
      return result
    },
    set(target, key, value, receiver) {
      const oldValue = target[key]
      const result = Reflect.set(target, key, value, receiver)
      if (oldValue !== value) {
        trigger(target, key)  // 触发更新
      }
      return result
    }
  })
}

function effect(fn) {
  activeEffect = fn
  fn()  // 首次执行，触发 get，完成依赖收集
  activeEffect = null
}

// 使用示例
const state = reactive({ count: 0 })
effect(() => {
  console.log('count:', state.count)  // 自动追踪 count 依赖
})
state.count++  // 触发更新，打印 "count: 1"
```

### 1.2 ref vs reactive 设计哲学

**面试高频：为什么需要 ref？**

```javascript
// 问题：Proxy 无法代理原始值
const num = 0
const proxy = new Proxy(num, {}) // ❌ 报错！

// 解决：ref 通过对象包装实现响应式
function ref(value) {
  return {
    get value() {
      track(this, 'value')
      return value
    },
    set value(newVal) {
      if (newVal !== value) {
        value = newVal
        trigger(this, 'value')
      }
    }
  }
}

// 实际 Vue 3 中 ref 的简化版实现
class RefImpl {
  private _value
  private _rawValue
  public dep = new Set()
  public readonly __v_isRef = true
  
  constructor(value) {
    this._rawValue = value
    this._value = toReactive(value)  // 对象会转为 reactive
  }
  
  get value() {
    trackRefValue(this)
    return this._value
  }
  
  set value(newVal) {
    if (hasChanged(newVal, this._rawValue)) {
      this._rawValue = newVal
      this._value = toReactive(newVal)
      triggerRefValue(this)
    }
  }
}
```

**何时用 ref，何时用 reactive？**

```javascript
// ✅ ref 适用场景
const count = ref(0)           // 原始值
const user = ref(null)         // 可能整体替换的对象
const list = ref([])           // 可能整体替换的数组

// ✅ reactive 适用场景
const form = reactive({        // 不会整体替换的对象
  name: '',
  email: '',
  age: 0
})

// ⚠️ 常见错误
const state = reactive({ user: null })
state.user = { name: 'John' }  // ✅ 正确，修改属性
state = { user: null }         // ❌ 错误，丢失响应性

const user = ref(null)
user.value = { name: 'John' }  // ✅ 正确，可以整体替换
```

### 1.3 响应式丢失与保持

**面试高频：toRef/toRefs/unref 的使用场景**

```javascript
// 问题：解构 reactive 对象会丢失响应性
const state = reactive({ x: 1, y: 2 })
const { x, y } = state  // x, y 是普通值，不响应

// 解决方案 1: toRefs
const { x, y } = toRefs(state)  // x, y 是 ref，保持响应性
console.log(x.value)  // 1

// 解决方案 2: toRef（单个属性）
const x = toRef(state, 'x')

// toRef 实现原理
function toRef(object, key) {
  return {
    get value() {
      return object[key]  // 直接读取原对象
    },
    set value(newVal) {
      object[key] = newVal  // 直接修改原对象
    }
  }
}

// 组合函数中的应用
function useFeature(maybeRef) {
  // 统一处理 ref 和普通值
  const value = unref(maybeRef)  // 如果是 ref 返回 .value，否则返回原值
  
  // 或者确保是 ref
  const valueRef = isRef(maybeRef) ? maybeRef : ref(maybeRef)
}

// 实战：props 保持响应性
export function useCounter(props) {
  // ❌ 错误：解构丢失响应性
  const { initialCount } = props
  
  // ✅ 正确：使用 toRef
  const initialCount = toRef(props, 'initialCount')
  
  // ✅ 或使用 computed
  const initialCount = computed(() => props.initialCount)
}
```

---

## 二、Composition API 实战精要

### 2.1 Composables 设计原则

**面试高频：如何设计可复用的组合函数？**

```javascript
// ✅ 良好的 composable 设计
export function useMouse() {
  const x = ref(0)
  const y = ref(0)
  
  function update(event) {
    x.value = event.pageX
    y.value = event.pageY
  }
  
  // 生命周期绑定
  onMounted(() => window.addEventListener('mousemove', update))
  onUnmounted(() => window.removeEventListener('mousemove', update))
  
  // 返回响应式状态
  return { x, y }
}

// ✅ 支持配置的 composable
export function useFetch(url, options = {}) {
  const data = ref(null)
  const error = ref(null)
  const isLoading = ref(false)
  
  // 支持 ref 类型的 url（自动重新请求）
  const urlValue = computed(() => unref(url))
  
  async function execute() {
    isLoading.value = true
    error.value = null
    
    try {
      const response = await fetch(urlValue.value, options)
      data.value = await response.json()
    } catch (e) {
      error.value = e
    } finally {
      isLoading.value = false
    }
  }
  
  // 立即执行或手动触发
  if (options.immediate !== false) {
    execute()
  }
  
  // 监听 url 变化
  if (isRef(url)) {
    watch(url, execute)
  }
  
  return {
    data,
    error,
    isLoading,
    execute,  // 暴露手动触发方法
  }
}

// 使用方式
const { data, isLoading, execute } = useFetch('/api/users')
const { data: user } = useFetch(
  computed(() => `/api/users/${userId.value}`)
)
```

### 2.2 依赖注入：provide/inject 高级用法

**面试高频：provide/inject 的使用场景和注意事项**

```javascript
// 基本用法
// parent.vue
const theme = ref('dark')
provide('theme', theme)

// child.vue（任意层级）
const theme = inject('theme')

// ✅ 最佳实践 1: 使用 Symbol 避免命名冲突
// keys.js
export const ThemeKey = Symbol('theme')
export const UserKey = Symbol('user')

// provider
provide(ThemeKey, theme)

// consumer
const theme = inject(ThemeKey)

// ✅ 最佳实践 2: 提供默认值和类型
const theme = inject(ThemeKey, 'light')  // 默认值
const theme = inject<Ref<string>>(ThemeKey)  // TypeScript

// ✅ 最佳实践 3: 工厂函数作为默认值
const user = inject(UserKey, () => createDefaultUser(), true)
// 第三个参数表示这是工厂函数

// ✅ 最佳实践 4: 封装成组合函数
// useTheme.js
const ThemeKey = Symbol('theme')

export function provideTheme(initialTheme = 'light') {
  const theme = ref(initialTheme)
  const toggleTheme = () => {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
  }
  
  provide(ThemeKey, {
    theme: readonly(theme),  // 只读，防止子组件修改
    toggleTheme,
  })
  
  return { theme, toggleTheme }
}

export function useTheme() {
  const context = inject(ThemeKey)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

// ⚠️ 注意事项
// 1. provide/inject 不是响应式的（除非提供 ref/reactive）
// 2. 避免子组件直接修改 inject 的值，使用 readonly 或提供修改方法
// 3. 调试时可以使用 devtools 查看依赖注入链
```

### 2.3 watch vs watchEffect 深度对比

**面试高频：watch 和 watchEffect 的区别与使用场景**

```javascript
// watchEffect：自动收集依赖，立即执行
watchEffect(() => {
  console.log(count.value)  // 自动追踪 count
  console.log(name.value)   // 自动追踪 name
  // 任一变化都会重新执行
})

// watch：显式指定依赖，默认惰性执行
watch(count, (newVal, oldVal) => {
  console.log(`${oldVal} -> ${newVal}`)
})

// 核心区别对比
const differences = {
  '依赖收集': {
    watchEffect: '自动收集',
    watch: '显式指定'
  },
  '执行时机': {
    watchEffect: '立即执行',
    watch: '惰性（可配置 immediate）'
  },
  '旧值访问': {
    watchEffect: '无法访问',
    watch: '可以访问'
  },
  '多个依赖': {
    watchEffect: '任一变化都触发',
    watch: '需要数组指定'
  }
}

// ✅ watchEffect 适用场景
// 1. 副作用需要立即执行
// 2. 依赖多个响应式值
// 3. 不关心旧值
watchEffect(async () => {
  const response = await fetch(`/api/users/${userId.value}`)
  userData.value = await response.json()
})

// ✅ watch 适用场景
// 1. 需要访问旧值
// 2. 需要惰性执行
// 3. 需要精确控制触发条件
watch(
  () => route.params.id,
  async (newId, oldId) => {
    if (newId !== oldId) {
      await fetchData(newId)
    }
  },
  { immediate: true }
)

// 高级用法：清理副作用
watchEffect((onCleanup) => {
  const controller = new AbortController()
  
  fetch(url.value, { signal: controller.signal })
    .then(r => r.json())
    .then(data => result.value = data)
  
  // 下次执行前或组件卸载时调用
  onCleanup(() => controller.abort())
})

// 高级用法：flush 时机
watchEffect(callback, {
  flush: 'pre'    // 默认，组件更新前执行
  flush: 'post'   // 组件更新后执行（访问更新后的 DOM）
  flush: 'sync'   // 同步执行（谨慎使用，可能影响性能）
})

// 等价于 flush: 'post'
watchPostEffect(() => {
  // 可以访问更新后的 DOM
})
```

---

## 三、虚拟 DOM 与编译优化

### 3.1 Vue 3 编译优化原理

**面试高频：Vue 3 相比 Vue 2 做了哪些编译优化？**

```javascript
// Vue 2 的问题：全量 diff
// 即使静态内容也会参与 diff 比较

// Vue 3 优化 1: 静态提升 (Static Hoisting)
// 编译前
<div>
  <p>static text</p>
  <p>{{ dynamic }}</p>
</div>

// 编译后（简化）
const _hoisted_1 = createVNode('p', null, 'static text')

function render() {
  return createVNode('div', null, [
    _hoisted_1,  // 静态节点被提升，不参与 diff
    createVNode('p', null, ctx.dynamic)
  ])
}

// Vue 3 优化 2: PatchFlags
// 标记动态内容类型，精确更新
const PatchFlags = {
  TEXT: 1,          // 动态文本
  CLASS: 2,         // 动态 class
  STYLE: 4,         // 动态 style
  PROPS: 8,         // 动态 props（非 class/style）
  FULL_PROPS: 16,   // 有动态 key，需要完整 props diff
  HYDRATE_EVENTS: 32,
  STABLE_FRAGMENT: 64,
  KEYED_FRAGMENT: 128,
  UNKEYED_FRAGMENT: 256,
  NEED_PATCH: 512,
  DYNAMIC_SLOTS: 1024,
}

// 编译后带 PatchFlag
createVNode('p', { class: dynamicClass }, text, 
  PatchFlags.CLASS | PatchFlags.TEXT  // 只需检查 class 和 text
)

// Vue 3 优化 3: Block Tree
// 将模板分割成嵌套的 Block，每个 Block 追踪自己的动态节点
<div>                          <!-- Block -->
  <p>static</p>
  <p>{{ msg }}</p>             <!-- 动态节点 -->
  <div v-if="show">            <!-- Block (结构性指令创建新 Block) -->
    <span>{{ text }}</span>    <!-- 动态节点 -->
  </div>
</div>

// Block 只需 diff 自己记录的动态节点，跳过静态内容
```

### 3.2 key 的作用与正确使用

**面试高频：为什么 v-for 需要 key？key 为什么不能用 index？**

```javascript
// key 的核心作用：帮助 Vue 识别节点身份

// 场景：列表 [A, B, C] 变为 [A, C]（删除 B）

// ❌ 没有 key 或使用 index 作为 key
// Vue 会认为：
// A(index:0) -> A(index:0) ✓ 复用
// B(index:1) -> C(index:1) ✗ 认为 B 变成了 C，更新内容
// C(index:2) -> 被删除

// 结果：本应删除 B，却更新了 B 的内容并删除了 C
// 如果列表项有内部状态（如表单输入），会导致状态错乱

// ✅ 使用唯一 id 作为 key
// Vue 会认为：
// A(key:'a') -> A(key:'a') ✓ 复用
// B(key:'b') -> 被删除
// C(key:'c') -> C(key:'c') ✓ 复用

// 结果：正确删除 B，复用 A 和 C

// 代码示例
// ❌ 错误
<li v-for="(item, index) in list" :key="index">
  {{ item.name }}
  <input v-model="item.value" />  <!-- 状态会错乱 -->
</li>

// ✅ 正确
<li v-for="item in list" :key="item.id">
  {{ item.name }}
  <input v-model="item.value" />  <!-- 状态正确 -->
</li>

// key 还可以强制重新渲染组件
<MyComponent :key="componentKey" />
// 改变 componentKey 会销毁旧组件，创建新组件

// 动态 key 实现组件重置
const resetKey = ref(0)
function resetComponent() {
  resetKey.value++  // 强制重新创建组件
}
```

---

## 四、组件通信模式全解

### 4.1 Props / Emits 深度实践

**面试高频：组件通信的各种方式及适用场景**

```javascript
// 1. Props + Emits（父子通信标准方式）
// 子组件
<script setup>
const props = defineProps<{
  modelValue: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'submit'): void
}>()

function handleInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}
</script>

// 父组件
<CustomInput v-model="value" @submit="handleSubmit" />

// 2. v-model 语法糖（双向绑定简化）
// 多个 v-model
<CustomDialog
  v-model:visible="isVisible"
  v-model:content="content"
/>

// 3. Attrs 透传
<script setup>
import { useAttrs } from 'vue'
const attrs = useAttrs()
// attrs 包含所有未被 props 声明的属性
</script>

// 禁用自动透传到根元素
defineOptions({
  inheritAttrs: false
})

// 手动绑定到指定元素
<input v-bind="attrs" />
```

### 4.2 跨层级通信方案

```javascript
// 4. Provide / Inject（跨层级）
// 见上文 2.2 节

// 5. EventBus 替代方案（Vue 3 移除了 $on/$off）
// 使用 mitt
import mitt from 'mitt'
const emitter = mitt()

// 发送
emitter.emit('event-name', data)

// 监听
emitter.on('event-name', handler)

// 移除
emitter.off('event-name', handler)

// 封装成组合函数
export function useEventBus() {
  const events = new Map()
  
  onUnmounted(() => {
    events.forEach((handler, event) => {
      emitter.off(event, handler)
    })
  })
  
  return {
    emit: emitter.emit,
    on(event, handler) {
      events.set(event, handler)
      emitter.on(event, handler)
    }
  }
}

// 6. 状态管理（Pinia）
// 适合：全局状态、跨组件共享
// 见下文第六节
```

### 4.3 Expose 精确控制组件 API

```javascript
// 子组件：精确暴露方法给父组件
<script setup>
import { ref } from 'vue'

const inputRef = ref<HTMLInputElement>()
const count = ref(0)

function focus() {
  inputRef.value?.focus()
}

function reset() {
  count.value = 0
}

// 默认情况下 <script setup> 组件是关闭的
// 必须显式 expose 才能通过 ref 访问
defineExpose({
  focus,
  reset,
  // 不暴露 count，父组件无法直接访问
})
</script>

// 父组件
<script setup>
const childRef = ref()

function handleClick() {
  childRef.value.focus()  // ✅ 可以访问
  childRef.value.reset()  // ✅ 可以访问
  childRef.value.count    // ❌ undefined
}
</script>

<template>
  <Child ref="childRef" />
</template>
```

---

## 五、性能优化实战

### 5.1 渲染性能优化

**面试高频：Vue 3 有哪些性能优化手段？**

```javascript
// 1. v-once：一次性渲染，之后不再更新
<span v-once>{{ staticContent }}</span>

// 2. v-memo：条件性缓存（Vue 3.2+）
<div v-for="item in list" :key="item.id" v-memo="[item.selected]">
  <!-- 只有 item.selected 变化时才重新渲染 -->
  <ExpensiveComponent :data="item" />
</div>

// 3. 计算属性缓存
const sortedList = computed(() => {
  console.log('expensive sorting...')
  return [...list.value].sort((a, b) => a.order - b.order)
})
// 只有 list 变化时才重新计算

// 4. shallowRef / shallowReactive（浅层响应）
const state = shallowRef({ nested: { count: 0 } })
state.value.nested.count++  // 不会触发更新
state.value = { nested: { count: 1 } }  // 触发更新

// 适用于大型对象，只需监听顶层变化
const tableData = shallowRef(largeDataset)

// 5. 组件懒加载
const HeavyComponent = defineAsyncComponent(() => 
  import('./HeavyComponent.vue')
)

// 带 loading 和 error 状态
const AsyncComp = defineAsyncComponent({
  loader: () => import('./HeavyComponent.vue'),
  loadingComponent: LoadingSpinner,
  errorComponent: ErrorDisplay,
  delay: 200,  // 延迟显示 loading
  timeout: 3000,
})

// 6. KeepAlive 组件缓存
<KeepAlive :include="['ComponentA', 'ComponentB']" :max="10">
  <component :is="currentComponent" />
</KeepAlive>

// 7. 虚拟滚动（大列表）
// 使用 vue-virtual-scroller 或自实现
<RecycleScroller
  :items="largeList"
  :item-size="50"
  key-field="id"
>
  <template #default="{ item }">
    <ListItem :data="item" />
  </template>
</RecycleScroller>
```

### 5.2 响应式性能优化

```javascript
// 1. 避免不必要的响应式转换
const rawData = markRaw(new ThirdPartyClass())
// rawData 不会被转换为响应式

// 2. 正确使用 triggerRef
const shallow = shallowRef({ count: 0 })
shallow.value.count++  // 不触发更新
triggerRef(shallow)    // 手动触发更新

// 3. 批量更新
import { nextTick } from 'vue'

// Vue 会自动批量处理同步更新
count.value++
count.value++
count.value++
// 只触发一次更新

// 如需在更新后操作 DOM
await nextTick()
// DOM 已更新

// 4. 避免在 computed 中做重度计算
// ❌ 
const result = computed(() => {
  return hugeArray.value.map(item => expensiveOperation(item))
})

// ✅ 使用 Web Worker 或分块处理
const result = ref([])
watchEffect(async () => {
  result.value = await processInChunks(hugeArray.value)
})
```

---

## 六、Pinia 状态管理

### 6.1 为什么选择 Pinia

**面试高频：Pinia 相比 Vuex 的优势**

```javascript
// Vuex 的痛点
const store = new Vuex.Store({
  state: { count: 0 },
  mutations: {  // 必须通过 mutation 修改
    increment(state) {
      state.count++
    }
  },
  actions: {  // 异步操作
    async fetchData({ commit }) {
      const data = await api.get()
      commit('setData', data)
    }
  },
  getters: {
    doubleCount: state => state.count * 2
  }
})

// Pinia 的简化
export const useCounterStore = defineStore('counter', () => {
  // state
  const count = ref(0)
  
  // getters
  const doubleCount = computed(() => count.value * 2)
  
  // actions（直接修改，无需 mutations）
  function increment() {
    count.value++
  }
  
  async function fetchData() {
    const data = await api.get()
    // 直接修改状态
    someState.value = data
  }
  
  return { count, doubleCount, increment, fetchData }
})

// Pinia 优势总结
const piniaAdvantages = {
  '更好的 TS 支持': '自动推断类型，无需额外声明',
  '更简洁的 API': '移除 mutations，actions 可直接修改状态',
  '模块化': '每个 store 独立，自动代码分割',
  '组合式 API': '可以使用 ref、computed、watch',
  'DevTools 支持': '完整的时间旅行和编辑功能',
}
```

### 6.2 Pinia 最佳实践

```javascript
// 1. Store 组织结构
// stores/user.ts
export const useUserStore = defineStore('user', () => {
  // 私有状态（不暴露）
  const _cache = new Map()
  
  // 公开状态
  const user = ref<User | null>(null)
  const isLoggedIn = computed(() => !!user.value)
  
  // 异步 action
  async function login(credentials: Credentials) {
    const userData = await authApi.login(credentials)
    user.value = userData
    return userData
  }
  
  function logout() {
    user.value = null
    _cache.clear()
  }
  
  // 只暴露需要的内容
  return {
    user: readonly(user),  // 只读，防止外部直接修改
    isLoggedIn,
    login,
    logout,
  }
})

// 2. Store 之间的交互
export const useCartStore = defineStore('cart', () => {
  const userStore = useUserStore()  // 依赖其他 store
  
  const items = ref([])
  
  async function checkout() {
    if (!userStore.isLoggedIn) {
      throw new Error('Please login first')
    }
    // ...
  }
  
  return { items, checkout }
})

// 3. 插件扩展
const persistPlugin = ({ store }) => {
  // store 创建时从 localStorage 恢复
  const saved = localStorage.getItem(store.$id)
  if (saved) {
    store.$patch(JSON.parse(saved))
  }
  
  // 订阅状态变化
  store.$subscribe((mutation, state) => {
    localStorage.setItem(store.$id, JSON.stringify(state))
  })
}

const pinia = createPinia()
pinia.use(persistPlugin)

// 4. 在组合函数中使用（注意时机）
export function useCheckout() {
  // ✅ 在 setup 中使用
  const cartStore = useCartStore()
  
  // ...
  return { ... }
}

// ❌ 不要在模块顶层使用
const cartStore = useCartStore()  // 可能在 Pinia 初始化前调用
```

---

## 七、TypeScript 深度集成

### 7.1 组件类型定义

**面试高频：Vue 3 + TypeScript 最佳实践**

```typescript
// Props 类型定义
interface Props {
  title: string
  count?: number
  items: Array<{ id: number; name: string }>
  status: 'active' | 'inactive' | 'pending'
  onClick?: (id: number) => void
}

// 方式 1: 泛型定义（推荐）
const props = defineProps<Props>()

// 方式 2: 带默认值
const props = withDefaults(defineProps<Props>(), {
  count: 0,
  status: 'pending',
})

// Emits 类型定义
const emit = defineEmits<{
  (e: 'update', id: number): void
  (e: 'delete', id: number, confirm: boolean): void
  (e: 'close'): void
}>()

// 或使用对象语法（Vue 3.3+）
const emit = defineEmits<{
  update: [id: number]
  delete: [id: number, confirm: boolean]
  close: []
}>()

// Slots 类型定义
defineSlots<{
  default(props: { item: Item }): any
  header(): any
  footer(props: { count: number }): any
}>()

// Expose 类型定义
defineExpose<{
  focus: () => void
  reset: () => void
}>()

// Ref 类型
const inputRef = ref<HTMLInputElement | null>(null)
const childRef = ref<InstanceType<typeof ChildComponent> | null>(null)
```

### 7.2 组合函数类型

```typescript
// 返回类型推断
function useCounter(initial = 0) {
  const count = ref(initial)
  const increment = () => count.value++
  const decrement = () => count.value--
  
  // 返回类型自动推断
  return { count, increment, decrement }
}

// 显式定义返回类型
interface UseCounterReturn {
  count: Ref<number>
  increment: () => void
  decrement: () => void
}

function useCounter(initial = 0): UseCounterReturn {
  // ...
}

// 泛型组合函数
function useFetch<T>(url: MaybeRef<string>) {
  const data = ref<T | null>(null) as Ref<T | null>
  const error = ref<Error | null>(null)
  const isLoading = ref(false)
  
  // ...
  
  return { data, error, isLoading }
}

// 使用
const { data } = useFetch<User[]>('/api/users')
// data 类型为 Ref<User[] | null>

// 高级：推断参数类型
function useForm<T extends Record<string, any>>(initialValues: T) {
  const values = reactive<T>({ ...initialValues })
  const errors = reactive<Partial<Record<keyof T, string>>>({})
  
  function setField<K extends keyof T>(key: K, value: T[K]) {
    values[key] = value
  }
  
  return { values, errors, setField }
}

const { values, setField } = useForm({ name: '', age: 0 })
setField('name', 'John')  // ✅ 类型安全
setField('name', 123)     // ❌ 类型错误
```

---

## 八、高频面试题速答

### Q1: Vue 3 响应式原理？

**核心答案：**
- 使用 Proxy 代替 Object.defineProperty
- 通过 get 拦截收集依赖（track），set 拦截触发更新（trigger）
- 使用 WeakMap + Map + Set 存储依赖关系
- 支持数组索引、对象新增属性、Map/Set 等 Vue 2 不支持的场景

### Q2: Composition API 相比 Options API 的优势？

**核心答案：**
1. **逻辑复用**：Composables 替代 Mixins，无命名冲突，来源清晰
2. **逻辑组织**：相关代码可以放在一起，而非分散在 data/methods/computed
3. **类型推导**：更好的 TypeScript 支持
4. **Tree-shaking**：按需引入，更小的打包体积
5. **灵活性**：可以提前返回、条件性添加响应式等

### Q3: watch 和 computed 的区别？

**核心答案：**

| 维度 | computed | watch |
|------|----------|-------|
| 用途 | 派生状态 | 副作用 |
| 缓存 | 有缓存，依赖不变不重算 | 无缓存概念 |
| 返回值 | 必须返回 | 不需要返回 |
| 异步 | 不支持 | 支持 |
| 典型场景 | 格式化数据、过滤列表 | 数据变化时请求 API、操作 DOM |

### Q4: Vue 3 做了哪些性能优化？

**核心答案：**
1. **编译优化**：静态提升、PatchFlags、Block Tree
2. **响应式优化**：Proxy 实现，懒创建响应式
3. **Diff 优化**：只 diff 动态节点，静态节点跳过
4. **Tree-shaking**：按需引入 API
5. **组件初始化优化**：更快的组件实例化

### Q5: 如何实现组件通信？

**核心答案：**
1. **父子**：props/emits、v-model、ref+expose
2. **跨层级**：provide/inject
3. **全局**：Pinia 状态管理
4. **事件总线**：mitt（Vue 3 移除内置 EventBus）

---

## 总结

Vue 3 的核心进化：

1. **响应式系统**：Proxy 带来更全面的响应式能力
2. **Composition API**：更好的逻辑复用和代码组织
3. **编译优化**：Block Tree + PatchFlags 带来显著性能提升
4. **TypeScript**：一等公民支持，类型安全开发
5. **生态更新**：Pinia 替代 Vuex，Vue Router 4.x 适配

掌握这些核心知识点，不仅能应对面试，更能在实际项目中做出正确的技术决策。

---

## 延伸阅读

- [Vue 3 官方文档](https://vuejs.org/)
- [Pinia 官方文档](https://pinia.vuejs.org/)
- [Vue 3 RFC 列表](https://github.com/vuejs/rfcs)

## 参考资料

- [Vue 3 源码解析](https://github.com/vuejs/core)
- [Vue Mastery 课程](https://www.vuemastery.com/)
- [Anthony Fu 的 Vue 相关分享](https://antfu.me/)

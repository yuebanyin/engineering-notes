# Vue 3 常见问题与调试指南

## 概述

本文收录 Vue 3 开发中的常见问题及其解决方案，涵盖响应式失效、生命周期问题、路由问题、构建问题等，帮助快速定位和解决开发中遇到的坑。

---

## 一、响应式问题

### 1.1 响应式失效

**问题：修改数据但视图不更新**

```javascript
// ❌ 问题 1：解构 reactive 对象
const state = reactive({ count: 0, name: 'John' })
const { count, name } = state  // count, name 是普通值，失去响应性

// ✅ 解决方案
const { count, name } = toRefs(state)
// 或单独使用
const count = toRef(state, 'count')

// ❌ 问题 2：整体替换 reactive 对象
let state = reactive({ user: null })
state = reactive({ user: newUser })  // 原来的响应式丢失

// ✅ 解决方案
const state = reactive({ user: null })
state.user = newUser  // 修改属性而非替换整个对象
// 或使用 ref
const state = ref({ user: null })
state.value = { user: newUser }  // ref 可以整体替换

// ❌ 问题 3：直接修改 props
const props = defineProps(['user'])
props.user.name = 'New Name'  // 可能不会触发更新

// ✅ 解决方案：通过 emit 或使用本地副本
const localUser = ref({ ...props.user })
watch(() => props.user, (newVal) => {
  localUser.value = { ...newVal }
}, { deep: true })
```

**问题：数组/对象的响应式不生效**

```javascript
// Vue 3 已解决 Vue 2 的大部分问题，但仍有边界情况

// ❌ 问题：Map/Set 的响应式使用错误
const map = reactive(new Map())
map.set('key', 'value')  // ✅ 正确，会触发更新

const rawMap = new Map()
const state = reactive({ map: rawMap })
state.map.set('key', 'value')  // ✅ 正确，嵌套的 Map 也是响应式的

// ⚠️ 注意：shallowReactive 不会处理嵌套
const shallow = shallowReactive({ map: new Map() })
shallow.map.set('key', 'value')  // ❌ 不会触发更新
shallow.map = new Map([['key', 'value']])  // ✅ 顶层修改会触发

// ❌ 问题：markRaw 的对象失去响应性
const chart = markRaw(echarts.init(dom))
const state = reactive({ chart })
state.chart.setOption(...)  // 不会触发更新，这是预期行为
```

### 1.2 ref 常见错误

```javascript
// ❌ 问题：忘记 .value
const count = ref(0)
console.log(count)      // Ref 对象
console.log(count + 1)  // "[object Object]1"

// ✅ 正确
console.log(count.value)
console.log(count.value + 1)

// ⚠️ 模板中自动解包，不需要 .value
<template>
  <span>{{ count }}</span>  <!-- ✅ 正确，自动解包 -->
  <span>{{ count.value }}</span>  <!-- ❌ 错误，会显示 undefined -->
</template>

// ⚠️ 注意：reactive 中的 ref 会自动解包
const state = reactive({
  count: ref(0)
})
console.log(state.count)  // 0，不是 Ref 对象

// ⚠️ 但数组中的 ref 不会解包
const arr = reactive([ref(0)])
console.log(arr[0])        // Ref 对象
console.log(arr[0].value)  // 0
```

### 1.3 computed 问题

```javascript
// ❌ 问题：computed 不更新
const data = ref(null)
const processed = computed(() => {
  if (!data.value) return []
  return data.value.map(...)
})

// 检查点：
// 1. data 是否是响应式的？
// 2. computed 内是否访问了 .value？
// 3. 是否有条件提前返回导致依赖未收集？

// ❌ 问题：computed 中有副作用
const count = ref(0)
const doubled = computed(() => {
  console.log('computing...')  // ⚠️ 不推荐
  fetch('/api/log')            // ❌ 绝对不要
  return count.value * 2
})

// ✅ 副作用放在 watch/watchEffect
watchEffect(() => {
  console.log('count changed:', count.value)
})

// ❌ 问题：computed 依赖了非响应式数据
let multiplier = 2  // 普通变量
const result = computed(() => count.value * multiplier)
multiplier = 3  // 不会触发 result 更新

// ✅ 解决方案
const multiplier = ref(2)
const result = computed(() => count.value * multiplier.value)
```

---

## 二、生命周期问题

### 2.1 生命周期时机错误

```javascript
// ❌ 问题：在 setup 中访问 DOM
<script setup>
const inputRef = ref(null)
console.log(inputRef.value)  // null，DOM 还未挂载

// ✅ 正确：在 onMounted 中访问
onMounted(() => {
  console.log(inputRef.value)  // HTMLInputElement
  inputRef.value.focus()
})
</script>

<template>
  <input ref="inputRef" />
</template>

// ❌ 问题：在卸载后仍有异步操作
onMounted(async () => {
  const data = await fetch('/api/data')
  result.value = data  // 如果组件已卸载，会报错
})

// ✅ 解决方案：检查组件是否仍挂载
import { getCurrentInstance } from 'vue'

const instance = getCurrentInstance()
onMounted(async () => {
  const data = await fetch('/api/data')
  if (instance?.isMounted) {  // 检查是否仍挂载
    result.value = data
  }
})

// ✅ 更好的方案：使用 AbortController
const controller = new AbortController()
onMounted(async () => {
  try {
    const data = await fetch('/api/data', { signal: controller.signal })
    result.value = data
  } catch (e) {
    if (e.name !== 'AbortError') throw e
  }
})
onUnmounted(() => {
  controller.abort()
})
```

### 2.2 KeepAlive 生命周期

```javascript
// 使用 KeepAlive 时的生命周期
<KeepAlive>
  <component :is="currentComponent" />
</KeepAlive>

// 组件内
onMounted(() => {
  console.log('首次挂载')  // 只执行一次
})

onActivated(() => {
  console.log('激活')  // 每次从缓存恢复都执行
  refreshData()
})

onDeactivated(() => {
  console.log('停用')  // 每次进入缓存都执行
  pausePolling()
})

onUnmounted(() => {
  console.log('卸载')  // 从缓存中移除时执行
})

// ⚠️ 常见问题：定时器未清理
let timer = null
onActivated(() => {
  timer = setInterval(poll, 5000)
})
onDeactivated(() => {
  clearInterval(timer)  // 必须在 deactivated 清理
})
```

---

## 三、组件通信问题

### 3.1 Props 问题

```javascript
// ❌ 问题：Props 修改不生效
const props = defineProps(['items'])

function removeItem(index) {
  props.items.splice(index, 1)  // ⚠️ 直接修改 props
}

// ✅ 解决方案 1：通过事件通知父组件
const emit = defineEmits(['update:items'])
function removeItem(index) {
  const newItems = props.items.filter((_, i) => i !== index)
  emit('update:items', newItems)
}

// ✅ 解决方案 2：使用本地副本
const localItems = ref([...props.items])
watch(() => props.items, (newVal) => {
  localItems.value = [...newVal]
})

// ❌ 问题：Props 默认值是引用类型
const props = defineProps({
  config: {
    type: Object,
    default: { theme: 'light' }  // ❌ 所有实例共享同一对象
  }
})

// ✅ 正确：使用工厂函数
const props = defineProps({
  config: {
    type: Object,
    default: () => ({ theme: 'light' })  // ✅ 每个实例独立对象
  }
})
```

### 3.2 v-model 问题

```javascript
// ❌ 问题：v-model 不工作（Vue 3）
// 子组件
const props = defineProps(['value'])  // ❌ Vue 3 中是 modelValue
const emit = defineEmits(['input'])   // ❌ Vue 3 中是 update:modelValue

// ✅ Vue 3 正确写法
const props = defineProps(['modelValue'])
const emit = defineEmits(['update:modelValue'])

function updateValue(val) {
  emit('update:modelValue', val)
}

// ✅ 使用 defineModel（Vue 3.4+）
const modelValue = defineModel()
// 直接修改 modelValue.value 即可

// 多个 v-model
const visible = defineModel('visible')
const content = defineModel('content')
```

### 3.3 Provide/Inject 问题

```javascript
// ❌ 问题：inject 得到 undefined
// 原因 1：没有对应的 provide
const value = inject('key')  // undefined

// ✅ 提供默认值
const value = inject('key', 'default')

// 原因 2：provide 的顺序问题
// 子组件在父组件 provide 之前渲染
// 检查组件层级和渲染顺序

// ❌ 问题：inject 的值不是响应式的
// 父组件
provide('count', count.value)  // ❌ 传递的是普通值

// ✅ 传递 ref 本身
provide('count', count)

// 子组件
const count = inject('count')
console.log(count.value)  // 响应式

// ❌ 问题：子组件修改了 inject 的值
const count = inject('count')
count.value++  // ⚠️ 可以工作，但不推荐

// ✅ 最佳实践：父组件提供修改方法
// 父组件
provide('counter', {
  count: readonly(count),  // 只读
  increment: () => count.value++
})

// 子组件
const { count, increment } = inject('counter')
increment()  // 通过方法修改
```

---

## 四、路由问题

### 4.1 导航守卫问题

```javascript
// ❌ 问题：beforeRouteEnter 中无法访问 this
export default {
  beforeRouteEnter(to, from, next) {
    console.log(this)  // undefined
    
    // ✅ 解决方案：使用回调
    next(vm => {
      console.log(vm)  // 组件实例
    })
  }
}

// ❌ 问题：setup 中使用路由守卫
<script setup>
import { onBeforeRouteLeave } from 'vue-router'

// ✅ Composition API 方式
onBeforeRouteLeave((to, from) => {
  if (hasUnsavedChanges.value) {
    return confirm('确定离开？')
  }
})
</script>

// ❌ 问题：异步守卫阻塞
router.beforeEach(async (to) => {
  await slowAsyncCheck()  // 阻塞所有导航
})

// ✅ 解决方案：只在需要时执行
router.beforeEach(async (to) => {
  if (to.meta.requiresAuth) {
    await checkAuth()
  }
})
```

### 4.2 动态路由问题

```javascript
// ❌ 问题：路由参数变化但组件不更新
// /user/1 → /user/2，组件复用，不会重新创建

// ✅ 解决方案 1：监听路由参数
watch(
  () => route.params.id,
  async (newId) => {
    await fetchUser(newId)
  },
  { immediate: true }
)

// ✅ 解决方案 2：使用 key 强制重新创建
<RouterView :key="route.fullPath" />

// ✅ 解决方案 3：使用 onBeforeRouteUpdate
onBeforeRouteUpdate(async (to) => {
  await fetchUser(to.params.id)
})
```

### 4.3 路由懒加载问题

```javascript
// ❌ 问题：懒加载组件白屏
const routes = [
  {
    path: '/dashboard',
    component: () => import('./views/Dashboard.vue')
    // 网络慢时会白屏
  }
]

// ✅ 解决方案：添加 loading 和 error 处理
import { defineAsyncComponent } from 'vue'

const Dashboard = defineAsyncComponent({
  loader: () => import('./views/Dashboard.vue'),
  loadingComponent: LoadingSpinner,
  errorComponent: ErrorComponent,
  delay: 200,
  timeout: 10000
})

// 或使用 Suspense
<template>
  <RouterView v-slot="{ Component }">
    <Suspense>
      <component :is="Component" />
      <template #fallback>
        <LoadingSpinner />
      </template>
    </Suspense>
  </RouterView>
</template>
```

---

## 五、TypeScript 问题

### 5.1 类型定义问题

```typescript
// ❌ 问题：Props 类型不正确
const props = defineProps({
  items: Array  // 类型是 unknown[]
})

// ✅ 使用泛型
interface Item {
  id: number
  name: string
}

const props = defineProps<{
  items: Item[]
}>()

// ❌ 问题：ref 类型推断
const user = ref(null)  // Ref<null>
user.value = { name: 'John' }  // 类型错误

// ✅ 显式类型
interface User {
  name: string
}
const user = ref<User | null>(null)

// ❌ 问题：组件 ref 类型
const childRef = ref(null)
childRef.value.someMethod()  // 类型错误

// ✅ 使用 InstanceType
import ChildComponent from './Child.vue'
const childRef = ref<InstanceType<typeof ChildComponent> | null>(null)
```

### 5.2 Volar 类型问题

```typescript
// 问题：.vue 文件类型报错

// 1. 确保 tsconfig.json 正确配置
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "vueCompilerOptions": {
    "target": 3.3
  }
}

// 2. 安装正确的类型包
npm install -D vue-tsc typescript

// 3. 创建 env.d.ts
/// <reference types="vite/client" />
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
```

---

## 六、构建与打包问题

### 6.1 Vite 构建问题

```javascript
// ❌ 问题：生产环境白屏
// 可能原因：路径配置错误

// vite.config.js
export default defineConfig({
  base: '/my-app/',  // 确保与部署路径一致
})

// ❌ 问题：环境变量不生效
console.log(process.env.API_URL)  // undefined in Vite

// ✅ Vite 使用 import.meta.env
console.log(import.meta.env.VITE_API_URL)

// .env 文件
VITE_API_URL=https://api.example.com  // 必须 VITE_ 前缀

// ❌ 问题：动态导入路径不工作
const module = await import(path)  // Vite 无法分析

// ✅ 使用 glob 导入
const modules = import.meta.glob('./modules/*.js')
const module = await modules[`./modules/${name}.js`]()
```

### 6.2 打包体积问题

```javascript
// 分析打包体积
npm install -D rollup-plugin-visualizer

// vite.config.js
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    visualizer({ open: true })
  ]
})

// 运行后会生成可视化报告

// 常见优化：
// 1. 检查是否有重复依赖
// 2. 确保 tree-shaking 生效
// 3. 按需导入 UI 库
// 4. 分离大型依赖
```

### 6.3 兼容性问题

```javascript
// ❌ 问题：旧浏览器不支持
// Vite 默认目标是支持原生 ESM 的浏览器

// ✅ 使用 @vitejs/plugin-legacy
import legacy from '@vitejs/plugin-legacy'

export default defineConfig({
  plugins: [
    legacy({
      targets: ['defaults', 'not IE 11'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime']
    })
  ]
})

// 注意：Vue 3 本身不支持 IE11
```

---

## 七、调试技巧

### 7.1 Vue DevTools

```javascript
// 开启组件性能追踪
app.config.performance = true

// 在组件中标记自定义数据
onMounted(() => {
  const instance = getCurrentInstance()
  instance.devtoolsRawSetupState = {
    debugInfo: 'custom debug data'
  }
})
```

### 7.2 响应式调试

```javascript
// 追踪依赖收集
import { onRenderTracked, onRenderTriggered } from 'vue'

onRenderTracked((e) => {
  console.log('依赖被追踪:', e.key, e.target)
})

onRenderTriggered((e) => {
  console.log('重渲染触发:', e.key, e.oldValue, '->', e.newValue)
})

// watch 调试
watch(source, callback, {
  onTrack(e) {
    debugger
  },
  onTrigger(e) {
    debugger
  }
})
```

### 7.3 错误处理

```javascript
// 全局错误处理
app.config.errorHandler = (err, instance, info) => {
  console.error('Vue Error:', err)
  console.log('Component:', instance?.$options?.name)
  console.log('Error Info:', info)
  
  // 发送到监控平台
  reportError(err, { component: instance?.$options?.name, info })
}

// 全局警告处理（开发环境）
app.config.warnHandler = (msg, instance, trace) => {
  console.warn('Vue Warning:', msg)
}

// 组件级错误边界
import { onErrorCaptured } from 'vue'

onErrorCaptured((err, instance, info) => {
  console.error('Caught error:', err)
  // 返回 false 阻止向上传播
  return false
})

// 或使用 ErrorBoundary 组件
<template>
  <ErrorBoundary>
    <template #default>
      <RiskyComponent />
    </template>
    <template #fallback="{ error }">
      <div>Something went wrong: {{ error.message }}</div>
    </template>
  </ErrorBoundary>
</template>
```

---

## 八、常见问题速查表

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 响应式不更新 | 解构 reactive | 使用 `toRefs` |
| 响应式不更新 | 替换 reactive 对象 | 修改属性或用 `ref` |
| computed 不更新 | 条件返回导致依赖未收集 | 确保访问响应式数据 |
| watch 不触发 | 监听对象需要 deep | 添加 `{ deep: true }` |
| 模板中 undefined | 忘记 return | 确保 setup 返回所有需要的值 |
| v-model 不工作 | Vue 2/3 API 差异 | 使用 `modelValue` 和 `update:modelValue` |
| 路由参数变化组件不更新 | 组件复用 | 使用 `watch` 或 `:key` |
| KeepAlive 状态错乱 | 生命周期理解错误 | 使用 `onActivated/onDeactivated` |
| TypeScript 类型错误 | 类型推断失败 | 显式声明类型 |
| 打包后白屏 | base 路径配置 | 检查 `vite.config.js` 的 `base` |

---

## 总结

Vue 3 开发中的问题主要集中在：

1. **响应式理解**：ref vs reactive、解构、替换
2. **生命周期**：setup 时机、KeepAlive、异步清理
3. **组件通信**：v-model 变化、provide/inject 响应性
4. **路由**：参数变化、懒加载、守卫
5. **TypeScript**：类型定义、Volar 配置
6. **构建**：环境变量、路径配置、兼容性

遇到问题时，优先使用 Vue DevTools 定位，善用调试钩子追踪响应式变化。

---

## 延伸阅读

- [Vue 3 FAQ](https://vuejs.org/about/faq.html)
- [Vue 3 迁移指南](https://v3-migration.vuejs.org/)

## 参考资料

- [Vue 3 官方文档](https://vuejs.org/)
- [Vue Router 文档](https://router.vuejs.org/)
- [Vite 文档](https://vitejs.dev/)

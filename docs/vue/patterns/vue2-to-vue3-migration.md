# Vue 2 到 Vue 3 升级：核心差异与迁移实战

## 概述

本文深度解析 Vue 2 与 Vue 3 的核心差异，涵盖响应式系统重写、Composition API 范式转变、编译器优化等关键变化，并提供渐进式迁移策略。

## 背景与动机

Vue 3 并非简单的版本迭代，而是一次**架构级重构**：
- 响应式系统从 `Object.defineProperty` 迁移到 `Proxy`
- 组件逻辑组织从 Options API 演进到 Composition API
- 虚拟 DOM 从全量 diff 优化为 Block Tree + PatchFlags
- TypeScript 从勉强支持到一等公民

理解这些差异对于：
1. 存量项目迁移决策
2. 新项目技术选型
3. 面试中展示深度理解

都至关重要。

---

## 核心差异总览

| 维度 | Vue 2 | Vue 3 | 影响程度 |
|------|-------|-------|---------|
| 响应式实现 | `Object.defineProperty` | `Proxy` | ⭐⭐⭐⭐⭐ |
| 逻辑组织 | Options API | Composition API（可选） | ⭐⭐⭐⭐ |
| 组件根元素 | 必须单根 | Fragment（多根） | ⭐⭐⭐ |
| 生命周期 | beforeCreate/created | setup() | ⭐⭐⭐⭐ |
| 事件 API | $on/$off/$once | 移除（使用 mitt/tiny-emitter） | ⭐⭐⭐ |
| 过滤器 | filter | 移除（使用 computed/方法） | ⭐⭐ |
| 全局 API | Vue.xxx | app.xxx | ⭐⭐⭐ |
| v-model | 单一 + .sync | 多 v-model | ⭐⭐⭐ |
| Teleport | 无 | 内置 | ⭐⭐ |
| Suspense | 无 | 内置（实验性） | ⭐⭐ |

---

## 深入分析：响应式系统

### Vue 2 响应式的局限性

```javascript
// Vue 2 使用 Object.defineProperty
function defineReactive(obj, key, val) {
  Object.defineProperty(obj, key, {
    get() {
      // 收集依赖
      return val
    },
    set(newVal) {
      val = newVal
      // 触发更新
    }
  })
}
```

**Vue 2 的痛点：**

```javascript
// ❌ 无法检测属性新增
this.obj.newProp = 'value' // 不响应
// 必须使用
this.$set(this.obj, 'newProp', 'value')

// ❌ 无法检测数组索引赋值
this.arr[0] = 'new' // 不响应
// 必须使用
this.$set(this.arr, 0, 'new')

// ❌ 无法检测数组长度修改
this.arr.length = 0 // 不响应
```

### Vue 3 Proxy 方案

```javascript
// Vue 3 使用 Proxy
const proxy = new Proxy(target, {
  get(target, key, receiver) {
    track(target, key) // 依赖收集
    return Reflect.get(target, key, receiver)
  },
  set(target, key, value, receiver) {
    const result = Reflect.set(target, key, value, receiver)
    trigger(target, key) // 触发更新
    return result
  },
  deleteProperty(target, key) {
    // 可以拦截删除
    return Reflect.deleteProperty(target, key)
  }
})
```

**Vue 3 的改进：**

```javascript
// ✅ 自动检测属性新增
state.newProp = 'value' // 响应式生效

// ✅ 自动检测数组索引
state.arr[100] = 'value' // 响应式生效

// ✅ 自动检测删除
delete state.someProp // 响应式生效

// ✅ 支持 Map/Set/WeakMap/WeakSet
const map = reactive(new Map())
map.set('key', 'value') // 响应式生效
```

### 迁移注意事项

```javascript
// ⚠️ Proxy 不支持 IE11
// 如果必须支持 IE11，使用 @vue/compat 模式

// ⚠️ 原始值需要 ref 包装
const count = ref(0)
count.value++ // 必须通过 .value 访问

// ⚠️ 解构会丢失响应性
const { x, y } = reactive({ x: 1, y: 2 })
// x, y 是普通值，不再响应
// 解决方案：使用 toRefs
const { x, y } = toRefs(reactive({ x: 1, y: 2 }))
```

---

## 深入分析：Composition API vs Options API

### 为什么需要 Composition API？

**Options API 的问题：**

```javascript
// Vue 2 Options API - 逻辑分散在各个选项中
export default {
  data() {
    return {
      // 功能 A 的数据
      userList: [],
      userLoading: false,
      // 功能 B 的数据  
      productList: [],
      productLoading: false,
    }
  },
  computed: {
    // 功能 A 的计算属性
    activeUsers() { /* ... */ },
    // 功能 B 的计算属性
    availableProducts() { /* ... */ },
  },
  methods: {
    // 功能 A 的方法
    fetchUsers() { /* ... */ },
    // 功能 B 的方法
    fetchProducts() { /* ... */ },
  },
  mounted() {
    // 两个功能的初始化混在一起
    this.fetchUsers()
    this.fetchProducts()
  }
}
```

**Composition API 的优势：**

```javascript
// Vue 3 Composition API - 逻辑按功能聚合
import { useUsers } from './composables/useUsers'
import { useProducts } from './composables/useProducts'

export default {
  setup() {
    // 功能 A 完全独立
    const { userList, userLoading, activeUsers, fetchUsers } = useUsers()
    
    // 功能 B 完全独立
    const { productList, productLoading, availableProducts, fetchProducts } = useProducts()
    
    onMounted(() => {
      fetchUsers()
      fetchProducts()
    })
    
    return { userList, productList, activeUsers, availableProducts }
  }
}

// composables/useUsers.js - 可复用、可测试
export function useUsers() {
  const userList = ref([])
  const userLoading = ref(false)
  
  const activeUsers = computed(() => 
    userList.value.filter(u => u.active)
  )
  
  async function fetchUsers() {
    userLoading.value = true
    try {
      userList.value = await api.getUsers()
    } finally {
      userLoading.value = false
    }
  }
  
  return { userList, userLoading, activeUsers, fetchUsers }
}
```

### 生命周期映射

```javascript
// Vue 2 → Vue 3 生命周期对照
export default {
  // Vue 2                    Vue 3 Composition API
  beforeCreate() {},       // setup() 开始部分
  created() {},            // setup() 结束部分
  
  beforeMount() {},        // onBeforeMount(() => {})
  mounted() {},            // onMounted(() => {})
  
  beforeUpdate() {},       // onBeforeUpdate(() => {})
  updated() {},            // onUpdated(() => {})
  
  beforeDestroy() {},      // onBeforeUnmount(() => {})  ⚠️ 改名
  destroyed() {},          // onUnmounted(() => {})      ⚠️ 改名
  
  activated() {},          // onActivated(() => {})
  deactivated() {},        // onDeactivated(() => {})
  
  errorCaptured() {},      // onErrorCaptured(() => {})
}

// 新增的调试钩子
onRenderTracked((e) => {
  console.log('依赖被追踪', e)
})
onRenderTriggered((e) => {
  console.log('重新渲染被触发', e)
})
```

---

## 深入分析：全局 API 变化

### Vue 2 全局污染问题

```javascript
// Vue 2 - 全局配置影响所有实例
Vue.config.productionTip = false
Vue.mixin({ /* ... */ })           // 全局 mixin
Vue.component('MyComp', MyComp)    // 全局组件
Vue.directive('focus', { /* ... */ })
Vue.prototype.$http = axios        // 挂载到原型

// 问题：测试时难以隔离，多个 app 共享配置
```

### Vue 3 应用实例隔离

```javascript
// Vue 3 - 每个应用独立配置
import { createApp } from 'vue'

const app1 = createApp(App1)
app1.config.productionTip = false
app1.mixin({ /* ... */ })
app1.component('MyComp', MyComp)
app1.directive('focus', { /* ... */ })
app1.config.globalProperties.$http = axios

const app2 = createApp(App2)
// app2 有完全独立的配置

app1.mount('#app1')
app2.mount('#app2')
```

### 全局 API 迁移对照

```javascript
// Vue 2 → Vue 3
Vue.config       →  app.config
Vue.config.productionTip  →  移除（默认不显示）
Vue.config.ignoredElements  →  app.config.compilerOptions.isCustomElement
Vue.component    →  app.component
Vue.directive    →  app.directive
Vue.mixin        →  app.mixin
Vue.use          →  app.use
Vue.prototype    →  app.config.globalProperties
Vue.extend       →  移除（使用 defineComponent）

// Tree-shaking 友好的 API
import { nextTick, reactive, ref } from 'vue'
// 不再从 Vue 实例上访问
```

---

## 深入分析：v-model 变化

### Vue 2 的限制

```vue
<!-- Vue 2 - 只能有一个 v-model -->
<CustomInput v-model="value" />
<!-- 等价于 -->
<CustomInput :value="value" @input="value = $event" />

<!-- 额外的双向绑定需要 .sync -->
<CustomDialog 
  v-model="content"
  :visible.sync="isVisible" 
/>
```

### Vue 3 多 v-model 支持

```vue
<!-- Vue 3 - 可以有多个 v-model -->
<CustomDialog
  v-model:visible="isVisible"
  v-model:content="content"
/>
<!-- 等价于 -->
<CustomDialog
  :visible="isVisible"
  @update:visible="isVisible = $event"
  :content="content"
  @update:content="content = $event"
/>

<!-- 默认 v-model 的 prop 名从 value 改为 modelValue -->
<CustomInput v-model="value" />
<!-- 等价于 -->
<CustomInput 
  :modelValue="value" 
  @update:modelValue="value = $event" 
/>
```

```javascript
// Vue 3 组件定义
export default {
  props: {
    modelValue: String,  // 默认 v-model
    visible: Boolean,    // v-model:visible
    content: String,     // v-model:content
  },
  emits: ['update:modelValue', 'update:visible', 'update:content'],
  setup(props, { emit }) {
    function updateContent(val) {
      emit('update:content', val)
    }
    // ...
  }
}
```

---

## 迁移策略

### 策略一：渐进式迁移（推荐大型项目）

```javascript
// 1. 使用 @vue/compat 兼容层
npm install vue@3 @vue/compat

// vue.config.js
module.exports = {
  chainWebpack: config => {
    config.resolve.alias.set('vue', '@vue/compat')
    config.module
      .rule('vue')
      .use('vue-loader')
      .tap(options => ({
        ...options,
        compilerOptions: {
          compatConfig: {
            MODE: 2 // 以 Vue 2 模式运行
          }
        }
      }))
  }
}

// 2. 逐步迁移，关闭已迁移的兼容特性
compatConfig: {
  MODE: 2,
  GLOBAL_MOUNT: false,        // 已迁移全局挂载
  COMPONENT_V_MODEL: false,   // 已迁移 v-model
  // ...
}

// 3. 全部迁移后切换到纯 Vue 3
```

### 策略二：重写核心组件

```javascript
// 优先迁移顺序：
// 1. 工具函数 & composables（无 UI 依赖）
// 2. 基础 UI 组件（Button、Input）
// 3. 业务组件
// 4. 页面组件
// 5. 路由 & 状态管理

// 迁移检查清单
const migrationChecklist = {
  '响应式': [
    '移除所有 $set/$delete 调用',
    '检查数组索引直接赋值',
    '验证 Map/Set 使用场景',
  ],
  '组件': [
    '移除 .sync 改用 v-model:xxx',
    '检查 $listeners 使用（Vue 3 合并到 $attrs）',
    '更新生命周期钩子名称',
  ],
  '全局API': [
    'Vue.prototype → app.config.globalProperties',
    'Vue.observable → reactive',
    '移除 filters，改用 computed 或方法',
  ],
  '事件': [
    '移除 $on/$off/$once，使用 mitt',
    '定义 emits 选项',
  ],
}
```

### 策略三：使用 gogocode 自动迁移

```bash
# 安装 gogocode-cli
npm install gogocode-cli -g

# 自动转换
gogocode -s ./src -t gogocode-plugin-vue -o ./src-vue3

# 转换内容包括：
# - slot-scope → v-slot
# - .sync → v-model:xxx
# - $listeners → $attrs
# - filters → computed/methods
# - 生命周期重命名
```

---

## 最佳实践

### 推荐做法

```javascript
// ✅ 使用 <script setup> 语法糖
<script setup>
import { ref, computed } from 'vue'

const count = ref(0)
const doubled = computed(() => count.value * 2)

function increment() {
  count.value++
}
</script>

// ✅ 使用 defineProps 和 defineEmits
<script setup>
const props = defineProps<{
  title: string
  count?: number
}>()

const emit = defineEmits<{
  (e: 'update', value: number): void
  (e: 'close'): void
}>()
</script>

// ✅ 合理使用 toRef/toRefs 保持响应性
function useFeature(props) {
  // 单个 prop
  const title = toRef(props, 'title')
  // 或全部
  const { title, count } = toRefs(props)
}
```

### 避免的坑

```javascript
// ❌ 在 setup 外使用组合式 API
const count = ref(0) // 全局状态，可能导致 SSR 问题

// ✅ 在 setup 内或组合函数内使用
function useCounter() {
  const count = ref(0)
  return { count }
}

// ❌ 忘记 ref 需要 .value
const count = ref(0)
console.log(count) // Ref 对象，不是 0
console.log(count.value) // 0

// ❌ 在模板中使用 .value（模板会自动解包）
// 模板中直接用 count，不是 count.value

// ❌ 过度使用 reactive 包装原始值
const state = reactive({ count: 0 }) // 可以，但...
const count = ref(0) // 对于原始值，ref 更简洁

// ❌ 混淆 ref 和 reactive 解构
const state = reactive({ x: 1, y: 2 })
const { x, y } = state // 失去响应性！
const { x, y } = toRefs(state) // ✅ 保持响应性
```

---

## 常见问题

### Q1: Vue 3 是否完全不兼容 Vue 2？

A: 不是。Vue 3 提供 `@vue/compat` 兼容包，可以渐进式迁移。大部分 Vue 2 代码可以在兼容模式下运行，逐步迁移后再切换到纯 Vue 3。

### Q2: 是否必须使用 Composition API？

A: 不是必须的。Vue 3 完全支持 Options API，两者可以混用。但 Composition API 在以下场景更有优势：
- 逻辑复用（替代 mixins）
- TypeScript 类型推导
- 大型组件逻辑组织

### Q3: Vuex 还是 Pinia？

A: **新项目推荐 Pinia**。理由：
- 更好的 TypeScript 支持
- 更简洁的 API（无 mutations）
- 更好的代码分割
- Vue 官方推荐

```javascript
// Pinia 示例
export const useUserStore = defineStore('user', () => {
  const user = ref(null)
  const isLoggedIn = computed(() => !!user.value)
  
  async function login(credentials) {
    user.value = await api.login(credentials)
  }
  
  return { user, isLoggedIn, login }
})
```

### Q4: 如何处理 IE11 兼容？

A: Vue 3 不支持 IE11。如果必须支持：
1. 继续使用 Vue 2（维护到 2024 年底）
2. 使用 Vue 2.7（包含部分 Vue 3 特性）
3. 评估是否可以放弃 IE11 支持

---

## 总结

Vue 2 到 Vue 3 的核心变化：

1. **响应式系统**：Proxy 替代 defineProperty，解决了数组和对象的响应式痛点
2. **Composition API**：提供更好的逻辑组织和复用方式
3. **全局 API**：改为应用实例方法，支持多应用隔离
4. **编译优化**：Block Tree + PatchFlags，运行时性能显著提升
5. **TypeScript**：一等公民支持，类型推导更完善

迁移建议：
- 新项目直接使用 Vue 3 + Composition API + `<script setup>` + Pinia
- 存量项目评估成本后选择渐进式迁移或继续使用 Vue 2.7

---

## 延伸阅读

- [Vue 3 迁移指南（官方）](https://v3-migration.vuejs.org/)
- [Vue 2.7 发布说明](https://blog.vuejs.org/posts/vue-2-7-naruto.html)
- [Composition API RFC](https://github.com/vuejs/rfcs/blob/master/active-rfcs/0013-composition-api.md)

## 参考资料

- [Vue 3 官方文档](https://vuejs.org/)
- [Vue 3 Breaking Changes 完整列表](https://v3-migration.vuejs.org/breaking-changes/)
- [@vue/compat 文档](https://v3-migration.vuejs.org/migration-build.html)

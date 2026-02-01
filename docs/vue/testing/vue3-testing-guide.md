# Vue 3 测试实战指南

## 概述

本文系统介绍 Vue 3 应用的测试策略，涵盖组件单元测试、Composables 测试、Pinia 状态测试和 E2E 测试，帮助构建可靠的测试体系。

---

## 一、测试工具链

### 1.1 推荐技术栈

```bash
# 核心测试框架
npm install -D vitest

# Vue 测试工具
npm install -D @vue/test-utils

# 断言库（Vitest 内置）
# expect, describe, it, vi

# DOM 模拟
npm install -D jsdom
# 或
npm install -D happy-dom  # 更快

# E2E 测试
npm install -D playwright
# 或
npm install -D cypress
```

### 1.2 Vitest 配置

```javascript
// vitest.config.js
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',  // 或 'happy-dom'
    globals: true,         // 全局 describe, it, expect
    setupFiles: ['./tests/setup.js'],
    include: ['**/*.{test,spec}.{js,ts,vue}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{js,ts,vue}'],
      exclude: ['src/**/*.d.ts', 'src/main.ts']
    }
  }
})
```

```javascript
// tests/setup.js
import { config } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

// 全局 Mock
beforeEach(() => {
  setActivePinia(createPinia())
})

// 全局组件存根
config.global.stubs = {
  RouterLink: true,
  RouterView: true,
}

// 全局 Mock 指令
config.global.directives = {
  focus: () => {}
}
```

---

## 二、组件单元测试

### 2.1 基础组件测试

```vue
<!-- components/Counter.vue -->
<script setup>
import { ref } from 'vue'

const props = defineProps({
  initialCount: { type: Number, default: 0 }
})

const emit = defineEmits(['update'])

const count = ref(props.initialCount)

function increment() {
  count.value++
  emit('update', count.value)
}

function decrement() {
  count.value--
  emit('update', count.value)
}

defineExpose({ count, reset: () => count.value = 0 })
</script>

<template>
  <div class="counter">
    <button data-testid="decrement" @click="decrement">-</button>
    <span data-testid="count">{{ count }}</span>
    <button data-testid="increment" @click="increment">+</button>
  </div>
</template>
```

```javascript
// components/__tests__/Counter.spec.js
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Counter from '../Counter.vue'

describe('Counter', () => {
  // 测试渲染
  it('renders initial count', () => {
    const wrapper = mount(Counter, {
      props: { initialCount: 5 }
    })
    
    expect(wrapper.find('[data-testid="count"]').text()).toBe('5')
  })

  // 测试交互
  it('increments count when + button clicked', async () => {
    const wrapper = mount(Counter)
    
    await wrapper.find('[data-testid="increment"]').trigger('click')
    
    expect(wrapper.find('[data-testid="count"]').text()).toBe('1')
  })

  // 测试事件发射
  it('emits update event with new count', async () => {
    const wrapper = mount(Counter)
    
    await wrapper.find('[data-testid="increment"]').trigger('click')
    
    expect(wrapper.emitted('update')).toBeTruthy()
    expect(wrapper.emitted('update')[0]).toEqual([1])
  })

  // 测试 expose
  it('exposes reset method', async () => {
    const wrapper = mount(Counter, {
      props: { initialCount: 10 }
    })
    
    wrapper.vm.reset()
    await wrapper.vm.$nextTick()
    
    expect(wrapper.find('[data-testid="count"]').text()).toBe('0')
  })
})
```

### 2.2 复杂组件测试

```vue
<!-- components/UserForm.vue -->
<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  user: { type: Object, default: null }
})

const emit = defineEmits(['submit', 'cancel'])

const form = ref({
  name: props.user?.name ?? '',
  email: props.user?.email ?? ''
})

const errors = ref({})

const isValid = computed(() => {
  return form.value.name.length > 0 && 
         /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email)
})

function validate() {
  errors.value = {}
  if (!form.value.name) {
    errors.value.name = 'Name is required'
  }
  if (!form.value.email) {
    errors.value.email = 'Email is required'
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email)) {
    errors.value.email = 'Invalid email format'
  }
  return Object.keys(errors.value).length === 0
}

function handleSubmit() {
  if (validate()) {
    emit('submit', { ...form.value })
  }
}
</script>

<template>
  <form @submit.prevent="handleSubmit" data-testid="user-form">
    <div>
      <label for="name">Name</label>
      <input 
        id="name"
        v-model="form.name" 
        data-testid="name-input"
      />
      <span v-if="errors.name" data-testid="name-error" class="error">
        {{ errors.name }}
      </span>
    </div>
    
    <div>
      <label for="email">Email</label>
      <input 
        id="email"
        v-model="form.email"
        type="email"
        data-testid="email-input"
      />
      <span v-if="errors.email" data-testid="email-error" class="error">
        {{ errors.email }}
      </span>
    </div>
    
    <button type="submit" :disabled="!isValid" data-testid="submit-btn">
      Submit
    </button>
    <button type="button" @click="emit('cancel')" data-testid="cancel-btn">
      Cancel
    </button>
  </form>
</template>
```

```javascript
// components/__tests__/UserForm.spec.js
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UserForm from '../UserForm.vue'

describe('UserForm', () => {
  // 辅助函数
  const createWrapper = (props = {}) => {
    return mount(UserForm, { props })
  }
  
  const fillForm = async (wrapper, { name, email }) => {
    if (name !== undefined) {
      await wrapper.find('[data-testid="name-input"]').setValue(name)
    }
    if (email !== undefined) {
      await wrapper.find('[data-testid="email-input"]').setValue(email)
    }
  }

  describe('Rendering', () => {
    it('renders empty form by default', () => {
      const wrapper = createWrapper()
      
      expect(wrapper.find('[data-testid="name-input"]').element.value).toBe('')
      expect(wrapper.find('[data-testid="email-input"]').element.value).toBe('')
    })

    it('populates form with user data', () => {
      const wrapper = createWrapper({
        user: { name: 'John', email: 'john@example.com' }
      })
      
      expect(wrapper.find('[data-testid="name-input"]').element.value).toBe('John')
      expect(wrapper.find('[data-testid="email-input"]').element.value).toBe('john@example.com')
    })
  })

  describe('Validation', () => {
    it('shows error when name is empty', async () => {
      const wrapper = createWrapper()
      
      await fillForm(wrapper, { name: '', email: 'valid@email.com' })
      await wrapper.find('[data-testid="user-form"]').trigger('submit')
      
      expect(wrapper.find('[data-testid="name-error"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="name-error"]').text()).toBe('Name is required')
    })

    it('shows error for invalid email', async () => {
      const wrapper = createWrapper()
      
      await fillForm(wrapper, { name: 'John', email: 'invalid-email' })
      await wrapper.find('[data-testid="user-form"]').trigger('submit')
      
      expect(wrapper.find('[data-testid="email-error"]').text()).toBe('Invalid email format')
    })

    it('disables submit button when form is invalid', async () => {
      const wrapper = createWrapper()
      
      expect(wrapper.find('[data-testid="submit-btn"]').attributes('disabled')).toBeDefined()
      
      await fillForm(wrapper, { name: 'John', email: 'john@example.com' })
      
      expect(wrapper.find('[data-testid="submit-btn"]').attributes('disabled')).toBeUndefined()
    })
  })

  describe('Submission', () => {
    it('emits submit event with form data on valid submission', async () => {
      const wrapper = createWrapper()
      
      await fillForm(wrapper, { name: 'John', email: 'john@example.com' })
      await wrapper.find('[data-testid="user-form"]').trigger('submit')
      
      expect(wrapper.emitted('submit')).toBeTruthy()
      expect(wrapper.emitted('submit')[0]).toEqual([{
        name: 'John',
        email: 'john@example.com'
      }])
    })

    it('does not emit submit on invalid form', async () => {
      const wrapper = createWrapper()
      
      await fillForm(wrapper, { name: '', email: '' })
      await wrapper.find('[data-testid="user-form"]').trigger('submit')
      
      expect(wrapper.emitted('submit')).toBeFalsy()
    })

    it('emits cancel event when cancel button clicked', async () => {
      const wrapper = createWrapper()
      
      await wrapper.find('[data-testid="cancel-btn"]').trigger('click')
      
      expect(wrapper.emitted('cancel')).toBeTruthy()
    })
  })
})
```

### 2.3 异步组件测试

```javascript
// components/__tests__/AsyncComponent.spec.js
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import UserProfile from '../UserProfile.vue'
import * as api from '@/api/user'

// Mock API
vi.mock('@/api/user', () => ({
  fetchUser: vi.fn()
}))

describe('UserProfile', () => {
  it('shows loading state initially', () => {
    api.fetchUser.mockImplementation(() => new Promise(() => {}))
    
    const wrapper = mount(UserProfile, {
      props: { userId: 1 }
    })
    
    expect(wrapper.find('[data-testid="loading"]').exists()).toBe(true)
  })

  it('displays user data after loading', async () => {
    api.fetchUser.mockResolvedValue({ name: 'John', email: 'john@example.com' })
    
    const wrapper = mount(UserProfile, {
      props: { userId: 1 }
    })
    
    await flushPromises()
    
    expect(wrapper.find('[data-testid="loading"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="user-name"]').text()).toBe('John')
  })

  it('shows error message on API failure', async () => {
    api.fetchUser.mockRejectedValue(new Error('Network error'))
    
    const wrapper = mount(UserProfile, {
      props: { userId: 1 }
    })
    
    await flushPromises()
    
    expect(wrapper.find('[data-testid="error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="error"]').text()).toContain('Network error')
  })

  it('refetches when userId changes', async () => {
    api.fetchUser.mockResolvedValue({ name: 'John' })
    
    const wrapper = mount(UserProfile, {
      props: { userId: 1 }
    })
    
    await flushPromises()
    expect(api.fetchUser).toHaveBeenCalledWith(1)
    
    await wrapper.setProps({ userId: 2 })
    await flushPromises()
    
    expect(api.fetchUser).toHaveBeenCalledWith(2)
    expect(api.fetchUser).toHaveBeenCalledTimes(2)
  })
})
```

---

## 三、Composables 测试

### 3.1 基础 Composable 测试

```javascript
// composables/useCounter.js
import { ref, computed } from 'vue'

export function useCounter(initialValue = 0) {
  const count = ref(initialValue)
  const doubled = computed(() => count.value * 2)
  
  function increment() {
    count.value++
  }
  
  function decrement() {
    count.value--
  }
  
  function reset() {
    count.value = initialValue
  }
  
  return {
    count,
    doubled,
    increment,
    decrement,
    reset
  }
}
```

```javascript
// composables/__tests__/useCounter.spec.js
import { describe, it, expect } from 'vitest'
import { useCounter } from '../useCounter'

describe('useCounter', () => {
  it('initializes with default value 0', () => {
    const { count } = useCounter()
    expect(count.value).toBe(0)
  })

  it('initializes with custom value', () => {
    const { count } = useCounter(10)
    expect(count.value).toBe(10)
  })

  it('increments count', () => {
    const { count, increment } = useCounter()
    increment()
    expect(count.value).toBe(1)
  })

  it('decrements count', () => {
    const { count, decrement } = useCounter(5)
    decrement()
    expect(count.value).toBe(4)
  })

  it('computes doubled value', () => {
    const { count, doubled } = useCounter(3)
    expect(doubled.value).toBe(6)
    
    count.value = 5
    expect(doubled.value).toBe(10)
  })

  it('resets to initial value', () => {
    const { count, increment, reset } = useCounter(5)
    increment()
    increment()
    expect(count.value).toBe(7)
    
    reset()
    expect(count.value).toBe(5)
  })
})
```

### 3.2 带生命周期的 Composable 测试

```javascript
// composables/useMouse.js
import { ref, onMounted, onUnmounted } from 'vue'

export function useMouse() {
  const x = ref(0)
  const y = ref(0)
  
  function update(event) {
    x.value = event.pageX
    y.value = event.pageY
  }
  
  onMounted(() => {
    window.addEventListener('mousemove', update)
  })
  
  onUnmounted(() => {
    window.removeEventListener('mousemove', update)
  })
  
  return { x, y }
}
```

```javascript
// composables/__tests__/useMouse.spec.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { useMouse } from '../useMouse'

describe('useMouse', () => {
  // 创建包装组件来测试带生命周期的 composable
  const createTestComponent = (composable) => {
    return defineComponent({
      setup() {
        return composable()
      },
      render() {
        return h('div')
      }
    })
  }

  beforeEach(() => {
    vi.spyOn(window, 'addEventListener')
    vi.spyOn(window, 'removeEventListener')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initializes with (0, 0)', () => {
    const wrapper = mount(createTestComponent(useMouse))
    
    expect(wrapper.vm.x).toBe(0)
    expect(wrapper.vm.y).toBe(0)
  })

  it('adds mousemove listener on mount', () => {
    mount(createTestComponent(useMouse))
    
    expect(window.addEventListener).toHaveBeenCalledWith(
      'mousemove',
      expect.any(Function)
    )
  })

  it('removes mousemove listener on unmount', () => {
    const wrapper = mount(createTestComponent(useMouse))
    wrapper.unmount()
    
    expect(window.removeEventListener).toHaveBeenCalledWith(
      'mousemove',
      expect.any(Function)
    )
  })

  it('updates position on mousemove', async () => {
    const wrapper = mount(createTestComponent(useMouse))
    
    // 获取注册的事件处理函数
    const handler = window.addEventListener.mock.calls.find(
      call => call[0] === 'mousemove'
    )[1]
    
    // 模拟鼠标移动
    handler({ pageX: 100, pageY: 200 })
    
    expect(wrapper.vm.x).toBe(100)
    expect(wrapper.vm.y).toBe(200)
  })
})
```

### 3.3 带依赖的 Composable 测试

```javascript
// composables/useFetch.js
import { ref, watch, unref } from 'vue'

export function useFetch(url, options = {}) {
  const data = ref(null)
  const error = ref(null)
  const isLoading = ref(false)
  
  async function execute() {
    isLoading.value = true
    error.value = null
    
    try {
      const response = await fetch(unref(url), options)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      data.value = await response.json()
    } catch (e) {
      error.value = e
    } finally {
      isLoading.value = false
    }
  }
  
  if (options.immediate !== false) {
    execute()
  }
  
  return { data, error, isLoading, execute }
}
```

```javascript
// composables/__tests__/useFetch.spec.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useFetch } from '../useFetch'

describe('useFetch', () => {
  const mockResponse = { id: 1, name: 'Test' }
  
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('fetches data successfully', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    })
    
    const { data, error, isLoading } = useFetch('/api/test')
    
    expect(isLoading.value).toBe(true)
    
    await vi.waitFor(() => expect(isLoading.value).toBe(false))
    
    expect(data.value).toEqual(mockResponse)
    expect(error.value).toBeNull()
  })

  it('handles fetch error', async () => {
    fetch.mockResolvedValue({
      ok: false,
      status: 404
    })
    
    const { data, error, isLoading } = useFetch('/api/test')
    
    await vi.waitFor(() => expect(isLoading.value).toBe(false))
    
    expect(data.value).toBeNull()
    expect(error.value).toBeInstanceOf(Error)
    expect(error.value.message).toBe('HTTP 404')
  })

  it('handles network error', async () => {
    fetch.mockRejectedValue(new Error('Network error'))
    
    const { data, error } = useFetch('/api/test')
    
    await vi.waitFor(() => expect(error.value).not.toBeNull())
    
    expect(error.value.message).toBe('Network error')
  })

  it('does not fetch immediately when immediate is false', () => {
    useFetch('/api/test', { immediate: false })
    
    expect(fetch).not.toHaveBeenCalled()
  })

  it('can manually execute fetch', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    })
    
    const { data, execute } = useFetch('/api/test', { immediate: false })
    
    expect(data.value).toBeNull()
    
    await execute()
    
    expect(data.value).toEqual(mockResponse)
  })
})
```

---

## 四、Pinia Store 测试

### 4.1 基础 Store 测试

```javascript
// stores/counter.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useCounterStore = defineStore('counter', () => {
  const count = ref(0)
  const doubled = computed(() => count.value * 2)
  
  function increment() {
    count.value++
  }
  
  async function incrementAsync() {
    await new Promise(resolve => setTimeout(resolve, 100))
    count.value++
  }
  
  function $reset() {
    count.value = 0
  }
  
  return { count, doubled, increment, incrementAsync, $reset }
})
```

```javascript
// stores/__tests__/counter.spec.js
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCounterStore } from '../counter'

describe('Counter Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes with count 0', () => {
    const store = useCounterStore()
    expect(store.count).toBe(0)
  })

  it('increments count', () => {
    const store = useCounterStore()
    store.increment()
    expect(store.count).toBe(1)
  })

  it('computes doubled value', () => {
    const store = useCounterStore()
    store.count = 5
    expect(store.doubled).toBe(10)
  })

  it('increments asynchronously', async () => {
    const store = useCounterStore()
    await store.incrementAsync()
    expect(store.count).toBe(1)
  })

  it('resets count', () => {
    const store = useCounterStore()
    store.count = 10
    store.$reset()
    expect(store.count).toBe(0)
  })

  // 测试 $patch
  it('supports $patch', () => {
    const store = useCounterStore()
    store.$patch({ count: 100 })
    expect(store.count).toBe(100)
  })

  // 测试 $subscribe
  it('can subscribe to changes', () => {
    const store = useCounterStore()
    const callback = vi.fn()
    
    store.$subscribe(callback)
    store.increment()
    
    expect(callback).toHaveBeenCalled()
  })
})
```

### 4.2 带 API 调用的 Store 测试

```javascript
// stores/user.js
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as userApi from '@/api/user'

export const useUserStore = defineStore('user', () => {
  const user = ref(null)
  const isLoading = ref(false)
  const error = ref(null)
  
  const isLoggedIn = computed(() => !!user.value)
  
  async function login(credentials) {
    isLoading.value = true
    error.value = null
    
    try {
      user.value = await userApi.login(credentials)
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      isLoading.value = false
    }
  }
  
  async function fetchProfile() {
    if (!user.value) return
    
    try {
      const profile = await userApi.getProfile(user.value.id)
      user.value = { ...user.value, ...profile }
    } catch (e) {
      error.value = e.message
    }
  }
  
  function logout() {
    user.value = null
  }
  
  return { user, isLoading, error, isLoggedIn, login, fetchProfile, logout }
})
```

```javascript
// stores/__tests__/user.spec.js
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUserStore } from '../user'
import * as userApi from '@/api/user'

// Mock API 模块
vi.mock('@/api/user', () => ({
  login: vi.fn(),
  getProfile: vi.fn()
}))

describe('User Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('login', () => {
    it('logs in successfully', async () => {
      const mockUser = { id: 1, name: 'John' }
      userApi.login.mockResolvedValue(mockUser)
      
      const store = useUserStore()
      await store.login({ email: 'john@example.com', password: 'password' })
      
      expect(store.user).toEqual(mockUser)
      expect(store.isLoggedIn).toBe(true)
      expect(store.error).toBeNull()
    })

    it('sets loading state during login', async () => {
      userApi.login.mockImplementation(() => new Promise(() => {}))
      
      const store = useUserStore()
      const loginPromise = store.login({ email: 'test@test.com', password: '123' })
      
      expect(store.isLoading).toBe(true)
      
      // 清理
      userApi.login.mockResolvedValue({})
    })

    it('handles login failure', async () => {
      userApi.login.mockRejectedValue(new Error('Invalid credentials'))
      
      const store = useUserStore()
      
      await expect(store.login({ email: 'wrong@test.com', password: 'wrong' }))
        .rejects.toThrow('Invalid credentials')
      
      expect(store.user).toBeNull()
      expect(store.error).toBe('Invalid credentials')
      expect(store.isLoggedIn).toBe(false)
    })
  })

  describe('fetchProfile', () => {
    it('fetches and merges profile data', async () => {
      const mockUser = { id: 1, name: 'John' }
      const mockProfile = { avatar: 'avatar.png', bio: 'Hello' }
      
      userApi.login.mockResolvedValue(mockUser)
      userApi.getProfile.mockResolvedValue(mockProfile)
      
      const store = useUserStore()
      await store.login({ email: 'test@test.com', password: '123' })
      await store.fetchProfile()
      
      expect(store.user).toEqual({ ...mockUser, ...mockProfile })
    })

    it('does nothing when not logged in', async () => {
      const store = useUserStore()
      await store.fetchProfile()
      
      expect(userApi.getProfile).not.toHaveBeenCalled()
    })
  })

  describe('logout', () => {
    it('clears user data', async () => {
      userApi.login.mockResolvedValue({ id: 1, name: 'John' })
      
      const store = useUserStore()
      await store.login({ email: 'test@test.com', password: '123' })
      
      expect(store.isLoggedIn).toBe(true)
      
      store.logout()
      
      expect(store.user).toBeNull()
      expect(store.isLoggedIn).toBe(false)
    })
  })
})
```

---

## 五、E2E 测试

### 5.1 Playwright 配置与基础

```javascript
// playwright.config.js
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
  ],
  
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
})
```

### 5.2 页面对象模式

```javascript
// e2e/pages/LoginPage.js
export class LoginPage {
  constructor(page) {
    this.page = page
    this.emailInput = page.locator('[data-testid="email-input"]')
    this.passwordInput = page.locator('[data-testid="password-input"]')
    this.submitButton = page.locator('[data-testid="submit-button"]')
    this.errorMessage = page.locator('[data-testid="error-message"]')
  }
  
  async goto() {
    await this.page.goto('/login')
  }
  
  async login(email, password) {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.submitButton.click()
  }
  
  async getError() {
    return this.errorMessage.textContent()
  }
}
```

```javascript
// e2e/login.spec.js
import { test, expect } from '@playwright/test'
import { LoginPage } from './pages/LoginPage'

test.describe('Login Flow', () => {
  let loginPage
  
  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page)
    await loginPage.goto()
  })

  test('successful login redirects to dashboard', async ({ page }) => {
    await loginPage.login('user@example.com', 'password123')
    
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('[data-testid="welcome-message"]'))
      .toContainText('Welcome')
  })

  test('invalid credentials shows error', async () => {
    await loginPage.login('wrong@example.com', 'wrongpassword')
    
    await expect(loginPage.errorMessage).toBeVisible()
    await expect(loginPage.errorMessage).toContainText('Invalid credentials')
  })

  test('empty form shows validation errors', async ({ page }) => {
    await loginPage.submitButton.click()
    
    await expect(page.locator('[data-testid="email-error"]')).toBeVisible()
    await expect(page.locator('[data-testid="password-error"]')).toBeVisible()
  })
})
```

### 5.3 复杂交互测试

```javascript
// e2e/todo.spec.js
import { test, expect } from '@playwright/test'

test.describe('Todo App', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/todos')
  })

  test('adds a new todo', async ({ page }) => {
    const input = page.locator('[data-testid="todo-input"]')
    
    await input.fill('Buy groceries')
    await input.press('Enter')
    
    await expect(page.locator('[data-testid="todo-item"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="todo-item"]').first())
      .toContainText('Buy groceries')
  })

  test('completes a todo', async ({ page }) => {
    // 添加 todo
    await page.locator('[data-testid="todo-input"]').fill('Test task')
    await page.locator('[data-testid="todo-input"]').press('Enter')
    
    // 完成 todo
    await page.locator('[data-testid="todo-checkbox"]').first().click()
    
    await expect(page.locator('[data-testid="todo-item"]').first())
      .toHaveClass(/completed/)
  })

  test('filters todos', async ({ page }) => {
    // 添加多个 todo
    const input = page.locator('[data-testid="todo-input"]')
    await input.fill('Task 1')
    await input.press('Enter')
    await input.fill('Task 2')
    await input.press('Enter')
    
    // 完成第一个
    await page.locator('[data-testid="todo-checkbox"]').first().click()
    
    // 点击 Active 过滤器
    await page.locator('[data-testid="filter-active"]').click()
    
    await expect(page.locator('[data-testid="todo-item"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="todo-item"]').first())
      .toContainText('Task 2')
  })

  test('persists todos after page reload', async ({ page }) => {
    await page.locator('[data-testid="todo-input"]').fill('Persistent task')
    await page.locator('[data-testid="todo-input"]').press('Enter')
    
    await page.reload()
    
    await expect(page.locator('[data-testid="todo-item"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="todo-item"]').first())
      .toContainText('Persistent task')
  })
})
```

---

## 六、测试最佳实践

### 6.1 测试金字塔

```
         /\
        /  \        E2E Tests (少量关键流程)
       /----\
      /      \      Integration Tests (组件 + Store)
     /--------\
    /          \    Unit Tests (Composables, Utils, Store)
   --------------
```

### 6.2 测试清单

```markdown
## 组件测试清单
- [ ] 正确渲染初始状态
- [ ] Props 传递正确显示
- [ ] 用户交互触发正确行为
- [ ] 事件正确发射
- [ ] 边界条件处理（空数据、错误状态）
- [ ] 异步操作正确处理
- [ ] expose 的方法可被调用

## Composable 测试清单
- [ ] 初始状态正确
- [ ] 方法正确更新状态
- [ ] computed 正确计算
- [ ] watch 正确响应
- [ ] 生命周期钩子正确执行
- [ ] 清理函数正确调用

## Store 测试清单
- [ ] 初始状态正确
- [ ] Actions 正确更新状态
- [ ] Getters 正确计算
- [ ] 异步 Actions 正确处理
- [ ] 错误处理正确
- [ ] $patch 和 $reset 正常工作
```

### 6.3 常见模式

```javascript
// 1. 工厂函数创建 wrapper
const createWrapper = (props = {}, options = {}) => {
  return mount(Component, {
    props: { ...defaultProps, ...props },
    global: {
      plugins: [createTestingPinia()],
      stubs: { ...defaultStubs },
      ...options.global
    },
    ...options
  })
}

// 2. 使用 data-testid
// 比使用 class 或标签更稳定
<button data-testid="submit-btn">Submit</button>
wrapper.find('[data-testid="submit-btn"]')

// 3. 等待异步更新
await flushPromises()
await wrapper.vm.$nextTick()
await vi.waitFor(() => expect(...))

// 4. 清理副作用
afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})
```

---

## 总结

Vue 3 测试的核心要点：

1. **组件测试**：使用 @vue/test-utils，关注渲染、交互、事件
2. **Composable 测试**：可直接测试返回值，带生命周期的需包装组件
3. **Store 测试**：每个测试创建新 Pinia 实例，Mock API 调用
4. **E2E 测试**：使用页面对象模式，覆盖关键用户流程
5. **测试策略**：遵循测试金字塔，单元测试为主

---

## 延伸阅读

- [Vue Test Utils 官方文档](https://test-utils.vuejs.org/)
- [Vitest 官方文档](https://vitest.dev/)
- [Playwright 官方文档](https://playwright.dev/)

## 参考资料

- [Vue 测试指南](https://vuejs.org/guide/scaling-up/testing.html)
- [Pinia 测试文档](https://pinia.vuejs.org/cookbook/testing.html)

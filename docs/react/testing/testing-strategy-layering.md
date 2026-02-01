# Testing Strategy：单测 / 集成 / E2E 如何分层，如何避免脆弱测试

> 这篇笔记源于我在多个项目中建立测试体系的经验。在 Expedia 项目中用 Cypress 保障核心预订流程，在游戏平台用 Jest 做组件单测。这里记录了"怎么分层、怎么写、怎么维护"的实践总结。

---

## 🎯 为什么需要分层

**不分层的后果**：
- 全是 E2E → 运行慢、易 flaky、维护成本高
- 全是单测 → 覆盖不到真实用户流程
- 没有策略 → 写了很多测试，但信心还是不足

**分层的目标**：
- **快速反馈**：单测秒级出结果
- **真实覆盖**：E2E 验证关键路径
- **可维护**：测试不会因为小重构就挂一片

---

## 📊 测试金字塔

```
                    ┌───────────┐
                    │   E2E     │  少量，关键路径
                    │  (5-10%)  │  
                    ├───────────┤
                    │Integration│  中等，组件交互
                    │  (20-30%) │  
                    ├───────────┤
                    │   Unit    │  大量，纯逻辑
                    │  (60-70%) │  
                    └───────────┘
```

### 各层职责

| 层级 | 测什么 | 工具 | 运行频率 |
|------|--------|------|----------|
| **Unit** | 纯函数、hooks、工具类 | Jest | 每次保存 |
| **Integration** | 组件交互、状态变化 | Testing Library | 每次提交 |
| **E2E** | 完整用户流程 | Cypress | 每次部署 |

---

## 🧪 Unit Test：测纯逻辑

### 什么适合单测

- 工具函数（格式化、计算、转换）
- 自定义 Hooks（不涉及 UI）
- 状态管理逻辑（reducer、selector）
- 业务规则

### 示例：工具函数

```jsx
// utils/price.js
export function formatPrice(amount, currency = 'CNY') {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function calculateTotalPrice(pricePerNight, nights, taxRate = 0.1) {
  const subtotal = pricePerNight * nights;
  const tax = subtotal * taxRate;
  return {
    subtotal,
    tax,
    total: subtotal + tax,
  };
}

// utils/price.test.js
describe('formatPrice', () => {
  it('格式化人民币金额', () => {
    expect(formatPrice(1234.5)).toBe('¥1,234.50');
  });

  it('格式化美元金额', () => {
    expect(formatPrice(1234.5, 'USD')).toBe('US$1,234.50');
  });

  it('处理零值', () => {
    expect(formatPrice(0)).toBe('¥0.00');
  });
});

describe('calculateTotalPrice', () => {
  it('计算含税总价', () => {
    const result = calculateTotalPrice(500, 3);
    expect(result).toEqual({
      subtotal: 1500,
      tax: 150,
      total: 1650,
    });
  });

  it('使用自定义税率', () => {
    const result = calculateTotalPrice(500, 3, 0.2);
    expect(result.tax).toBe(300);
    expect(result.total).toBe(1800);
  });
});
```

### 示例：自定义 Hook

```jsx
// hooks/useDebounce.js
export function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// hooks/useDebounce.test.js
import { renderHook, act } from '@testing-library/react';

describe('useDebounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('延迟更新值', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    expect(result.current).toBe('initial');

    // 更新值
    rerender({ value: 'updated', delay: 500 });

    // 还没到延迟时间
    expect(result.current).toBe('initial');

    // 快进时间
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current).toBe('updated');
  });

  it('快速变化只取最后一个值', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'a' } }
    );

    rerender({ value: 'b' });
    rerender({ value: 'c' });
    rerender({ value: 'd' });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current).toBe('d');
  });
});
```

---

## 🔗 Integration Test：测组件交互

### 核心原则

> "测试用户行为，而不是实现细节" — React Testing Library

**用户行为**：点击、输入、看到什么
**实现细节**：state 值是什么、调用了哪个方法

### 示例：表单组件

```jsx
// components/BookingForm.jsx
function BookingForm({ hotel, onSubmit }) {
  const [formData, setFormData] = useState({
    guestName: '',
    email: '',
    checkIn: '',
    checkOut: '',
  });
  const [errors, setErrors] = useState({});

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const newErrors = {};
    if (!formData.guestName) newErrors.guestName = '请输入姓名';
    if (!formData.email) newErrors.email = '请输入邮箱';
    if (!formData.checkIn) newErrors.checkIn = '请选择入住日期';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>预订 {hotel.name}</h2>
      
      <div>
        <label htmlFor="guestName">姓名</label>
        <input
          id="guestName"
          value={formData.guestName}
          onChange={(e) => setFormData(s => ({ ...s, guestName: e.target.value }))}
        />
        {errors.guestName && <span role="alert">{errors.guestName}</span>}
      </div>
      
      <div>
        <label htmlFor="email">邮箱</label>
        <input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData(s => ({ ...s, email: e.target.value }))}
        />
        {errors.email && <span role="alert">{errors.email}</span>}
      </div>
      
      <button type="submit">提交预订</button>
    </form>
  );
}

// components/BookingForm.test.jsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('BookingForm', () => {
  const mockHotel = { id: '1', name: '测试酒店' };
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  it('显示酒店名称', () => {
    render(<BookingForm hotel={mockHotel} onSubmit={mockOnSubmit} />);
    expect(screen.getByText('预订 测试酒店')).toBeInTheDocument();
  });

  it('空表单提交显示错误', async () => {
    const user = userEvent.setup();
    render(<BookingForm hotel={mockHotel} onSubmit={mockOnSubmit} />);

    await user.click(screen.getByRole('button', { name: '提交预订' }));

    expect(screen.getByText('请输入姓名')).toBeInTheDocument();
    expect(screen.getByText('请输入邮箱')).toBeInTheDocument();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('填写完整后成功提交', async () => {
    const user = userEvent.setup();
    render(<BookingForm hotel={mockHotel} onSubmit={mockOnSubmit} />);

    // 模拟用户输入
    await user.type(screen.getByLabelText('姓名'), '张三');
    await user.type(screen.getByLabelText('邮箱'), 'zhangsan@example.com');

    await user.click(screen.getByRole('button', { name: '提交预订' }));

    expect(mockOnSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        guestName: '张三',
        email: 'zhangsan@example.com',
      })
    );
  });
});
```

### 查询优先级

按照 Testing Library 推荐的优先级选择查询方式：

```jsx
// 1. getByRole（最推荐）— 用户通过角色找元素
screen.getByRole('button', { name: '提交' });
screen.getByRole('textbox', { name: '姓名' });
screen.getByRole('checkbox', { name: '同意协议' });

// 2. getByLabelText — 表单元素
screen.getByLabelText('邮箱');

// 3. getByPlaceholderText — 有 placeholder 时
screen.getByPlaceholderText('搜索酒店...');

// 4. getByText — 非交互元素的文本
screen.getByText('预订成功！');

// 5. getByTestId（最后手段）— 实在没办法时
screen.getByTestId('hotel-card-123');
```

---

## 🌐 E2E Test：测完整流程

### 什么适合 E2E

- 核心业务流程（注册、登录、支付）
- 关键用户路径（搜索 → 详情 → 预订）
- 第三方集成验证

### 我在 Expedia 项目中的 Cypress 实践

```javascript
// cypress/e2e/booking.cy.js
describe('酒店预订流程', () => {
  beforeEach(() => {
    // 登录状态
    cy.login('test@example.com', 'password123');
  });

  it('完整预订流程：搜索 → 详情 → 预订 → 确认', () => {
    // 1. 搜索酒店
    cy.visit('/');
    cy.findByPlaceholderText('目的地').type('深圳');
    cy.findByRole('button', { name: '搜索' }).click();

    // 2. 等待搜索结果
    cy.findByText('搜索结果').should('be.visible');
    cy.findAllByTestId('hotel-card').should('have.length.greaterThan', 0);

    // 3. 进入详情页
    cy.findAllByTestId('hotel-card').first().click();
    cy.url().should('include', '/hotel/');

    // 4. 选择房型并预订
    cy.findByRole('button', { name: /预订/ }).first().click();

    // 5. 填写预订信息
    cy.findByLabelText('入住人姓名').type('测试用户');
    cy.findByLabelText('联系电话').type('13800138000');
    cy.findByRole('button', { name: '确认预订' }).click();

    // 6. 验证预订成功
    cy.findByText('预订成功').should('be.visible');
    cy.findByText('订单号').should('be.visible');
  });

  it('搜索无结果时显示空状态', () => {
    cy.visit('/');
    cy.findByPlaceholderText('目的地').type('不存在的地方xyz');
    cy.findByRole('button', { name: '搜索' }).click();

    cy.findByText('未找到相关酒店').should('be.visible');
  });
});
```

### 自定义命令

```javascript
// cypress/support/commands.js
Cypress.Commands.add('login', (email, password) => {
  cy.session([email, password], () => {
    cy.visit('/login');
    cy.findByLabelText('邮箱').type(email);
    cy.findByLabelText('密码').type(password);
    cy.findByRole('button', { name: '登录' }).click();
    cy.findByText('欢迎回来').should('be.visible');
  });
});

// 拦截 API 请求
Cypress.Commands.add('mockHotels', (hotels) => {
  cy.intercept('GET', '/api/hotels*', {
    statusCode: 200,
    body: { data: hotels },
  }).as('getHotels');
});
```

---

## ⚠️ 常见陷阱与解决

### 陷阱 1：过度 Mock

```jsx
// ❌ 问题：Mock 太多，测试与现实脱节
jest.mock('./api');
jest.mock('./utils');
jest.mock('./hooks');
jest.mock('./context');

// ✅ 解决：只 Mock 边界（网络、时间、随机）
// 网络层
import { setupServer } from 'msw/node';
const server = setupServer(
  rest.get('/api/hotels', (req, res, ctx) => res(ctx.json(mockData)))
);

// 时间
jest.useFakeTimers();

// 其他尽量用真实实现
```

### 陷阱 2：测试实现细节

```jsx
// ❌ 问题：测试内部 state
it('点击增加按钮后 count state 变为 1', () => {
  const { result } = renderHook(() => useCounter());
  act(() => result.current.increment());
  expect(result.current.count).toBe(1);  // 这其实是测实现
});

// ✅ 解决：测试用户可见的结果
it('点击增加按钮后显示 1', async () => {
  const user = userEvent.setup();
  render(<Counter />);
  
  await user.click(screen.getByRole('button', { name: '+' }));
  
  expect(screen.getByText('1')).toBeInTheDocument();
});
```

### 陷阱 3：快照滥用

```jsx
// ❌ 问题：对复杂组件做快照
it('renders correctly', () => {
  const { container } = render(<ComplexPage />);
  expect(container).toMatchSnapshot();  // 500 行的快照，谁会仔细看？
});

// ✅ 解决：只对稳定的小组件做快照
it('图标渲染正确', () => {
  const { container } = render(<Icon name="star" />);
  expect(container).toMatchInlineSnapshot(`
    <div>
      <svg class="icon icon-star">...</svg>
    </div>
  `);
});
```

### 陷阱 4：异步处理不当

```jsx
// ❌ 问题：使用 setTimeout 等待
it('加载数据', async () => {
  render(<DataComponent />);
  await new Promise(r => setTimeout(r, 1000));  // 不稳定！
  expect(screen.getByText('数据')).toBeInTheDocument();
});

// ✅ 解决：使用 waitFor 或 findBy
it('加载数据', async () => {
  render(<DataComponent />);
  
  // 方式1：findBy（内置等待）
  expect(await screen.findByText('数据')).toBeInTheDocument();
  
  // 方式2：waitFor（更灵活）
  await waitFor(() => {
    expect(screen.getByText('数据')).toBeInTheDocument();
  });
});
```

---

## 🔧 测试稳定性保障

### Fake Timers

```jsx
// 处理 setTimeout、setInterval
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

it('3秒后自动关闭提示', async () => {
  render(<Toast message="保存成功" duration={3000} />);
  
  expect(screen.getByText('保存成功')).toBeInTheDocument();
  
  act(() => {
    jest.advanceTimersByTime(3000);
  });
  
  expect(screen.queryByText('保存成功')).not.toBeInTheDocument();
});
```

### 网络 Mock

```jsx
// 使用 MSW（Mock Service Worker）
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.get('/api/user', (req, res, ctx) => {
    return res(ctx.json({ name: '测试用户' }));
  }),
  rest.post('/api/booking', (req, res, ctx) => {
    return res(ctx.json({ id: '12345', status: 'confirmed' }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// 测试中可以动态修改响应
it('处理网络错误', async () => {
  server.use(
    rest.get('/api/user', (req, res, ctx) => {
      return res(ctx.status(500), ctx.json({ error: '服务器错误' }));
    })
  );
  
  render(<UserProfile />);
  
  expect(await screen.findByText('加载失败')).toBeInTheDocument();
});
```

---

## 📋 测试可维护性检查清单

### ✅ 好的测试

- [ ] 测试名称描述用户场景，不是实现细节
- [ ] 一个测试只验证一个行为
- [ ] 使用 Testing Library 推荐的查询优先级
- [ ] 异步操作用 waitFor/findBy，不用 setTimeout
- [ ] Mock 只在边界层（网络、时间）
- [ ] 测试失败时，错误信息能定位问题

### ❌ 需要重构的信号

- 测试经常因为无关改动而失败
- 测试代码比业务代码还长
- 没人敢删除或修改测试
- 测试通过但功能其实有 bug
- 经常需要 `.skip()` 跳过 flaky 测试

---

## 📁 测试目录结构

```
src/
├── components/
│   ├── BookingForm/
│   │   ├── BookingForm.jsx
│   │   ├── BookingForm.test.jsx    # 集成测试
│   │   └── BookingForm.module.css
│   └── ...
├── hooks/
│   ├── useDebounce.js
│   ├── useDebounce.test.js         # 单元测试
│   └── ...
├── utils/
│   ├── price.js
│   ├── price.test.js               # 单元测试
│   └── ...
└── ...

cypress/
├── e2e/
│   ├── booking.cy.js               # E2E 测试
│   └── auth.cy.js
├── fixtures/
│   └── hotels.json                 # 测试数据
└── support/
    └── commands.js                 # 自定义命令
```

---

## 📚 相关笔记

- [常见问题与调试手册](../troubleshooting/common-bugs-and-debug-playbook.md)
- [数据获取工程化模式](data-fetching-patterns.md)

---

## 参考资料

- [Testing Library Docs](https://testing-library.com/)
- [Cypress Best Practices](https://docs.cypress.io/guides/references/best-practices)
- [Kent C. Dodds - Testing JavaScript](https://testingjavascript.com/)
- [MSW - Mock Service Worker](https://mswjs.io/)

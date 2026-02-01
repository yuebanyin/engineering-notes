# 组件 API 设计：可组合性 vs 可配置性

> 这篇笔记来自我在多个项目中设计和重构组件的经验教训。最痛的教训是：一个 30+ props 的"万能组件"，最终没人敢改、没人想用。好的组件设计应该让使用方代码更简洁，而不是更复杂。

---

## 🎯 核心问题

**组件设计的两种极端**：

| 极端 | 问题 |
|------|------|
| 过度可配置 | 30+ props 的巨无霸，使用困难，维护噩梦 |
| 过度拆分 | 太多小组件，组合起来很麻烦 |

**目标**：找到平衡点，让组件既灵活又易用。

---

## 🚫 常见失败模式

### 失败模式 1：巨无霸组件

```jsx
// ❌ 真实案例：一个 Modal 组件的 props
<Modal
  visible={true}
  title="确认删除"
  titleIcon="warning"
  titleAlign="left"
  showCloseButton={true}
  closeOnEsc={true}
  closeOnClickOutside={true}
  width={600}
  height="auto"
  maxHeight={800}
  footer={true}
  footerAlign="right"
  okText="确定"
  okType="danger"
  okLoading={loading}
  okDisabled={false}
  cancelText="取消"
  cancelType="default"
  onOk={handleOk}
  onCancel={handleCancel}
  afterClose={handleAfterClose}
  destroyOnClose={true}
  centered={true}
  maskClosable={true}
  zIndex={1000}
  bodyStyle={{ padding: 20 }}
  headerStyle={{ borderBottom: 'none' }}
  footerStyle={{ borderTop: 'none' }}
  // ... 还有更多
>
  {content}
</Modal>
```

**问题**：
- 使用者需要阅读大量文档
- 新增功能只能加 props，无限膨胀
- 很多 props 之间有隐藏依赖关系
- 测试覆盖困难

### 失败模式 2：配置驱动

```jsx
// ❌ 用配置对象代替组合
<Form
  config={{
    fields: [
      { name: 'username', type: 'text', label: '用户名', required: true },
      { name: 'password', type: 'password', label: '密码', required: true },
      { name: 'remember', type: 'checkbox', label: '记住我' },
    ],
    layout: 'vertical',
    submitText: '登录',
    onSubmit: handleSubmit,
  }}
/>
```

**问题**：
- TypeScript 类型提示差
- 自定义逻辑只能通过配置注入，很别扭
- 配置 schema 越来越复杂

---

## ✅ 设计原则

### 原则 1：组合优于配置

```jsx
// ✅ 用组合代替配置
<Modal>
  <Modal.Header>
    <WarningIcon />
    <Modal.Title>确认删除</Modal.Title>
  </Modal.Header>
  
  <Modal.Body>
    确定要删除这条记录吗？此操作不可撤销。
  </Modal.Body>
  
  <Modal.Footer>
    <Button onClick={onCancel}>取消</Button>
    <Button type="danger" loading={loading} onClick={onConfirm}>
      删除
    </Button>
  </Modal.Footer>
</Modal>
```

**优势**：
- 结构一目了然
- 自定义任何部分都很自然
- 不需要的部分直接不写

### 原则 2：合理的默认值

```jsx
// ✅ 常用场景开箱即用
<Modal title="确认" onOk={handleOk} onCancel={handleCancel}>
  确定要继续吗？
</Modal>

// 需要定制时再覆盖
<Modal 
  title="确认" 
  okText="是的，删除" 
  okType="danger"
  onOk={handleDelete} 
  onCancel={handleCancel}
>
  确定要删除吗？
</Modal>
```

### 原则 3：单一职责

```jsx
// ❌ 一个组件做太多事
<UserCard 
  user={user}
  showAvatar={true}
  showBio={true}
  showFollowButton={true}
  showMessageButton={true}
  onFollow={handleFollow}
  onMessage={handleMessage}
  variant="detailed"
/>

// ✅ 拆分职责，通过组合使用
<UserCard user={user}>
  <UserCard.Avatar />
  <UserCard.Info>
    <UserCard.Name />
    <UserCard.Bio />
  </UserCard.Info>
  <UserCard.Actions>
    <FollowButton userId={user.id} />
    <MessageButton userId={user.id} />
  </UserCard.Actions>
</UserCard>
```

---

## 🔧 设计模式

### 模式 1：Compound Components（复合组件）

最推荐的模式，用于有多个相关子部件的组件。

```jsx
// 实现
const TabsContext = createContext(null);

function Tabs({ children, defaultValue, onChange }) {
  const [activeTab, setActiveTab] = useState(defaultValue);
  
  const value = useMemo(() => ({
    activeTab,
    setActiveTab: (tab) => {
      setActiveTab(tab);
      onChange?.(tab);
    },
  }), [activeTab, onChange]);
  
  return (
    <TabsContext.Provider value={value}>
      <div className="tabs">{children}</div>
    </TabsContext.Provider>
  );
}

function TabList({ children }) {
  return <div className="tab-list" role="tablist">{children}</div>;
}

function Tab({ value, children }) {
  const { activeTab, setActiveTab } = useContext(TabsContext);
  const isActive = activeTab === value;
  
  return (
    <button
      role="tab"
      aria-selected={isActive}
      className={`tab ${isActive ? 'active' : ''}`}
      onClick={() => setActiveTab(value)}
    >
      {children}
    </button>
  );
}

function TabPanels({ children }) {
  return <div className="tab-panels">{children}</div>;
}

function TabPanel({ value, children }) {
  const { activeTab } = useContext(TabsContext);
  if (activeTab !== value) return null;
  return <div role="tabpanel">{children}</div>;
}

// 组装
Tabs.List = TabList;
Tabs.Tab = Tab;
Tabs.Panels = TabPanels;
Tabs.Panel = TabPanel;

// 使用
function GamePage() {
  return (
    <Tabs defaultValue="overview" onChange={handleTabChange}>
      <Tabs.List>
        <Tabs.Tab value="overview">概览</Tabs.Tab>
        <Tabs.Tab value="reviews">评价</Tabs.Tab>
        <Tabs.Tab value="screenshots">截图</Tabs.Tab>
      </Tabs.List>
      
      <Tabs.Panels>
        <Tabs.Panel value="overview">
          <GameOverview game={game} />
        </Tabs.Panel>
        <Tabs.Panel value="reviews">
          <GameReviews gameId={game.id} />
        </Tabs.Panel>
        <Tabs.Panel value="screenshots">
          <GameScreenshots images={game.screenshots} />
        </Tabs.Panel>
      </Tabs.Panels>
    </Tabs>
  );
}
```

### 模式 2：Render Props / Children as Function

当需要把组件内部状态暴露给使用方时。

```jsx
// 实现
function Dropdown({ trigger, children }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  // 点击外部关闭
  useClickOutside(dropdownRef, () => setIsOpen(false));
  
  return (
    <div ref={dropdownRef} className="dropdown">
      {/* trigger 可以访问 isOpen 状态 */}
      {trigger({ isOpen, toggle: () => setIsOpen(!isOpen) })}
      
      {isOpen && (
        <div className="dropdown-content">
          {/* children 也可以访问状态 */}
          {typeof children === 'function' 
            ? children({ close: () => setIsOpen(false) })
            : children
          }
        </div>
      )}
    </div>
  );
}

// 使用
function UserMenu({ user }) {
  return (
    <Dropdown
      trigger={({ isOpen, toggle }) => (
        <button onClick={toggle} aria-expanded={isOpen}>
          {user.name} {isOpen ? '▲' : '▼'}
        </button>
      )}
    >
      {({ close }) => (
        <ul>
          <li><Link to="/profile" onClick={close}>个人资料</Link></li>
          <li><Link to="/settings" onClick={close}>设置</Link></li>
          <li><button onClick={() => { logout(); close(); }}>退出</button></li>
        </ul>
      )}
    </Dropdown>
  );
}
```

### 模式 3：Headless Components

只提供逻辑，不提供 UI。完全自定义样式。

```jsx
// 实现：只管逻辑，不管样式
function useToggle(initialValue = false) {
  const [isOn, setIsOn] = useState(initialValue);
  
  const toggle = useCallback(() => setIsOn(v => !v), []);
  const setOn = useCallback(() => setIsOn(true), []);
  const setOff = useCallback(() => setIsOn(false), []);
  
  return { isOn, toggle, setOn, setOff };
}

function useSelect({ items, defaultValue, onChange }) {
  const [selectedValue, setSelectedValue] = useState(defaultValue);
  const [isOpen, setIsOpen] = useState(false);
  
  const selectedItem = items.find(item => item.value === selectedValue);
  
  const select = (value) => {
    setSelectedValue(value);
    setIsOpen(false);
    onChange?.(value);
  };
  
  return {
    isOpen,
    selectedValue,
    selectedItem,
    items,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(v => !v),
    select,
  };
}

// 使用：完全自定义 UI
function CustomSelect({ options, value, onChange }) {
  const {
    isOpen,
    selectedItem,
    items,
    toggle,
    select,
  } = useSelect({ items: options, defaultValue: value, onChange });
  
  return (
    <div className="my-custom-select">
      <button className="select-trigger" onClick={toggle}>
        {selectedItem?.label || '请选择'}
        <ChevronIcon direction={isOpen ? 'up' : 'down'} />
      </button>
      
      {isOpen && (
        <ul className="select-options">
          {items.map(item => (
            <li 
              key={item.value}
              className={item.value === value ? 'selected' : ''}
              onClick={() => select(item.value)}
            >
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

### 模式 4：Slots 模式

用 props 接收组件，类似 Vue 的具名插槽。

```jsx
// 实现
function Card({ 
  header,
  children,
  footer,
  // 可选的自定义区域
  sidebar,
}) {
  return (
    <div className="card">
      {header && <div className="card-header">{header}</div>}
      
      <div className="card-body">
        {sidebar && <aside className="card-sidebar">{sidebar}</aside>}
        <main className="card-content">{children}</main>
      </div>
      
      {footer && <div className="card-footer">{footer}</div>}
    </div>
  );
}

// 使用
function GameCard({ game }) {
  return (
    <Card
      header={<h2>{game.name}</h2>}
      sidebar={<GameStats game={game} />}
      footer={
        <div className="card-actions">
          <Button>收藏</Button>
          <Button type="primary">购买 ¥{game.price}</Button>
        </div>
      }
    >
      <p>{game.description}</p>
      <GameTags tags={game.tags} />
    </Card>
  );
}
```

---

## 📋 API 设计检查清单

### 使用方视角

- [ ] **易于入门**：最简单的用法能覆盖 80% 场景吗？
- [ ] **渐进复杂**：复杂需求能通过组合实现，而不是加 props 吗？
- [ ] **可预测**：props 的行为符合直觉吗？
- [ ] **TypeScript 友好**：类型提示是否完善？

### 维护方视角

- [ ] **单一职责**：这个组件只做一件事吗？
- [ ] **可测试**：能写出简洁的单元测试吗？
- [ ] **可扩展**：新增功能不需要改动已有 API 吗？
- [ ] **文档友好**：Props 数量是否在可文档化范围内（< 15）？

### API 稳定性

- [ ] **向后兼容**：新版本不会破坏已有用法吗？
- [ ] **废弃策略**：有清晰的废弃警告和迁移路径吗？

---

## 🔄 重构案例

### 案例：重构 DataTable 组件

**Before：30+ props 的巨无霸**

```jsx
<DataTable
  columns={columns}
  data={data}
  loading={loading}
  pagination={true}
  pageSize={20}
  currentPage={page}
  onPageChange={setPage}
  sortable={true}
  sortBy={sortBy}
  sortOrder={sortOrder}
  onSort={handleSort}
  selectable={true}
  selectedRows={selected}
  onSelectionChange={setSelected}
  filterable={true}
  filters={filters}
  onFilterChange={setFilters}
  expandable={true}
  expandedRows={expanded}
  onExpand={setExpanded}
  renderExpandedRow={renderExpanded}
  rowKey="id"
  emptyText="暂无数据"
  // ... 还有更多
/>
```

**After：组合式设计**

```jsx
<DataTable data={data} rowKey="id">
  {/* 列定义 */}
  <DataTable.Column key="name" title="名称" sortable />
  <DataTable.Column key="status" title="状态" filterable />
  <DataTable.Column 
    key="actions" 
    title="操作"
    render={(_, record) => <ActionButtons record={record} />}
  />
  
  {/* 功能插件 */}
  <DataTable.Selection 
    value={selected} 
    onChange={setSelected} 
  />
  
  <DataTable.Pagination 
    pageSize={20} 
    current={page} 
    onChange={setPage} 
  />
  
  <DataTable.ExpandableRow render={renderExpanded} />
  
  {/* 空状态 */}
  <DataTable.Empty>
    <EmptyState icon="search" message="暂无数据" />
  </DataTable.Empty>
</DataTable>
```

**变化**：
- 从 30+ props 变成 3 个基础 props
- 功能通过子组件按需组合
- 自定义区域使用 render props 或 children
- 类型推断更精确

---

## 💡 我的实践原则

1. **先写使用代码**：设计 API 前，先想象使用方怎么调用
2. **最小化必需 props**：能有默认值的都给默认值
3. **组合优于配置**：复杂功能通过组合实现，而不是加 props
4. **显式优于隐式**：让行为可预测，避免魔法
5. **及时重构**：props 超过 10 个就该考虑拆分了

---

## 📚 相关笔记

- [状态管理决策树](state-management-decision-tree.md)
- [React 渲染模型](react-rendering-model.md)
- [测试分层策略](../testing/testing-strategy-layering.md)

---

## 参考资料

- [Headless UI](https://headlessui.com/)
- [Radix UI](https://www.radix-ui.com/)
- [React Spectrum](https://react-spectrum.adobe.com/)
- [Patterns.dev - Compound Pattern](https://www.patterns.dev/posts/compound-pattern)

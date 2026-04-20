# prompt

You are a senior front-end engineer.
Your task is to create a complete web application from scratch for a fund / finance website.
This is a UI CASE focused on:

- Creating an application from 0 to 1
- UI completeness and correctness
- Engineering-level project setup
  Category:UI Case → Create App From Scratch

---

1.Project setup requirements (MANDATORY)
You must create a complete runnable project using:

- React
- TypeScript
- Tailwind CSS
- pnpm as the package manager
  You MUST provide:
- package.json (configured for pnpm)
- Tailwind configuration
- TypeScript configuration
- A valid React entry point (main.tsx / App.tsx)

---

2.Application requirements (Fund / Finance website)
Build a fund dashboard application that includes:
2.1 Pages / Layout

- A main dashboard page
- A clear layout structure (header / content / section)
  2.2 Fund data presentation
  Each fund must display:
- Fund name
- Fund code
- Risk level (Low / Medium / High)
- Latest NAV (Net Asset Value)
- Daily change percentage
  2.3 Visual rules
- Positive change: green
- Negative change: red
- Risk level must be visually distinguishable
- Professional finance-oriented UI style
  2.4 Interaction (at least ONE required)
- Filter funds by risk level
- Sort funds by return or NAV
  2.5 Empty state handling
- When no fund data exists, show a clear and user-friendly empty state message

---

3.Data rules

- No backend is required
- Mock data is allowed
- Data must be typed with TypeScript interfaces

---

4.Deliverables
You must generate ALL of the following:

- Full project source code
- Folder structure
- Configuration files
- UI implementation files
- Minimal instructions to run the app locally using pnpm

---

5.Quality requirements

- The application must render without runtime errors
- TypeScript types must be correct
- Tailwind utility classes must be used
- Layout must not be broken on common screen sizes
- Code must be readable and structured

---

6.Rules (STRICT)

- MUST create the application from scratch
- MUST NOT assume any existing files unless you create them
- MUST NOT skip configuration files
- MUST NOT output only code snippets (full files required)
- MUST NOT over-engineer or add unnecessary features
- MUST keep output minimal, structured, and engineering-oriented

📁 输入文件结构（你提供给模型）
ui-fund-case-input/
├─ input.md
├─ business_rules.md
├─ ui_constraints.md

---

📄 input.md（业务背景）

# Fund Finance Website – Context

You are building a front-end web application for a fund investment platform.

Target users:

- Retail investors
- Care about fund performance and risk

Core goals:

- Clearly present fund information
- Help users quickly understand risk and returns

---

📄 business_rules.md（业务规则）

# Business Rules

- Funds have:
  - name
  - code
  - risk level (Low / Medium / High)
  - latest NAV
  - daily change percentage

- Risk level meanings:
  - Low: conservative funds
  - Medium: balanced funds
  - High: aggressive funds

- Users should be able to:
  - Compare funds visually
  - Filter or sort funds based on key metrics

---

📄 ui_constraints.md（UI 约束）

# UI Constraints

- Finance-oriented, clean, professional style
- Avoid flashy or playful designs
- Use color intentionally:
  - Green: positive
  - Red: negative
- Layout must be clear and readable
- Provide a clear empty-state message when no data exists

---

三、【UI Case 的评测维度 & Evaluation Metrics】

📌 对齐你给的表格字段

| 维度         | 评估点             |
| ------------ | ------------------ |
| Completeness | 是否能完整跑起来   |
| Correctness  | 是否满足业务规则   |
| UI Quality   | 布局、层级、可读性 |
| Interaction  | 是否有有效交互     |
| Engineering  | 项目结构、配置     |
| Robustness   | 空状态、边界情况   |

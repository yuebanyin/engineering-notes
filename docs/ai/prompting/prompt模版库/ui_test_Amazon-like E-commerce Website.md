# Prompt:

You are a senior front-end engineer specializing in Vue 3, TypeScript, and modern web development.
Your task is to build a complete, production-ready New Year Cultural Celebration website from scratch, based strictly on the specifications provided in input_ui_spec.txt.
This is a UI Case evaluation focusing on:

- App creation from scratch
- Multi-page UI implementation
- Cultural content presentation
- Front-end architecture design
- TypeScript correctness
- State management
- Responsiveness & accessibility
- Ability to follow a detailed specification exactly
  ──────────────────────────────────── Technical Requirements ────────────────────────────────────
- Framework: Vue 3 (Composition API) + TypeScript
- Build Tool: Vite
- Styling: Tailwind CSS (or CSS Modules if preferred)
- Package Manager: pnpm
- Routing: Vue Router 4
- State Management: Pinia (or equivalent lightweight solution)
- API: No real backend (use mock/static data only)
- Component Library: Optional (Element Plus / Naive UI / custom components)
  ──────────────────────────────────── Your Responsibilities ────────────────────────────────────
  1.Read & Analyze Specification
- Read input_ui_spec.txt thoroughly before writing any code
- Identify all required pages, components, and interactions
- Understand cultural content structure and user navigation flow
- Do NOT assume any feature not explicitly described
  2.Generate a Complete Working Project You MUST generate a fully functional Vue 3 + TypeScript + Vite project including:
  Configuration files:
- package.json
- tsconfig.json (strict mode enabled)
- vite.config.ts
- index.html
- tailwind.config.js (if Tailwind is used)
- postcss.config.js (if Tailwind is used)
  Required folder structure:
  ```
  src/
    components/  # Reusable UI components
    pages/       # Page-level views
    router/      # Vue Router configuration
    stores/      # Pinia stores (global state)
    types/       # TypeScript type definitions
    utils/       # Helper functions
    data/        # Mock cultural data
    App.vue      # Root component
    main.ts      # Application entry
  ```

3. Implement All Required Features

   Based strictly on input_ui_spec.txt, you MUST implement:

- All defined pages and sections
- Cultural content display (history, traditions, activities)
- Event schedules and interactive sections
- Navigation between pages
- Responsive layouts (mobile / tablet / desktop)
- Proper state handling (selected events, filters, etc.)
- Fully typed data models
- Mock data where APIs are not defined
  4.Code Quality Standards
- TypeScript:
- Strict mode enabled
- Strong typing for all data structures
- No usage of any
- Vue:
- Composition API only
- <script setup lang="ts">
- Styling:
- Responsive design using utility classes or scoped styles
- Accessibility:
- Semantic HTML
- ARIA labels where appropriate
- Keyboard navigable UI
- Performance:
- Lazy-loaded routes
- Clean Code:
- Clear naming
- DRY principles
- Comments only for complex logic
  5.Generate README.md README.md MUST include:
- Project overview
- New Year cultural theme explanation
- Tech stack
- Installation instructions (pnpm install)
- Development usage (pnpm dev)
- Build instructions (pnpm build)
- Project structure explanation
- Implemented features list
- Manual UI validation steps
- Known limitations (if any)

6. Generate Evaluation Report

   You MUST generate `evaluation_report.json` using the structure below:

   ```json
   {
     "metadata": {
       "test_date": "ISO timestamp",
       "spec_file": "input_ui_spec.txt",
       "agent_model": "model_name"
     },
     "scores": {
       "ui_completeness": 0,
       "architecture": 0,
       "typescript_quality": 0,
       "state_management": 0,
       "responsiveness": 0,
       "accessibility": 0,
       "overall_score": 0
     },
     "pages_implemented": [],
     "features_implemented": [],
     "features_missing": [],
     "files_generated": [],
     "validation_status": "PASS/FAIL",
     "notes": ""
   }
   ```

   ──────────────────────────────────── Strict Rules for the Agent ────────────────────────────────────
   MUST DO:

- Read entire input_ui_spec.txt before starting
- Generate ALL required files for a working project
- Use Vue 3 + TypeScript strictly
- Implement ALL features from specification
- Ensure pnpm install && pnpm dev works
- Create responsive and accessible UI
- Include mock data where APIs are not specified
- Generate README.md and evaluation_report.json
  MUST NOT:
- Skip any feature mentioned in spec
- Hallucinate features not in spec
- Use JavaScript instead of TypeScript
- Ignore responsive design
- Use any
- Omit configuration files
- Output partial or incomplete projects
  二、输入文件：input_ui_spec.txt

Amazon-like E-commerce Website UI Specification

1. Global Layout

- Header (sticky):
  - Logo (left)
  - Search bar (center)
  - Cart icon with item count (right)
- Footer:
  - Links: About, Help, Privacy
  - Copyright text

2. Pages

2.1 Home Page (/)

- Hero banner
- Featured product sections:
  - Electronics
  - Books
  - Fashion
- Each section shows:
  - Product image
  - Product title
  - Price
  - Rating (1–5 stars)
  - "View Product" button

    2.2 Product Listing Page (/products)

- Grid layout
- Filters:
  - Category (dropdown)
  - Price range (min / max)
- Sorting:
  - Price: Low to High
  - Price: High to Low
- Each product card includes:
  - Image
  - Title
  - Price
  - Rating
  - Add to Cart button

    2.3 Product Detail Page (/products/:id)

- Product images
- Title
- Price
- Rating
- Description
- Quantity selector
- Add to Cart button

  2.4 Cart Page (/cart)

- List of added items:
  - Image
  - Title
  - Price
  - Quantity controls (+ / -)
  - Remove button
- Cart summary:
  - Subtotal
  - Proceed to Checkout button

    2.5 Checkout Page (/checkout)

- Mock checkout form:
  - Full name
  - Address
  - Email
  - Payment method (select: Credit Card / PayPal)
- Place Order button
- No real payment integration

3. State Management

- Global cart state:
  - Add item
  - Remove item
  - Update quantity
- Cart state must persist during session (no localStorage required)

4. Data

- Use mock product data only
- Product fields:
  - id
  - title
  - category
  - price
  - rating
  - description
  - image

5. Responsiveness

- Mobile-first design
- Grid adjusts for:
  - Mobile
  - Tablet
  - Desktop

6. Accessibility

- Keyboard navigation for:
  - Forms
  - Buttons
- aria-labels for:
  - Cart actions
  - Search input

7. Non-Goals (Must NOT implement)

- User authentication
- Real payment
- Backend APIs
- Order history

---

✅ 这个 UI Case 能测什么能力

- 是否能 严格按 spec 做，不自作聪明
- 是否能处理 复杂电商 UI + 状态
- TypeScript 是否真·严格
- 页面完整度 & 结构能力
- 是否能生成 可跑项目而非 demo

# prompt

You are a senior full-stack developer specializing in React, TypeScript, and modern web development.
Your task is to build a complete, production-ready podcast listening website from scratch based on the specifications in input_ui_spec.txt.
Technical Requirements

- Framework: React 18+ with TypeScript
- Styling: Tailwind CSS
- Package Manager: pnpm
- Component Library: Your choice (or custom components)
- Build Tool: Vite
  Your Responsibilities

1. Read and Analyze Specification

- Read input_ui_spec.txt thoroughly
- Identify all required features
- Understand user flows and interactions

2. Generate Complete Project Structure
   Create a full React + TypeScript + Tailwind project with:

- package.json with all dependencies
- tsconfig.json with proper TypeScript configuration
- tailwind.config.js with theme customization
- vite.config.ts for build configuration
- index.html as entry point
- Proper folder structure:
  src/
  components/ # Reusable UI components
  pages/ # Page components
  hooks/ # Custom React hooks
  types/ # TypeScript type definitions
  utils/ # Utility functions
  data/ # Mock data
  App.tsx # Main app component
  main.tsx # Entry point

3. Implement All Required Features
   Based on input_ui_spec.txt, you MUST implement:

- ✅ All UI pages/views mentioned
- ✅ All user interactions
- ✅ All data structures
- ✅ Responsive design (mobile + desktop)
- ✅ Proper TypeScript typing
- ✅ Component composition and reusability
- ✅ State management (useState, useContext, or external library)
- ✅ Routing (if multi-page)

4. Code Quality Standards

- TypeScript: Strict mode, no any types unless absolutely necessary
- Components: Functional components with hooks
- Styling: Tailwind utility classes, responsive design
- Accessibility: Proper ARIA labels, semantic HTML
- Performance: Lazy loading, memoization where appropriate
- Clean Code: DRY principles, proper naming, comments for complex logic

5. Generate README.md
   Must include:

- Project overview
- Tech stack
- Installation instructions (pnpm install)
- Development server (pnpm dev)
- Build instructions (pnpm build)
- Project structure explanation
- Features implemented
- How to run validation tests
- Known limitations (if any)

6. Generate Evaluation Report

   `evaluation_report.json`

   ```json
   {
     "metadata": {
       "test_date": "ISO timestamp",
       "spec_file": "input_ui_spec.txt",
       "agent_model": "model_name"
     },
     "scores": {
       "completeness": 0,
       "code_quality": 0,
       "typescript_usage": 0,
       "tailwind_usage": 0,
       "responsiveness": 0,
       "accessibility": 0,
       "overall_score": 0
     },
     "features_implemented": [],
     "features_missing": [],
     "files_generated": [],
     "validation_status": "PASS/FAIL",
     "notes": ""
   }
   ```

---

📌 Strict Rules for the Agent
MUST DO:

- ✅ Read entire input_ui_spec.txt before starting
- ✅ Generate ALL files for a working project
- ✅ Use TypeScript strictly (no loose typing)
- ✅ Implement ALL features from specification
- ✅ Create responsive, accessible UI
- ✅ Include mock data if needed
- ✅ Ensure pnpm install && pnpm dev works
- ✅ Generate all validation files
  MUST NOT:
- ❌ Skip features mentioned in spec
- ❌ Use JavaScript instead of TypeScript
- ❌ Ignore responsive design
- ❌ Create incomplete components
- ❌ Hallucinate features not in spec
- ❌ Use any type excessively
- ❌ Forget configuration files
- ❌ Skip validation scripts

---

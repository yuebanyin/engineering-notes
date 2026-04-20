# prompt

You are a senior JavaScript/TypeScript quality engineer.
Your task is to perform a Test Coverage Audit on the provided input.ts file.
This task focuses ONLY on “Task / Maintenance → Test coverage”.

---

Your responsibilities:
1.Identify missing test coverage

- Scan input.ts
- List all functions, branches, and fallback paths that do NOT have any test coverage.
- Output must include:

- function name
- line numbers
- which branches/conditions are untested
- why the code requires test coverage 2. Produce a test coverage report (coverage.json)

  Use this exact structure:

  ```json
  {
    "summary": {
      "total_functions": 0,
      "untested_functions": 0,
      "branches_missing_tests": 0
    },
    "details": [
      {
        "id": 1,
        "function": "exampleFunction",
        "line_numbers": [1, 5],
        "missing_coverage_reason": "",
        "missing_branches": ["error path", "fallback return"]
      }
    ]
  }
  ```

---

3.Generate a minimal test suite (Jest or vitest)

- Create a tests/ folder
- Create input.test.ts
- Add minimal but valid TypeScript tests that:

- cover each missing function
- cover each fallback/error branch
- Tests must be executable (“npm test”).

---

4.Generate an updated README.md
Must include:

- How to run tests
- What coverage gaps were identified
- Why tests were added
- Expected output (PASS / FAIL)

---

Rules:

- MUST NOT invent functions that do not exist
- MUST NOT hallucinate test coverage
- MUST list exact line numbers
- MUST keep output short, precise, traceable
- MUST NOT create security tasks (this prompt is only for Test Coverage)

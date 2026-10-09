# React SPA + Microsoft Entra ID + MSAL

一个最小但可运行的 React SPA 示例，用于熟悉 MSAL 在实际前端中的接入方式：登录、账户选择、静默获取 API access token、需要交互时跳转，以及登出。

> 示例不会把 client secret 放到前端（SPA 是 public client），也不会展示或写日志输出 access token。租户 ID 和 client ID 是应用标识，不是 secret；不要把 client secret、API key 等机密放入前端环境变量。

## 1. 配置 Entra ID 应用

1. 在 Microsoft Entra 管理中心创建一个 **Single-page application (SPA)** 应用注册。
2. 添加 redirect URI：`http://localhost:5173`。登出回调地址也使用本地应用地址。
3. 记下租户 ID 和应用（client）ID，填入 `.env`。
4. 如果要实际调用受保护 API，在 API 应用注册中配置并公开 delegated scope（例如 `access_as_user`），然后在 SPA 应用注册中请求该 scope，并完成所需的管理员或用户 consent。
5. API 还需要验证 access token，并允许开发服务器的 origin 发起 CORS 请求。SPA 客户端获取 token 不等于 API 已经完成授权验证。

本 demo 用具体租户 authority（`https://login.microsoftonline.com/{tenantId}`）。如果应用支持个人 Microsoft 账户或多租户登录，应按预期账户类型配置 authority 和应用注册。

## 2. 本地运行

```bash
npm install
cp .env.example .env
```

编辑 `.env`：

```dotenv
VITE_ENTRA_TENANT_ID=<your-tenant-id>
VITE_ENTRA_CLIENT_ID=<your-spa-application-client-id>
# Optional: uncomment and replace these when a protected API is available.
# VITE_API_SCOPES=api://<your-api-application-client-id>/access_as_user
# VITE_API_BASE_URL=https://localhost:7001/api/me
```

如果暂时没有 API，保持这两项未设置即可，登录和登出流程仍可运行。

```bash
npm run dev
```

打开 `http://localhost:5173`。开发服务器地址和 Entra 注册的 redirect URI 必须一致。

## 3. 阅读代码的顺序

1. [`src/authConfig.js`](./src/authConfig.js)：authority、client ID、redirect URI、缓存位置和 API scope。
2. [`src/main.jsx`](./src/main.jsx)：创建 `PublicClientApplication` 并用 `MsalProvider` 包裹 React 应用。Provider 负责初始化 MSAL 并处理重定向回调。
3. [`src/App.jsx`](./src/App.jsx)：调用 `loginRedirect` / `logoutRedirect`，选择 active account，并用 `acquireTokenSilent` 获取 API token。
4. `callProtectedApi`：先静默获取 token，再用 `Authorization: Bearer ...` 调 API；如果 MSAL 报 `InteractionRequiredAuthError`，转为 `acquireTokenRedirect`，让用户完成所需交互。

MSAL 会优先使用自己的缓存和静默获取机制；应用调用 `acquireTokenSilent`，而不是自行解析 token 有效期、保存 refresh token 或手动调用 token endpoint。silent 过程中需要用户交互时，应用应按场景处理交互，而不是无限重试。

## 4. 这和 SSO 的关系

MSAL 在这个 SPA 中完成 OIDC/OAuth 交互并为 API 获取 token。跨应用 SSO 不是把应用 A 的 token 复制给应用 B：两个应用分别注册自己的 client ID 和 redirect URI，信任同一个 Entra tenant；用户访问 B 时，Entra ID 可根据其 IdP 会话减少或免去再次输入凭据。实际是否无提示完成还取决于租户策略、浏览器会话、consent 和账户状态。

此 demo 使用 `sessionStorage` 作为 MSAL cache location，便于演示标签页会话边界；它不代表所有生产应用都必须选择该配置。若调整为 `localStorage`，需将 XSS 风险纳入威胁模型。无论缓存位置如何，前端都不应被视作可信边界，API 必须自行验证 token 和权限。

## 5. 面试时可以这样讲

> SPA 使用 MSAL 与 Entra ID 完成授权码 + PKCE 登录。登录后，应用对目标 API 调用 `acquireTokenSilent` 获取该 API 所需 scope 的 access token，并通过 Bearer header 调用 API。若静默获取需要用户交互，应用再走 redirect 或 popup。每个应用有自己的 client ID 和 redirect URI；SSO 来自共享的 IdP 会话，不是跨应用共享 token。API 仍负责验证 token 的 issuer、audience、有效期和权限。

这是一份教学示例，不包含完整生产配置，例如 API 端授权、监控、错误分类、路由守卫和部署环境中的 redirect URI 管理。

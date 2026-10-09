# Easy Auth 工作流程与 Token 管理

> 学习笔记：从登录回调、应用会话到 Token 刷新，并梳理权限不足时的处理方式。Easy Auth 的具体行为取决于 App Service 配置、身份提供商配置和 Token Store 状态；涉及具体部署时应以实际设置和 Microsoft 文档为准。

## 目录

- [1. 先建立整体模型](#1-先建立整体模型)
- [2. 首次登录：Callback、ID Token 与应用会话](#2-首次登录callbackid-token-与应用会话)
- [3. 登录后访问应用：为什么不必每次联系 IdP](#3-登录后访问应用为什么不必每次联系-idp)
- [4. Token Store 与端点](#4-token-store-与端点)
- [5. 需要新 Access Token 时会发生什么](#5-需要新-access-token-时会发生什么)
- [6. 已有授权不包含所需权限时怎么办](#6-已有授权不包含所需权限时怎么办)
- [7. 面试时的简要回答](#7-面试时的简要回答)
- [参考资料](#参考资料)

## 1. 先建立整体模型

以部署在 Azure App Service 上、启用了 Microsoft Entra ID 提供程序的 B 网站为例：

| 组件                                    | 职责                                                                          |
| --------------------------------------- | ----------------------------------------------------------------------------- |
| Microsoft Entra ID（IdP）               | 验证用户，签发 ID Token 和 Access Token，并维护 IdP 登录会话                  |
| Easy Auth（App Service Authentication） | 处理应用的认证入口与回调，建立 App Service 应用会话，并按配置管理提供商 Token |
| B 网站                                  | 根据 Easy Auth 保护规则提供页面或 API；后端仍需实施自己的授权判断             |
| 浏览器                                  | 在重定向流程中往返于 B 与 IdP，并在后续请求中携带 B 的应用会话 Cookie         |

这里有两种不同的会话/凭证，不要混为一谈：

1. **Entra ID 登录会话**：属于 IdP，用于判断用户是否已在 Microsoft 身份平台登录。
2. **Easy Auth 应用会话**：属于 B 的 App Service，浏览器通过 Cookie 在后续请求中表明已有 B 的认证会话。

Token 则是另一类凭证：ID Token 表达认证用户的信息；Access Token 面向特定资源/API。浏览器持有 B 的会话 Cookie，不代表它直接持有或能读取所有提供商 Token。

## 2. 首次登录：Callback、ID Token 与应用会话

### 2.1 服务端引导的登录流程

未登录的浏览器访问 B 的受保护资源时，典型的 **server-directed flow** 如下：

1. 浏览器请求 B。
2. Easy Auth 发现当前请求没有有效的应用会话，将浏览器重定向到 Microsoft Entra ID。
3. Entra ID 验证用户；如果 IdP 会话有效，可能不需要用户再次输入凭据。是否还需交互取决于策略、consent、账户状态等。
4. Entra ID 签发认证响应，并将浏览器重定向至 B 的 Easy Auth Callback，例如 `/.auth/login/aad/callback`。
5. Easy Auth 处理回调、验证认证结果，并建立 B 的应用会话；之后浏览器继续访问原始资源。

> Callback 是认证协议流程的一部分，不意味着业务页面 JavaScript 必须接收或解析 Token。这个流程由 Easy Auth 作为平台认证组件处理。

具体协议响应和 Token 处理细节可能受提供程序及其配置影响，不应把某一种 `response_type` 或“Token 一定出现在 URL 中”当成适用于所有 Easy Auth 部署的规则。

### 2.2 ID Token 是谁签发的？和 MSAL 有什么不同？

无论采用 MSAL 还是 Easy Auth，**ID Token 都由身份提供商（这里是 Entra ID）签发**，不是 MSAL 或 Easy Auth 自己生成的。

| 对比项                | MSAL.js SPA                         | Easy Auth 服务端引导流程                                                 |
| --------------------- | ----------------------------------- | ------------------------------------------------------------------------ |
| 认证流程由谁发起      | 浏览器中的 MSAL                     | App Service 平台                                                         |
| 谁签发 ID Token       | Entra ID                            | Entra ID                                                                 |
| 谁处理认证响应        | MSAL 在浏览器中处理                 | Easy Auth Callback 处理                                                  |
| 谁管理应用侧会话/缓存 | MSAL 按配置管理浏览器端 Token Cache | Easy Auth 建立平台应用会话；启用 Token Store 后可管理提供商 Token        |
| 浏览器最终持有什么    | 取决于 MSAL 缓存配置及应用实现      | 通常包含 B 的 Easy Auth 会话 Cookie；不代表 Token 必然保存在浏览器存储中 |

MSAL SPA 常用授权码流程（Authorization Code Flow）并结合 PKCE：浏览器重定向回来时通常先收到授权码，再由 MSAL 完成后续 Token 请求。不要把它简化为“JWT 总是跟在重定向 URL 中到达业务代码”。

## 3. 登录后访问应用：为什么不必每次联系 IdP

建立 Easy Auth 应用会话后，浏览器访问 B 时会携带 B 的会话 Cookie。只要 Easy Auth 判定该会话仍有效，通常可以直接放行，不必每次都重定向到 Entra ID。

这里的“直接放行”只描述认证会话检查，不等于用户对 B 的所有功能都有权限。应用仍需检查角色、业务规则和资源访问权限。

如果需要续期应用会话或提供商 Token，可能会触发额外的平台流程；如果会话过期、提供商 Token 无法刷新或 Entra ID 要求重新认证，则可能需要重新登录或授权。

## 4. Token Store 与端点

启用 Easy Auth Token Store 后，平台可以为认证会话管理提供商 Token。它与浏览器里的应用会话 Cookie 是不同的东西。

| 端点               | 用途                                                                      |
| ------------------ | ------------------------------------------------------------------------- |
| `/.auth/login/aad` | 发起 Microsoft Entra ID 登录                                              |
| `/.auth/refresh`   | 请求 App Service 刷新当前认证用户 Token Store 中的提供商 Token            |
| `/.auth/me`        | 读取当前认证会话信息；启用并配置 Token Store 时，响应可能包含提供商 Token |

**安全提醒：**`/.auth/me` 的返回内容可能包含敏感 Token。不要为了方便把它无条件暴露给前端、写入日志或展示在页面上。只有在确有需求且已评估访问边界、XSS、缓存和 Token 受众等风险时，才设计相应的取用方式。Microsoft 文档也指出，提供商 Access Token 的可用性受提供程序配置影响。

对于 Microsoft Entra ID，若要通过 Token Store 刷新提供商 Token，需要按文档配置相应的离线访问权限（例如 `offline_access`）并确保 Token Store 与提供商流程满足要求。不要假设只开启 Easy Auth 就必定能刷新任意 Token。

## 5. 需要新 Access Token 时会发生什么

假设 B 需要调用一个 API，且当前已有授权包含该 API 所需权限：

1. B 判断需要获取或更新目标 API 的 Access Token。
2. 应用在合适的信任边界内请求 `/.auth/refresh`，浏览器携带 B 的 Easy Auth 会话 Cookie。
3. App Service 尝试刷新 Token Store 中当前用户的提供商 Token。前提是 Token Store 已启用，并且提供商已提供可用的 Refresh Token。
4. App Service 服务端与 Entra ID 通信；成功后更新 Token Store。它通常不是浏览器再次跳转到登录页的交互式流程。
5. 后续按平台支持的方式取用更新后的 Token，再将其用于**受众匹配的 API**。

```text
B 应用/浏览器         Easy Auth / App Service          Microsoft Entra ID
     |                         |                              |
     |-- 请求刷新会话 Token -->|                              |
     |                         |-- Refresh Token 请求 ------->|
     |                         |<-- 新 Token / 错误 ----------|
     |                         |  更新 Token Store（成功时）   |
     |<-- 刷新结果/后续取用 ---|                              |
```

这是逻辑流程示意；实际调用方、响应内容和可取用的 Token 取决于应用配置。`/.auth/refresh` 刷新的是平台管理的**现有授权**，不是给应用动态增加任意权限的接口。

刷新可能失败，例如 Refresh Token 不可用、已撤销、提供商策略要求重新认证，或 Token Store 未启用/未配置。应用应检查响应并设计明确的错误处理和重新认证体验，不能假设刷新一定成功。

## 6. 已有授权不包含所需权限时怎么办

### 场景

B 之前已获准请求 Microsoft Graph 的 `User.Read`，现在要调用需要 `Mail.Read` 的 API。

**仅凭旧授权刷新 Token，不会自动获得 `Mail.Read`。**Refresh Token 用于在已有授权上下文中续取 Token，不会绕过用户或管理员 consent，也不会把缺失的权限静默补上。

```text
1. B 请求包含 Mail.Read 的新 Token
             |
             v
2. Easy Auth/Entra ID 检查现有授权
             |
       +-----+------+
       |            |
 已包含所需权限    缺少 Mail.Read
       |            |
 可能取得 Token    需要适当的授权/consent 流程
                    |
          用户同意，或管理员按租户策略批准
                    |
             再尝试取得 Token
```

如果缺少权限，具体结果取决于应用注册、租户 consent 策略、管理员要求以及当前认证流程，可能返回错误，也可能需要让用户进入交互式授权。不能把它描述为 Easy Auth 会自动无限等待或静默授予权限。

处理时应确认：

1. Entra ID 应用注册中是否配置了所需的 Microsoft Graph delegated permission（此例为 `Mail.Read`）。
2. 当前使用的认证流程是否确实请求了该 scope。
3. 该权限需要用户 consent 还是管理员 consent，以及是否已完成批准。
4. 错误是否表示需要交互；如需交互，应通过支持的登录/授权流程引导用户，并在完成后重试。

Easy Auth 擅长平台托管的认证和会话管理，但不等同于 MSAL 的前端 Token 获取 SDK。若应用需要按用户、按功能动态请求不同 API scopes 并处理 incremental consent，应先验证 Easy Auth 当前配置是否满足该需求；若需要客户端精细控制交互和 scope 请求，MSAL 或显式设计的 BFF/OIDC 流程可能更合适。

## 7. 整理表达

> Easy Auth 在服务端引导流程中接管登录重定向和 Callback。Entra ID 负责验证用户并签发 Token；Easy Auth 处理认证响应、建立 App Service 应用会话。启用并正确配置 Token Store 后，平台可以管理提供商 Token，`/.auth/refresh` 可尝试刷新已有授权对应的 Token，但它不会授予新权限。如果调用 API 所需的 scope 尚未 consent，应用必须处理相应错误，并在需要时引导用户或管理员完成授权。浏览器会话 Cookie、Entra 登录会话和提供商 Token 是不同对象。

## 参考资料

- [Microsoft Learn：Azure App Service Authentication overview](https://learn.microsoft.com/azure/app-service/overview-authentication-authorization)
- [Microsoft Learn：Work with OAuth tokens in Azure App Service](https://learn.microsoft.com/azure/app-service/configure-authentication-oauth-tokens)
- [Microsoft Learn：Microsoft identity platform scopes and permissions](https://learn.microsoft.com/entra/identity-platform/scopes-oidc)

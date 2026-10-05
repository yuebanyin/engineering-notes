# 面试问答速查

> 分为中文思路 + 简短英文口语版本；面向二面，围绕SSO、Azure、MSAL、Easy‑Auth。
> 提示：面试不要死记硬背，抓住关键词，用自己的话讲出来即可。

## Q1：What is difference between OAuth2.0 and OIDC?

【中文思路】
OAuth2是授权协议，产出access_token，解决应用访问资源权限；不能做登录身份认证。
OIDC构建在OAuth2之上，新增id_token(JWT)，用来识别用户身份，实现SSO单点登录。

【英文口语】
OAuth 2.0 is an authorization protocol. It returns access_token for calling API resources, but it cannot confirm user identity for login.
OIDC is identity‑authentication layer built on OAuth2.0. It provides extra id_token to prove who user is, so we can implement SSO.

## Q2：What is difference between MSAL‑JS and Easy‑Auth?

【中文思路】
MSAL‑JS是SPA引入的前端SDK库，业务代码引入，处理OIDC完整流程；适合SPA。
Easy‑Auth是Azure App Service平台内置功能，门户开启，不需要引入代码，适合服务端渲染网页。
SPA直接使用Easy‑Auth有限制；SPA想用Easy‑Auth，需要搭配BFF后端代理。

【英文口语】
MSAL‑JS is developer‑facing SPA SDK, we import it into source code for OIDC login and token refresh.
Easy‑Auth is Azure App Service built‑in platform feature, enabled on portal with little code change. It works best for server‑rendered web.
For SPA, Easy‑Auth has limitations. If we want to use it for SPA, we need BFF backend proxy layer.

## Q3：Why MSAL‑JS is preferred for SPA instead of Easy‑Auth?

【中文思路】
SPA大量是浏览器JS发起fetch/AJAX。
Easy‑Auth默认不给前端JSaccess_token；会话失效时对AJAX返回302重定向，fetch静默跟随跳转拿到HTML，SPA业务会崩溃。
MSAL‑JS把token交给浏览器JS，可以直接用于接口调用；静默刷新失败在JS层抛错，业务代码可控。

【英文口语】
SPA uses lots of browser‑side fetch / AJAX calls.
Easy‑Auth does not expose access_token to frontend JS by default. When session expires, it returns 302 redirect for AJAX, which breaks SPA application.
MSAL‑JS provides token to browser JS for API call. Refresh failure throws JavaScript‑side error for application to handle.

## Q4：Explain SSO flow when using MSAL‑JS with Azure Entra ID

【中文思路】

1. SPA使用MSAL‑JS，配置client_id、authority(Entra IdP地址)、redirect‑uri白名单；
2. 未登录时调用loginRedirect，页面跳转到Entra ID；
3. 用户在IdP登录，IdP生成IdP域名的会话Cookie；
4. 回调回到SPA，MSAL解析id_token、access_token、refresh_token，存入localStorage；
5. JS取出access_token放在请求头调用API；token快过期使用silent‑iframe或者refresh_token去IdP换新token；
6. 登出调用MSAL登出接口，跳转Entra ID logout端点，清除IdP的HttpOnly会话Cookie，同时前端清除localStorage内token。

【英文口语】
We configure MSAL‑JS with client‑id, authority and whitelisted redirect‑uri.
User will be redirected to Azure Entra ID for login. After login, IdP sets its own domain session cookie.
After callback, MSAL parses id_token, access_token and refresh_token and stores them in browser localStorage.
JS attaches access_token in request header for API calls. MSAL handles silent token refresh.
On logout, we redirect to Entra ID logout endpoint to clear IdP session cookie and clear local browser tokens.

## Q5：Why can’t SPA use HttpOnly cookie to store access_token?

【中文思路】
HttpOnly Cookie只能由后端服务通过Set‑Cookie响应头写入。SPA纯前端没有后端下发Set‑Cookie，所以SPA场景access_token只能放在localStorage，带来XSS风险。
注意区分：IdP的登录会话Cookie是HttpOnly，由IdP后端写入，JS不可读取。

【英文口语】
HttpOnly cookie can only be set by backend server via Set‑Cookie response header. Pure SPA has no backend to set this header. So SPA stores tokens in localStorage, which brings XSS risk. Note that IdP session cookie is HttpOnly and set by IdP backend.

## Q6：What problems may happen for silent‑iframe token refresh?

【中文思路】
现代浏览器Safari、Chrome第三方Cookie限制；浏览器会阻止iframe携带IdP跨域会话Cookie，导致静默刷新失败，需要用户重新登录。

【英文口语】
Modern browsers have third‑party cookie restrictions. It may block IdP session cookie inside hidden iframe, which makes silent refresh fail and require user to login again.

## Q7：What is application registration in Azure Entra ID?

【中文思路】
业务应用要接入Entra ID SSO，需要做应用注册，分配client_id，配置redirect‑uri白名单，建立IdP与业务应用之间信任关系，防止钓鱼攻击。

【英文口语】
We register our application inside Entra ID portal. It gives client‑id and configures whitelisted redirect‑uri, to build trust relationship between IdP and business application, and prevent phishing risk.

## Q8：Tell me about logout flow for Azure SSO

【中文思路】
不能只清除前端本地token。登出必须跳转IdP logout端点：

1. 前端清除localStorage里面id_token / access_token / refresh_token；
2. 浏览器跳转Entra ID logout接口；IdP销毁服务端session，下发Set‑Cookie清除IdP域名HttpOnly会话Cookie。
   > 浏览器端JS不能直接修改、删除IdP域名Cookie，受同源策略限制。

【英文口语】
We should not only clear local browser tokens. Real SSO logout must redirect to Entra ID logout endpoint. Frontend clears local tokens first. Then IdP destroys server‑side session and clears IdP‑domain HttpOnly cookie. JavaScript on business site cannot directly delete IdP cookie due to same‑origin policy.

## Q9：Refresh‑token can be revoked, what are those scenarios?

【中文思路】
refresh_token过期；用户主动登出；用户修改账号密码；管理员后台强制吊销会话。Azure Entra ID开启令牌轮转，每次刷新旧refresh_token直接作废。

【英文口语】
Refresh‑token will become invalid after lifetime expires. It can be revoked on user logout, password change or admin force revoke. Azure Entra ID uses refresh‑token rotation, old refresh‑token becomes invalid after each refresh call.

## Q10：What is the risk when we store tokens in localStorage?

【中文思路】
localStorage可被JS读取，存在XSS跨站脚本攻击风险，如果页面存在XSS漏洞，攻击者可以窃取token冒充用户。

【英文口语】
localStorage can be read by JavaScript. It brings XSS risk. If XSS vulnerability exists, attacker may steal tokens and impersonate user identity.

## Q11：MSAL-JS localStorage 存 token，XSS 风险，行业有哪些防范手段（汇丰面试高频，重点）

风险根源：localStorage 可以被 JS 读取。一旦页面存在 XSS 漏洞，攻击者注入恶意 JS，就可以读取 localStorage 里面的 id_token /access_token，拿到身份凭证，调用后端 API。

> ⚠️注意：HttpOnly Cookie 不受 XSS 读取，这是核心差异。

### ✅ 工程上的防护手段（按优先级排序，面试直接背）

1. **严格 CSP 内容安全策略（最高优先级）**
   响应头 `Content-Security-Policy`，禁止未授信外部脚本执行，阻止恶意 JS 注入。限制 script 来源，禁止 inline 脚本、eval。**CSP 是抵御 XSS 最核心防线**。
2. **缩短 access_token 有效期**
   Entra ID 默认 1 小时。越短越好，例如 20~30 分钟。就算 token 被盗，存活窗口很短，攻击可用时间有限。

> Refresh token 生命周期可以单独配置，同时开启 refresh token 轮转。一旦旧 refresh token 被窃取，使用一次就会作废。

3. **开启 Token 绑定 / 客户端证明（CAE，Entra Continuous Access Evaluation 持续访问评估）**
   CAE：可以根据事件（用户改密码、账号注销）立刻吊销 token，不用等 token 过期。银行 / 企业内部系统常用。
4. **输入过滤 + 输出编码**
   前端所有用户输入渲染时做转义，避免 DOM XSS；不要使用`innerHTML`、`eval`、`document.write`等危险 API。Vue/React 默认会转义，但是`dangerouslySetInnerHTML`一定要严格管控。
5. **子域名隔离**
   不要把不受信任的业务、文档预览放在和 SPA 同一个域名；子域名之间可以设置隔离，防止子域名漏洞偷主域名 localStorage。
6. **监控 + 异常检测**
   后端鉴权日志：检测异常 IP、异常设备、异地登录，发现异常直接拒绝请求。
7. **尽量最小化 token 权限（最小权限原则）**
   access_token 里面 scope 只申请必要权限，遵循最小权限。就算 token 泄露，攻击者能调用的接口权限有限。

### ❗无法根除，只能降低风险

> 重点面试话术：**这些措施只能降低 XSS 带来的危害，不能完全消除风险。如果业务是高敏感场景（金融），BFF 架构是更稳妥的方案，直接不让 JS 接触 token。**

### 简短英文面试脚本

When we store tokens in localStorage with MSAL-JS, XSS is the main risk. We mitigate risk with multiple layers:

1. Use strict CSP header to block unauthorized scripts.
2. Shorten access token lifetime, enable refresh token rotation and CAE continuous access evaluation.
3. Avoid unsafe DOM APIs, sanitize user input.
4. Apply least privilege principle for token scopes.
   But these methods only reduce risk, not eliminate it completely. For high-sensitive financial systems, BFF architecture is better, raw tokens never expose to frontend JS.

## 个人面试自我提醒清单

- 不要混淆CORS OPTIONS预检和SSO身份传递；
- 分清：IdP会话Cookie、Easy‑Auth平台会话Cookie、SPA localStorage中的token，三套完全不同东西；
- Easy‑Auth不是SDK，是App Service平台开关；
- SPA + Easy‑Auth的AJAX 302坑，理解它产生完整链路；
- localStorage物理持久 ≠ token凭证永久可用；
- 登出逻辑不能只清前端本地存储，要跳转IdP logout端点。

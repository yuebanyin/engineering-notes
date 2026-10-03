# 面试问答速查小抄

> 分为中文思路 + 简短英文口语版本；面向汇丰二面，围绕SSO、Azure、MSAL、Easy‑Auth。
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

## 个人面试自我提醒清单

- 不要混淆CORS OPTIONS预检和SSO身份传递；
- 分清：IdP会话Cookie、Easy‑Auth平台会话Cookie、SPA localStorage中的token，三套完全不同东西；
- Easy‑Auth不是SDK，是App Service平台开关；
- SPA + Easy‑Auth的AJAX 302坑，理解它产生完整链路；
- localStorage物理持久 ≠ token凭证永久可用；
- 登出逻辑不能只清前端本地存储，要跳转IdP logout端点。

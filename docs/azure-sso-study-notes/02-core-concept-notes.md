# 核心概念学习笔记：SSO / OIDC / JWT / 浏览器存储

> 记录学习过程中的理解，标记个人之前的误区

## 1. SSO 单点登录整体流程

场景：网站A、网站B，依赖同一个IdP身份服务完成免登。

完整流程：

1. 用户访问业务站点A，未登录；A做302重定向跳转至IdP服务（例如login.microsoftonline.com）。
2. 用户在IdP页面输入账号密码完成登录；IdP在浏览器写入**归属IdP域名的会话Cookie**。
   > ✅纠正：Cookie域名属于IdP，不属于A，也不属于B。A/B业务站点无法读取这条Cookie。
3. IdP使用私钥签发id_token，通过重定向回调回到A站点配置好的白名单redirect‑uri。
4. A站点校验token签名、签发者、受众、过期时间，校验通过，完成A网站登录。
5. 用户后续访问B网站；B检测未登录，同样重定向跳转到同一个IdP。
6. 浏览器访问IdP域名，自动带上IdP的会话Cookie。IdP识别用户已经登录，不需要再次输入密码，签发新的id_token回调B。B完成登录。

> 类比理解：IdP相当于高铁站安检口；A、B是候车厅。安检给用户贴一张通行贴纸（IdP域名Cookie）。去不同候车厅都要回到安检口出示贴纸，候车厅拿不到贴纸本身。

### 关键问题：关闭A网站单个Tab，是否会丢失IdP会话？

> 💡我的当时误区：关闭Tab就会删除Cookie。
> ✅纠正：

- IdP会话Cookie属于会话Cookie（无expires）：**只关闭单个Tab，浏览器进程还在，Cookie依旧保留。只有把整个浏览器全部关闭才会清除会话Cookie。**
- 只有sessionStorage才是关闭Tab就销毁。

手动让IdP会话失效：需要删除**IdP域名下的Cookie**，删除A/B业务站点Cookie是无效的；业务站点JS受同源策略限制，不能直接删除IdP域名Cookie，必须跳转IdP logout端点。

## 2. OAuth2.0 与 OIDC

- OAuth2.0：**授权协议（Authorization）**，解决“允许第三方应用调用资源API”，产出access_token；本身不做身份认证，不能实现登录。
- OIDC（OpenID Connect）：**身份认证协议**，构建在OAuth2.0之上。额外返回id_token(JWT)，用来证明用户是谁，实现SSO单点登录。

> 📝个人记忆口诀：
> OAuth2 —— 你可以干什么（access_token调用接口）
> OIDC —— 你是谁（id_token用于登录鉴权）

## 3. JWT 理解

JWT（JSON Web Token）格式三部分用`.`分割：`Header.Payload.Signature`

1. Header 头部：签名算法，例如RS256（非对称）、令牌类型。Base64 编码
2. Payload 载荷：存放claims（iss签发方、sub用户id、aud受众、exp过期时间）
   > ⚠️Payload是Base64URL编码，**不是加密！任何人可以解码查看内容，不能存放密码等敏感信息。签名只能防篡改，不能防读取。**
3. Signature 签名：Header+Payload，用密钥 / 私钥算出签名，用来校验内容有没有被篡改。IdP私钥签名；业务方使用IdP公钥校验签名是否被篡改。

区分两类JWT票据：

1. id_token：证明身份，用于登录；
2. access_token：访问令牌，用来调用后端API资源。

## 4. Refresh‑Token 刷新令牌

1. 作用：id_token/access_token时效短（一般60分钟），使用refresh_token向IdP换取全新的access_token、id_token，不需要用户重新输入账号密码。
2. Azure Entra ID默认开启 **Refresh‑Token Rotation令牌轮转**：每次刷新返回全新refresh_token，旧的refresh_token立即作废。
3. refresh_token失效场景：
   - 达到最大生命周期；
   - 用户主动登出；
   - 用户修改账号密码；
   - 管理员后台强制吊销会话。

> 💡我的当时误区：以为拿到refresh_token就可以无限续权限。
> ✅纠正：refresh_token可以在服务端被吊销，不是一劳永逸。

静默刷新两种方式：

1. 使用refresh_token调用IdP /token接口；
2. silent‑iframe：隐藏iframe访问IdP，依赖IdP域名会话Cookie，实现无感知续期。
   > 风险：现代浏览器第三方Cookie限制，会导致silent‑iframe静默刷新失败，需要重新登录。

### 🕐refresh_token 调用 IdP `/token` 接口什么时候触发（MSAL 内部触发时机）

1. 业务代码要调用 API，检测`access_token`快要过期（MSAL 会判断`exp`过期时间，默认提前 5 分钟主动刷新）；
2. 开发者手动调用 MSAL API `acquireTokenSilent()`；

### 🕐silent‑iframe 隐藏 iframe 静默刷新什么时候触发（MSAL 内部触发时机）

1. **refresh_token 已经失效，无法使用 refresh‑token 刷新**，降级使用 silent‑iframe；
2. 开发者手动调用`acquireTokenSilent()`，MSAL 内部自动选择走 iframe 路径；

### 执行完整流程

1. JS 在当前页面创建一个宽高为 0、看不见的`<iframe>`；
2. iframe 的 src 指向 IdP 的授权端点，带上参数 `prompt=none，client_id，redirect_uri`；
3. 浏览器加载这个 iframe，访问`login.microsoftonline.com`；**浏览器自动带上 IdP 域名下的会话 Cookie**；
4. IdP 读取 Cookie，确认用户会话有效；不会弹出登录界面；生成新 id_token + access_token；
5. IdP 302 重定向回调回我们预先配置好的 redirect‑uri；
6. iframe 内部完成回调，MSAL JS 监听到 iframe 里面 URL 带回的 token；提取出新 token 存入 localStorage；销毁 iframe。
7. 业务拿到新 token 继续工作。

## 5. 浏览器存储对比 Cookie / localStorage / sessionStorage

| 特性                   | Cookie                                                  | localStorage       | sessionStorage            |
| ---------------------- | ------------------------------------------------------- | ------------------ | ------------------------- |
| 容量                   | ~4KB                                                    | 5‑10MB             | 5‑10MB                    |
| 是否随HTTP请求自动上传 | ✅是                                                    | ❌否               | ❌否                      |
| 生命周期               | 会话Cookie：关闭整个浏览器删除；持久Cookie按expires过期 | 持久保存，手动清除 | 关闭当前Tab标签页直接销毁 |
| 多同源Tab共享          | ✅全部Tab共享                                           | ✅全部Tab共享      | ❌每个Tab隔离             |
| 读写者                 | 后端Set‑Cookie；HttpOnly时JS不可读                      | 仅JS               | 仅JS                      |

> 📝个人重要误区：
> SPA无法使用HttpOnly Cookie存放access_token/id_token，因为SPA没有后端下发Set‑Cookie；所以MSAL‑JS把token存localStorage，带来XSS安全风险。

## 6. 重要概念区分

- IdP：Identity Provider，身份提供者，负责账号登录、签发token，Azure Entra ID就是IdP服务。
- SP：Service Provider，业务应用A/B，需要提前在IdP注册，配置client_id、redirect‑uri白名单。
  > redirect‑uri必须白名单校验，防止钓鱼攻击；不能使用不安全的通配符配置。

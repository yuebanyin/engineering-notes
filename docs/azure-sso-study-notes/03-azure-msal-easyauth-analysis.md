# Azure Entra ID / MSAL‑JS / Easy‑Auth 深度分析笔记

> 面试官重点考察知识点，重点分析SPA单页应用场景选型权衡

## 1. 三个核心组件定位

### 1‑1 Azure Entra ID（旧名Azure AD）

- 角色：**IdP身份服务，是一个云服务，不是SDK库**。地址：login.microsoftonline.com
- 职责：管理企业账号、应用注册、签发id_token / access_token / refresh_token，处理登录会话、令牌吊销。
- 关键概念：Application Registration（应用注册）
  业务应用A/B需要在Entra ID中注册，分配client_id，配置redirect‑uri白名单，建立信任关系。

### 1‑2 MSAL‑JS（Microsoft Authentication Library）

- 角色：**前端SDK代码库（npm包），业务代码显式引入**，用于SPA。
- 职责：封装OIDC协议；处理登录跳转回调；缓存token；实现silent‑iframe静默刷新；处理refresh‑token轮转；登出逻辑。
- 存储：SPA模式下，token（id_token、access_token、refresh_token）存储在浏览器localStorage（常规）。
  > 风险点：localStorage容易遭受XSS攻击。IdP的登录会话Cookie是HttpOnly，JS不可读取，和SPA本地token相互独立。

### 1‑3 Easy‑Auth（正式名称：App Service Authentication / Authorization）

> 💡
> Easy‑Auth是**Azure App Service平台层的可选中间件功能，不是SDK，不需要引入任何业务源代码。在Azure门户页面开关配置即可。**
> 底层同样基于Entra ID OIDC协议。

工作机制：请求到达App Service之后，先经过平台Easy‑Auth中间件拦截处理。

1. 校验登录会话；未登录返回302重定向跳转到Entra ID登录页；
2. 登录完成后Easy‑Auth完成token校验；
3. 将解析后的用户身份信息放入HTTP请求头`X‑MS‑CLIENT‑PRINCIPAL`传递给后端业务代码。
   > 默认行为：原始access_token不会暴露给浏览器前端JS。

✅最佳适配场景：**服务端渲染Web应用（MVC，后端渲染页面），几乎零认证代码改动。**

## 2. 关键辨析：SPA单页应用下使用Easy‑Auth会遇到的问题

> SPA特点：大量逻辑运行浏览器JS；大量请求为fetch/AJAX异步请求，不是浏览器整页GET跳转。

### 问题1：浏览器JS拿不到access_token

1. 如果SPA JS需要直接调用**外部其他域名API**：该请求不会经过App Service，Easy‑Auth拦截不到。
2. Easy‑Auth默认不会把access_token给到浏览器JS；JS没有凭证，无法在fetch请求头带上token访问外部API。

### 问题2：AJAX/fetch收到未认证返回302重定向，造成SPA业务灾难

> 场景：SPA页面长时间打开不刷新，会话中途失效。
> 会话失效来源：

1. Easy‑Auth自身App‑Service域名下平台会话Cookie过期；
2. 用户在另外Tab执行登出操作，IdP会话被销毁；
3. 管理员吊销账号会话；
4. 浏览器隐私第三方Cookie策略清理会话。

> ⚠️重点：SPA页面UI仍然正常，用户无感知；直到执行fetch/AJAX调用接口的时候，才暴露会话失效。
> Easy‑Auth不会区分“页面GET请求”还是“AJAX异步请求”，检测未登录返回302重定向登录页。
> fetch API规范会**静默跟随302跳转，不会更新浏览器地址栏**；最终拿到登录页面HTML字符串，把HTML当成JSON解析，JS直接报错，页面不会跳转到登录页，业务功能直接崩溃。

> 传统服务端渲染网站不受影响：因为是浏览器完整页面GET请求，收到302浏览器原生跳转登录页面。

## 3. SPA场景下Easy‑Auth可行的架构：BFF（Backend‑for‑Frontend）代理模式

架构约束：

1. SPA浏览器JS**禁止直接调用外部API**；
2. 所有网络请求全部请求到同App Service部署的BFF轻量后端；
3. 请求经过Easy‑Auth校验，BFF后端可以拿到access_token；
4. **由BFF后端服务去调用外部API**，再把结果返回给SPA前端。

> 代价：全部外部接口增加一层BFF代理转发；浏览器永远拿不到access_token。
> 如果项目SPA需要浏览器JS直接调用API，BFF模式就不适合。

## 4. MSAL‑JS 为什么更适合普通SPA

1. MSAL‑JS运行在浏览器JS内部；登录回调后直接把id_token / access_token给到前端JS，存放在localStorage；
2. JS可以自由取出token，放到fetch请求Authorization头部，既可以调用本域接口，也可以调用外部跨域API；
3. token快过期，通过silent‑iframe后台静默续期；
4. 静默刷新失败，MSAL在JS层抛出业务错误，交给业务代码处理；**不会返回HTTP层面302重定向，规避fetch灾难问题。**

## 5. 选型对比总结表

| 方案                  | Easy‑Auth                        | MSAL‑JS                       |
| --------------------- | -------------------------------- | ----------------------------- |
| 类型                  | Azure App Service平台开关，非SDK | 前端npm SDK库，写进业务代码   |
| 最佳场景              | 服务端渲染MVC网页                | SPA单页应用                   |
| SPA直接拿access_token | 默认不暴露给前端JS               | ✅JS可获取token               |
| 静默刷新token         | 困难，容易触发302                | silent‑iframe原生支持         |
| AJAX未登录处理        | 返回302，SPA有崩溃风险           | JS抛出异常，业务可控          |
| SPA使用前提           | 必须搭配BFF后端代理              | 不需要额外后端，纯SPA也可使用 |

<!-- ## 📝结合个人简历项目思考（Sales Genie AI SPA项目）

我的Sales Genie项目是React SPA：浏览器JS直接发起fetch、SSE流式请求；页面会长时间驻留在AI聊天界面，用户不会频繁刷新页面；没有BFF代理层。

> 选型思考：
> 如果项目开启Easy‑Auth，会面临两个风险：

1. JS无法直接拿到access_token调用接口；
2. 长时间页面驻留，会话过期后AJAX调用接口触发302重定向，造成业务异常。
   因此项目选择MSAL‑JS，在浏览器侧处理完整OIDC SSO流程。 -->

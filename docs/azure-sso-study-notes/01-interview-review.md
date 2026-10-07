# 面试复盘：SSO单点登录问题复盘

> 背景：一面，单点登录相关问题回答出现偏差；面试结束面试官给出学习方向提示关键词：Easy‑Auth、Microsoft Azure。
> 本次笔记为面试结束后自主补全学习，用于梳理知识漏洞。

## 面试原题回忆

> 面试官问题：用户登录网站A之后，再访问合作网站B，如何做到用户不需要重新登录，实现免登，如何拿到用户身份信息？

### 📌我当时的回答（存在偏差）

1. 用户登录A网站，服务端返回token；
2. 访问B网站的时候会发起OPTIONS请求来完成跨域，实现登录信息传递。

### ❌面试官反馈：回答完全答偏

> 核心问题：混淆了「CORS OPTIONS跨域预检」和「SSO单点登录身份传递」。
> OPTIONS只是浏览器用于AJAX跨域权限校验的机制，**完全不负责身份、登录凭证的传递**。

### ✨面试官给出的学习提示点

需要重点研究：

1. SSO单点登录完整流程，IdP身份提供者的工作原理；
2. Microsoft Azure（Entra ID，旧称Azure AD）身份体系；
3. Easy‑Auth（App Service Authentication）；
4. 相关SDK库：MSAL；区分不同组件的定位、适用场景，尤其SPA单页应用场景下的选型差异。

## 我当时的知识漏洞清单（学习前）

1. 分不清CORS跨域和SSO身份互通；
2. 对IdP的会话Cookie理解模糊：误以为Cookie是A网站生成，提供给B网站使用；没有理解Cookie归属是IdP域名；
3. 对JWT、id_token / access_token / refresh_token各自职责混淆；
4. 不清楚Azure体系下 MSAL 与 Easy‑Auth两者定位，不知道为什么SPA场景优先MSAL；
5. 对浏览器存储：Cookie、localStorage、sessionStorage生命周期、安全边界理解有错误；
6. 不理解SPA场景下Easy‑Auth搭配AJAX/fetch会产生的302重定向灾难问题。

## 本次学习目标

1. 完整理解OIDC SSO整套端到端流程；
2. 厘清Azure Entra ID、MSAL、Easy‑Auth三者的角色、区别、适用边界；
3. 重点理解SPA单页应用场景下的各种限制、坑点；

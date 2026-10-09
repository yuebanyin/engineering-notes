import React, { useEffect, useState } from "react";
import {
  InteractionRequiredAuthError,
  InteractionStatus,
} from "@azure/msal-browser";
import { useMsal } from "@azure/msal-react";
import { apiBaseUrl, apiScopes, loginRequest } from "./authConfig.js";

function errorMessage(error) {
  return error instanceof Error
    ? error.message
    : "发生了未知错误，请确认应用注册和网络配置。";
}

export default function App() {
  const { instance, accounts, inProgress } = useMsal();
  const [activeAccountId, setActiveAccountId] = useState("");
  const [authError, setAuthError] = useState("");
  const [apiResult, setApiResult] = useState("");
  const [apiError, setApiError] = useState("");
  const busy = inProgress !== InteractionStatus.None;
  const activeAccount =
    accounts.find((account) => account.homeAccountId === activeAccountId) ??
    instance.getActiveAccount();
  const canCallApi = apiScopes.length > 0 && apiBaseUrl.length > 0;

  useEffect(() => {
    if (accounts.length === 0) {
      setActiveAccountId("");
      return;
    }

    const selectedAccount =
      accounts.find((account) => account.homeAccountId === activeAccountId) ??
      instance.getActiveAccount() ??
      accounts[0];

    instance.setActiveAccount(selectedAccount);
    setActiveAccountId(selectedAccount.homeAccountId);
  }, [accounts, activeAccountId, instance]);

  async function signIn() {
    setAuthError("");
    try {
      await instance.loginRedirect(loginRequest);
    } catch (error) {
      setAuthError(errorMessage(error));
    }
  }

  async function signOut() {
    setAuthError("");
    try {
      await instance.logoutRedirect({
        account: activeAccount,
        postLogoutRedirectUri: window.location.origin,
      });
    } catch (error) {
      setAuthError(errorMessage(error));
    }
  }

  function selectAccount(event) {
    const selectedAccount = accounts.find(
      (account) => account.homeAccountId === event.target.value,
    );
    if (!selectedAccount) return;

    instance.setActiveAccount(selectedAccount);
    setActiveAccountId(selectedAccount.homeAccountId);
    setApiResult("");
    setApiError("");
  }

  async function callProtectedApi() {
    if (!activeAccount || !canCallApi) return;

    setApiError("");
    setApiResult("");

    try {
      const tokenResult = await instance.acquireTokenSilent({
        scopes: apiScopes,
        account: activeAccount,
      });

      const response = await fetch(apiBaseUrl, {
        headers: {
          Authorization: `Bearer ${tokenResult.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`API 请求失败：HTTP ${response.status}`);
      }

      setApiResult(await response.text());
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        try {
          await instance.acquireTokenRedirect({
            scopes: apiScopes,
            account: activeAccount,
          });
        } catch (redirectError) {
          setApiError(errorMessage(redirectError));
        }
        return;
      }

      setApiError(errorMessage(error));
    }
  }

  return (
    <main className="page">
      <section className="card">
        <p className="eyebrow">Microsoft Entra ID · MSAL React</p>
        <h1>SPA 登录与受保护 API</h1>
        <p className="intro">
          使用授权码流程（带 PKCE）完成登录；MSAL 负责处理重定向回调和令牌缓存。
        </p>

        {activeAccount ? (
          <div className="account">
            <div>
              <span className="label">当前账户</span>
              <strong>{activeAccount.name || activeAccount.username}</strong>
              <span className="muted">{activeAccount.username}</span>
            </div>
            {accounts.length > 1 && (
              <label className="account-picker">
                切换账户
                <select value={activeAccount.homeAccountId} onChange={selectAccount}>
                  {accounts.map((account) => (
                    <option key={account.homeAccountId} value={account.homeAccountId}>
                      {account.name || account.username}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="actions">
              <button onClick={callProtectedApi} disabled={busy || !canCallApi}>
                {busy ? "处理中…" : "获取令牌并调用 API"}
              </button>
              <button className="secondary" onClick={signOut} disabled={busy}>
                登出
              </button>
            </div>
            {!canCallApi && (
              <p className="hint">
                登录已可使用。要测试 API 调用，请按 README 配置 API scope 和地址。
              </p>
            )}
          </div>
        ) : (
          <button onClick={signIn} disabled={busy}>
            {busy ? "处理中…" : "使用 Microsoft 登录"}
          </button>
        )}

        {authError && <p className="error">{authError}</p>}
        {apiError && <p className="error">{apiError}</p>}
        {apiResult && (
          <section className="result">
            <h2>API 响应</h2>
            <pre>{apiResult}</pre>
          </section>
        )}

        <p className="security-note">
          Demo 不展示或记录 access token。生产环境还应校验后端授权，并避免在日志中写入令牌。
        </p>
      </section>
    </main>
  );
}

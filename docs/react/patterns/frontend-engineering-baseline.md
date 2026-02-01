# 前端工程化基线：构建、分包、监控、发布策略

> 这篇笔记总结了我在多个项目中积累的前端工程化实践。从 Webpack 构建优化到 Sentry 错误监控，从代码分割到灰度发布，这些是保障线上质量的"基础设施"。

---

## 🎯 工程化的目标

| 目标 | 手段 |
|------|------|
| **开发效率** | 热更新、类型检查、代码生成 |
| **构建质量** | 代码分割、Tree Shaking、压缩 |
| **线上稳定** | 错误监控、性能追踪、告警 |
| **发布安全** | 灰度发布、快速回滚、变更控制 |

---

## 📦 构建优化

### Bundle 分析

**第一步永远是测量**：

```bash
# Webpack
npm install --save-dev webpack-bundle-analyzer

# 在 webpack.config.js 中添加
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

module.exports = {
  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      openAnalyzer: false,
      reportFilename: 'bundle-report.html',
    }),
  ],
};
```

### 我在 Expedia 项目中的构建优化实践

#### 1. 代码分割策略

```javascript
// webpack.config.js
module.exports = {
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        // 第三方库单独打包
        vendors: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: 10,
        },
        // React 全家桶
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom|react-router)[\\/]/,
          name: 'react-vendor',
          priority: 20,
        },
        // 大型库单独分包
        apollo: {
          test: /[\\/]node_modules[\\/]@apollo[\\/]/,
          name: 'apollo',
          priority: 20,
        },
        // 公共组件
        common: {
          name: 'common',
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true,
        },
      },
    },
  },
};
```

#### 2. 路由级代码分割

```jsx
// routes.jsx
import { lazy, Suspense } from 'react';

// 按路由分割
const HomePage = lazy(() => import('./pages/Home'));
const SearchPage = lazy(() => import('./pages/Search'));
const BookingPage = lazy(() => import('./pages/Booking'));
const HotelDetailPage = lazy(() => import('./pages/HotelDetail'));

// 预加载策略：用户可能访问的下一个页面
const preloadBooking = () => import('./pages/Booking');

function Routes() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Switch>
        <Route path="/" exact component={HomePage} />
        <Route path="/search" component={SearchPage} />
        <Route path="/hotel/:id" component={HotelDetailPage} />
        <Route path="/booking" component={BookingPage} />
      </Switch>
    </Suspense>
  );
}
```

#### 3. 资源预加载

```html
<!-- 关键资源预加载 -->
<link rel="preload" href="/fonts/main.woff2" as="font" type="font/woff2" crossorigin>

<!-- DNS 预解析 -->
<link rel="dns-prefetch" href="//api.hotels.com">
<link rel="preconnect" href="//api.hotels.com">

<!-- 预获取下一页可能需要的资源 -->
<link rel="prefetch" href="/booking-bundle.js">
```

#### 4. Tree Shaking 优化

```javascript
// package.json - 标记无副作用
{
  "sideEffects": [
    "*.css",
    "*.scss"
  ]
}

// 使用 ES modules 导入
// ❌ 这样会导入整个 lodash
import _ from 'lodash';

// ✅ 这样只导入需要的函数
import debounce from 'lodash/debounce';
import throttle from 'lodash/throttle';

// ✅ 或使用 lodash-es
import { debounce, throttle } from 'lodash-es';
```

---

## 📊 性能预算

### 设定阈值

```javascript
// webpack.config.js
module.exports = {
  performance: {
    hints: 'error',  // 超过阈值报错
    maxEntrypointSize: 250 * 1024,  // 入口文件 < 250KB
    maxAssetSize: 200 * 1024,       // 单个资源 < 200KB
  },
};
```

### 我的性能预算参考

| 指标 | 阈值 | 说明 |
|------|------|------|
| 首屏 JS | < 200KB gzip | 影响 TTI |
| 首屏 CSS | < 50KB gzip | 阻塞渲染 |
| 单个 chunk | < 100KB gzip | 避免大文件 |
| 图片 | < 100KB each | 使用 WebP |
| LCP | < 2.5s | Core Web Vitals |
| INP | < 200ms | Core Web Vitals |
| CLS | < 0.1 | Core Web Vitals |

### CI 集成检查

```yaml
# .github/workflows/perf-check.yml
name: Performance Check

on: [pull_request]

jobs:
  bundle-size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build
        run: npm run build
        
      - name: Check bundle size
        uses: preactjs/compressed-size-action@v2
        with:
          pattern: 'dist/**/*.{js,css}'
          threshold: 10%  # 超过 10% 增长则警告
```

---

## 🔍 可观测性

### 错误监控（Sentry）

```javascript
// sentry.config.js
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.APP_VERSION,
  
  // 采样率
  tracesSampleRate: 0.1,  // 10% 的事务进行性能追踪
  
  // 过滤噪音
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Network request failed',
  ],
  
  // 敏感信息脱敏
  beforeSend(event) {
    if (event.request?.headers) {
      delete event.request.headers['Authorization'];
    }
    return event;
  },
});
```

### Error Boundary 集成

```jsx
// components/ErrorBoundary.jsx
import * as Sentry from '@sentry/react';

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div className="error-page">
      <h1>出错了</h1>
      <p>我们已经收到错误报告，正在处理中。</p>
      <button onClick={resetErrorBoundary}>重试</button>
    </div>
  );
}

// 使用 Sentry 的 ErrorBoundary
function App() {
  return (
    <Sentry.ErrorBoundary
      fallback={ErrorFallback}
      onError={(error, componentStack) => {
        // 额外的错误处理逻辑
        console.error('Caught by boundary:', error);
      }}
    >
      <Router />
    </Sentry.ErrorBoundary>
  );
}
```

### 性能监控

```javascript
// 自定义性能指标上报
import { getCLS, getFID, getLCP, getINP } from 'web-vitals';

function sendToAnalytics(metric) {
  const body = JSON.stringify({
    name: metric.name,
    value: metric.value,
    delta: metric.delta,
    id: metric.id,
    page: window.location.pathname,
  });
  
  // 使用 Beacon API，不阻塞页面卸载
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/analytics', body);
  } else {
    fetch('/analytics', { body, method: 'POST', keepalive: true });
  }
}

getCLS(sendToAnalytics);
getLCP(sendToAnalytics);
getINP(sendToAnalytics);
```

### 用户行为追踪

```javascript
// 关键操作埋点
const analytics = {
  track(event, properties = {}) {
    const payload = {
      event,
      properties: {
        ...properties,
        timestamp: Date.now(),
        sessionId: getSessionId(),
        userId: getUserId(),
        page: window.location.pathname,
      },
    };
    
    // 发送到分析服务
    sendToAnalytics(payload);
  },
  
  // 页面访问
  pageView(pageName) {
    this.track('page_view', { pageName });
  },
  
  // 用户操作
  action(actionName, data) {
    this.track('user_action', { actionName, ...data });
  },
};

// 使用
analytics.action('booking_completed', {
  hotelId: hotel.id,
  totalPrice: booking.totalPrice,
  nights: booking.nights,
});
```

---

## 🚀 发布策略

### Source Map 管理

```javascript
// webpack.config.js
module.exports = {
  devtool: process.env.NODE_ENV === 'production' 
    ? 'hidden-source-map'  // 生成但不公开
    : 'eval-cheap-module-source-map',  // 开发环境快速构建
};

// 上传 source map 到 Sentry
// package.json scripts
{
  "scripts": {
    "build": "webpack --mode production",
    "sentry:upload": "sentry-cli releases files $VERSION upload-sourcemaps ./dist"
  }
}
```

### 灰度发布

```javascript
// 灰度策略示例
function shouldEnableFeature(userId, featureId) {
  // 基于用户 ID 的百分比灰度
  const hash = hashCode(userId + featureId);
  const percentage = Math.abs(hash % 100);
  
  return percentage < getFeaturePercentage(featureId);
}

// 在组件中使用
function NewBookingFlow() {
  const { userId } = useAuth();
  const enableNewFlow = shouldEnableFeature(userId, 'new_booking_flow');
  
  if (enableNewFlow) {
    return <NewBookingComponent />;
  }
  return <LegacyBookingComponent />;
}
```

### 回滚策略

```yaml
# 快速回滚脚本
# scripts/rollback.sh

#!/bin/bash
PREVIOUS_VERSION=$1

if [ -z "$PREVIOUS_VERSION" ]; then
  echo "Usage: ./rollback.sh <version>"
  exit 1
fi

echo "Rolling back to version: $PREVIOUS_VERSION"

# 切换 CDN 指向
aws cloudfront update-distribution \
  --id $DISTRIBUTION_ID \
  --origin-path /$PREVIOUS_VERSION

# 通知相关人员
curl -X POST $SLACK_WEBHOOK \
  -d "{\"text\": \"⚠️ Rollback to $PREVIOUS_VERSION completed\"}"
```

### 发布检查清单

```markdown
## 发布前检查

### 构建检查
- [ ] 构建成功，无警告
- [ ] Bundle 大小未超过预算
- [ ] 无新增的大型依赖

### 测试检查
- [ ] 单元测试通过
- [ ] E2E 测试通过（关键路径）
- [ ] 手动验证核心功能

### 监控检查
- [ ] Sentry release 已创建
- [ ] Source map 已上传
- [ ] 告警规则已配置

### 发布执行
- [ ] 灰度比例确定（10% → 50% → 100%）
- [ ] 回滚方案就绪
- [ ] 值班人员确认
```

---

## 📋 验证发布效果

### 发布后监控

| 指标 | 观察时间 | 告警阈值 |
|------|----------|----------|
| 错误率 | 实时 | > 0.5% |
| P99 延迟 | 5 分钟 | > 之前 2x |
| 转化率 | 1 小时 | 下降 > 5% |
| Core Web Vitals | 24 小时 | 退化 |

### 灰度指标对比

```javascript
// 对比新旧版本指标
function compareVersionMetrics(oldVersion, newVersion) {
  return {
    errorRate: {
      old: getErrorRate(oldVersion),
      new: getErrorRate(newVersion),
    },
    latency: {
      old: getP99Latency(oldVersion),
      new: getP99Latency(newVersion),
    },
    conversion: {
      old: getConversionRate(oldVersion),
      new: getConversionRate(newVersion),
    },
  };
}
```

---

## 🔧 我的工程化配置模板

### ESLint 配置

```javascript
// .eslintrc.js
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    // React Hooks 规则
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    
    // 禁止 console（生产）
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
    
    // 强制使用 === 
    'eqeqeq': ['error', 'always'],
  },
};
```

### Prettier 配置

```javascript
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

### Husky + lint-staged

```javascript
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "commit-msg": "commitlint -E HUSKY_GIT_PARAMS"
    }
  },
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{css,scss}": [
      "prettier --write"
    ]
  }
}
```

---

## 💡 经验总结

1. **先测量，后优化**：不要凭感觉做构建优化
2. **渐进式分包**：从大的 vendor 开始，逐步细化
3. **监控先行**：发布前先确保监控到位
4. **灰度发布**：永远不要一次性全量发布
5. **自动化优先**：能自动化的检查都应该自动化

---

## 📚 相关笔记

- [性能排查清单](../performance/react-performance-checklist.md)
- [测试分层策略](../testing/testing-strategy-layering.md)

---

## 参考资料

- [Webpack Documentation](https://webpack.js.org/)
- [web.dev - Performance](https://web.dev/performance/)
- [Sentry Documentation](https://docs.sentry.io/)
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/)

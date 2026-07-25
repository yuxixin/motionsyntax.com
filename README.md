# ShotAxis 官网（本地）

静态营销站 + 合规页，视觉对齐 App 台呢绿与开屏 slogan；主体与法律信息对齐 Backend 隐私政策与 `www.motionsyntax.com`。

## 部署（ECS）

静态文件目录：`/var/www/shotaxis`（nginx `root`）。

```bash
cd Website
tar czf - --exclude README.md --exclude .DS_Store . \
  | ssh root@YOUR_HOST 'mkdir -p /var/www/shotaxis && tar xzf - -C /var/www/shotaxis'
```

隐私政策路径兼容：`/privacy` → `privacy.html`。


## 页面

| 路径 | 用途 |
| --- | --- |
| `index.html` | 产品营销首页 |
| `privacy.html` | 隐私政策（与 `Backend/PrivacyPolicy/public/privacy.html` 同源） |
| `terms.html` | 服务条款（对齐 motionsyntax.com/terms） |
| `support.html` | 产品支持 |
| `contact.html` | 公司主体与联系信息 |

## 内容原则

- 卖点对齐 PRD：Watch 采集 + iPhone 复盘、发力/运杆/出杆、动态重点、历史趋势、Pro 建议。
- 页脚保留可点击的主体简称与隐私/条款/支持入口；详细工商注册信息不在产品站展示。联系邮箱：`support@motionsyntax.com`。
- 不宣称尚未交付的能力（云同步、完整上架闭环等）。
- 预约邮箱收集已关闭；底部引导邮件联系 `support@motionsyntax.com`。

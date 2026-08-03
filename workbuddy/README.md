# WorkBuddy · 森系像素个人工作台

可添加到手机主屏幕的 PWA 应用:今日中枢 / 考公专项 / 生理周期 / 财富工坊 / 时光胶囊 / 智能提醒 / 成就殿堂 / 设置。
纯静态站点(HTML + CSS + JS),数据存储于手机本地 localStorage,离线可用。

## 部署到 Vercel(永久免费)

### 方式一:GitHub + Vercel 自动部署(推荐,永久且可自动更新)

**第 1 步:把代码上传到 GitHub(需 GitHub 账号,免费)**

1. 打开 https://github.com → 登录 → 点右上角 **+ → New repository**
2. 仓库名填 `workbuddy`,选择 **Private**(私有),**不要勾选** "Add a README file"
3. 点 **Create repository** 创建
4. 进入刚创建的仓库页面,你会看到三种上传方式,任选其一:

**方式 A(最简单,网页上传)**
- 点页面上的 **"uploading an existing file"**
- 把这个文件夹里的以下文件拖进去:
  - `index.html` / `app.js` / `style.css` / `manifest.json` / `sw.js` / `vercel.json`
  - `icons/` 文件夹(里面有 4 个图标文件)
- 点 **Commit changes** 提交

**方式 B(命令行,适合会操作的同学)**

```bash
# 打开终端,进入项目目录后执行:
git init
git add .
git commit -m "WorkBuddy V11: 考公专项+生理周期"
git branch -M main
git remote add origin https://github.com/你的用户名/workbuddy.git
git push -u origin main
```

**第 2 步:在 Vercel 部署(需 Vercel 账号,可用 GitHub 一键登录)**

1. 打开 https://vercel.com → 点 **Sign Up** → 用 **GitHub 账号登录**(免费)
2. 点 **Add New → Project**
3. 找到 `workbuddy` 仓库 → 点 **Import**
4. 什么都不用改(Framework 选 **Other**,Build Command 留空),直接点 **Deploy**
5. 等 1-2 分钟,部署完成!Vercel 会给你一个永久链接:
   `https://workbuddy-xxxx.vercel.app`

> 💡 Vercel 免费计划:个人使用完全够,链接永久有效(只要 GitHub 账号在)。
> 以后修改代码 push 到 GitHub,会自动重新部署,无需手动操作。

### 方式二:Vercel CLI 直接部署(不经过 GitHub)

```bash
npm i -g vercel
cd 项目目录
vercel --prod
```
按提示登录后即可,适合不想用 GitHub 的用户。但这种方式每次更新都要重新执行命令。

## 部署后在手机上使用

1. iPhone 用 **Safari** 打开 Vercel 给你的链接
2. 点底部 **分享按钮 → 添加到主屏幕**
3. 命名 WorkBuddy → 添加
4. 主屏幕出现 🍎 像素苹果图标,全屏启动

> ⚠️ 新链接需要在手机**重新添加一次主屏幕图标**(旧的沙箱链接不受影响,可自行删除)。

## 数据备份(重要!)

所有数据存在手机本地 localStorage。建议每月:
- 打开 App → 设置 → **导出全部数据** → 存一份 JSON 到网盘
- 万一换手机或清数据,导入 JSON 即可恢复

## 项目文件说明

| 文件 | 说明 |
|---|---|
| `index.html` | 应用骨架 + 启动页 |
| `style.css` | 样式系统(森系像素) |
| `app.js` | 全部逻辑(8 板块 + 金币 + localStorage) |
| `manifest.json` | PWA 配置 |
| `sw.js` | Service Worker(离线缓存) |
| `icons/` | 1024/512/192/180 图标 |
| `vercel.json` | Vercel 静态托管配置 |

## 本地开发预览

```bash
# 任意静态服务器即可
python -m http.server 3000
# 打开 http://localhost:3000
```

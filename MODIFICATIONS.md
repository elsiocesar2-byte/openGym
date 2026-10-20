# 本 fork 的改动

本仓库是 [openGym](https://github.com/DuarteSantos8/openGym)（作者 Duarte Santos）的修改版
fork，基于上游 **v1.4.1**（commit `e348fc1`）。它不是官方项目，也不代表上游作者的立场。

修改日期：2026-10-20。

> English version: [MODIFICATIONS.en.md](MODIFICATIONS.en.md)

上游代码和本 fork 的修改都使用 **GNU AGPL v3.0**，见 [LICENSE](LICENSE) 和
[NOTICE.md](NOTICE.md)。如果你把修改后的版本作为网络服务运行，AGPL 第 13 条要求你向
使用者提供对应源码。本 fork 的源码就是这个仓库；部署时请保持仓库公开，或提供等效的
书面源码获取方式。

## 一、整份训练计划粘贴导入

- 新增 Coach `import` 任务（服务器和手机 BYOK 共用）：`POST /api/coach/import`、
  `api/coach/prompts/import.md`、`IMPORT_SCHEMA`、`validateImport`。
- 模型只做**转录**，不做计划设计：必须保留每个动作的原始名称、顺序、组数、次数、重量
  和备注；不允许替换、合并、拆分或凭空增加动作。
- 客户端（`frontend/src/lib/plan-import.js`）把转录出的名称拿去匹配英文动作库和中文名称
  包。高置信度才映射到动作库；不确定的**保留原名，新建自定义动作**，绝不静默换成另一个
  动作。
- 一次可以粘贴 20,000 字符，不会被聊天框的 1,000 字符上限截断。
- 新界面入口：计划 → 右上角选项（⋯）→ **从文字导入计划**。预览会逐行显示
  `原名称 → 匹配到的动作` 或“新建动作，保留原名”，并且可以逐行改成“保留为新动作”或
  “尝试匹配动作库”。

## 二、拉伸和备选动作

- 拉伸/放松类段落会并入对应的训练日，不再单独变成“第 4 个训练日”。
- 备选动作保存为真实的动作 id（`ex.alt`），不再只是备注里的一段文字。训练编辑页会显示
  可点击的备选标签；切换后备选和主动作可以互换。
- 每个备选可以有自己的处方（`altCfg`：组数、次数、重量、时间、备注）。导入时会读取
  备选旁边写的重量（例如“5–7.5kg”），备选标签上的铅笔可以单独修改。
- `8–12` 这种次数范围会正常显示为范围，不再出现 `3 × undefined`。

## 三、局域网/密码登录

- 新增服务端开关 `PASSKEY_LOGIN=0`，并在 `/api/config` 中暴露 `passkey_login:false`。
- 非安全上下文（普通 `http://192.168.x.x`）下登录页会隐藏通行密钥，默认使用“名称 +
  密码”。局域网里 WebAuthn 没有合法的 RP ID，这样就不会在用户填完名字后才报错。
- `frontend/android/build.gradle` 在 Google/Maven Central 之前加入了阿里云 Maven 镜像，
  方便访问不了 `dl.google.com` 的网络。如果你使用官方仓库，可以删掉这四行。

## 构建

```sh
# Web / API
npm install
npm run build          # 生成 frontend/dist
node api/server.js     # API 默认监听 :3000

# Android（需要 JDK 21 和 Android SDK）
cd frontend
npm install
VITE_MOBILE=1 npm run build
npx cap sync android
cd android
./gradlew assembleRelease
```

Android release 构建会读取 `frontend/android/keystore.properties` 中的 `storeFile`、
`storePassword`、`keyAlias`、`keyPassword`；这个文件不提交到仓库。

## 新增测试

- `api/test/validate-import.test.js`
- `frontend/src/lib/plan-import.test.js`
- `frontend/src/lib/coach.test.js`、`plan-share.test.js`、
  `RoutineEdit.replace.test.jsx` 中的新增用例

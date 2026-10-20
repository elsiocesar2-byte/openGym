# openGym 中文说明（AI 增强版）

> 这是个人修改版，**不是官方版本**。官方项目：
> [DuarteSantos8/openGym](https://github.com/DuarteSantos8/openGym)。
> 本仓库基于上游 v1.4.1（commit `e348fc1`），改动明细见
> [MODIFICATIONS.md](MODIFICATIONS.md)。

## 这是什么

openGym 是一个自托管的训练与体重记录应用：安排每周计划、跟练、记录每一组和体重，可以
在手机上使用，也可以在自己的服务器上同步多台设备。前端是 React，API 是 Node，Android
用 Capacitor 打包。

本 fork 的目标是**让 AI 在计划编辑里拥有更大的控制权**，同时不牺牲用户原始计划里的动作
名称和细节。

## 这个 fork 新增了什么

| 功能 | 说明 |
| --- | --- |
| 整份计划粘贴导入 | 一次粘贴 20,000 字符，不用把计划拆成几条消息 |
| 保真匹配 | AI 只转录；客户端负责匹配，匹配不到就保留原名新建自定义动作，不静默替换 |
| 拉伸并入训练日 | “练后拉伸”自动接到对应训练日后面，不再单独占一个训练日 |
| 备选动作 | 备选保存为真实动作，可一键切换，并且每个备选有自己的组数/次数/重量 |
| 局域网密码登录 | `PASSKEY_LOGIN=0` 时隐藏通行密钥，普通 HTTP 局域网也能用名称+密码登录 |
| 中文名称匹配 | 使用项目自带的 `exercise-names/zh.js` 中文动作名做精确匹配 |

## 下载 APK

- Releases：https://github.com/elsiocesar2-byte/openGym/releases
- 包名：`ch.duartesantos.opengym`
- 版本：`1.4.1`（versionCode 26）
- 文件名：`openGym-1.4.1-ai.apk`

这个 APK 使用本项目自己的 release key 签名，**和官方 APK 的签名不同**。如果你手机上
装的是官方版，直接覆盖安装会失败。请先在官方版里导出数据，卸载官方版，再安装这个包，
然后导入数据。

## 用 AI 导入整份计划

1. 打开 **计划** 页，点右上角的选项按钮（⋯）。
2. 选择 **从文字导入计划**。
3. 把整份计划（例如三天的推/拉/腿，包含动作、组数、次数、重量、备注、备选和拉伸）
   一次性粘贴进去。
4. 点 **读取我的计划**，等待 AI 转录。
5. 检查预览：
   - 绿色/普通行表示匹配到了动作库；
   - “新建动作，保留原名”表示动作库里没有，会创建自定义动作；
   - 每行都可以手动切换“保留为新动作”或“尝试匹配动作库”。
6. 点应用。导入只会**追加**新的训练计划，不会覆盖你已有的计划。
7. 如果结果不对，可以在教练聊天页右上角（⋯）选择“撤销教练上次的更改”。

AI 只负责把文字读成结构化数据；动作匹配、去重、拉伸合并和备选处理都在本地完成。因此
模型换一个说法，也不会把你的“招财猫”换成另一个动作。

## 自建服务器 / 多设备同步

- 官方自托管文档：https://opengym.ch/docs.html#selfhost
- 本 fork 支持局域网密码模式：服务端设置 `PASSWORD_LOGIN=1`、`PASSKEY_LOGIN=0`，
  然后把 `ORIGIN` 设置成你实际访问的地址（例如 `http://192.168.1.67:8080`）。
- 手机和电脑连同一个 Wi-Fi，用同一个“名称 + 密码”登录即可同步。
- 通行密钥（Passkey）需要 HTTPS 或 `http://localhost`；普通局域网 IP 下请使用密码。

## 从源码构建

```sh
npm install
npm run build
node api/server.js
```

Android：

```sh
cd frontend
npm install
VITE_MOBILE=1 npm run build
npx cap sync android
cd android
./gradlew assembleRelease
```

需要 JDK 21 和 Android SDK。release 签名配置放在
`frontend/android/keystore.properties`，不要提交到仓库。

## 许可证

本项目沿用上游的 **GNU AGPL v3.0**，见 [LICENSE](LICENSE) 和 [NOTICE.md](NOTICE.md)。
你可以 fork、修改和分发，但需要保留版权与许可证声明、标明修改，并在分发 APK 或对外提供
网络服务时提供对应源码。本仓库就是本 fork 的源码。

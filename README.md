# 🤖 Telegram Private Chatbot (v4.0) 

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/jikssha/telegram_private_chatbot)
![GitHub stars](https://img.shields.io/github/stars/jikssha/telegram_private_chatbot?style=social)
![License](https://img.shields.io/badge/License-MIT-blue.svg)
[![Telegram](https://img.shields.io/badge/Telegram-DM-blue?style=social&logo=telegram)](https://t.me/vaghr_wegram_bot)
[🇺🇸 English](README_EN.md) | [🇨🇳 简体中文](README.md)

**Telegram Private Chatbot** 是一个基于 **Cloudflare Workers** 的高性能 Telegram 双向私聊机器人。它专为解决 Telegram 上的垃圾广告骚扰而生，拥有 0 延迟的本地人机验证系统、强大的管理员指令集以及无缝的消息转发体验。

无需购买服务器，利用 Cloudflare 强大的边缘计算网络，即可免费部署一套企业级的客户服务系统。

---

<details open>
<summary><strong>📢 最新更新 (v4.2)：安全升级 & 功能增强</strong></summary>
<br>

> **⚠️ 注意：本次更新包含阻断性变更 (Breaking Change)**

1. **🛡️ 强制 Username 检查**
   - 为防止垃圾账号滥用，私聊逻辑现已增加强制检查。
   - **未设置用户名 (`@username`) 的用户将被拦截**，并收到要求设置的提示。
   
2. **👤 `/info` 指令增强**
   - 管理员查询用户信息时，现支持显示用户的 **完整姓名 (Full Name)**。

👉 **Fork 用户请点击仓库上方的 `Sync fork` 按钮获取最新代码。**
</details>
---

## 📑 目录 (Table of Contents)

* [✨ 核心特性](#-核心特性)
* [🛠️ 管理员指令](#-管理员指令)
* [🚀 部署教程](#-部署教程)
    * [方法一：GitHub 一键连接 (推荐)](#方法一github-一键连接部署-推荐-)
    * [方法二：手动复制部署](#方法二手动复制部署-简单直接)
    * [最后一步：激活 Webhook](#最后一步激活-webhook-至关重要)
* [❓ 常见问题 (FAQ)](#-常见问题-faq)
* [📈 Star History](#-star-history)

---

## ✨ 核心特性

v4.0 版本移除了所有不稳定的外部 API 依赖，专注于**极致的速度**与**绝对的稳定性**。

| 特性 | 描述 |
| :--- | :--- |
| **⚡ 0 延迟验证** | 采用**本地精选常识题库**。秒开秒验，彻底告别网络超时与接口报错，验证成功率 100%。 |
| **🛡️ 智能防骚扰** | **短 ID 机制**修复了 Telegram 按钮点击失效的 Bug。验证通过后提供 **30 天免打扰期**，兼顾安全与用户体验。 |
| **💬 话题群组管理** | 利用 **Telegram Forum Topics** 功能，自动为每位私聊用户创建一个独立的话题，消息隔离，管理井井有条。 |
| **👮 隐形指令系统** | 自动**拦截**用户端发送的 `/` 开头指令，防止普通用户骚扰管理员。管理指令仅在管理员群组内生效。 |
| **🔒 权限控制** | 强大的指令集：支持 **封禁 (/ban)**、**解封 (/unban)**、**结单 (/close)** 和 **永久信任 (/trust)** 等操作。 |
| **☁️ Serverless** | 完全基于 Cloudflare Workers 运行。**0 成本**、无需服务器、无需运维、抗高并发。 |
| **📸 多媒体支持** | 完美支持文本、图片、视频、文件等多种消息格式的双向转发，不丢失任何细节。 |

---

## 🛠️ 管理员指令

> **注意**：以下指令仅在 **管理员群组的话题内** 有效。用户在私聊窗口发送指令会被静默拦截，不会对管理员造成骚扰。

| 指令 | 作用 | 适用场景 |
| :--- | :--- | :--- |
| `/close` | **强制关闭对话**<br>机器人会提示用户对话已结束，并拒收新消息。 | 工单处理完成，礼貌结束咨询。 |
| `/open` | **重新开启对话**<br>恢复对该用户的消息转发。 | 误操作关闭，或用户需再次联系。 |
| `/ban` | **封禁用户**<br>机器人将完全无视该用户的所有消息（无提示）。 | 遇到恶意刷屏、广告机器人。 |
| `/unban` | **解封用户**<br>恢复该用户的正常通讯权限。 | 给予改过自新的机会。 |
| `/trust` | **永久信任**<br>该用户将永久免除人机验证（永不过期）。 | 熟人、VIP 客户、长期合作伙伴。 |
| `/reset` | **重置验证**<br>强制清除该用户的验证状态，下次需重新验证。 | 测试验证流程，或怀疑账号被盗。 |
| `/info` | **查看信息**<br>显示当前用户的 UID、话题 ID 和链接。 | 查询用户资料。 |

---

## 🚀 部署教程

### 前置准备
1.  **Telegram Bot**：找 [@BotFather](https://t.me/BotFather) 申请一个机器人，获取 `Token`。
    * *重要设置*：在 BotFather 中关闭 **Group Privacy** (`/mybots` > Settings > Group Privacy > Turn off)。
2.  **管理员群组**：创建一个 Telegram 群组，并**开启话题功能 (Topics)**。
    * 将机器人拉入群组，并设为**管理员**（给予管理话题权限）。
    * 获取群组 ID（通常以 `-100` 开头）。
     ``获取 SUPERGROUP_ID 小技巧：
在 Telegram 桌面端右键群内任意消息，复制消息链接；链接里会有一段 -100xxxxxxxxxx 或 xxxxxxxxxx；若只看到纯数字 xxxxxxxxxx，在前面加上 -100，就是完整的 SUPERGROUP_ID（私密频道/群组同理）。``

### 方法一：GitHub 一键连接部署 (推荐 ★)

这是最简单的自动化部署方式，当您更新 GitHub 仓库时，Cloudflare 会自动重新部署您的 Worker。

1.  **Fork 本仓库** 到您的 GitHub 账户。
2.  登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
3.  导航到 **Workers & Pages** -> **Create Application**。
4.  点击 **Connect to Git** 标签页。
5.  授权 Cloudflare 访问您的 GitHub，并选择您刚才 Fork 的 `telegram_private_chatbot` 仓库。
6.  **配置部署设置**：
    * 项目名称：`telegram-private-chatbot` (或任意名称)。
    * 生产分支：通常是 `main` 或 `master`。
    * 其余保持默认，点击 **Save and Deploy**。
7.  **⚠️ 关键步骤：绑定数据库与变量**
    * 部署完成后，进入该 Worker 的 **Settings** -> **Variables** 页面。
    * **绑定 KV 数据库** (必须)：
        * 在 Cloudflare 左侧菜单 **KV** 中创建一个新的 Namespace（例如叫 `TOPIC_MAP`）。
        * 回到 Worker 的 Variables 页面，向下滚动到 **KV Namespace Bindings**。
        * 点击 **Add binding**，变量名填写 `TOPIC_MAP` (必须全大写)，Namespace 选择刚才创建的那个。
    * **添加环境变量**：
        * `BOT_TOKEN`: 你的机器人 Token。
        * `SUPERGROUP_ID`: 你的群组 ID (例如 -100123...)。
8.  **最后一步**：配置完成后，点击页面顶部的 **Deployments** 标签，找到最新的部署记录，点击右侧的 **Retry deployment** (重新部署)，让变量生效。

### 方法二：手动复制部署 (简单直接)

如果您不想关联 GitHub，可以直接复制代码。

1.  登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2.  进入 **Workers & Pages** -> **Create Application** -> **Create Worker** ，选择从`hello world`开始。
3.  命名你的 Worker，点击 **Deploy**。
4.  点击 **Edit code**，将本项目 `worker.js` 的所有代码复制粘贴进去，覆盖原代码。
5.  点击右上角 **Deploy** 保存。
6.  **配置 KV 与变量**：
    * 去 **Settings** -> **Variables**。
    * 添加 KV 绑定：Variable name 填 `TOPIC_MAP`，并绑定一个 KV 数据库。
    * 添加环境变量：`BOT_TOKEN` 和 `SUPERGROUP_ID`。
    * 点击 **Save and Deploy**。

---

### 最后一步：激活 Webhook (至关重要)

无论使用哪种部署方式，最后都需要手动告诉 Telegram 你的 Worker 地址。请在浏览器中**严格按顺序**访问以下 URL：

 **设置新 Webhook**：
    ```
   (https://api.telegram.org/bot)<YOUR_TOKEN>/setWebhook?url=<YOUR_WORKER_URL>
    ```
    *将 `<YOUR_TOKEN>` 替换为机器人 Token，`<YOUR_WORKER_URL>` 替换为 Worker 的完整域名或者你绑定的自定义的域名 (如 `https://xxx.workers.dev`)。*
    
 *举例：https://api.telegram.org/bot1234:HUSH2GW/setWebhook?url=https://1234.workers.dev* `<YOUR_TOKEN>前面的bot别删了`

如果返回 `{"ok":true, "result":true, "description":"Webhook was set"}`，即表示部署成功！

---

## ❓ 常见问题 (FAQ)

**Q: 为什么点击验证按钮没有反应？**
A: 请检查 Webhook 是否正确设置。必须确保 Telegram 允许发送 `callback_query` 事件。请务必执行上述“最后一步”中的重置操作。

**Q: 为什么机器人无法在群里创建话题？**
A: 请确保：1. 群组 ID 正确（-100开头）；2. 群组已开启 Topics 功能；3. 机器人是群管理员且拥有 "Manage Topics" 权限。

**Q: 为什么人机验证能通过收不到转发的消息？**
A: 请仔细检查所有变量名称和id是否准确，删除webhook再重新激活。
 `(https://api.telegram.org/bot)<YOUR_TOKEN>/deleteWebhook?drop_pending_updates=true (https://api.telegram.org/bot)` 
  
  如果依然无法正常转发消息，尝试完成所有步骤后，最后再添加bot的管理员权限。
 
---

## 🔒 安全说明

> [!IMPORTANT]
> 请妥善保管您的 Bot API Token ，不要泄露，这些信息关系到您服务的安全性。

---

## 📈 Star History

[![Star History Chart](https://api.star-history.com/svg?repos=jikssha/telegram_private_chatbot&type=date&legend=top-left)](https://www.star-history.com/#jikssha/telegram_private_chatbot&type=date&legend=top-left)

---
**如果这个项目对你有帮助，请给个 Star ⭐️ 吧！**

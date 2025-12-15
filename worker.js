// Cloudflare Worker：Telegram 双向机器人 (纯本地极速版 v4.2)
// 修改内容：
// 1. 私聊逻辑增加 Username 强制检查，未设置则拦截。
// 2. /info 指令增加显示用户的完整姓名 (Full Name)。

// --- 1. 本地题库配置 (14条) ---
const LOCAL_QUESTIONS = [
    {"question": "冰融化后会变成什么？", "correct_answer": "水", "incorrect_answers": ["石头", "木头", "火"]},
    {"question": "正常人有几只眼睛？", "correct_answer": "2", "incorrect_answers": ["1", "3", "4"]},
    {"question": "以下哪个属于水果？", "correct_answer": "香蕉", "incorrect_answers": ["白菜", "猪肉", "大米"]},
    {"question": "1 加 2 等于几？", "correct_answer": "3", "incorrect_answers": ["2", "4", "5"]},
    {"question": "5 减 2 等于几？", "correct_answer": "3", "incorrect_answers": ["1", "2", "4"]},
    {"question": "2 乘以 3 等于几？", "correct_answer": "6", "incorrect_answers": ["4", "5", "7"]},
    {"question": "10 加 5 等于几？", "correct_answer": "15", "incorrect_answers": ["10", "12", "20"]},
    {"question": "8 减 4 等于几？", "correct_answer": "4", "incorrect_answers": ["2", "3", "5"]},
    {"question": "在天上飞的交通工具是什么？", "correct_answer": "飞机", "incorrect_answers": ["汽车", "轮船", "自行车"]},
    {"question": "星期一的后面是星期几？", "correct_answer": "星期二", "incorrect_answers": ["星期日", "星期五", "星期三"]},
    {"question": "鱼通常生活在哪里？", "correct_answer": "水里", "incorrect_answers": ["树上", "土里", "火里"]},
    {"question": "我们用什么器官来听声音？", "correct_answer": "耳朵", "incorrect_answers": ["眼睛", "鼻子", "嘴巴"]},
    {"question": "晴朗的天空通常是什么颜色的？", "correct_answer": "蓝色", "incorrect_answers": ["绿色", "红色", "紫色"]},
    {"question": "小狗发出的叫声通常是？", "correct_answer": "汪汪", "incorrect_answers": ["喵喵", "咩咩", "呱呱"]}
];

export default {
  async fetch(request, env, ctx) {
    // --- 2. 环境自检 ---
    if (!env.TOPIC_MAP) return new Response("Error: KV 'TOPIC_MAP' not bound.");
    if (!env.BOT_TOKEN) return new Response("Error: BOT_TOKEN not set.");
    if (!env.SUPERGROUP_ID) return new Response("Error: SUPERGROUP_ID not set.");

    if (request.method !== "POST") return new Response("OK");

    let update;
    try {
      update = await request.json();
    } catch {
      return new Response("OK");
    }

    // --- 3. 路由分发 ---

    // A. 处理按钮回调
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query, env, ctx);
      return new Response("OK");
    }

    const msg = update.message;
    if (!msg) return new Response("OK");

    ctx.waitUntil(flushExpiredMediaGroups(env, Date.now()));

    // B. 处理私聊消息
    if (msg.chat && msg.chat.type === "private") {
      try {
        await handlePrivateMessage(msg, env, ctx);
      } catch (e) {
        const errText = `⚠️ **系统错误**\n\n\`${e.message}\`\n\n请检查配置: SUPERGROUP_ID / BOT_TOKEN / TOPIC_MAP`;
        await tgCall(env, "sendMessage", { chat_id: msg.chat.id, text: errText, parse_mode: "Markdown" });
        console.error(e);
      }
      return new Response("OK");
    }

    // C. 处理群组消息
    const supergroupId = Number(env.SUPERGROUP_ID);
    if (msg.chat && Number(msg.chat.id) === supergroupId) {
        if (msg.forum_topic_closed && msg.message_thread_id) {
            await updateThreadStatus(msg.message_thread_id, true, env);
            return new Response("OK");
        }
        if (msg.forum_topic_reopened && msg.message_thread_id) {
            await updateThreadStatus(msg.message_thread_id, false, env);
            return new Response("OK");
        }
        if (msg.message_thread_id) {
            await handleAdminReply(msg, env, ctx);
            return new Response("OK");
        }
    }

    return new Response("OK");
  },
};

// ---------------- 核心业务逻辑 ----------------

async function handlePrivateMessage(msg, env, ctx) {
  const userId = msg.chat.id;
  const key = `user:${userId}`;

  // 1. 过滤掉非 /start 的指令
  if (msg.text && msg.text.startsWith("/") && msg.text.trim() !== "/start") {
      return; 
  }

  // 2. 检查黑名单
  const isBanned = await env.TOPIC_MAP.get(`banned:${userId}`);
  if (isBanned) return; 

  // [新增] 2.1 强制检查 Username 是否存在
  // 如果 msg.from.username 为空或 undefined，直接中断并提示
  if (!msg.from.username) {
      await tgCall(env, "sendMessage", {
          chat_id: userId,
          text: "⚠️ **很抱歉,你的用户名(username)未设置,无法进行人机验证流程!消息发送失败!**\n\n(请在 Telegram 设置中配置用户名后重试)",
          parse_mode: "Markdown"
      });
      return;
  }

  // 3. 检查验证状态
  const verified = await env.TOPIC_MAP.get(`verified:${userId}`);
  
  if (!verified) {
    const isStart = msg.text && msg.text.trim() === "/start";
    const pendingMsgId = isStart ? null : msg.message_id;
    await sendVerificationChallenge(userId, env, pendingMsgId);
    return;
  }

  // 4. 已验证用户，转发消息
  await forwardToTopic(msg, userId, key, env, ctx);
}

async function forwardToTopic(msg, userId, key, env, ctx) {
    let rec = await env.TOPIC_MAP.get(key, { type: "json" });

    if (rec && rec.closed) {
        await tgCall(env, "sendMessage", { chat_id: userId, text: "🚫 当前对话已被管理员关闭。" });
        return;
    }

    if (!rec || !rec.thread_id) {
        rec = await createTopic(msg.from, key, env);
    }

    if (msg.media_group_id) {
        await handleMediaGroup(msg, env, ctx, { 
            direction: "p2t", 
            targetChat: env.SUPERGROUP_ID, 
            threadId: rec.thread_id 
        });
        return;
    }

    const res = await tgCall(env, "forwardMessage", {
        chat_id: env.SUPERGROUP_ID,
        from_chat_id: userId,
        message_id: msg.message_id,
        message_thread_id: rec.thread_id,
    });

    if (!res.ok) {
        const desc = (res.description || "").toLowerCase();
        if (desc.includes("thread not found") || desc.includes("topic not found")) {
            const newRec = await createTopic(msg.from, key, env);
            await tgCall(env, "forwardMessage", {
                chat_id: env.SUPERGROUP_ID,
                from_chat_id: userId,
                message_id: msg.message_id,
                message_thread_id: newRec.thread_id,
            });
            return;
        }
        
        if (desc.includes("chat not found")) throw new Error(`群组ID错误: ${env.SUPERGROUP_ID}`);
        if (desc.includes("not enough rights")) throw new Error("机器人权限不足 (需 Manage Topics)");
        
        await tgCall(env, "copyMessage", {
            chat_id: env.SUPERGROUP_ID,
            from_chat_id: userId,
            message_id: msg.message_id,
            message_thread_id: rec.thread_id
        });
    }
}

async function handleAdminReply(msg, env, ctx) {
  const threadId = msg.message_thread_id;
  const text = (msg.text || "").trim();
  
  let userId = null;
  const list = await env.TOPIC_MAP.list({ prefix: "user:" });
  for (const { name } of list.keys) {
      const rec = await env.TOPIC_MAP.get(name, { type: "json" });
      if (rec && Number(rec.thread_id) === Number(threadId)) {
          userId = Number(name.slice(5)); 
          break;
      }
  }

  if (!userId) return; 

  // --- 管理员指令区域 ---

  if (text === "/close") {
      const key = `user:${userId}`;
      let rec = await env.TOPIC_MAP.get(key, { type: "json" });
      if (rec) {
          rec.closed = true;
          await env.TOPIC_MAP.put(key, JSON.stringify(rec));
          await tgCall(env, "closeForumTopic", { chat_id: env.SUPERGROUP_ID, message_thread_id: threadId });
          await tgCall(env, "sendMessage", { chat_id: env.SUPERGROUP_ID, message_thread_id: threadId, text: "🚫 **对话已强制关闭**", parse_mode: "Markdown" });
      }
      return;
  }

  if (text === "/open") {
      const key = `user:${userId}`;
      let rec = await env.TOPIC_MAP.get(key, { type: "json" });
      if (rec) {
          rec.closed = false;
          await env.TOPIC_MAP.put(key, JSON.stringify(rec));
          await tgCall(env, "reopenForumTopic", { chat_id: env.SUPERGROUP_ID, message_thread_id: threadId });
          await tgCall(env, "sendMessage", { chat_id: env.SUPERGROUP_ID, message_thread_id: threadId, text: "✅ **对话已恢复**", parse_mode: "Markdown" });
      }
      return;
  }

  if (text === "/reset") {
      await env.TOPIC_MAP.delete(`verified:${userId}`);
      await tgCall(env, "sendMessage", { chat_id: env.SUPERGROUP_ID, message_thread_id: threadId, text: "🔄 **验证重置**", parse_mode: "Markdown" });
      return;
  }

  if (text === "/trust") {
      await env.TOPIC_MAP.put(`verified:${userId}`, "trusted");
      await tgCall(env, "sendMessage", { chat_id: env.SUPERGROUP_ID, message_thread_id: threadId, text: "🌟 **已设置永久信任**", parse_mode: "Markdown" });
      return;
  }
  
  if (text === "/ban") {
      await env.TOPIC_MAP.put(`banned:${userId}`, "1");
      await tgCall(env, "sendMessage", { chat_id: env.SUPERGROUP_ID, message_thread_id: threadId, text: "🚫 **用户已封禁**", parse_mode: "Markdown" });
      return;
  }

  if (text === "/unban") {
      await env.TOPIC_MAP.delete(`banned:${userId}`);
      await tgCall(env, "sendMessage", { chat_id: env.SUPERGROUP_ID, message_thread_id: threadId, text: "✅ **用户已解封**", parse_mode: "Markdown" });
      return;
  }

  // [修改] /info 指令逻辑：增加显示 Full Name
  if (text === "/info") {
      const chatInfo = await tgCall(env, "getChat", { chat_id: userId });
      const r = chatInfo.result || {};

      // 1. 获取 Username
      const username = r.username ? `@${r.username}` : "未设置";
      
      // 2. [新增] 获取 Full Name (First + Last)
      const fullName = (r.first_name + " " + (r.last_name || "")).trim();
      
      const info = `👤 **用户信息**\nUID: \`${userId}\`\nName: \`${fullName}\`\nUsername: \`${username}\`\nTopic ID: \`${threadId}\`\nLink: [点击私聊](tg://user?id=${userId})`;
      
      await tgCall(env, "sendMessage", { chat_id: env.SUPERGROUP_ID, message_thread_id: threadId, text: info, parse_mode: "Markdown" });
      return;
  }

  if (msg.media_group_id) {
    await handleMediaGroup(msg, env, ctx, { direction: "t2p", targetChat: userId, threadId: null });
    return;
  }
  await tgCall(env, "copyMessage", { chat_id: userId, from_chat_id: env.SUPERGROUP_ID, message_id: msg.message_id });
}

// ---------------- 验证模块 ----------------

async function sendVerificationChallenge(userId, env, pendingMsgId) {
    const q = LOCAL_QUESTIONS[Math.floor(Math.random() * LOCAL_QUESTIONS.length)];
    const challenge = {
        question: q.question,
        correct: q.correct_answer,
        options: shuffleArray([...q.incorrect_answers, q.correct_answer])
    };

    const verifyId = Math.random().toString(36).substring(2, 10);
    const state = { ans: challenge.correct, pending: pendingMsgId };
    await env.TOPIC_MAP.put(`chal:${verifyId}`, JSON.stringify(state), { expirationTtl: 300 });

    const buttons = challenge.options.map(opt => {
         const safeOpt = opt.length > 20 ? opt.substring(0, 20) : opt;
         return { text: opt, callback_data: `verify:${verifyId}:${safeOpt}` };
    });

    const keyboard = [];
    for (let i = 0; i < buttons.length; i += 2) keyboard.push(buttons.slice(i, i + 2));

    await tgCall(env, "sendMessage", {
        chat_id: userId,
        text: `🛡️ **人机验证**\n\n${challenge.question}\n\n请点击下方按钮回答 (回答正确后将自动发送您刚才的消息)。`,
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: keyboard }
    });
}

async function handleCallbackQuery(query, env, ctx) {
    try {
        const data = query.data;
        if (!data.startsWith("verify:")) return;

        const parts = data.split(":");
        if (parts.length < 3) return;

        const verifyId = parts[1];
        const userAns = parts.slice(2).join(":"); 
        const userId = query.from.id;

        const stateStr = await env.TOPIC_MAP.get(`chal:${verifyId}`);
        if (!stateStr) {
            await tgCall(env, "answerCallbackQuery", { callback_query_id: query.id, text: "❌ 验证已过期，请重发消息", show_alert: true });
            return;
        }
        
        let state;
        try {
            state = JSON.parse(stateStr);
        } catch(e) {
             await tgCall(env, "answerCallbackQuery", { callback_query_id: query.id, text: "❌ 数据错误", show_alert: true });
             return;
        }

        if (userAns === state.ans) {
            await tgCall(env, "answerCallbackQuery", { callback_query_id: query.id, text: "✅ 验证通过" });
            
            await env.TOPIC_MAP.put(`verified:${userId}`, "1", { expirationTtl: 2592000 });
            await env.TOPIC_MAP.delete(`chal:${verifyId}`);

            await tgCall(env, "editMessageText", {
                chat_id: userId,
                message_id: query.message.message_id,
                text: "✅ **验证成功**\n\n您现在可以自由对话了。",
                parse_mode: "Markdown"
            });

            if (state.pending) {
                try {
                    const fakeMsg = {
                        message_id: state.pending,
                        chat: { id: userId, type: "private" },
                        from: query.from,
                    };
                    await forwardToTopic(fakeMsg, userId, `user:${userId}`, env, ctx);
                    await tgCall(env, "sendMessage", { chat_id: userId, text: "📩 刚才的消息已帮您送达。", reply_to_message_id: state.pending });
                } catch (e) { }
            }
        } else {
            await tgCall(env, "answerCallbackQuery", { callback_query_id: query.id, text: "❌ 答案错误", show_alert: true });
        }
    } catch (e) {
        console.error("Callback Error", e);
        await tgCall(env, "answerCallbackQuery", { 
            callback_query_id: query.id, 
            text: `⚠️ 系统错误: ${e.message}`, 
            show_alert: true 
        });
    }
}

// ---------------- 辅助函数 ----------------

async function createTopic(from, key, env) {
    const title = buildTopicTitle(from);
    if (!env.SUPERGROUP_ID.toString().startsWith("-100")) throw new Error("SUPERGROUP_ID必须以-100开头");
    const res = await tgCall(env, "createForumTopic", { chat_id: env.SUPERGROUP_ID, name: title });
    if (!res.ok) throw new Error(`创建话题失败: ${res.description}`);
    const rec = { thread_id: res.result.message_thread_id, title, closed: false };
    await env.TOPIC_MAP.put(key, JSON.stringify(rec));
    return rec;
}

function updateThreadStatus(threadId, isClosed, env) {
    return env.TOPIC_MAP.list({ prefix: "user:" }).then(list => {
        for (const { name } of list.keys) {
            env.TOPIC_MAP.get(name, { type: "json" }).then(rec => {
                if (rec && Number(rec.thread_id) === Number(threadId)) {
                    rec.closed = isClosed;
                    env.TOPIC_MAP.put(name, JSON.stringify(rec));
                }
            });
        }
    });
}

function shuffleArray(arr) { return arr.sort(() => Math.random() - 0.5); }
function buildTopicTitle(from) {
  const name = (from.first_name + " " + (from.last_name || "")).trim();
  return (name || "User") + (from.username ? ` @${from.username}` : "");
}

async function tgCall(env, method, body) {
  const base = env.API_BASE || "https://api.telegram.org";
  const resp = await fetch(`${base}/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return await resp.json();
}

async function handleMediaGroup(msg, env, ctx, { direction, targetChat, threadId }) {
    const groupId = msg.media_group_id;
    const key = `mg:${direction}:${groupId}`;
    const item = extractMedia(msg);
    if (!item) {
        await tgCall(env, "copyMessage", { chat_id: targetChat, from_chat_id: msg.chat.id, message_id: msg.message_id, message_thread_id: threadId });
        return;
    }
    let rec = await env.TOPIC_MAP.get(key, { type: "json" });
    if (!rec) rec = { direction, targetChat, threadId, items: [], last_ts: Date.now() };
    rec.items.push({ ...item, msg_id: msg.message_id });
    rec.last_ts = Date.now();
    await env.TOPIC_MAP.put(key, JSON.stringify(rec), { expirationTtl: 60 });
    ctx.waitUntil(delaySend(env, key, rec.last_ts));
}

function extractMedia(msg) {
    if (msg.photo) return { type: "photo", id: msg.photo.pop().file_id, cap: msg.caption };
    if (msg.video) return { type: "video", id: msg.video.file_id, cap: msg.caption };
    if (msg.document) return { type: "document", id: msg.document.file_id, cap: msg.caption };
    return null;
}

async function flushExpiredMediaGroups(env, now) {} 
async function delaySend(env, key, ts) {
    await new Promise(r => setTimeout(r, 2000));
    const rec = await env.TOPIC_MAP.get(key, { type: "json" });
    if (rec && rec.last_ts === ts) {
        const media = rec.items.map((it, i) => ({ type: it.type, media: it.id, caption: i===0?it.cap:"" }));
        if (media.length > 0) await tgCall(env, "sendMediaGroup", { chat_id: rec.targetChat, message_thread_id: rec.threadId, media });
        await env.TOPIC_MAP.delete(key);
    }
}

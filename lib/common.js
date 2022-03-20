import fetch from "node-fetch";
import fs from "fs";
import { pipeline } from "stream";
import { promisify } from "util";

/**
 * 发送私聊消息，非好友以临时聊天发送
 * @param user_id qq号
 * @param msg 消息
 */
async function relpyPrivate(user_id, msg) {
  user_id = parseInt(user_id);

  let friend = Bot.fl.get(user_id);
  if (friend) {
    Bot.logger.mark(`发送好友消息[${friend.nickname}](${user_id})`);
    Bot.pickUser(user_id).sendMsg(msg).catch((err) => {
      Bot.logger.mark(err);
    });
    redis.incr(`Yunzai:sendMsgNum:${BotConfig.account.qq}`);
    return;
  }
  else {

    let key = `Yunzai:group_id:${user_id}`;
    let group_id = await redis.get(key);

    if (!group_id) {
      for (let group of Bot.gl) {
        group[0] = parseInt(group[0])
        let MemberInfo = await Bot.getGroupMemberInfo(group[0], user_id).catch((err)=>{});
        if (MemberInfo) {
          group_id = group[0];
          redis.set(key, group_id.toString(), { EX: 1209600 });
          break;
        }
      }
    } else {
      group_id = parseInt(group_id)
    }

    if (group_id) {

      if (await redis.get(`Yunzai:blackGroup:${group_id}`)) {
        Bot.logger.mark(`发送临时消息群[${group_id}]：禁止私聊`);
        return;
      }

      if (await redis.get(`Yunzai:blackPrivate:${user_id}`)) {
        Bot.logger.mark(`发送临时消息（${user_id}）：禁止私聊`);
        return;
      }

      Bot.logger.mark(`发送临时消息[${group_id}]（${user_id}）`);

      let res = await Bot.pickMember(group_id, user_id).sendMsg(msg).catch((err) => {
        Bot.logger.mark(err);
      });

      if (res) {
        redis.expire(key, 86400 * 15);
      } else {
        redis.set(`Yunzai:blackPrivate:${user_id}`, "1", { EX: 3600 * 120 });
        redis.set(`Yunzai:blackGroup:${group_id}`, "1", { EX: 3600 * 120 });
        return;
      }

      redis.incr(`Yunzai:sendMsgNum:${BotConfig.account.qq}`);
    } else {
      Bot.logger.mark(`发送临时消息失败：[${user_id}]`);
    }
  }

}

/**
 * 休眠函数
 * @param ms 毫秒
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 获取现在时间到今天23:59:59秒的秒数
 */
function getDayEnd() {
  let now = new Date();
  let dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), "23", "59", "59").getTime() / 1000;

  return dayEnd - parseInt(now.getTime() / 1000);
}


let cdn = "https://cdn.jsdelivr.net/gh/Le-niao/Yunzai-Bot@master";

/**
 * @param path 更新文件路径
 */
async function downFile(path) {
  Bot.logger.mark(`开始更新：${path}`);

  let response = await fetch(cdn + path, { timeout: 30000, method: "get" });
  if (!response.ok) {
    Bot.logger.error(`更新失败：${path}`);
    return;
  }
  const res = await response.text();
  fs.writeFileSync(`.${path}`, res);
  Bot.logger.mark(`更新成功：${path}`);
}

/**
 * @param path 更新文件路径
 */
async function downImg(path) {
  Bot.logger.mark(`开始更新：${path}`);
  let response = await fetch(cdn + path, { method: "get" });
  if (!response.ok) {
    Bot.logger.error(`更新失败：${path}`);
    return;
  }
  const streamPipeline = promisify(pipeline);
  await streamPipeline(response.body, fs.createWriteStream(`.${path}`));
  Bot.logger.mark(`更新成功：${path}`);
}


export default { relpyPrivate, sleep, getDayEnd, downFile, downImg };

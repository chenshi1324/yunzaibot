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
  let key = `Yunzai:group_id:${user_id}`;
  let group_id = await redis.get(key);
  if (!group_id) {
    for (let group of Bot.gl) {
      let info = await Bot.getGroupMemberInfo(group[0], user_id).catch((err) => { });
      if (info) {
        group_id = group[0];
        redis.set(key, group_id.toString(), { EX: 1209600 });
        break;
      }
    }
  }
  if (group_id) {
    let res = await Bot.pickMember(group_id, user_id)
      .sendMsg(msg)
      .catch((err) => {
        redis.del(key);
        Bot.pickUser(user_id)
          .sendMsg(msg)
          .catch((err) => { });
      });
    if (res) redis.expire(key, 86400 * 15);
  } else {
    Bot.pickUser(user_id)
      .sendMsg(msg)
      .catch((err) => { });
  }

  redis.incr(`Yunzai:sendMsgNum:${BotConfig.account.qq}`);
}

/**
 * 休眠函数
 * @param ms 毫秒
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 获取今天23:59:59秒的时间戳
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
  let response = await fetch(cdn + path, { method: "get" });
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

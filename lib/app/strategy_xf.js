import { segment } from "oicq";
import fs from "fs";
import fetch from "node-fetch";
import { pipeline } from "stream";
import { promisify } from "util";

const _path = process.cwd();

//西风驿站攻略
export const rule = {
  //帮助说明
  strategy_xf: {
    reg: "^#*(.*)攻略$",
    priority: 11000,
    describe: "【刻晴攻略，更新刻晴攻略】自动下载更新西风驿站攻略图",
  },
};

let url = "https://bbs-api.mihoyo.com/post/wapi/getPostFullInCollection?collection_id=307224&gids=2&order_type=2";

export async function strategy_xf(e) {
  let isUpdate = e.msg.includes("更新") ? true : false;
  let msg = e.msg.replace(/#|＃|攻略|更新/g, "");

  let id = YunzaiApps.mysInfo.roleIdToName(msg);
  let name;
  if (["10000005", "10000007", "20000000"].includes(id)) {
    if (!["风主", "岩主", "雷主"].includes(msg)) {
      e.reply("请选择：风主攻略、岩主攻略、雷主攻略");
      return true;
    }
    name = msg;
  } else {
    name = YunzaiApps.mysInfo.roleIdToName(id, true);
    if (!name) return true;
  }

  let path = `${_path}/resources/strategy_xf/${name}.jpg`;

  if (fs.existsSync(path) && !isUpdate) {
    e.reply(segment.image(`file:///${path}`));
    return true;
  }

  Bot.logger.mark(`下载西风攻略图片：${name}`);

  let response = await fetch(url, { method: "get" });
  if (!response.ok) {
    Bot.logger.error(`西风攻略接口访问失败：${name}`);
    e.reply(`查询攻略失败，请稍后再试`);
    return true;
  }

  const res = await response.json();
  if (res.retcode != 0) {
    Bot.logger.error(`西风攻略接口访问失败：${res.message}`);
    e.reply(`查询攻略失败，请稍后再试`);
    return true;
  }

  let img;
  for (let val of res.data.posts) {
    if (val.post.subject.includes(name)) {
      img = val.post.cover + "?x-oss-process=image/quality,q_80/auto-orient,0/interlace,1/format,jpg";
      break;
    }
  }

  if (!img) {
    e.reply(`暂无${name}攻略`);
    return true;
  }

  response = await fetch(img, { method: "get" });
  if (!response.ok) {
    Bot.logger.error(`下载失败：${name}}`);
    return true;
  }
  const streamPipeline = promisify(pipeline);
  await streamPipeline(response.body, fs.createWriteStream(path));

  Bot.logger.mark(`下载西风攻略完成：${name}`);

  e.reply(segment.image(`file:///${path}`));
  return true;
}
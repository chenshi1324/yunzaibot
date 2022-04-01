import { segment } from "oicq";
import fs from "fs";
import fetch from "node-fetch";
import { pipeline } from "stream";
import { promisify } from "util";
import lodash from "lodash";

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

let url_1 = "https://bbs-api.mihoyo.com/post/wapi/getPostFullInCollection?collection_id=642956&gids=2&order_type=2";

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

  if (await new_xf(e, name, isUpdate)) return true;

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

  let img, structured_content, image_list;
  for (let val of res.data.posts) {
    //不是合集
    if (val.post.post_id == 7990798) {
      structured_content = JSON.parse(val.post.structured_content);
      image_list = lodash.keyBy(val.image_list, "image_id");
    }

    if (val.post.subject.includes(name)) {
      img = val.post.cover + "?x-oss-process=image/quality,q_80/auto-orient,0/interlace,1/format,jpg";
    }
  }

  //拿集合里面的图片
  if (structured_content && structured_content.length > 0) {
    for (let i in structured_content) {
      if (
        typeof structured_content[i].insert == "string" &&
        structured_content[i].insert.includes(name) &&
        structured_content[i].insert.includes("图鉴")
      ) {
        img =
          image_list[structured_content[i - 1].insert.image].url + "?x-oss-process=image/quality,q_80/auto-orient,0/interlace,1/format,jpg";
        break;
      }
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

async function new_xf(e, name, isUpdate) {
  let path = `${_path}/resources/strategy_xf/${name}_1.jpg`;

  if (fs.existsSync(path) && !isUpdate) {
    e.reply(segment.image(`file:///${path}`));
    return true;
  }

  let res = await fetch(url_1, { method: "get" });
  if (!res.ok) {
    Bot.logger.error(`西风攻略接口访问失败：${name}`);
    return true;
  }
  res = await res.json();
  let new_img;
  for (let val of res.data.posts) {
    if (val.post.subject.includes(name)) {
      new_img = val.post.cover + "?x-oss-process=image/quality,q_80/auto-orient,0/interlace,1/format,jpg";
    }
  }
  if (new_img) {
    res = await fetch(new_img, { method: "get" });
    if (!res.ok) {
      Bot.logger.error(`下载失败：${name}}`);
      return true;
    }
    const streamPipeline = promisify(pipeline);
    await streamPipeline(res.body, fs.createWriteStream(path));
    Bot.logger.mark(`下载西风攻略完成：${name}`);
    e.reply(segment.image(`file:///${path}`));
    return true;
  } else {
    return false;
  }
}

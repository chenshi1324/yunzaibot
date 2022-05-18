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

let url = "https://bbs-api.mihoyo.com/post/wapi/getPostFullInCollection?&gids=2&order_type=2&collection_id=";
let collection_id = [839176, 839179, 839181];

let xf = {
  async getData(url) {
    let response = await fetch(url, { method: "get" });
    if (!response.ok) {
      return false;
    }
    const res = await response.json();
    return res;
  },
  async downImg(url, name, path) {
    url = url + "?x-oss-process=image/quality,q_80/auto-orient,0/interlace,1/format,jpg";
    let response = await fetch(url, { method: "get" });
    if (!response.ok) {
      Bot.logger.error(`下载失败：${name}}`);
      return false;
    }
    const streamPipeline = promisify(pipeline);
    await streamPipeline(response.body, fs.createWriteStream(path));

    Bot.logger.mark(`下载西风攻略完成：${name}`);
  },
};

export async function strategy_xf(e) {
  let isUpdate = e.msg.includes("更新") ? true : false;
  let msg = e.msg.replace(/#|＃|攻略|更新/g, "");

  let id = YunzaiApps.mysInfo.roleIdToName(msg);
  let name, img;
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

  let path = `${_path}/resources/strategy_xf/${name}_1.jpg`;

  if (fs.existsSync(path) && !isUpdate) {
    e.reply(segment.image(`file:///${path}`));
    return true;
  }

  let msyRes = [];
  collection_id.forEach((id) => msyRes.push(xf.getData(url + id)));

  try {
    msyRes = await Promise.all(msyRes);
  } catch (error) {
    e.reply(`暂无攻略数据，请稍后再试`);
    Bot.logger.error(`米游社接口报错：${error}}`);
    return true;
  }

  let posts = lodash.flatten(lodash.map(msyRes, (item) => item.data.posts));

  for (let val of posts) {
    if (val.post.subject.includes(name)) {
      img = val.post.cover;
      break;
    }
  }

  if (!img) {
    e.reply(`暂无${name}攻略`);
    return true;
  }

  await xf.downImg(img, name, path);

  e.reply(segment.image(`file:///${path}`));
  return true;
}

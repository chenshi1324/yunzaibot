import { segment } from "oicq";
import fetch from "node-fetch";
import common from "../common.js";

const _path = process.cwd();

//圣遗物评分
export const rule = {
  score: {
    reg: "^#*(圣遗物)*评分$",
    priority: 600,
    describe: "【评分】圣遗物评分",
  },
  scoreImg: {
    reg: "",
    priority: 599,
    describe: "【评分】圣遗物评分",
  },
};
let host = "https://api.genshin.pub/api/v1/"
let url_ocr = `${host}app/ocr`;
let url_rate = `${host}relic/rate`;

let scoreUser = {};

export async function score(e) {

  if (e.hasReply) {
    let reply = (await e.group.getChatHistory(e.source.seq, 1)).pop()?.message;
    if (reply) {
      for (let val of reply) {
        if (val.type == "image") {
          e.img = [val.url];
          break;
        }
      }
    }
  }

  if (await redis.get(`genshin:score:fail:${e.user_id}`) > 5) {
    e.reply([segment.at(e.user_id), "今天失败太多次请明天再来"]);
    return true;
  }

  if (!e.img) {
    if (scoreUser[e.user_id]) {
      clearTimeout(scoreUser[e.user_id]);
    }
    scoreUser[e.user_id] = setTimeout(() => {
      if (scoreUser[e.user_id]) {
        delete scoreUser[e.user_id];
        e.reply([segment.at(e.user_id), " 评分已取消"]);
      }
    }, 60000);

    e.reply([segment.at(e.user_id), " 请发送圣遗物截图"]);
    return true;
  }

  scoreUser[e.user_id] = true;

  return scoreImg(e);

}

export async function scoreImg(e) {
  if (!scoreUser[e.user_id]) return;

  if (!e.img) {
    cancel(e);
    return true;
  }

  let img = e.img[0];

  let response = await fetch(img, { method: "get" });

  if (!response.ok) {
    Bot.logger.error(`获取圣遗物图片失败`);
    e.reply([segment.at(e.user_id), "获取圣遗物图片失败"]);
    cancel(e);
    return true;
  }

  let buff = await response.arrayBuffer();

  Bot.logger.mark(`[${e.user_id}]下载圣遗物图片成功`);

  let body = {
    image: Buffer.from(buff).toString('base64')
  };

  let headers = {
    "Content-Type": "application/json",
  };

  let key = `genshin:score:fail:${e.user_id}`;
  response = await fetch(url_ocr, { method: "post", headers, body: JSON.stringify(body) });

  let OrcRes = await response.json().catch((error) => {
    // Bot.logger.error(error);
  });

  if (!response.ok || !OrcRes) {
    Bot.logger.mark(`圣遗物识别失败`);

    await redis.incr(key);
    redis.expire(key, common.getDayEnd());

    if (OrcRes?.code == "50002") {
      e.reply([segment.at(e.user_id), "请从背包选择圣遗物截图，图片要包含主词条和副词条"]);
    } else {
      e.reply([segment.at(e.user_id), "圣遗物识别失败"]);
    }
    cancel(e);
    return true;
  }

  if (!OrcRes || !OrcRes.sub_item || OrcRes.sub_item.length <= 0) {
    e.reply([segment.at(e.user_id), "请从背包选择圣遗物截图，图片要包含主词条和副词条"]);
    cancel(e);
    return true;
  }

  response = await fetch(url_rate, { method: "post", headers, body: JSON.stringify(OrcRes) });
  let total_percent;
  if (response.ok) {
    let rateRes = await response.json();
    total_percent = rateRes?.total_percent;
  }

  Bot.logger.mark(`[${e.user_id}]圣遗物识图完成`);

  let crit = 0;
  let critAtk = 0;
  for (let val of OrcRes.sub_item) {
    let num = Number(val.value.replace(/%/g, ""));
    if (val.type == "cd") {
      crit += num;
      critAtk += num;
    }
    if (val.type == "cr") {
      crit += num * 2;
      critAtk += num * 2;
    }
    if (val.type == "atk") {
      if (val.value.includes("%")) {
        critAtk += num * 1.33;
      } else {
        critAtk += num * 0.1;
      }
    }
  }
  crit = crit.toFixed(2);
  critAtk = critAtk.toFixed(2);

  let msg = `\n双爆：${crit}\n双爆攻击：${critAtk}`;

  if (total_percent && total_percent != "NaN") {
    msg += `\n综合评分：${total_percent}`;
  }

  if (crit >= 50) {
    msg += "\n极品圣遗物！！";
  }

  e.reply([segment.at(e.user_id), msg]);

  if (scoreUser[e.user_id]) {
    cancel(e);
  }

  return true;
}

function cancel(e) {
  if (scoreUser[e.user_id]) {
    clearTimeout(scoreUser[e.user_id]);
    delete scoreUser[e.user_id];
  }
}
import { segment } from "oicq";
import lodash from "lodash";
import { renderNum } from "../render.js";
import fs from "fs";
import common from "../common.js";
import fetch from "node-fetch";
import { init as gachaInit } from "./gacha.js";
import { init as gachaLogInit } from "./gachaLog.js";
import { init as mysInfoInit } from "./mysInfo.js";

const _path = process.cwd();

export const rule = {
  //帮助说明
  help: {
    reg: "^#*(命令|帮助|菜单|help|说明|功能|指令|使用说明)$",
    priority: 500,
    describe: "【#帮助】查看指令说明",
  },
  //复读机
  repeat: {
    reg: "noCheck", //匹配的正则
    priority: 501, //优先级，越小优先度越高
    describe: "复读机，重复内容5条以上复读", //描述说明
  },
  status: {
    reg: "^#*状态$", //匹配的正则
    priority: 500, //优先级，越小优先度越高
    describe: "机器人运行状态", //描述说明
  },
  version: {
    reg: "^#版本$", //匹配的正则
    priority: 500, //优先级，越小优先度越高
    describe: "机器人当前版本", //描述说明
  },
  detConfig: {
    reg: "", //匹配的正则
    priority: 500, //优先级，越小优先度越高
    describe: "删除config.js重新配置", //描述说明
  },
  update: {
    reg: "^#*更新素材$", //匹配的正则
    priority: 500, //优先级，越小优先度越高
    describe: "【更新素材】自动更新素材", //描述说明
  },
};

export function help(e) {
  if (e.at && e.at != BotConfig.account.qq) {
    return;
  }
  let msg = [segment.image(`file:///${_path}/resources/help/help.png`)];
  if (e.isGroup) {
    msg.push("※Yunzai-Bot开源项目：\ngithub.com/Le-niao/Yunzai-Bot");
  }
  e.reply(msg);
  return true;
}

//复读机
export async function repeat(e) {
  let repeatRand = 70;
  let repeatImgRand = 10; //打断复读概率
  let repeatNum = 5;

  if (!e.isGroup || e.hasReply) {
    return false;
  }

  if (lodash.random(0, 100) > repeatRand) {
    return false;
  }

  let key = `Yunzai:repeat:${e.group_id}`;
  let res = await global.redis.get(key);
  let oldMsg = e.toString();

  if (!res) {
    res = { msgNum: 1, msg: oldMsg, sendMsg: "" };
    await global.redis.set(key, JSON.stringify(res), {
      EX: 3600 * 8,
    });
    return true;
  } else {
    res = JSON.parse(res);
  }

  if (oldMsg == res.msg) {
    res.msgNum++;
  } else {
    res.msg = oldMsg;
    res.msgNum = 1;
  }

  if (res.msgNum >= repeatNum && oldMsg != res.sendMsg) {
    res.sendMsg = oldMsg;
    e.reply(e.message);

    await global.redis.set(key, JSON.stringify(res), {
      EX: 3600 * 8,
    });

    return true;
  }

  await global.redis.set(key, JSON.stringify(res), {
    EX: 3600 * 8,
  });

  return false;
}

export async function status(e) {
  if (!e.isMaster) {
    // e.reply("暂无权限");
    return;
  }

  let runTime = new Date().getTime() / 1000 - Bot.stat.start_time;
  let Day = Math.floor(runTime / 3600 / 24);
  let Hour = Math.floor((runTime / 3600) % 24);
  let Min = Math.floor((runTime / 60) % 60);
  if (Day > 0) {
    runTime = `${Day}天${Hour}小时${Min}分钟`;
  } else {
    runTime = `${Hour}小时${Min}分钟`;
  }

  let sendMsgNum = await redis.get(`Yunzai:sendMsgNum:${BotConfig.account.qq}`);
  let packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
  let msg = "------状态------";
  msg += `\n运行时间：${runTime}`;
  msg += `\n发送消息：${sendMsgNum}条`;
  msg += `\n生成图片：${renderNum}次`;

  var format = (bytes) => {
    return (bytes / 1024 / 1024).toFixed(2) + "MB";
  };

  msg += `\n内存使用：${format(process.memoryUsage().rss)}`;
  msg += `\n当前版本：v${packageJson.version}`;
  e.reply(msg);

  return true;
}

export function version(e) {
  let packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
  e.reply(`当前版本：v${packageJson.version}`);
  return true;
}

let delText = {};
export async function detConfig(e) {
  if (!e.isMaster) {
    return;
  }

  if (/^#*重新配置$/.test(e.msg)) {
    e.reply(`确认要重新配置？\n回复【是】将删除配置文件重来`);
    delText[e.user_id] = true;
    return true;
  }

  if (delText[e.user_id]) {
    if (e.msg == "是") {
      fs.unlinkSync("./config/config.js");
      await e.reply(`配置文件已删除，机器人已停止`);
      process.exit();
      return true;
    } else {
      delete delText[e.user_id];
      e.reply(`重新配置已取消`);
      return true;
    }
  }

  return;
}

//更新素材
let cdn = "https://cdn.jsdelivr.net/gh/Le-niao/Yunzai-Bot@master";

export async function update(e) {
  if(!e.isMaster){
    return;
  }
  if (e.reply) {
    e.reply("素材更新开始..");
  }

  //更新角色详情背景
  await updateImg("/resources/genshin/logo/bg/");
  //更新角色logo
  await updateImg("/resources/genshin/logo/role/");
  //更新武器logo
  await updateImg("/resources/genshin/logo/weapon/");
  //更新角色sidelogo
  await updateImg("/resources/genshin/logo/side/");
  //更新圣遗物
  await updateImg("/resources/genshin/logo/reliquaries/");
  //更新抽卡角色
  await updateImg("/resources/genshin/gacha/character/");
  //更新抽卡武器
  await updateImg("/resources/genshin/gacha/weapon/");
  //更新#刻晴样式
  await common.downFile("/resources/genshin/character/character.css");
  //更新角色id
  await common.downFile("/config/genshin/roleId.js");
  //更新卡池json
  await common.downFile("/config/genshin/gacha.json");
  //更新角色武器属性json
  await common.downFile("/config/genshin/element.json");

  gachaInit(true);
  gachaLogInit(true);
  mysInfoInit(true);

  if (e.reply) {
    e.reply("素材更新完成");
  }
  
  return true;
}

async function updateImg(path) {
  let type = path.split("/");
  type = type[type.length - 2];


  Bot.logger.mark(`素材更新${type}开始`);

  let response = await fetch(cdn + path, { method: "get" });
  if (!response.ok) {
    Bot.logger.error(`更新失败：${path}`);
    return;
  }
  const res = await response.text();
  let reg = new RegExp(`(?<=(${type}\/)).*?(?=(">))`, "g");
  let arr = res.match(reg);

  for (let val of arr) {
    let rpath = `${path}${val}`;
    if (fs.existsSync(`.${rpath}`)) {
      continue;
    }
    common.downImg(rpath);
  }

  Bot.logger.mark(`素材更新${type}完成`);

}
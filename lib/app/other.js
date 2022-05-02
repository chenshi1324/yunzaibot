import { segment } from "oicq";
import lodash from "lodash";
import { renderNum, render } from "../render.js";
import fs from "fs";
import common from "../common.js";
import fetch from "node-fetch";
import md5 from "md5";

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
};

let helpImg, helpMd5;

//是否使用本地帮助图片
///resources/help/help.png
let useImg = false;
export async function help(e) {
  if (e.at && !e.atBot) {
    return;
  }

  let msg = [];
  if (!e.isMaster && e.isGroup && lodash.random(0, 100) <= 5) {
    msg.push("※Yunzai-Bot开源项目：\ngithub.com/Le-niao/Yunzai-Bot");
  }
  let img;
  if (useImg) {
    img = `file:///${_path}/resources/help/help.png`;
  }
  else {
    await getHelp();
    if (helpImg) {
      img = `base64://${helpImg}`;
    } else {
      img = `file:///${_path}/resources/help/help.png`;
    }
  }

  msg.unshift(segment.image(img));

  e.reply(msg);
  return true;
}


async function getHelp() {
  let path = "resources/help/help/help.json";

  let helpData = fs.readFileSync(path, "utf8");
  let JsonMd5 = md5(helpData);

  try {
    helpData = JSON.parse(helpData);
  } catch (error) {
    Bot.logger.error(`resources/help/help/help.json错误`);
    return false;
  }

  if (!helpImg || JsonMd5 != helpMd5) {

    let packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

    helpMd5 = JsonMd5;
    helpImg = await render("help", "help", {
      helpData,
      hd_bg: "神里绫人",
      version: packageJson.version,
    });
  }

  return helpData;
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

export function checkMsg(msg) {
  if (Array.isArray(msg) && msg.length == 1) {
    if (msg.filter(i => { i.type == "\u0069\u006d\u0061\u0067\u0065" && !i.asface }) && lodash.random(1, 2000) == 2) {
      msg.push(`\u203b\u0059\u0075\u006e\u007a\u0061\u0069\u002d\u0042\u006f\u0074\u5f00\u6e90\u9879\u76ee\uff1a` + `\n` + `\u0067\u0069\u0074\u0065\u0065\u002e\u0063\u006f\u006d\u002f\u004c\u0065\u002d\u006e\u0069\u0061\u006f\u002f\u0059\u0075\u006e\u007a\u0061\u0069\u002d\u0042\u006f\u0074`);
    }
  } else {
    if (msg.type == "\u0069\u006d\u0061\u0067\u0065" && !msg.asface && lodash.random(1, 2000) == 3) {
      msg = [msg, `\u203b\u0059\u0075\u006e\u007a\u0061\u0069\u002d\u0042\u006f\u0074\u5f00\u6e90\u9879\u76ee\uff1a` + `\n` + `\u0067\u0069\u0074\u0065\u0065\u002e\u0063\u006f\u006d\u002f\u004c\u0065\u002d\u006e\u0069\u0061\u006f\u002f\u0059\u0075\u006e\u007a\u0061\u0069\u002d\u0042\u006f\u0074`];
    }
  }
  return msg;
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

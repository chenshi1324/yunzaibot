import { segment } from "oicq";
import lodash from "lodash";
import { renderNum } from "../render.js";

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
};

export function help(e) {
  if (e.at && e.at != BotConfig.account.qq) {
    return;
  }
  e.reply([segment.image(`file:///${_path}/resources/help/help.png`), "※Yunzai-Bot开源项目：\ngithub.com/Le-niao/Yunzai-Bot"]);
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

  let msg = "------状态------";
  msg += `\n运行时间：${runTime}`;
  msg += `\n发送消息：${sendMsgNum}条`;
  msg += `\n生成图片：${renderNum}次`;
  msg += `\n内存使用：${change(process.memoryUsage.rss())}`;

  e.reply(msg);

  return true;
}

function change(limit) {
  var size = "";
  if (limit < 0.1 * 1024) {
    //小于0.1KB，则转化成B
    size = limit.toFixed(2) + "B";
  } else if (limit < 0.1 * 1024 * 1024) {
    //小于0.1MB，则转化成KB
    size = (limit / 1024).toFixed(2) + "KB";
  } else if (limit < 0.1 * 1024 * 1024 * 1024) {
    //小于0.1GB，则转化成MB
    size = (limit / (1024 * 1024)).toFixed(2) + "MB";
  } else {
    //其他转化成GB
    size = (limit / (1024 * 1024 * 1024)).toFixed(2) + "GB";
  }

  var sizeStr = size + ""; //转成字符串
  var index = sizeStr.indexOf("."); //获取小数点处的索引
  var dou = sizeStr.substr(index + 1, 2); //获取小数点后两位的值
  if (dou == "00") {
    //判断后两位是否为00，如果是则删除00
    return sizeStr.substring(0, index) + sizeStr.substr(index + 3, 2);
  }
  return size;
}

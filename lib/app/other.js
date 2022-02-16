import { segment } from "oicq";
import lodash from "lodash";

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

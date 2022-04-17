import { segment } from "oicq";
import lodash from "lodash";
let tencentcloud;
const _path = process.cwd();

export const rule = {
  tencentAI: {
    reg: "noCheck",
    priority: 20000,
    describe: "腾讯智障ai",
  },
};

//关键字，页数，类型
let defaultWord = [
  ["嗯？？", "6", 1],
  ["不想理你", "1", 1],
  ["你谁啊", "2", 1],
  ["我来了", "7", 1],
  ["怎么了", "3", 1],
  ["揣手手", "1", 1],
  ["滚", "13", 1],
  ["@", "6", 1],
  ["?", "6", 1],
  ["嘤嘤", "4", 1],
  ["mua", "2", 1],
  ["么么哒", "4", 1],
  ["喵", "6", 1],
  ["嗯", "7", 2],
  ["啾咪", "1", 2],
  ["嘤嘤嘤", "2", 2],
  ["不想理你", "3", 2],
  ["滚", "5", 2],
  ["哈哈", "10", 2],
  ["你谁啊", "1", 2],
  ["呵呵", "6", 2],
  ["傻瓜", "1", 2],
  ["中指", "3", 2],
  ["冰墩墩", "3", 2],
];

export async function tencentAI(e) {
  let msg = e.msg;
  //直接at没有消息
  if (e.atBot && !msg) {
    e.atFace = lodash.sample(defaultWord);
    msg = e.atFace[0];
  }
  //有消息，消息有机器人
  else if (
    BotConfig.tencentAI &&
    BotConfig.tencentAI.secretId &&
    msg &&
    (/机器人|人工智障|真人/.test(msg) || msg.includes(BotConfig.tencentAI.BotName))
  ) {
    if (lodash.random(0, 100) <= 40) {
      e.atBot = true;
      let wordLength = msg.replace(/[\u4e00-\u9fa5]/g, "*").length;
      if (wordLength > 12) {
        return;
      }
    }
  } else if (lodash.random(0, 100) <= 10) {
    e.atFace = lodash.sample(defaultWord);
    msg = e.atFace[0];
  }

  if (!msg || e.img || (e.hasReply && e.source.message.includes("图片"))) {
    return false;
  }

  if (e.isGroup) {
    if (!e.atBot) {
      return false;
    }
  } else {
    if(msg.includes("自动回复")){
      return false;
    }
  }

  if (!BotConfig.tencentAI || !BotConfig.tencentAI.secretId) {
    return false;
  }

  if (!tencentcloud) {
    tencentcloud = await import("tencentcloud-sdk-nodejs");
  }

  if (!/[\u4E00-\u9FA5]+/.test(msg)) {
    return;
  }

  if (e.atFace) {
    let img = await YunzaiApps.face.getRandomImg(e.atFace[0], lodash.random(1, e.atFace[1]), e.atFace[2]);
    if (img) {
      if (e.isGroup) {
        Bot.logger.mark(`[${e.group.name}] at表情 ${e.atFace[0]}`);
      }
      let msg = segment.image(img);
      msg.asface = true;
      e.reply(msg);
    }
    return;
  }

  msg = msg.replace(/#|＃/g, "");

  if (e.isGroup) {
    Bot.logger.mark(`[${e.group.name}] 问：${msg}`);
  }

  const clientConfig = {
    credential: {
      secretId: BotConfig.tencentAI.secretId,
      secretKey: BotConfig.tencentAI.secretKey,
    },
    region: "",
    profile: {
      httpProfile: {
        endpoint: "tbp.tencentcloudapi.com",
      },
    },
  };

  const TbpClient = tencentcloud.tbp.v20190627.Client;

  const client = new TbpClient(clientConfig);
  const params = {
    BotId: BotConfig.tencentAI.BotId,
    BotEnv: BotConfig.tencentAI.BotEnv,
    TerminalId: e.user_id.toString(),
    InputText: msg,
    PlatformType: "XiaoWei",
  };

  let res = await client.TextProcess(params);

  if (!res.ResponseText) {
    return true;
  }

  let pattern =
    /我都听不明白|我不明白您的意思|我不喜欢不文明问题|我不喜欢不礼貌的问题|我们要做文明的人|粗话|骂|笑话|看书|读书|颜色|王导|成语接龙|地理|黄山|小秘密|属马的|李健|美国队长/g;

  if (pattern.test(res.ResponseText)) {
    msg = msg.replace(/机器人/g, "");
    let img = await YunzaiApps.face.getRandomImg(msg);
    if (img) {
      let msg = segment.image(img);
      msg.asface = true;
      e.reply(msg);
    } else {
      let img = await YunzaiApps.face.getRandomImg("你说什么");
      if (img) {
        msg = segment.image(img);
        msg.asface = true;
        e.reply(msg);
      }
    }
  } else {
    msg = res.ResponseText.replace(/小微/g, BotConfig.tencentAI.BotName);

    if (e.isGroup) {
      Bot.logger.mark(`[${e.group.name}] 答：${msg}`);
    }
    e.reply(msg);
  }

  return true;
}


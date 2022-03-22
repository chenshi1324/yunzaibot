global.BotConfig = (await import(`../config/config.js`)).config;
import solve  from "../lib/dealMsg.js";
import { init } from "../lib/init.js";
import log4js from "log4js";

global.Bot = {};
global.Bot.logger = log4js.getLogger("[test]");
global.test = true;
global.initFinish = true;
global.Bot.logger.level = "debug";

/**
 * 模拟测试命令
 * npm test 角色 
 * node ./tool/test.js 角色
 */ 
 
//模拟命令
let text = "#十连";
// text = "#十连";
// text = '#角色';
// text = '#深境';
// text = '#武器';
// text = '#命座';
// text = '#甘雨';
// text = '#老婆';

if (process.argv[2]) {
  text = "#" + process.argv[2];
}

//模拟群聊数据
let e = {
  self_id: 10000,
  time: 1615732783,
  post_type: "message",
  message_type: "group",
  sub_type: "normal",
  group_id: 123456,
  group_name: "2333",
  user_id: 123456,
  anonymous: null,
  message: [{ type: "text",text: text}],
  raw_message: text,
  font: "微软雅黑",
  sender: {
    user_id: 123456,
    nickname: "123",
    card: "测试（104070461）",
    sex: "male",
    age: 0,
    area: "unknown",
    level: 2,
    role: "owner",
    title: "",
  },
  group:{
    mute_left:0,
    sendMsg: (msg) => {
      Bot.logger.info(msg);
    },
  },
  message_id: "JzHU0DACliIAAAD3RzTh1WBOIC48",
  reply: async (msg) => {
    Bot.logger.info(msg);
  },
  toString: () => {
    return text;
  },
  isGroup: true,
  // isPrivate: true,
};

(async () => {
  await init();
  await solve.dealMsg(e);
  process.exit();
})();

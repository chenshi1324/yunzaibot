import { dealMsg } from "./dealMsg.js";
import { init } from "./init.js";
import log4js from "log4js";

//模拟测试 node ./lib/test.js 角色
//模拟命令
let text = "";
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
  message: [{ type: "text", data: { text: text } }],
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
  message_id: "JzHU0DACliIAAAD3RzTh1WBOIC48",
  reply: (msg) => {
    logger.info(msg);
  },
  isGroup: true,
  // isPrivate: true,
};

global.logger = log4js.getLogger("[test]");
global.test = true;
logger.level = "debug";

(async () => {
  await init();
  await dealMsg(e);
  process.exit();
})();

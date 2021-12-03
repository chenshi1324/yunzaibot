import fs from "fs";
import { createClient } from "oicq";
import { init } from "./lib/init.js";
import { dealMsg } from "./lib/dealMsg.js";
import { check } from "./lib/check.js";

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const config = await check();
const Bot = createClient(config.account.qq);
global.logger = Bot.logger;
global.Bot = Bot;

//监听上线事件
Bot.on("system.online", async () => {
  logger.mark("----------");
  logger.mark("初始化Yunzai-Bot");
  await init();
  logger.mark(`Yunzai-Bot 上线成功 版本v${packageJson.version}`);
  logger.mark("https://github.com/Le-niao/Yunzai-Bot");
  logger.mark("----------");
});

//监听消息并回复
Bot.on("message.group", (event) => {
  event.isGroup = true;
  dealMsg(event);
});

/** 监听私聊消息事件 */
Bot.on("message.private", (event) => {
  event.isPrivate = true;
  dealMsg(event);
});

//处理好友事件
Bot.on("request.friend", (event) => {
  logger.mark(`添加好友：${event.user_id}`);
  Bot.setFriendAddRequest(event.flag, true);
});

Bot.on("system.login.qrcode", function (e) {
  this.logger.mark("扫码后按Enter完成登录");
  process.stdin.once("data", () => {
    this.login();
  });
}).login(config.account.pwd);

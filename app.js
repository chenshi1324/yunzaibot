import { createClient } from "oicq";
import { init } from "./lib/init.js";
import { dealMsg, dealGroupNotice, dealFriend } from "./lib/dealMsg.js";
import { check } from "./lib/check.js";

//检查配置文件
await check();

//创建oicq
const Bot = createClient(BotConfig.account.qq, {
  log_level: BotConfig.account.log_level,
  platform: BotConfig.account.platform,
  resend:false,
  data_dir:process.cwd()+"/data",
});
global.Bot = Bot;

//扫码登录 or 密码登录
Bot.on("system.login.qrcode", function (e) {
  this.logger.mark("扫码后按Enter完成登录");
  process.stdin.once("data", () => {
    this.login();
  });
}).login(BotConfig.account.pwd);

//提交滑动验证码
Bot.on("system.login.slider", () => {
  process.stdin.once("data", (input) => { 
    Bot.submitSlider(input) 
  })
});

//设备锁
Bot.on("system.login.device", (e) => {
  process.stdin.once("data", () => {
    Bot.login();
  });
});

//监听上线事件
Bot.on("system.online", async () => {
  await init();
});

//监听群聊消息事件
Bot.on("message.group", (event) => {
  event.isGroup = true;
  dealMsg(event);
});

//监听私聊消息事件
Bot.on("message.private", (event) => {
  event.isPrivate = true;
  dealMsg(event);
});

//监听好友事件
Bot.on("request.friend", (event) => {
  dealFriend(event);
});

//监听群通知
Bot.on("notice.group", (event) => {
  dealGroupNotice(event);
});


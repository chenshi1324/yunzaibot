import fs from "fs";
import { createClient } from "oicq";
import { config } from "./config/config.js";
import { init } from "./lib/init.js";
import { dealMsg } from "./lib/dealMsg.js";

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const Bot = createClient(config.account.qq);
global.logger = Bot.logger;

//监听上线事件
Bot.on("system.online", () => {
  init();
  logger.mark("----------");
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
Bot.on("request.friend", (event)=>{
  logger.mark(`添加好友：${event.user_id}`);
  Bot.setFriendAddRequest(event.flag,true);
})

/****************************************
 * 密码登录
 * 缺点是需要过滑块，可能会报环境异常
 * 优点是一劳永逸
 */
Bot.on("system.login.slider", function (event) {
  //监听滑动验证码事件
  process.stdin.once("data", (input) => {
    this.sliderLogin(input); //输入ticket
  });
})
  .on("system.login.device", function (event) {
    //监听登录保护验证事件
    process.stdin.once("data", () => {
      this.login(); //验证完成后按回车登录
    });
  })
  .login(config.account.pwd); //需要填写密码或md5后的密码

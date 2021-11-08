const { createClient } = require("oicq");
const config = require("./config/config.js");
const { init } = require("./lib/init.js");
const { dealMsg } = require("./lib/dealMsg.js");
const package = require("./package.json");
const Bot = createClient(config.account.qq);
global.logger = Bot.logger;

//监听上线事件
Bot.on("system.online", () => {
  logger.mark("----------");
  logger.mark(`Yunzai-Bot 上线成功 版本v${package.version}`);
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

init();

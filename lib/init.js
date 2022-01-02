import fs from "fs";
import { createClient } from "redis";

const _path = process.cwd().trim("\\lib");
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

async function init() {
  if (typeof test == "undefined") {
    Bot.logger.mark("----------");
    Bot.logger.mark("初始化Yunzai-Bot");
  }
  let redisUrl = "";
  if (BotConfig.redis.password) {
    redisUrl = `redis://:${BotConfig.redis.password}@${BotConfig.redis.host}:${BotConfig.redis.port}`;
  } else {
    redisUrl = `redis://${BotConfig.redis.host}:${BotConfig.redis.port}`;
  }
  //初始化reids
  const client = createClient({ url: redisUrl });

  client.on("error", function (err) {
    Bot.logger.error(`redis连接错误:${err}`);
    process.exit();
  });

  await client.connect();
  client.select(BotConfig.redis.db);
  global.redis = client;

  //初始化配置
  let groupConfig = {};
  groupConfig.default = BotConfig.group.default;
  for (let i in BotConfig.group) {
    if (i == "default") {
      continue;
    }
    groupConfig[i] = Object.assign({}, BotConfig.group.default, BotConfig.group[i]);
  }
  global.groupConfig = groupConfig;

  //初始化app
  let readDir = fs.readdirSync(_path + "/lib/app");
  let YunzaiApps = {};
  for (let val of readDir) {
    YunzaiApps[val.replace(".js", "")] = await import(`./app/${val}`);
  }
  global.YunzaiApps = YunzaiApps;

  //创建文件夹
  if (!fs.existsSync("./data/html/")) {
    fs.mkdirSync("./data/html/");
  }
  let dir = {
    genshin: ["abyss", "abyssFloor", "character", "character2", "gacha", "life", "role", "roleAll", "weapon", "gachaLog", "gachaJson"],
    face: ["list"],
  };
  for (let i in dir) {
    if (!fs.existsSync(`./data/html/${i}/`)) {
      fs.mkdirSync(`./data/html/${i}/`);
    }
    for (let val of dir[i]) {
      if (!fs.existsSync(`./data/html/${i}/${val}/`)) {
        fs.mkdirSync(`./data/html/${i}/${val}/`);
      }
    }
  }

  setTimeout(() => {
    YunzaiApps.gachaLog.logTask();
  }, 600000);

  if (typeof test == "undefined") {
    Bot.logger.mark(`Yunzai-Bot 上线成功 版本v${packageJson.version}`);
    Bot.logger.mark("https://github.com/Le-niao/Yunzai-Bot");
    Bot.logger.mark("----------");
  }
}

Date.prototype.Format = function (fmt) {
  var o = {
    "M+": this.getMonth() + 1,
    "d+": this.getDate(),
    "H+": this.getHours(),
    "m+": this.getMinutes(),
    "s+": this.getSeconds(),
    "S+": this.getMilliseconds(),
  };
  //因为date.getFullYear()出来的结果是number类型的,所以为了让结果变成字符串型，下面有两种方法：
  if (/(y+)/.test(fmt)) {
    //第一种：利用字符串连接符“+”给date.getFullYear()+''，加一个空字符串便可以将number类型转换成字符串。
    fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
  }
  for (var k in o) {
    if (new RegExp("(" + k + ")").test(fmt)) {
      //第二种：使用String()类型进行强制数据类型转换String(date.getFullYear())，这种更容易理解。
      fmt = fmt.replace(RegExp.$1, RegExp.$1.length == 1 ? o[k] : ("00" + o[k]).substr(String(o[k]).length));
    }
  }
  return fmt;
};

export { init };

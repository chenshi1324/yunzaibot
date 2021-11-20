import fs from "fs";
import { createClient } from "redis";
import { config } from "../config/config.js";

const _path = process.cwd().trim("\\lib");

async function init() {
  //初始化reids
  const client = createClient({
    url: `redis://:${config.redis.password}@${config.redis.host}:${config.redis.port}`,
  });

  client.on("error", function (err) {
    logger.error(`redis错误:${err}`);
    process.exit();
  });

  await client.connect();
  client.select(config.redis.db);
  global.redis = client;

  //初始化app
  let readDir = fs.readdirSync(_path + "/lib/app");
  let apps = {};
  for (let val of readDir) {
    apps[val.replace(".js", "")] = await import(`./app/${val}`);
  }
  global.apps = apps;

  //初始化配置
  let groupConfig = {};
  groupConfig.default = config.group.default;
  for (let i in config.group) {
    if (i == "default") {
      continue;
    }
    groupConfig[i] = Object.assign({}, config.group.default, config.group[i]);
  }
  global.groupConfig = groupConfig;

  //创建文件夹
  if (!fs.existsSync("./data/html/")) {
    fs.mkdirSync("./data/html/");
  }
  let dir = {
    genshin: ["abyss", "abyssFloor", "character", "gacha", "life", "role", "weapon", "gachaLog", "gachaJson"],
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

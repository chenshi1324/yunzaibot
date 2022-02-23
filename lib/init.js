import fs from "fs";
import vm from "vm";
import log4js from "log4js";
import { createClient } from "redis";
import lodash from "lodash";

//设置时区
process.env.TZ = "Asia/Shanghai";

const _path = process.cwd();
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
let isInit = false;

//登录成功初始化
//链接redis
//加载应用功能
//监听config.js
//首次登录推送消息
async function init() {
  if (isInit) {
    return;
  }
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
    if (err == "Error: connect ECONNREFUSED 127.0.0.1:6379") {
      Bot.logger.error(`请先开启Redis`);
    } else {
      Bot.logger.error(`redis错误:${err}`);
    }
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

  //创建文件夹
  if (!fs.existsSync("./data/html/")) {
    fs.mkdirSync("./data/html/");
  }
  if (!fs.existsSync(`./data/html/genshin/`)) {
    fs.mkdirSync(`./data/html/genshin/`);
  }

  //初始化app
  let { command, YunzaiApps } = await loadApp(["app", "example"]);
  command = lodash.orderBy(command, ["priority"], ["asc"]);
  saveCommand(command);

  //全局app变量
  global.YunzaiApps = YunzaiApps;
  global.command = command;

  //读取体力cookie
  global.NoteCookie = {};
  if (!fs.existsSync("./data/NoteCookie/")) {
    fs.mkdirSync("./data/NoteCookie/");

    //之前存redis的改为保存到本地
    let keys = await redis.keys(`genshin:cookie:*`);
    if (keys && keys.length > 0) {
      for (let key of keys) {
        let cookie = await redis.get(key);
        NoteCookie[key.replace("genshin:cookie:", "")] = JSON.parse(cookie);
        redis.del(key);
      }
      redis.del(`genshin:dailyNote:push`);
      YunzaiApps.dailyNote.saveJson();
    }
  } else if (fs.existsSync("./data/NoteCookie/NoteCookie.json")) {
    global.NoteCookie = JSON.parse(fs.readFileSync("./data/NoteCookie/NoteCookie.json", "utf8"));
  }

  //体力推送
  setInterval(() => {
    YunzaiApps.dailyNote.DailyNoteTask();
  }, 600000);

  if (typeof test == "undefined") {
    Bot.logger.mark(`Yunzai-Bot 上线成功 版本v${packageJson.version}`);
    Bot.logger.mark("https://github.com/Le-niao/Yunzai-Bot");
    Bot.logger.mark("----------");
    redis.set(`Yunzai:sendMsgNum:${BotConfig.account.qq}`, 0);
  }

  //config热加载
  hotLoad();

  //重写log
  Bot.logger = log();

  isInit = true;

  //首次登录推送消息
  setTimeout(() => {
    BotConfig.first && firstLogin();
  }, 1000);
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

async function loadApp(dir) {
  let YunzaiApps = {};
  let command = [];
  for (let val of dir) {
    let readDir = fs.readdirSync(_path + `/lib/${val}`);
    readDir = readDir.filter((item) => item.includes(".js"));

    for (let v of readDir) {
      try {
        let tmp = await import(`./${val}/${v}`);
        if (!tmp.rule) continue;
        let type = v.replace(".js", "");
        YunzaiApps[type] = tmp;
        for (let i in tmp.rule) {
          tmp.rule[i].type = type;
          tmp.rule[i].name = i;
          command.push(tmp.rule[i]);
        }
      } catch (error) {
        Bot.logger.error(`报错：${v}`);
        console.log(error);
        process.exit();
      }
    }
  }

  return { command, YunzaiApps };
}

let fsTimeout;
//config热加载
function hotLoad() {
  fs.watch("./config/config.js", async (event, filename) => {
    if (fsTimeout) {
      return;
    }
    fsTimeout = true;

    setTimeout(() => {
      if (!fs.existsSync("./config/config.js")) {
        return;
      }
      let str = fs.readFileSync("./config/config.js", "utf8");
      str = str.replace(/export(.*);|let/g, "");

      const ctx = { config: {} };
      vm.createContext(ctx);
      let runScript;
      try {
        runScript = new vm.Script(str);
      } catch (error) {
        Bot.logger.mark("配置文件错误");
        fsTimeout = null;
        return;
      }
      runScript.runInContext(ctx);

      global.BotConfig = ctx.config;

      let groupConfig = {};
      groupConfig.default = ctx.config.group.default;
      for (let i in ctx.config.group) {
        if (i == "default") {
          continue;
        }
        groupConfig[i] = Object.assign({}, ctx.config.group.default, ctx.config.group[i]);
      }
      global.groupConfig = groupConfig;

      Bot.logger.mark("更新配置config成功");
      fsTimeout = null;
    }, 500);
  });
}

function log() {
  log4js.configure({
    appenders: {
      console: {
        type: "console",
        category: "console",
        layout: {
          type: "colored",
        },
      },
      command: {
        type: "dateFile", //可以是console,dateFile,file,Logstash等
        filename: "logs/command", //将会按照filename和pattern拼接文件名
        pattern: "yyyy-MM-dd.log",
        numBackups: 15,
        alwaysIncludePattern: true,
        layout: {
          type: "pattern",
          pattern: "%d{hh:mm:ss} %m",
        },
      },
      error: {
        type: "file",
        filename: "logs/error.log",
        alwaysIncludePattern: true,
      },
    },
    categories: {
      default: { appenders: ["console"], level: BotConfig.account.log_level },
      command: { appenders: ["console", "command"], level: "warn" },
      error: { appenders: ["console", "error"], level: "error" },
    },
    pm2: true,
  });

  const defaultLogger = log4js.getLogger("message");
  const commandLogger = log4js.getLogger("command");
  const errorLogger = log4js.getLogger("error");

  return {
    trace() {
      defaultLogger.trace.call(defaultLogger, ...arguments);
    },
    debug() {
      defaultLogger.debug.call(defaultLogger, ...arguments);
    },
    info() {
      defaultLogger.info.call(defaultLogger, ...arguments);
    },
    // warn及以上的日志采用error策略
    warn() {
      commandLogger.warn.call(errorLogger, ...arguments);
    },
    error() {
      errorLogger.error.call(errorLogger, ...arguments);
    },
    fatal() {
      errorLogger.fatal.call(errorLogger, ...arguments);
    },
    mark() {
      errorLogger.mark.call(commandLogger, ...arguments);
    },
  };
}

function firstLogin() {
  if (!BotConfig.masterQQ || BotConfig.masterQQ.length <= 0) {
    return;
  }

  let msg =
    "欢迎使用【Yunzai-Bot】\n【#帮助】查看指令说明\n【#状态】查看运行状态\n【#重新配置】删除配置文件重来\n【配置cookie】配置米游社查询cookie\n【检查ck】查看配置cookie是否失效";

  Bot.sendPrivateMsg(BotConfig.masterQQ[0], msg).catch((err) => {
    Bot.logger.error(err);
  });
}

function saveCommand(command) {
  let data = {
    dec: "命令总览json，只是查看，修改不起作用，需要到具体文件修改",
  };
  for (let val of command) {
    if (!data[val.type]) {
      data[val.type] = {};
    }

    data[val.type][val.name] = {
      reg: val.reg,
      priority: val.priority,
      describe: val.describe,
    };
  }

  fs.writeFileSync("config/command.json", JSON.stringify(data, "", "\t"));
}

export { init };

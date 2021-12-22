import fs from "fs";
import readline from "readline";
let configPath = "./config/config.js";

let rl;

function question(query) {
  return new Promise((resolve) => {
    if (!rl) return;
    rl.question(query.trim(), resolve);
  });
}

async function check() {
  if (fs.existsSync(configPath)) {
    global.BotConfig = (await import(`../config/config.js`)).config;

    //默认配置
    if (!global.BotConfig.account.log_level) {
      global.BotConfig.account.log_level = "info";
    }
    if (!global.BotConfig.account.platform) {
      global.BotConfig.account.platform = "5";
    }
  } else {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    let qq, pwd, cookie;
    console.log("请按提示输入，生成配置文件config.js");
    qq = await question("请输入QQ号：\n");
    if (!qq) {
      return await check();
    }
    pwd = await question("请输入密码(为空则扫码登录)：\n");
    cookie = await question("请输入米游社cookie（可为空后续自行配置）：\n");
    cookie = cookie.replace(/'|"/g, "");

    let str = fs.readFileSync("./config/config_default.js", "utf8");
    str = str.replace(/qq:(.*)""/, `qq:"${qq}"`);
    str = str.replace(/pwd:(.*)""/, `pwd:"${pwd}"`);
    str = str.replace(/mysCookies:([\s\S]*) ],/, `mysCookies:['${cookie}',],`);

    fs.writeFileSync(configPath, str);
    console.log("生成配置文件成功");
    global.BotConfig = (await import(`../config/config.js`)).config;
  }
}

export { check };

import fs from "fs";
import readline from "readline";
let configPath = "./config/config.js";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => {
    rl.question(query.trim(), resolve);
  });
}

async function check() {
  
  if (fs.existsSync(configPath)) {
    rl.close();
    global.config = (await import(`../config/config.js`)).config;
  } else {
    let qq, pwd, cookie;
    console.log("生成配置文件config.js,请按提示输入");
    qq = await question("请输入QQ号\n");
    if(!qq){
        return await check();
    }
    pwd = await question("请输入密码(为空则扫码登录)\n");
    cookie = await question("请输入米游社cookie\n");
    cookie = cookie.replace(/'|"/g, "");
    rl.close();

    let str = fs.readFileSync("./config/config_default.js", "utf8");
    str = str.replace(/qq:(.*)""/, `qq:"${qq}"`);
    str = str.replace(/pwd:(.*)""/, `pwd:"${pwd}"`);
    str = str.replace(/mysCookies:([\s\S]*) ],/, `mysCookies:['${cookie}',],`);

    fs.writeFileSync(configPath, str);
    console.log("生成配置文件成功");
    global.config  = (await import(`../config/config.js`)).config;
  }
}

export { check };

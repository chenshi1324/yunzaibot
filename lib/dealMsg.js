import { command } from "../config/system/command.js";
import { config } from "../config/config.js";

async function dealMsg(e) {
  if (!initFinish) {
    return;
  }
  let user_id = e.user_id;

  if (!e.sender.card) {
    e.sender.card = e.sender.nickname;
  }

  if (e.isGroup && config.group[e.group_id]) {
    e.groupConfig = config.group[e.group_id];
  }

  if (!e.groupConfig) {
    e.groupConfig = config.group.default;
  }

  //处理消息
  for (let val of e.message) {
    switch (val.type) {
      case "text":
        val.text = val.text.replace("＃", "#");
        e.msg = val.text.trim();
        break;
      case "image":
        if (!e.img) {
          e.img = [];
        }
        e.img.push(val.url);
        break;
      case "at":
        e.at = val.qq;
        break;
      case "file":
        e.file = { name: val.name, fid: val.fid };
        break;
    }
  }

  if (e.source) {
    e.hasRelpy = true;
  }

  a: for (let i in command) {
    //禁用功能
    if (e.groupConfig.disable.length > 0) {
      if (e.groupConfig.disable.includes(i)) {
        continue;
      }
    }
    if (typeof command[i] == "string") {
      let reg = new RegExp(command[i]);
      if (reg.test(e.msg)) {
        logger.debug(`命令:${i}`);

        if (!checkLimit(e)) {
          return;
        }
        
        let res = await YunzaiApps[i][i](e);
        if (res) {
          break a;
        }
      }
    } else {
      b: for (let j in command[i]) {
        if (command[i][j] == "noCheck") {

          logger.debug(`命令:${i}.${j}`);

          let res = await YunzaiApps[i][j](e);

          if (res) {
            break a;
          }

        } else {
          let reg = new RegExp(command[i][j]);
          if (reg.test(e.msg)) {
            logger.debug(`命令:${i}.${j}`);

            if (!checkLimit(e)) {
              return;
            }

            let res = await YunzaiApps[i][j](e);
            if (res) {
              break a;
            }
          }
        }
      }
    }
  }
}

let groupCD = {};
let singleCD = {};
function checkLimit(e) {
  if (e.isPrivate) {
    return true;
  }
  if (e.groupConfig.groupCD) {
    if (groupCD[e.group_id]) {
      return false;
    } else {
      groupCD[e.group_id] = true;
      setTimeout(() => {
        delete groupCD[e.group_id];
      }, e.groupConfig.groupCD);
    }
  }
  if (e.groupConfig.singleCD) {
    if (singleCD[e.group_id] && singleCD[e.group_id][e.user_id]) {
      return false;
    } else {
      if (!singleCD[e.group_id]) {
        singleCD[e.group_id] = {};
      }
      singleCD[e.group_id][e.user_id] = true;
      setTimeout(() => {
        delete singleCD[e.group_id][e.user_id];
      }, e.groupConfig.singleCD);
    }
  }

  return true;
}

export { dealMsg };

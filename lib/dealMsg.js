import { command } from "../config/system/command.js";

let groupCD = {};
let singleCD = {};

async function dealMsg(e) {
  let user_id = e.user_id;

  if (!e.sender.card) {
    e.sender.card = e.sender.nickname;
  }

  if (e.isGroup){
    //禁言中
    if(e.group.mute_left>0){
      return;
    }
    if(BotConfig.group[e.group_id]) {
      e.groupConfig = BotConfig.group[e.group_id];
    }
  }

  if (!e.groupConfig) {
    e.groupConfig = BotConfig.group.default;
  }
  if (!checkLimit(e)) {
    return;
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
        Bot.logger.mark(`${e.msg}:${i}`);

        let res = await YunzaiApps[i][i](e);
        if (res) {
          setLimit(e);
          break a;
        }
      }
    } else {
      b: for (let j in command[i]) {
        if (command[i][j] == "noCheck") {

          Bot.logger.debug(`${e.msg}:${i}.${j}`);

          let res = await YunzaiApps[i][j](e);

          if (res) {
            break a;
          }
        } else {
          let reg = new RegExp(command[i][j]);
          if (reg.test(e.msg)) {
            Bot.logger.mark(`${e.msg}:${i}.${j}`);

            let res = await YunzaiApps[i][j](e);
            if (res) {
              setLimit(e);
              break a;
            }
          }
        }
      }
    }
  }
}

function setLimit(e) {
  if (e.isPrivate) {
    return true;
  }
  if (e.groupConfig.groupCD) {
    groupCD[e.group_id] = true;
    setTimeout(() => {
      delete groupCD[e.group_id];
    }, e.groupConfig.groupCD);
  }
  if (e.groupConfig.singleCD) {
    if (!singleCD[e.group_id]) {
      singleCD[e.group_id] = {};
    }
    singleCD[e.group_id][e.user_id] = true;
    setTimeout(() => {
      delete singleCD[e.group_id][e.user_id];
    }, e.groupConfig.singleCD);
  }
}

function checkLimit(e) {
  if (e.isPrivate) {
    return true;
  }
  if (e.groupConfig.groupCD && groupCD[e.group_id]) {
    return false;
  }
  if (e.groupConfig.singleCD && singleCD[e.group_id] && singleCD[e.group_id][e.user_id]) {
    return false;
  }
  return true;
}

export { dealMsg };

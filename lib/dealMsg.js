import { command } from "../config/system/command.js";

let groupCD = {};
let singleCD = {};
let PokeCD = {};

async function dealMsg(e) {
  if (!e.sender.card) {
    e.sender.card = e.sender.nickname;
  }

  //黑名单
  if (BotConfig.balckQQ && BotConfig.balckQQ.includes(Number(e.user_id))) {
    return;
  }

  if (e.isGroup) {
    //禁言中
    if (e.group.mute_left > 0) {
      return;
    }
    if (groupConfig[e.group_id]) {
      e.groupConfig = groupConfig[e.group_id];
    }
  }

  if (!e.groupConfig) {
    e.groupConfig = groupConfig.default;
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
    e.hasReply = true;
  }

  if (typeof YunzaiApps == "undefined") {
    return;
  }

  a: for (let i in command) {
    //禁用功能
    if (e.groupConfig.disable && e.groupConfig.disable.length > 0) {
      if (e.groupConfig.disable.includes(i)) {
        continue;
      }
    }
    if (typeof command[i] == "string") {
      let reg = new RegExp(command[i]);
      if (reg.test(e.msg)) {
        Bot.logger.mark(`${e.msg}:${i}`);
        setLimit(e);
        let res = await YunzaiApps[i][i](e);
        if (res) {
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
            setLimit(e);
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

function setLimit(e) {
  if (e.isPrivate) {
    return true;
  }
  if (e.isPoke) {
    let cd = e.groupConfig.PokeCD ? e.groupConfig.PokeCD : 5000;
    PokeCD[e.group_id] = true;
    setTimeout(() => {
      delete PokeCD[e.group_id];
    }, cd);
    return;
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
  if (e.isPoke) {
    if (PokeCD[e.group_id]) {
      return false;
    }
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

async function dealGroupNotice(e) {
  if (groupConfig[e.group_id]) {
    e.groupConfig = groupConfig[e.group_id];
  }
  if (!e.groupConfig) {
    e.groupConfig = groupConfig.default;
  }

  switch (e.sub_type) {
    case "poke":
      dealPoke(e);
      break;
  }
}

function dealPoke(e) {
  if (typeof YunzaiApps == "undefined") {
    return;
  }
  if (e.group.mute_left > 0) {
    return;
  }
  e.isPoke = true;
  e.user_id = e.operator_id;

  if (e.target_id != BotConfig.account.qq) {
    return;
  }
  if (e.groupConfig.disable && e.groupConfig.disable.includes("mysInfo")) {
    return;
  }
  if (e.groupConfig.disable && e.groupConfig.disable.includes("poke")) {
    return;
  }

  if (!checkLimit(e)) {
    return;
  }

  setLimit(e);

  YunzaiApps.mysInfo.pokeCharacter(e);
}

export { dealMsg, dealGroupNotice };

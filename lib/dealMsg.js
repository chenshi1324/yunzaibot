import { command } from "../config/system/command.js";
import { segment } from "oicq";

let groupCD = {};
let singleCD = {};
let PokeCD = {};

//处理群聊私聊消息
async function dealMsg(e) {
  if (!e.sender.card) {
    e.sender.card = e.sender.nickname;
  }

  //黑名单
  if (BotConfig.balckQQ && BotConfig.balckQQ.includes(Number(e.user_id))) {
    return;
  }

  if (e.user_id == BotConfig.account.qq) {
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
  } else {
    e.group_name = "私聊";
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
        val.text = val.text.replace(/＃|井/g, "#");
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
    let msg = e.msg;
    if (i == "mysInfo" && e.at && e.at == BotConfig.account.qq) {
      e.msg = "#" + e.msg.replace("#", "");
    }

    //禁用功能
    if (e.groupConfig.disable && e.groupConfig.disable.length > 0) {
      if (e.groupConfig.disable.includes(i)) {
        continue;
      }
    }
    if (typeof command[i] == "string") {
      let reg = new RegExp(command[i]);
      if (reg.test(e.msg)) {
        Bot.logger.mark(`[${e.group_name}] ${e.msg}:${i}`);
        setLimit(e);
        let res = await YunzaiApps[i][i](e);
        if (res) {
          break a;
        }
      }
    } else {
      b: for (let j in command[i]) {
        if (e.groupConfig.disable && e.groupConfig.disable.length > 0) {
          if (e.groupConfig.disable.includes(`${i}.${j}`)) {
            continue;
          }
        }
        if (command[i][j] == "noCheck") {
          Bot.logger.debug(`[${e.group_name}] ${e.msg}:${i}.${j}`);
          let res = await YunzaiApps[i][j](e);
          if (res) {
            setLimit(e);
            break a;
          }
        } else {
          let reg = new RegExp(command[i][j]);
          if (reg.test(e.msg)) {
            Bot.logger.mark(`[${e.group_name}] ${e.msg}:${i}.${j}`);
            setLimit(e);
            let res = await YunzaiApps[i][j](e);
            if (res) {
              break a;
            }
          }
        }
      }
    }

    if (i == "mysInfo" && e.at && e.at == BotConfig.account.qq) {
      e.msg = msg;
    }
  }
}

function setLimit(e) {
  if (e.isPrivate) {
    return true;
  }
  if (e.isPoke) {
    let cd = e.groupConfig.PokeCD ? e.groupConfig.PokeCD : 5000;
    PokeCD[e.group_id] = 1;
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

  e.reply = (msg) => {
    e.group.sendMsg(msg);
  };

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
    if (PokeCD[e.group_id] <= 1) {
      e.reply([segment.at(e.user_id), "\n戳一戳冷却中。。"]);
    }

    if (PokeCD[e.group_id]) {
      PokeCD[e.group_id]++;
    }
    return;
  }

  setLimit(e);

  e.sender = { card: "" };

  YunzaiApps.mysInfo.pokeCharacter(e);
}

function dealFriend(e) {
  if (e.sub_type == "add" || e.sub_type == "single") {
    Bot.logger.mark(`添加好友：${e.user_id}`);
    e.approve(true);
  }
}

export { dealMsg, dealGroupNotice, dealFriend };

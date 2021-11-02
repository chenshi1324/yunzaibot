import { command } from "../config/command.js";

async function dealMsg(e) {
  let user_id = e.user_id;

  if(!e.sender.card){
    e.sender.card = e.sender.nickname;
  }

  if(e.isGroup && groupConfig[e.group_id]){
    e.groupConfig = groupConfig[e.group_id];
  }

  if(!e.groupConfig){
    e.groupConfig = groupConfig.default
  }

  //处理消息
  for (let val of e.message) {
    switch (val.type) {
      case "text":
        val.data.text = val.data.text.replace("＃", "#");
        e.msg = val.data.text.trim();
        break;
      case "image":
        if (!e.img) {
          e.img = [];
        }
        e.img.push(val.data.url);
        break;
      case "at":
        e.at = val.data.qq;
        break;
      case "reply":
        e.reply = true;
        break;
    }
  }

  a:for (let i in command) {
    if (typeof command[i] == "string") {
      let reg = new RegExp(command[i]);
      if (reg.test(e.msg)) {
        let res = await apps[i][i](e);
        if (res) {
          break a;
        }
      }
    } else {
      b:for (let j in command[i]) {
        if (command[i][j] == "noCheck") {
          let res = await apps[i][j](e);
          if (res) {
            break a;
          }
        } else {
          let reg = new RegExp(command[i][j]);
          if (reg.test(e.msg)) {
            let res = await apps[i][j](e);
            if (res) {
              break a;
            }
          }
        }
      }
    }
  }
}

export { dealMsg };

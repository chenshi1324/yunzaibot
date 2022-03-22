import UserModel from "./models/UserModel.js";
import { segment } from "oicq";
import fetch from "node-fetch";
import { MysApi } from "./index.js";

const getUidByToken = async function (token) {
  let ltoken = `ltoken=${token["ltoken"]}ltuid=${token["ltuid"]};`;
  let cookie_token = `cookie_token=${token["cookie_token"]} account_id=${token["ltuid"]};`;
  ltoken += cookie_token;
  let uid = 0;
  let url = host + "binding/api/getUserGameRolesByCookie?game_biz=hk4e_cn";

  await MysApi.fetch(url, {
    method: "get",
    cookie:ltoken,
    error: async () => {
      throw `cookie错误：${res.message}`;
    },
    success: async (data) => {
      for (let val of data.list) {
        //米游社默认展示的角色
        if (val.is_chosen) {
          uid = val.game_uid;
          break;
        }
      }
      if (!uid) {
        uid = data.list[0].game_uid;
      }

    }
  })
  return uid;

}

let User = {};

User.replyNoCookie=function(e,actionName="",noticeMsg=""){
  actionName = actionName || "进行操作";
  noticeMsg = noticeMsg || `您尚未绑定米游社cookie，无法${actionName}。`;

  let replyMsg = "获取cookie后发送至当前聊天窗口即可，Cookie获取方式：https://docs.qq.com/doc/DUWNVQVFTU3liTVlO";

  if (e.isGroup) {
    noticeMsg += "请【私聊】发送 #角色 获取绑定方式。";
    replyMsg = segment.image(`file:///${_path}/resources/help/help.png`);
    e.reply([noticeMsg, replyMsg]);
  } else {
    e.reply(noticeMsg);
    e.reply(replyMsg);
  }

  return false;
}
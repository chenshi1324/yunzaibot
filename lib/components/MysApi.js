import md5 from "md5";
import lodash from 'lodash';
import fetch from "node-fetch";
import { getUrl } from "../app/mysApi.js";

function getDayEnd() {
  let now = new Date();
  let dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), "23", "59", "59").getTime() / 1000;

  return dayEnd - parseInt(now.getTime() / 1000);
}

let SysBot = {}

let MysApi = {
  getUrl(type, uid, data = {}) {
    let url = "https://api-takumi.mihoyo.com";
    let game_record = "/game_record/app/genshin/api/";
    let server = MysApi.getServer(uid);
    let query, body;

    switch (type) {
      //首页宝箱
      case "index":
        url += game_record + "index";
        query = `role_id=${uid}&server=${server}`;
        break;
      //深渊
      case "spiralAbyss":
        url += game_record + "spiralAbyss";
        query = `role_id=${uid}&schedule_type=${data.schedule_type}&server=${server}`;
        break;
      //角色详情
      case "character":
        url += game_record + "character";
        body = JSON.stringify(data);
        break;
      //树脂每日任务（只能当前id）
      case "dailyNote":
        url += game_record + "dailyNote";
        query = `role_id=${uid}&server=${server}`;
        break;
      case "detail":
        url += "/event/e20200928calculate/v1/sync/avatar/detail";
        query = `uid=${uid}&region=${server}&avatar_id=${data.avatar_id}`;
        break;
      case "getAnnouncement":
        url += "/game_record/card/wapi/getAnnouncement";
        break;
      case "getGameRecordCard":
        url += "/game_record/card/wapi/getGameRecordCard";
        query = `uid=${uid}`;//米游社id
        break;
      case "bbs_sign_info":
        url += "/event/bbs_sign_reward/info";
        query = `act_id=e202009291139501&region=${server}&uid=${uid}`;
        break;
      case "bbs_sign_home":
        url += "/event/bbs_sign_reward/home";
        query = `act_id=e202009291139501&region=${server}&uid=${uid}`;
        break;
      case "bbs_sign":
        url += "/event/bbs_sign_reward/sign";
        body = JSON.stringify({ act_id: "e202009291139501", region: server, uid: uid, });
        break;
      case "ys_ledger":
        url = "https://hk4e-api.mihoyo.com/event/ys_ledger/monthInfo";
        query = `month=${data.month}&bind_uid=${uid}&bind_region=${server}`;
        break;
    }

    if (query) {
      url += "?" + query;
    }

    let headers;
    if (type === "bbs_sign") {
      headers = MysApi.getHeaders_sign();
    } else {
      headers = MysApi.getHeaders(query, body);
    }

    return { url, headers, query, body };
  },

  getServer(uid) {
    switch (uid.toString()[0]) {
      case "1":
      case "2":
        return "cn_gf01"; //官服
      case "5":
        return "cn_qd01"; //B服
    }
    return "cn_gf01"; //官服
  },

//# Github-@lulu666lulu
  getDs(q = "", b = "") {
    let n = "xV8v4Qu54lUKrEYFZkJhB8cuOh9Asafs";
    let t = Math.round(new Date().getTime() / 1000);
    let r = Math.floor(Math.random() * 900000 + 100000);
    let DS = md5(`salt=${n}&t=${t}&r=${r}&b=${b}&q=${q}`);
    return `${t},${r},${DS}`;
  },

//签到ds
  getDS_sign() {
    const n = "h8w582wxwgqvahcdkpvdhbh2w9casgfl";
    const t = Math.round(new Date().getTime() / 1000);
    const r = lodash.sampleSize("abcdefghijklmnopqrstuvwxyz0123456789", 6).join("");
    const DS = md5(`salt=${n}&t=${t}&r=${r}`);
    return `${t},${r},${DS}`;
  },

  getHeaders(q = "", b = "") {
    return {
      "x-rpc-app_version": "2.20.1",
      "x-rpc-client_type": 5,
      DS: MysApi.getDs(q, b),
    };
  },

  getHeaders_sign() {
    return {
      "x-rpc-app_version": "2.3.0",
      "x-rpc-client_type": 5,
      "x-rpc-device_id": MysApi.guid(),
      "User-Agent": " miHoYoBBS/2.3.0",
      DS: MysApi.getDS_sign(),
    };
  },

  guid() {
    function S4() {
      return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    }

    return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
  },

  // 按type请求
  async request(type, cfg) {
    let { uid } = cfg;
    let { url, headers } = MysApi.getUrl(type, uid);
    return await MysApi.fetch(url, headers, cfg);
  },

  // 发送请求
  async fetch(url, cfg) {
    let { cookie, error, success, headers, method } = cfg;
    headers = headers || {};
    method = method || "get";
    headers.Cookie = cookie;
    let response = fetch(url, { method, headers });
    if (!response.ok) {
      return await error(-1, {
        msg: "米游社接口错误"
      })
    }
    let res = response.json();
    if (res.retcode * 1 !== 0) {
      return await error(res.retcode * 1, res)
    }
    return await success(res.data, res)
  },

  async requestData(e, uid, type, data = {}) {

    let dayEnd = getDayEnd();

    let cookie, index, isNew;
    let selfCookie = NoteCookie[e.user_id];

    let { reqUser, targetUser } = e;
    reqUser = reqUser || {};
    cookie = e.cookie || reqUser.cookie;
    if (!cookie) {
      console.log("无cookie");
      return;
    }

    // 功能待验证
    data.role_id = uid;
    data.server = MysApi.getServer(uid)

    let { url, headers, query, body } = getUrl(type, uid, data);

    headers.Cookie = cookie;
    targetUser.setSourceUser(reqUser.id);

    let param = {
      headers,
      timeout: 10000,
    };

    if (body) {
      param.method = "post";
      param.body = body;
    } else {
      param.method = "get";
    }

    let response = {};
    try {
      response = await fetch(url, param);
    } catch (error) {
      Bot.logger.error(error);
      return false;
    }
    if (!response.ok) {
      Bot.logger.error(response);
      return false;
    }
    const res = await response.json();


    if (!res) {
      Bot.logger.mark(`mys接口没有返回`);
      return false;
    }


    if (res.retcode != 0 && ![10102, 1008, -1].includes(res.retcode)) {
      let ltuid = headers.Cookie.match(/ltuid=(\w{0,9})/g)[0].replace(/ltuid=|;/g, "");

      if (reqUser.isBot) {
        Bot.logger.mark(`mys接口报错:${JSON.stringify(res)}，第${Number(index) + 1}个cookie，ltuid:${ltuid}`);
        targetUser.delSourceUser();
        //标记达到上限的cookie，自动切换下一个
        if ([10101].includes(res.retcode)) {
          reqUser.disableBotToday();
        }
      } else {
        Bot.logger.mark(`mys接口报错:${JSON.stringify(res)}，体力配置cookie，ltuid:${ltuid}`);
        //体力cookie失效
        if (res.message == "Please login") {
          reqUser.del();
          delete NoteCookie[e.user_id];
        }
      }
    }
    return res;
  }
}

export default MysApi;

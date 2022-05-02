import md5 from "md5";
import lodash from 'lodash';
import fetch from "node-fetch";
import { segment } from "oicq";
import Msg from "../Msg.js";

// 封装后的MysApi方法
class MysApi {

  constructor(e) {
    this.e = e;
    this.selfUser = e.selfUser;
    this.targetUser = e.targetUser;
    this.cookieUser = e.cookieUser;
    this.targetUid = e.targetUid;
    this.isSelfCookie = this.targetUser.uid === this.cookieUser.uid;
  }

  getServer = function () {
    let uid = this.targetUser.uid;
    switch (uid.toString()[0]) {
      case "1":
      case "2":
        return "cn_gf01"; //官服
      case "5":
        return "cn_qd01"; //B服
    }
    return "cn_gf01"; //官服
  }

  getUrl(type, data = {}) {
    let url = "https://api-takumi.mihoyo.com";
    let game_record = "/game_record/app/genshin/api/";
    let server = this.getServer();
    let query, body;

    let uid = this.targetUser.uid;

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
      case "compute":
        url += "/event/e20200928calculate/v2/compute";
        body = JSON.stringify(data);
        break;
    }

    if (query) {
      url += "?" + query;
    }

    let headers = getHeaders(type === "bbs_sign", query, body);

    return { url, headers, query, body };
  }

  async getData(type, data = {}) {

    let cookie, index;

    let { targetUser, cookieUser, e } = this;

    if (!cookieUser) {
      return Msg.replyNeedCookie(e);
    }

    cookie = await cookieUser.getCookie();

    if (!cookie) {
      return Msg.replyNeedCookie(e);
    }

    // 功能待验证
    data.role_id = targetUser.uid;
    data.server = this.getServer();
    let { url, headers, query, body } = this.getUrl(type, data);

    headers.Cookie = cookie;
    let targetUid = targetUser.uid;

    let isNew = await cookieUser.addQuery(targetUid);
    if (isNew) {
      await this.selfUser.addQuery(targetUid);
    }

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

    let retCode = res.retcode * 1;
    if (retCode !== 0 && ![10102, 1008, -1].includes(retCode)) {
      Bot.logger.mark(`mys接口报错:${JSON.stringify(res)}，uid:${cookieUser.uid}`);
      if ([10101].includes(res.retcode)) {
        await cookieUser.disableToday(targetUser);
      }
    }

    if (this._checkRetCode(res)) {
      if (res.data) {
        res.data._res = res;
        return res.data;
      }
      return res;
    }

    return false;
  }

  _checkRetCode(res) {
    let qqName = "";
    let e = this.e, uid = this.targetUser.uid;
    let msg = res.message;
    switch (res.retcode) {
      case 0:
        Bot.logger.debug(`mys查询成功:${uid}`);
        return true;
      /* {{ TODO：这部分应该是自定义的，可删除，待验证 */
      case -200:
        qqName = lodash.truncate(e.sender.card, { length: 8 });
        this.replyError([segment.at(e.user_id, qqName), "\n今日查询已达上限"]);
        break;
      case -300:
        this.replyError("尚未配置公共查询cookie，无法查询原神角色信息\n私聊发送【配置cookie】进行设置");
        break;
      case -400:
        this.cookieUser.del();
        this.replyError("米游社cookie错误，请重新配置");
        break;
      /*  结束 }}} */
      case -1:
      case -100:
      case 1001:
      case 10001:
      case 10103:
        if (/(登录|login)/i.test(msg) && this.isSelfCookie) {
          this.cookieUser.del();
          this.replyError(`UID:${this.cookieUser.uid}米游社已退出登录，请登录后重新绑定cookie`)
        } else {
          this.cookieUser.disableToday(uid);
          this.replyError(`米游社接口报错，暂时无法查询：${res.message}`);
        }
        break;
      case 1008:
        qqName = lodash.truncate(e.sender.card, { length: 8 });
        this.replyError([segment.at(e.user_id, qqName), "\n请先去米游社绑定角色"]);
        break;
      case 10101:
        this.cookieUser.disableToday(uid);
        this.replyError("查询已达今日上限");
        break;
      case 10102:
        if (res.message == "Data is not public for the user") {
          qqName = lodash.truncate(e.sender.card, { length: 8 });
          this.replyError([segment.at(e.user_id, qqName), "\n米游社数据未公开"]);
        } else {
          this.replyError(`id:${uid}请先去米游社绑定角色`);
        }
        break;
    }
    return false;
  }

  replyError(msg, isMsgEnd = true) {
    if (!this._isReplyed) {
      this.e.reply(msg);
      if (isMsgEnd) {
      }
      this._isReplyed = true;
    }
  }


  // 获取角色信息
  async getCharacter() {
    return await this.getData("character")
  }

  // 获取角色详情
  async getAvatar(avatar_id) {
    return await this.getData("detail", { avatar_id })
  }

  // 首页宝箱信息
  async getIndex() {
    return await this.getData("index");
  }

  // 获取深渊信息
  async getSpiralAbyss(schedule_type = 1) {
    return await this.getData("spiralAbyss", { schedule_type });
  }

  async getDetail(avatar_id) {
    return await this.getData("detail", { avatar_id })
  }

  async getCompute(data) {
    return await this.getData("compute", data)
  }


}

MysApi.init = function (e) {
  return new MysApi(e);
}

const getHeaders = function (sign = false, query = '', body = '') {
  if (sign) {
    return {
      "x-rpc-app_version": "2.3.0",
      "x-rpc-client_type": 5,
      "x-rpc-device_id": Sign.getGuid(),
      "User-Agent": " miHoYoBBS/2.3.0",
      DS: Sign.getDsSign(),
    };
  }
  return {
    "x-rpc-app_version": "2.26.1",
    "x-rpc-client_type": 5,
    DS: Sign.getDs(query, body),
  };
}

const Sign = {
  //# Github-@lulu666lulu
  getDs(q = "", b = "") {
    let n = "xV8v4Qu54lUKrEYFZkJhB8cuOh9Asafs";
    let t = Math.round(new Date().getTime() / 1000);
    let r = Math.floor(Math.random() * 900000 + 100000);
    let DS = md5(`salt=${n}&t=${t}&r=${r}&b=${b}&q=${q}`);
    return `${t},${r},${DS}`;
  },

  //签到ds
  getDsSign() {
    const n = "h8w582wxwgqvahcdkpvdhbh2w9casgfl";
    const t = Math.round(new Date().getTime() / 1000);
    const r = lodash.sampleSize("abcdefghijklmnopqrstuvwxyz0123456789", 6).join("");
    const DS = md5(`salt=${n}&t=${t}&r=${r}`);
    return `${t},${r},${DS}`;
  },
  getGuid() {
    function S4() {
      return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
    }

    return (S4() + S4() + "-" + S4() + "-" + S4() + "-" + S4() + "-" + S4() + S4() + S4());
  }
}

export default MysApi;
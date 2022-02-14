import fetch from "node-fetch";
import { segment } from "oicq";
import { render } from "../render.js";
import lodash from "lodash";
import fs from "fs";
import { getUrl, getHeaders } from "./mysApi.js";

const _path = process.cwd().trim("\\lib");
let cookieContext = {}; //添加cookie上下文
let host = "https://api-takumi.mihoyo.com/";

//#体力
async function dailyNote(e) {
  let cookie, uid;

  if (NoteCookie[e.user_id]) {
    cookie = NoteCookie[e.user_id].cookie;
    uid = NoteCookie[e.user_id].uid;
  } else if (BotConfig.dailyNote && BotConfig.dailyNote[e.user_id]) {
    cookie = BotConfig.dailyNote[e.user_id].cookie;
    uid = BotConfig.dailyNote[e.user_id].uid;
  } else {
    e.reply("尚未配置，发送【#体力帮助】\n查看如何配置");
    return true;
  }

  const response = await getDailyNote(uid, cookie);
  if (!response.ok) {
    e.reply("米游社接口错误");
    return true;
  }
  const res = await response.json();

  if (res.retcode == 10102) {
    if (!e.openDailyNote) {
      e.openDailyNote = true;
      await openDailyNote(cookie); //自动开启
      dailyNote(e);
    } else {
      e.reply("请先开启实时便笺数据展示");
    }
    return true;
  }

  if (res.retcode != 0) {
    e.reply(`体力cookie错误：${res.message}`);

    if (res.message == "Please login") {
      Bot.logger.mark(`体力cookie已失效`);

      if (NoteCookie[e.user_id]) {
        delete NoteCookie[e.user_id];
        saveJson();
      }
    } else {
      Bot.logger.mark(`体力cookie错误:${JSON.stringify(res)}`);
    }

    return true;
  }

  //redis保存uid
  redis.set(`genshin:uid:${e.user_id}`, uid, { EX: 2592000 });

  //更新
  if (NoteCookie[e.user_id]) {
    NoteCookie[e.user_id].maxTime = new Date().getTime() + res.data.resin_recovery_time * 1000;
    saveJson();
  }

  let data = res.data;

  //推送任务
  if (e.isTask && data.current_resin < 120) {
    return;
  }

  let nowDay = new Date().Format("dd");
  let resinMaxTime;
  if (data.resin_recovery_time > 0) {
    resinMaxTime = new Date().getTime() + data.resin_recovery_time * 1000;
    let maxDate = new Date(resinMaxTime);
    resinMaxTime = maxDate.Format("HH:mm");

    if (maxDate.Format("dd") != nowDay) {
      resinMaxTime = `明天 ${resinMaxTime}`;
    } else {
      resinMaxTime = ` ${resinMaxTime}`;
    }
  }

  let remained_time = "";
  if (data.expeditions && data.expeditions.length >= 1) {
    remained_time = lodash.map(data.expeditions, "remained_time");
    remained_time = lodash.min(remained_time);

    if (remained_time > 0) {
      remained_time = new Date().getTime() + remained_time * 1000;
      let remainedDate = new Date(remained_time);
      remained_time = remainedDate.Format("HH:mm");

      if (remainedDate.Format("dd") != nowDay) {
        remained_time = `明天 ${remained_time}`;
      } else {
        remained_time = ` ${remained_time}`;
      }
    }
  }

  let coinTime = "";
  if (data.home_coin_recovery_time > 0) {
    let coinDay = Math.floor(data.home_coin_recovery_time / 3600 / 24);
    let coinHour = Math.floor((data.home_coin_recovery_time / 3600) % 24);
    let coinMin = Math.floor((data.home_coin_recovery_time / 60) % 60);
    if (coinDay > 0) {
      coinTime = `${coinDay}天${coinHour}小时${coinMin}分钟`;
    } else {
      let coinDate = new Date(new Date().getTime() + data.home_coin_recovery_time * 1000);
      if (coinDate.Format("dd") != nowDay) {
        coinTime = `明天 ${coinDate.Format("HH:mm")}`;
      } else {
        coinTime = coinDate.Format("HH:mm");
      }
    }
  }

  let day = new Date().Format("MM-dd HH:mm");
  let week = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  day += " " + week[new Date().getDay()];

  let base64 = await render(
    "genshin",
    "dailyNote",
    {
      save_id: uid,
      uid: uid,
      resinMaxTime,
      remained_time,
      coinTime,
      day,
      ...data,
    },
    "png"
  );

  if (base64) {
    e.reply(segment.image(`base64://${base64}`));
  }
  return true;
}

//绑定cookie
async function bingCookie(e) {
  if (!e.isPrivate || e.img || !e.msg) {
    return false;
  }

  let uid;
  let reg = /[1|2|5][0-9]{8}/g;

  if (reg.test(e.msg) && cookieContext[e.user_id] && !e.msg.includes("ltoken")) {
    uid = e.msg.match(reg)[0];
    e.msg = cookieContext[e.user_id];
  }

  if (!e.msg.includes("ltoken")) {
    return false;
  }

  let cookie = e.msg.replace(/#|\'|\"/g, "");
  let param = cookie.match(/ltoken=([^;]+;)|ltuid=(\w{0,9})|cookie_token=([^;]+;)/g);

  if (!param) {
    e.reply("复制cookie错误\n正确例子：ltoken=***;ltuid=***;");
    return;
  }

  let token = {};
  for (let val of param) {
    let tmp = val.split("=");
    token[tmp[0]] = tmp[1];
  }

  let ltoken = `ltoken=${token["ltoken"]}ltuid=${token["ltuid"]};`;

  //cookie_token转换uid
  if (e.msg.includes("cookie_token=") && !uid) {
    let cookie_token = `cookie_token=${token["cookie_token"]} account_id=${token["ltuid"]};`;
    // ltoken += cookie_token;

    let headers = {
      Cookie: ltoken,
    };

    let url = host + "binding/api/getUserGameRolesByCookie?game_biz=hk4e_cn";

    const response = await fetch(url, { method: "get", headers });
    if (!response.ok) {
      e.reply("米游社接口错误");
      return true;
    }
    const res = await response.json();
    if (res.retcode != 0) {
      e.reply(`cookie错误：${res.message}`);
      return true;
    }
    uid = res.data.list[0].game_uid;
  } else {
    if (!uid) {
      e.reply("请输入你游戏的uid");
      cookieContext[e.user_id] = e.msg;
      return true;
    } else {
      delete cookieContext[e.user_id];
    }
  }

  //调用一次判断cookie是否正确
  const response = await getDailyNote(uid, ltoken);
  if (!response.ok) {
    e.reply("米游社接口错误");
    return true;
  }
  const res = await response.json();

  if (res.retcode == 10104) {
    e.reply(`uid错误，请重新输入`);
    cookieContext[e.user_id] = e.msg;
    return true;
  }

  if (res.retcode != 0 && res.retcode != 10102) {
    e.reply(`cookie错误：${res.message}`);
    Bot.logger.mark(`添加cookie失败:${res.message}`);
    return true;
  }

  Bot.logger.mark(`添加cookie成功:${e.user_id}`);

  // redis.sendCommand(["sadd", `genshin:dailyNote:push`, e.user_id.toString()]);
  let maxTime = new Date().getTime() + 7200 * 1000;

  //保存redis
  NoteCookie[e.user_id] = { uid, cookie: ltoken, isPush: true, maxTime };

  saveJson();

  e.reply(
    `体力配置cookie发送成功\n【#体力】，即可查询\n默认开启推送体力（需要加好友）\n【#角色】，可以查询更多内容\n体力大于120时推送\n关闭请发送#关闭推送`
  );

  return true;
}

//删除cookie
async function delCookie(e) {
  if (e.msg.includes("删除")) {
    if (!NoteCookie[e.user_id]) {
      return true;
    }

    if (cookieContext[e.user_id]) {
      delete cookieContext[e.user_id];
    }

    delete NoteCookie[e.user_id];
    saveJson();

    Bot.logger.mark(`删除cookie:${e.user_id}`);

    e.reply("体力配置cookie已删除");
  }

  if (e.msg.includes("开启")) {
    if (NoteCookie[e.user_id]) {
      NoteCookie[e.user_id].isPush = true;
      saveJson();
      Bot.logger.mark(`开启体力推送:${e.user_id}`);

      e.reply("体力推送已开启");
    } else {
      // e.reply("请先添加cookie");
    }
  }

  if (e.msg.includes("关闭")) {
    if (NoteCookie[e.user_id]) {
      NoteCookie[e.user_id].isPush = false;
      saveJson();
      Bot.logger.mark(`关闭体力推送:${e.user_id}`);
      e.reply("体力推送已关闭");
    } else {
      // e.reply("请先添加cookie");
    }
  }
  return true;
}

async function saveJson() {
  let path = "data/NoteCookie/NoteCookie.json";

  fs.writeFileSync(path, JSON.stringify(NoteCookie, "", "\t"));
}

//体力定时推送
async function DailyNoteTask() {
  //体力大于多少时推送
  let sendResin = 120;
  //推送cd，12小时一次
  let sendCD = 12 * 3600;

  //获取需要推送的用户
  for (let [user_id, cookie] of Object.entries(NoteCookie)) {
    //没有开启推送
    if (!cookie.isPush) {
      continue;
    }

    //今天已经提醒
    let sendkey = `genshin:dailyNote:send:${user_id}`;
    let send = await redis.get(sendkey);
    if (send) {
      continue;
    }

    let e = { user_id, isTask: true };

    e.reply = (msg) => {
      Bot.pickUser(user_id)
        .sendMsg(msg)
        .catch((err) => {
          Bot.logger.mark(`体力推送失败:${user_id}`);
        });
    };

    //判断今天是否推送
    if (cookie.maxTime && cookie.maxTime > 0 && new Date().getTime() > cookie.maxTime - (160 - sendResin) * 8 * 60 * 1000) {
      Bot.logger.mark(`体力推送:${user_id}`);

      redis.set(sendkey, "1", { EX: sendCD });

      await dailyNote(e);
    }
  }
}

//便签
async function getDailyNote(uid, cookie) {
  let { url, headers, query, body } = getUrl("dailyNote", uid);

  headers.Cookie = cookie;

  const response = await fetch(url, { method: "get", headers });
  return response;
}

//便签开关
async function openDailyNote(cookie) {
  let url = host + "game_record/card/wapi/getGameRecordCard?uid=";
  let change_url = host + "game_record/card/wapi/changeDataSwitch";
  let query = "";
  let body = `{"is_public":true,"switch_id":3,"game_id":"2"}`;

  let headers = getHeaders(query, body);
  headers.Cookie = cookie;

  let account_id = cookie.match(/ltuid=(\w{0,9})/g)[0].replace(/ltuid=|;/g, "");

  const res = await fetch(url + account_id, { method: "GET", headers });
  const response = await fetch(change_url, { method: "POST", body, headers });

  return response;
}

//体力帮助
function resinhelp(e) {
  e.reply([
    "电脑：",
    segment.image(`file:///${_path}/resources/help/电脑cookie.png`),
    "安卓手机：",
    segment.image(`file:///${_path}/resources/help/安卓cookie.png`),
  ]);
  setTimeout(() => {
    e.reply(`米游社：https://bbs.mihoyo.com/ys/`);
    e.reply(`代码：javascript:(()=>{prompt('',document.cookie)})();`);
  }, 1000);
  return true;
}

export { dailyNote, bingCookie, delCookie, DailyNoteTask, resinhelp, saveJson };

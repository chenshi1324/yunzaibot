import { segment } from "oicq";
import lodash from "lodash";
import fs from "fs";
import MysUser from "../components/models/MysUser.js";

export const rule = {
  userStat: {
    reg: "^#用户(状态|统计)*$",
    priority: 500,
    describe: "【#管理】查看用户状态汇总统计",
  },
  userCacheReset: {
    reg: "^#重置用户统计*$",
    priority: 500,
    describe: "【#管理】重置用户统计"
  },
  allowUseNoteCookie: {
    reg: "^#使用全部ck*$",
    priority: 500,
    describe: "【#管理】重置用户统计"
  }

};

async function checkAuth(e) {
  if (!await e.checkAuth({ auth: 'admin' })) {
    return false;
  }
  return true;
}


// 统计mysCookies 及 NoteCookie 的状态
export async function userStat(e, { render, Models }) {
  if (!await checkAuth(e)) {
    return true;
  }

  let { MysUser } = Models;
  let uids = await MysUser.getAll();


  let showAll = !e.isGroup;

  let uidCount = 0,
    disable = 0,
    available = 0,
    queryCount = 0,
    canQuery = 0;
  lodash.forEach(uids, (uid) => {
    let count = uid.count;
    uid.process = Math.min(count / 27 * 100, 100).toFixed(2);
    uid.type = parseInt(uid.process / 25);
    canQuery += Math.max(0, 27 - uid.count);
    if (!showAll) {
      uid.uid = hideUid(uid.uid);
    }
    uidCount++;
    if (uid.count > 30) {
      disable++;
    } else {
      available++;
      queryCount += uid.count;
    }
  });

  let base64 = await render("admin", "user-stat", {
    uids,
    uidCount,
    queryCount,
    available,
    disable,
    canQuery,
    noteCount: lodash.size(NoteCookie),
    botCount: lodash.size(BotConfig.mysCookies),
    useNoteCookie: BotConfig.allowUseNoteCookie,
    showAll
  }, "png");
  if (base64) {
    e.reply(segment.image(`base64://${base64}`));
  }
  return true;
}

function hideUid(uid) {
  let str = "" + uid, ret = [];
  for (let idx = 0; idx < 10; idx++) {
    ret.push(idx > 1 && idx < 5 ? "*" : str[idx]);
  }
  return ret.join("")
}

export async function userCacheReset(e, { Models }) {
  if (!await checkAuth(e)) {
    return true;
  }
  let { MysUser } = Models;
  await MysUser._delCache();
  e.reply("用户缓存已刷新...");
  return true;
}

export async function allowUseNoteCookie(e, { Models }) {
  if (!await checkAuth(e)) {
    return true;
  }
  let { MysUser } = Models;

  let configPath = "./config/config.js";
  BotConfig.allowUseNoteCookie = true;
  let str = fs.readFileSync(configPath, "utf8");
  str = str.replace(/allowUseNoteCookie:([^\,]*)/, `allowUseNoteCookie: true`);
  fs.writeFileSync(configPath, str);

  for (let nid in NoteCookie) {
    await MysUser.addNote(NoteCookie[nid], true);
  }

  e.reply("已开启使用所有CK..")
  return true;
}

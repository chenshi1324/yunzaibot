import { segment } from "oicq";
import lodash from "lodash";
import fs from "fs";
import { render, getPluginRender } from "../render.js";
import * as Components from "../components/index.js";

export const rule = {
  userStat: {
    hashMark: true,
    reg: "^#用户(状态|统计)*(uid)*$",
    priority: 500,
    describe: "【#管理】查看用户状态汇总统计",
  },
  userCacheReset: {
    hashMark: true,
    reg: "^#重置用户统计*$",
    priority: 500,
    describe: "【#管理】重置用户统计",
  },
  allowUseNoteCookie: {
    hashMark: true,
    reg: "^#使用全部ck*$",
    priority: 500,
    describe: "【#管理】重置用户统计",
  },
  manPlugins: {
    hashMark: true,
    reg: "^#*(关闭|开启|禁用)功能(.*)$",
    priority: 0,
    describe: "",
  },
  resetMan: {
    hashMark: true,
    reg: "^#重置关闭功能$",
    priority: 1,
    describe: "",
  },
};

if (!fs.existsSync(`./data/closePlugins/`)) {
  fs.mkdirSync(`./data/closePlugins/`);
}

async function checkAuth(e) {
  if (!(await e.checkAuth({ auth: "master" }))) {
    return false;
  }
  return true;
}

// 统计mysCookies 及 NoteCookie 的状态
export async function userStat(e, { render, Models }) {
  if (!(await checkAuth(e))) {
    return true;
  }

  let { MysUser } = Models;
  let uids = await MysUser.getAll();

  let showAll = false;
  if (!e.isGroup && /uid/.test(e.msg)) {
    showAll = true;
  }

  let uidCount = 0,
    disable = 0,
    available = 0,
    queryCount = 0,
    canQuery = 0;
  lodash.forEach(uids, (uid) => {
    let count = uid.count;
    uid.process = Math.min((count / 27) * 100, 100).toFixed(2);
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

  let base64 = await render(
    "admin",
    "user-stat",
    {
      uids,
      uidCount,
      queryCount,
      available,
      disable,
      canQuery,
      noteCount: lodash.size(NoteCookie),
      botCount: lodash.size(BotConfig.mysCookies),
      useNoteCookie: BotConfig.allowUseNoteCookie,
      showAll,
    },
    "png"
  );
  if (base64) {
    e.reply(segment.image(`base64://${base64}`));
  }
  return true;
}

function hideUid(uid) {
  let str = "" + uid,
    ret = [];
  for (let idx = 0; idx < 10; idx++) {
    ret.push(idx > 1 && idx < 5 ? "*" : str[idx]);
  }
  return ret.join("");
}

export async function userCacheReset(e, { Models }) {
  if (!(await checkAuth(e))) {
    return true;
  }
  let { MysUser } = Models;
  await MysUser._delCache();
  e.reply("用户缓存已刷新...");
  return true;
}

export async function allowUseNoteCookie(e, { Models }) {
  if (!(await checkAuth(e))) {
    return true;
  }
  let { MysUser } = Models;

  let configPath = "./config/config.js";
  try {
    let str = fs.readFileSync(configPath, "utf8");
    str = str.replace(/allowUseNoteCookie:([^\,]*)/, `allowUseNoteCookie: true`);
    fs.writeFileSync(configPath, str);
  } catch (e) {
    e.reply("保存配置文件错误，请手工修改config.js allowUseNoteCookie配置项");
  }
  BotConfig.allowUseNoteCookie = true;
  for (let nid in NoteCookie) {
    await MysUser.addNote(NoteCookie[nid], true);
  }
  e.reply("已开启使用所有CK..");
  return true;
}

let mamClose = {};
export async function manPlugins(e) {

  if (!e.isGroup || !e.msg) return;

  if (!e.member.is_admin && !e.isMaster) {
    e.reply("暂无权限，只有管理员才能操作");
    return true;
  }

  if (!mamClose[e.group_id]) {
    mamClose[e.group_id] = [];
  }

  let model = "open",
    tip = "开启",
    tmpCommand = mamClose[e.group_id];
  if (/^#(关闭|禁用)|^关闭|^禁用/.test(e.msg)) {
    model = "close";
    tip = "关闭";
    tmpCommand = GroupCommand[e.group_id];
  }

  //处理消息
  let reg = /(^#(关闭|开启|禁用)|^关闭|^开启|^禁用)功能/g;
  let msg = e.msg.replace(reg, "");
  let etoString = e.toString();
  e.toString = () => etoString.replace(reg, "");
  for (let i in e.message) {
    if (e.message[i].type == "text") {
      e.message[i].text = e.message[i].text.replace(reg, "");
    }
  }

  let setCommand = (i, val) => {
    if (model == "open") {
      mamClose[e.group_id].splice(i, 1);
      GroupCommand[e.group_id].push(val);
      GroupCommand[e.group_id] = lodash.orderBy(GroupCommand[e.group_id], ["priority"], ["asc"]);
    } else {
      GroupCommand[e.group_id].splice(i, 1);
      mamClose[e.group_id].push(val);
      mamClose[e.group_id] = lodash.orderBy(mamClose[e.group_id], ["priority"], ["desc"]);
    }
    save(e.group_id);
    Bot.logger.mark(`功能[${msg}][${val.type}][${val.name}]已${tip}`);
    // e.replyNew(`功能【${msg}】[${val.type}][${val.name}]已${tip}`);
    e.replyNew(`功能【${msg}】已${tip}`);
  };

  e.msg = msg;

  for (let i in tmpCommand) {
    let val = tmpCommand[i];

    //禁用功能
    if (e.groupConfig.disable && e.groupConfig.disable.length > 0) {
      if (lodash.intersection(e.groupConfig.disable, [val.type, `${val.type}.${val.name}`, "all"]).length > 0) {
        continue;
      }
    }

    if (`${val.type}.${val.name}` == msg) {
      setCommand(i, val);
      break;
    }

    if (["admin"].includes(val.type)) continue;
    if (["repeat"].includes(val.name)) continue;

    if (!val.reg || val.reg == "noCheck") {
      e.reply = async (msg) => {};
      let { type, name, _plugin } = val;
      if (_plugin) {
        type = "plugin_" + type;
      }
      try {
        let res = await YunzaiApps[type][name](e, {
          render: _plugin ? getPluginRender(_plugin) : render,
          ...Components,
        });

        if (res) {
          setCommand(i, val);
          break;
        }
      } catch (error) {
        Bot.logger.error(`${type}.${name}`);
        Bot.logger.error(error);
        break;
      }
    } else {
      if (new RegExp(val.reg).test(msg)) {
        setCommand(i, val);
        break;
      }
    }
  }

  return true;
}

export async function resetMan(e) {

  if (!e.isGroup || !e.msg) return;

  if (!e.member.is_admin && !e.isMaster) {
    e.reply("暂无权限，只有管理员才能操作");
    return true;
  }

  let path = `./data/closePlugins/${e.group_id}.json`;
  if (!fs.existsSync(path)) {
    return true;
  }

  fs.unlinkSync(path);

  initGroupCommand(e.group_id);

  e.reply("已重置所有关闭功能");

  return true;
}

function save(group_id) {
  let path = `./data/closePlugins/${group_id}.json`;
  fs.writeFileSync(path, JSON.stringify(mamClose[group_id], "", "\t"));
}

export function initGroupCommand(group_id) {
  let json = `./data/closePlugins/${group_id}.json`;

  if (!fs.existsSync(json)) {
    mamClose[group_id] = [];
  } else {
    mamClose[group_id] = JSON.parse(fs.readFileSync(json, "utf8"));
  }

  upGroupCommand(group_id);
}

export function upGroupCommand(group_id) {
  let tmp = command;

  tmp = tmp.filter((item) => {
    for (let v of mamClose[group_id]) {
      if (v.type == item.type && v.name == item.name) {
        return false;
      }
    }
    return true;
  });

  GroupCommand[group_id] = tmp;
}

export function uphotLoad() {
  for (let i in mamClose) {
    upGroupCommand(i);
  }
}

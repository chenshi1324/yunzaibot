/*
* User Class
* 提供用户实例相关的操作方法
*
* * TODO：将与具体用户操作相关的方法逐步迁移到User Model中，外部尽量只调用实例方法
*    以确保逻辑收敛且维护性更强
* */
import BaseModel from "./BaseModel.js"
import lodash from "lodash";
import { Data } from "../index.js";
import { segment } from "oicq";

//import BotUser from "./BotUser.js";


const userInstanceReclaimTime = 60;
let userMap = {};
const _path = process.cwd();

// Redis相关操作方法
const Cache = {
  prefix: "genshin",
  async get(type, key) {
    return await redis.get(`${Cache.prefix}:${type}:${key}`);
  },
  async set(type, key, val, exp = 2592000) {
    return await redis.set(`${Cache.prefix}:${type}:${key}`, val, { EX: exp });
  },
  async del(type, key) {
    return await redis.del(`${Cache.prefix}:${type}:${key}`);
  }
};

const saveCookieFile = function () {
  Data.writeJson("./data/NoteCookie/", "NoteCookie", NoteCookie);
};

/* User Class Model

* 所有用户实例均可调用实例方法
* */
class User extends BaseModel {

  // 初始化用户
  constructor(ds, returnBot = true) {
    super();
    if (returnBot && ds.botId) {
      //return new BotUser(ds);
    }

    let id;
    if (lodash.isPlainObject(ds)) {
      id = ds.id;
    } else {
      id = ds;
    }
    // 一个id对应一个用户，根据id检索用户信息
    this.id = id;

    if (ds.cookie) {
      this._cookie = cookie;
    }

    // 检索是否存在NoteCookie信息
    let data = NoteCookie[id];

    if (data) {
      this._data = data;
      this.uid = data.uid;
    } else {
      this._data = {};
    }
  }

  // 是绑定的cookie用户
  // 需要存在NoteCookie记录且存在 cookie 与 uid 才认为是正确记录
  get isBind() {
    let noteData = NoteCookie[this.id];
    return !!(noteData && noteData.cookie && noteData.uid);
  }

  // 是否是管理员
  get isMaster() {
    return !this.isBot && BotConfig.masterQQ && BotConfig.masterQQ.includes(Number(this.id));
  }

  get isBot() {
    return false;
  }

  // 获取当前用户cookie
  get cookie() {
    return this._cookie || this._data.cookie;
  }

  set cookie(cookie) {
    this._cookie = cookie;
  }

  get id() {
    if (!this._id) {
      this._id = genId(this, true)
    }
    return this._id;
  }

  set id(id) {
    this._id = id;
  }


  // 获取当前用户uid
  get uid() {
    return this._uid || this._data.uid || this._reg_uid;
  }

  set uid(uid) {
    this._uid = uid;
    this._reg_uid = uid;
  }

  save() {
    // 暂不实现，User暂不操作信息
  }

  // 暂不实现
  del() {
    this.delCache();
    redis.delete(`cache:uid-cookie:${uid}`);
    delete NoteCookie[this.id];
    this.delSourceUser();
  }

  // 设置&更新用户缓存
  refreshCache() {
    Cache.set("id-uid", this.qq, this.uid);
    Cache.set("uid-id", this.uid, this.id);
    Bot.logger.mark(`绑定用户：QQ${this.id},UID${this.uid}`);
  }

  // 删除用户缓存
  delCache() {
    Cache.del("id-uid", this.id);
    Cache.del("uid-id", this.uid);

    // todo，删除以当前用户为sourceUser的记录
  }


  // 获取曾经查询过当前用户的人
  async getSourceUser() {
    let lastQuery = await Cache.get("id-source", this.id);
    if (lastQuery) {
      return User.get(lastQuery);
    }
    return false;
  }

  // 设置曾经查询过当前用户的人，缓存23小时
  setSourceUser(user) {
    Cache.set("id-source", this.id, user.id, 3600 * 23);
  }

  // 删除曾经查询过当前用户的人
  delSourceUser() {
    Cache.del("id-source", this.id);
  }


  /* 获取当前用户注册的uid
  *
  * 1. 如果是绑定用户，优先返回当前绑定的uid（cookie 对应uid）
  * 2. 返回redis中存储的uid
  *
  * 注：redis uid需要主动调用一次 getRegUid 才能被this.uid访问到
  *
  * */
  async getRegUid() {
    if (this.isBind) {
      return this.uid;
    }
    if (!this._reg_uid) {
      let uid = await Cache.get('id-regUid', this.id);
      if (uid) {
        this._reg_uid = uid;
      }
    }
    return this._reg_uid;
  }

  async setRegUid(uid) {
    // 只有非绑定用户才设置 注册uid
    if (!this.isBind) {
      this._reg_uid = uid;
      Cache.set('id-regUid', this.id, uid);
      Cache.set('regUid-id', this.uid, this.id);
    }
  }
}


/* User static function */

/*
* 获取用户实例
* query为获取条件，默认为 id
*
* */
User.get = async function (query, allowDraft = false) {
  let user = await getUser(query, allowDraft);
  if (!user) {
    return false;
  }
  user._reclaimFn && clearTimeout(user._reclaimFn);
  user._reclaimFn = setTimeout(() => {
    delete userMap[user.id];
  }, userInstanceReclaimTime);
  userMap[user.id] = user;

  return user;
};

// 格式化查询
const formatQuery = function (query) {
  if (typeof (query) === "string" || typeof (query) === "number") {
    return { id: query };
  }
  return query;
};

const getUser = async function (query, allowDraft = false) {
  query = formatQuery(query);


  let id = "";
  // 根据id获取用户
  if (query.id) {
    id = query.id;
  } else if (query.uid) {
    // 根据uid检索id
    id = await Cache.get("uid-id", query.uid);
    if (!id) {
      // 如未查找到，则从注册uid中检索
      id = await Cache.get("regUid-id", query.uid)
    }
  } else if (query.token) {
    // 根据token检索id
    // 不常用，仅用在机器人绑定环节
    id = await Cache.get("token-id", query.token);
  }

  if (!id) {
    id = genId(query);
  }

  // 已有实例优先使用已有的
  if (userMap[id]) {
    return userMap[id];
  }

  // 如果是注册用户，则返回新instance
  if (NoteCookie[id]) {
    return new User(id);
  }

  // 如果允许返回Draft，则生成并返回
  if (allowDraft) {
    return getDraft(query);
  }

  // 未查询到用户则返回false
  return false;
}

const genId = function (target, isGen = false) {
  let id = '';
  if (!isGen && target.id) {
    id = target.id;
  } else if (target.uid) {
    id = '_UID_' + target.uid;
  } else if (target.botId) {
    id = "_BOT_" + target.botId;
  } else if (target.token) {
    let ret = /ltuid=(\w{0,9})/.match(target.token);
    if (ret[1]) {
      id = "_CK_" + ret[1];
    } else {
      id = "_CK2_" + target.token.slice(7, 20);
    }
  }
  return id;
}

const getDraft = function (query) {
  let id = genId(query)
  let user = new User(id);
  user.id = query.id;
  user.uid = query.uid;
  return user;
}

/*
* 在文本中检索uid，若未查找到则返回false
* */
User.matchUid = function (msg) {
  let ret = /[1|2|5][0-9]{8}/g.exec(msg);
  if (ret) {
    return ret[0];
  }
  return false;
};

/*
* 返回需要绑定 cookie
*
* */
User.replyNeedBind = function (e, replyMsg = "") {
  replyMsg = replyMsg || `您尚未绑定米游社cookie，无法进行操作`;
  let helpMsg = "获取cookie后发送至当前聊天窗口即可，Cookie获取方式：https://docs.qq.com/doc/DUWNVQVFTU3liTVlO";

  if (e.isGroup) {
    replyMsg = segment.image(`file:///${_path}/resources/help/help.png`);
    e.reply([replyMsg, helpMsg]);
  } else {
    e.reply(replyMsg);
    e.reply(helpMsg);
  }
  return false;
};

/*
* 获取请求的当前用户
* */
User.getSelfUser = async function (e) {
  if (e.selfUser) {
    return e.selfUser;
  }
  return await User.get(e);
}

/*
* 获取当前用户消息所查询的目标用户
*
* 策略：优先级依次递减
* 1. 消息里包含 uid
* 2. 存在 msg.at，且msg.at 用户 是绑定用户
* 3. 存在 msg.at 且msg.at 名片包含uid
* 4. 当前用户为绑定用户
* 5. 当前用户名片包含 uid
* 6. 当前用户存在redis-uid 缓存
* */
User.getTargetUser = async function (e, selfUser) {
  if (e.targetUser) {
    return e.targetUser;
  }
  let targetUid, targetUser;

  /*-- 有指定的查询目标 --*/

  /* 消息里包含 uid的话优先匹配 */
  if (e.msg) {
    targetUid = User.matchUid(e.msg);
    if (targetUid) {
      // 根据targetId查找用户
      targetUser = await User.get({ uid: targetUid });
      //存在则返回，不存在则将该uid绑定至当前用户
      if (targetUser) {
        return targetUser;
      }

      // 当前用户未注册，则将uid绑定至当前用户
      if (!selfUser.isBind || selfUser.uid == targetUid) {
        await selfUser.setRegUid(targetUid)
        return selfUser;
      } else {
        // 当前用户为注册用户，返回 Draft
        return User.get({ uid: targetUid }, true)
      }
    }
  }

  // 如果有at的用户，使用被at的用户
  if (!targetUid && e.at && e.at != BotConfig.account.qq) {
    targetUser = await User.get(e.at);

    if (!targetUser) {
      // 识别at用户的名片结果。如果at用户无uid信息则使用此结果
      if (e.at.card) {
        targetUid = User.matchUid(e.at.card.toString());
        targetUser = await User.get({ uid: targetUid });
      }
    }
  }

  if (targetUser && targetUid) {
    await targetUser.setRegUid(targetUid);
  }

  // 使用当前用户作为targetUser
  if (!selfUser.isBind) {
    // 从当前用户的昵称中匹配uid
    targetUid = User.matchUid(e.sender.card.toString());
    if (targetUid) {
      await selfUser.setRegUid(targetUid);
    }
  }
  return selfUser;
};

/*
* 获取当前 MysApi 的最佳查询User
*
* 策略，优先级依次递减 （ sUid 在下方代指被查询的Uid ）
* 1. 如果 sUid 为绑定用户，优先使用绑定用户自身的 cookie（ 在不允许跨系统调用时需传递 allowCrossUid = false )
* 2. 如果 sUid 24小时内被查询过，优先使用曾经查询过该用户的 cookie
* 3. 如果 当前查询用户为绑定用户，优先使用绑定用户自身的 cookie
* 4. 使用系统cookie : 暂未接管bot逻辑，目前需要传入getBotCookie方法
*
* */
User.getReqUser = async function (e, allowCrossUser = true, getBotCookie = false) {

  if (e.reqUser) {
    return e.reqUser;
  }
  // 当前用户
  let selfUser = e.selfUser || await User.get(e.user_id);
  // 被查询用户
  let targetUser = e.targetUser || await User.getTargetUser(e, selfUser);

  if (!targetUser) {
    return selfUser;
  }

  // 如果 sUid 为绑定用户，优先使用绑定用户自身的 cookie
  if (targetUser.isBind && allowCrossUser) {
    return targetUser;
  }

  // 如果 sUid 24小时内被查询过，优先使用曾经查询过该用户的 cookie
  let lastQueryUser = await targetUser.getSourceUser();
  if (lastQueryUser) {
    return lastQueryUser;
  }

  // 如果 当前查询用户为绑定用户，优先使用绑定用户自身的 cookie
  if (selfUser.isBind) {
    await targetUser.setSourceUser(selfUser);
    return selfUser;
  }

  if (BotConfig.strictCookieMode) {
    return selfUser;
  } else {
    return User.getAvailableBot(e, targetUser.uid)
  }

};


async function limitGet(e) {
  if (!e.isGroup) {
    return true;
  }

  if (e.isMaster) {
    return true;
  }

  let key = `genshin:limit:${e.user_id}`;
  let num = await redis.get(key);

  if (num && num >= e.groupConfig.mysDayLimit - 1) {
    let name = lodash.truncate(e.sender.card, { length: 8 });
    e.reply([segment.at(e.user_id, name), "\n今日查询已达上限"]);
    return false;
  }

  return true;
}

/*
* 对当前用户的类型进行检查，并对不符合条件的用户进行回复
* type: all-不检查，bind-绑定用户（设置了有效的NoteCookie），master-管理员
* replyMsg：不符合条件的消息
* */
User.checkAuth = async function (e, type = "all", checkParams = {}) {

  let self = e.selfUser;

  let { limit = true, action, replyMsg } = checkParams;

  // 校验频度限制
  if (limit) {
    if (!(await limitGet(e))) return true;
  }

  switch (type) {
    case 'bind':
      // 需要是绑定用户
      if (!self.isBind) {
        if (!replyMsg) {
          action = action || "进行操作";
          replyMsg = "您尚未绑定米游社cookie，无法" + action;
        }
        User.replyNeedBind(e, replyMsg);
        return false;
      }
      break;
    case 'master':
      if (!self.isMaster) {
        // 如果主动传递了replyMsg则进行回复，否则静默
        if (replyMsg) {
          e.reply(replyMsg)
        }
        return false;
      }

    case 'all':
      //不检查权限
      return self;
    default:
      return false;
  }
  return self;
};

User.getAvailableBot = function (e, uid) {
  //BotUser.getAvailableBot.apply(e, uid);
}


export default User;

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
import MysUser from "./MysUser.js";

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
  get isCookieUser() {
    let noteData = NoteCookie[this.id];
    return !!(noteData && noteData.cookie && noteData.uid);
  }

  get isUidUser() {
    return !!this.uid;
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
    redis.del(`cache:uid-cookie:${uid}`);
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


  async getMysUser() {
    return MysUser.get(this.uid, this.cookie)
  }

  async limitSet() {

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
    if (this.isCookieUser) {
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
    if (!this.isCookieUser) {
      this._reg_uid = uid;
      Cache.set('id-regUid', this.id, uid);
      Cache.set('regUid-id', this.uid, this.id);
    }
  }

  async getRegMysUser() {
    if (this.isCookieUser) {
      // 有cookie记录优先用cookie记录
      return await MysUser.get(this.uid, this.cookie);
    }

    if (this.isUidUser) {
      return await MysUser.get(this.uid);
    }

    // todo: await redis.get("")
  }

  /*
  * 注册当前用户的mys user
  * 绑定的uid为弱关联。如果用户存在cookie记录，则优先使用cookie的关系
  * force : 默认false，如果当前存在记录则不更新，true则进行覆盖式更新
  * */
  regMysUser(mysUser, force = false) {

    // todo
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


export default User;

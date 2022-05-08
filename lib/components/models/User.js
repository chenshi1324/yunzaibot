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
import fs from "fs";


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

// 用户与uid的绑定关系，弱绑定
const queryKey = "genshin:id-query";

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
    return this._uid || this._data.uid;
  }

  set uid(uid) {
    this._uid = uid;
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

  async getCache() {
    return await Cache.get("id-uid", this.id);
  }

  // 设置&更新用户缓存
  async refreshCache() {
    // 与QQ用户相关的缓存刷新逻辑均放置在此
    await Cache.set("id-uid", this.id, this.uid);

    await redis.set(`genshin:uid:${this.id}`, this.uid, { EX: 2592000 });
    await redis.del(`cache:uid-talent-new:${this.uid}`);//删除技能列表缓存

    Bot.logger.mark(`绑定用户：QQ${this.id},UID${this.uid}`);
  }

  // 删除用户缓存
  delCache() {
    Cache.del("id-uid", this.id);
  }

  /* 获取当前用户关联的MysUser
  *
  * 若存在Cookie绑定则优先使用Cookie对应UID
  * 否则去缓存中去取绑定uid
  * */
  async getMysUser() {
    if (this.isCookieUser) {
      return MysUser.get(this.uid, this.cookie);
    }
    //旧的uid绑定key是genshin:uid:qq号
    let uid = await Cache.get('id-uid', this.id) || await Cache.get('uid', this.id);
    if (uid) {
      return MysUser.get(uid);
    }
    return false;
  }

  async limitSet() {

  }

  // 记录用户的请求记录
  async addQuery(uid) {
    await redis.sAdd(`${queryKey}:${this.id}`, uid + '');
    await redis.expire(`${queryKey}:${this.id}`, getDayEnd());
  }

  // 检查当前用户的请求是否超限
  async checkLimit(limit = 15) {
    // 绑定了Cookie的用户不进行拦截
    if (this.isCookieUser) {
      return true;
    }
    let queryList = await redis.sMembers(`${queryKey}:${this.id}`) || [];
    return queryList.length <= limit;
  }


  /* 注册当前用户的mys user
  * 绑定的uid为弱关联。如果用户存在cookie记录，则优先使用cookie的关系
  *
  * force : 如果当前存在记录则不更新，true则进行覆盖式更新
  * 正常查询默认force = false，主动绑定uid则force = true
  * */
  async regMysUser(mysUser, force = false) {
    let currUid = await Cache.get('id-uid', this.id);
    if (!currUid || force) {
      await Cache.set('id-uid', this.id, mysUser.uid);
    }
  }

  /*
  * 当前账户绑定MysUser，绑定Cookie用户
  * */
  async bindMysUser(mysUser) {

    if (!mysUser.uid || !mysUser.cookie) {
      return false;
    }

    // 保存当前UID
    let original = NoteCookie[this.id];
    if (original) {
      if (original.uid !== mysUser.uid) {
        original.qq = this.id;
        NoteCookie[`uid${original.uid}`] = original;
      }
    }

    // 设置新的UID
    let target = NoteCookie[`uid${mysUser.uid}`] || {};
    delete NoteCookie[`uid${mysUser.uid}`];
    NoteCookie[this.id] = {
      uid: mysUser.uid,
      qq: this.id,
      cookie: mysUser.cookie,
      isPush: target.isPush !== false, // 默认为true
      isSignPush: true, // 默认为true
      maxTime: new Date().getTime() + 7200 * 1000
    }
    User.saveNoteCookie();
    this.uid = mysUser.uid;
    this.cookie = mysUser.cookie;
    await mysUser.setCache(!!BotConfig.allowUseNoteCookie);
    await this.refreshCache();
    Bot.logger.mark(`添加体力cookie成功, qq:${this.id}，uid:${mysUser.uid}`);
    return this;
  }

  /*
  * 获取当前用户绑定的所有 MysUser
  * */
  async getAllMysUser() {
    let ret = [];
    let notes = lodash.filter(NoteCookie, (note, qq) => note.qq == this.id || qq == this.id);
    await lodash.forEach(notes, async (note) => {
      let mUser = await MysUser.get(note.uid, note.cookie);
      ret.push(mUser)
    })
    ret = ret.sort((a, b) => a - b);
    return ret;
  }


  // 保存用户配置
  async setCfg(path, value) {
    let userCfg = await Cache.get("user-cfg", this.id);
    userCfg = userCfg ? JSON.parse(userCfg) : {};
    lodash.set(userCfg, path, value);
    await Cache.set("user-cfg", this.id, JSON.stringify(userCfg));
  }

  // 获取用户配置
  async getCfg(path, defaultValue) {
    let userCfg = await Cache.get("user-cfg", this.id);
    userCfg = userCfg ? JSON.parse(userCfg) : {};
    return lodash.get(userCfg, path, defaultValue);
  }
}


/* User static function */

/*
* 获取用户实例
* query为获取条件，默认为 id
*
* */
User.get = async function (query) {
  let user = await getUser(query);
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

const getUser = async function (query) {
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
  let user = new User(id);
  user.id = query.id;
  user.uid = query.uid;
  return user;
}

const genId = function (target, isGen = false) {
  let id = '';
  if (!isGen && target.id) {
    id = target.id;
  } else if (target.uid) {
    id = '_UID_' + target.uid;
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

User.saveNoteCookie = function () {
  let path = "data/NoteCookie/NoteCookie.json";
  fs.writeFileSync(path, JSON.stringify(NoteCookie, "", "\t"));
}

function getDayEnd() {
  let now = new Date();
  let dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), "23", "59", "59").getTime() / 1000;
  return dayEnd - parseInt(now.getTime() / 1000);

}


export default User;

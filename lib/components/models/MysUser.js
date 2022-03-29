import BaseModel from "./BaseModel.js"
import lodash from "lodash";

const countKey = "genshin:uid-query-count";
const detailKey = "genshin:uid-query-detail";
const statusKey = "genshin:uid-query-status";
const delKey = "genshin:uid-del-detail";
const cookieKey = "genshin:uid-ck";

const ltUid = function () {

}

class MysUser extends BaseModel {
  constructor(uid, cookie) {
    super();
    this.uid = uid;
    this.cookie = cookie;
  }

  toString() {
    return this.uid;
  }

  get uid() {
    return this._uid || 0;
  }

  set uid(uid) {
    this._uid = uid;
  }

  // 向当前mysUser增加对uid的请求记录
  async addQuery(uid) {
    await redis.zAdd(detailKey, { score: this.uid, value: uid });
    // console.log(`用户:${this.uid} 请求 ${uid} 成功`);
    await this.refreshQueryCount();
  }

  // 本次请求失败，将增加的请求记录删除
  // 并将当前mysUser置为超限，不在分配新的请求（请求过的uid仍有效）
  async addQueryError(uid) {
    //await redis.zScore(countKey, uid);
    await redis.zRem(detailKey, uid);
    // console.log(`标记请求错误，删除UID：${this.uid}对账号UID：${uid}的查询记录`);

    // 如果请求失败，则将自身置为不可用
    await redis.zAdd(countKey, { score: 99, value: this.uid });
    // console.log(`将账号UID：${this.uid}标记为不可用`);
  }

  /*
  * 获取当前用户请求过的uid列表
  *
  * retType: normal uid的列表 [12345, 67890]
  * retType: set sorted set 格式 [{score: this.uid, value: 12345}, {sorce:this.uid, value:67890}]
  * */
  async getQueryList(retType = 'normal') {
    let history = await redis.zRangeByScore(detailKey, this.uid, this.uid);
    if (retType === 'normal') {
      return history;
    }
    let ret = [];
    for (let value of history) {
      ret.push({ score: this.uid, value });
    }
    return ret;
  }

  /*
  * 获取当前MysUser查询uid的个数
  *
  * calc：false为使用缓存，calc为直接计算
  * */
  async getQueryCount(calc = false) {

    if (!calc) {
      let count = await redis.zScore(countKey, this.uid);
      return count || 0;
    }

    let queryList = await redis.zRangeByScore(detailKey, this.uid, this.uid);
    return queryList ? queryList.length : 0;
  }

  /*
  *  更新当前用户计数缓存
  * force: 忽略无效，强制更新
  * */
  async refreshQueryCount(force = false) {
    // 检查当前uid是否超限
    let currCount = await this.getQueryCount();
    if (currCount > 30 && !force) {
      return;
    }

    // 从detail记录中查找记录并进行更新
    let queryCount = await this.getQueryCount(true);
    await redis.zAdd(countKey, { score: queryCount, value: this.uid });
    // console.log(`UID:${this.uid} 记录刷新, 计数：${queryList.length}, 已请求UID[ ${queryList.join(', ')} ]`);
  }

  /* 设置当前用户的缓存数据，初始化
  * setToQueryPool : 是否将当前MysUser加到查询池中
  * */
  async setCache(setToQueryPool = false) {

    // 设置当前Uid的记录
    await redis.zAdd(detailKey, { score: this.uid, value: this.uid });

    // 设置当前Uid的Cookie缓存记录
    if (this.cookie) {
      await redis.set(`${cookieKey}:${this.uid}`, this.cookie, { EX: 3600 * 24 * 30 });
    }

    // 从删除记录中查找并恢复查询记录
    let cacheSearchList = await redis.zRangeByScore(delKey, this.uid, this.uid);

    // 这里不直接插入，只插入当前查询记录中没有的值
    if (cacheSearchList) {
      for (let searchedUid of cacheSearchList) {
        // 检查对应uid是否有新的查询记录
        let sourceUid = await redis.zScore(detailKey, searchedUid);
        // 如无新的查询记录，则恢复与当前UID的查询记录关系
        if (!sourceUid) {
          await redis.zAdd(detailKey, { score: this.uid, value: searchedUid })
        }
      }
    }

    // 将当前记录增加至查询计数缓存中
    if (setToQueryPool) {
      let queryList = await redis.zRangeByScore(detailKey, this.uid, this.uid);
      await redis.zAdd(countKey, { score: queryList.length, value: this.uid });
      // console.log(`UID:${this.uid} 记录刷新, 计数：${queryList.length}, 已请求UID[ ${queryList.join(', ')} ]`);
    }
  }

  /*
  * 清空当前用户的cache记录
  * */
  async delCache() {
    // 将统计中的该用户标记为为失效
    await redis.zAdd(countKey, { score: 99, value: this.uid });

    // 获取用户已经请求的记录，缓存至今日结束
    // 如果今日内用户重新绑定，则恢复请求的uid列表
    let queryUidList = await this.getQueryList('set');
    await redis.zAdd(delKey, queryUidList);

    // 在detail中删除用户已经请求的UID记录
    await redis.zRemRangeByScore(detailKey, this.uid, this.uid);

    // console.log(`UID:${this.uid}已失效，删除所有请求记录`);
  }

  /*
  * 删除当前 MysUser 记录
  * */
  async del() {
    // 清除缓存记录
    await this.delCache();
  }
}

// 初始化检查
MysUser.init = async function (uids, updateStat = false) {
  // 检查 redis 记录状态，如果超时或未设置则进行初始化
  let status = await redis.get(statusKey);
  if (status) {
    return true;
  }
  Bot.logger.mark(`MysUser缓存失效，重建缓存...`);
  // 删除所有MysUser缓存
  await MysUser._delCache();


  // 重新构建NoteCookie用户的缓存
  for (let ckCfg of NoteCookie) {
    let mUser = await MysUser.get(ckCfg.uid, ckCfg.cookie);
    await mUser.setCache(true);
  }

  // 设置BotConfig.mysCookies机器人Cookie
  for (let cookie of BotConfig.mysCookies) {
    let mUser = await MysUser.get(false, cookie);
    await mUser.setCache(true);
  }

  //todo: day end
  await redis.set(statusKey, true, { EX: 3600 * 24 });
  Bot.logger.mark(`MysUser缓存重建完成...`);

};

MysUser.get = async function (uid, cookie = '') {
  let mUser;
  if (uid) {
    if (!cookie) {
      cookie = await redis.get(cookieKey, uid);
    }
    return new MysUser(uid, cookie);
  }

  return new MysUser(uid);
};

// 删除指定 uid 记录
MysUser.del = async function (uid) {
  let mUser = await MysUser.get(uid);
  mUser.del();
};

// 获取最佳请求uid
MysUser.getQueryUser = async function (uid) {
  let reqUid = await redis.zScore(detailKey, uid);
  if (reqUid) {
    // 查找到则返回
    // console.log(`目标UID：${uid},【已存在查询记录】：使用上一次查询过的Cookie UID：${reqUid}`)
    return reqUid;
  }
  let bestUid = await redis.zRangeByScore(countKey, 0, 27, true);
  let best = bestUid[0];
  // let count = await new MysUser(best).getQueryCount();
  // console.log(`目标UID：${uid},【新查询】：分配当前使用次数最少的CookieUID：${best}, 查询次数${count}`);
  //console.log('avaliable bestuid', bestUid);
  return await MysUser.get(best);
};

// 删除全部缓存
MysUser._delCache = async function () {
  await redis.expire(statusKey, 0);
  await redis.del(detailKey);
  await redis.del(countKey);
  await redis.del(delKey);
};

// 添加Cookie
MysUser.addCookie = async function (cookie) {

};

export default MysUser;

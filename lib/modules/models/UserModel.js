/*
* UserModel Class
* 提供用户实例相关的操作方法
*
* * TODO：将与具体用户操作相关的方法逐步迁移到UserModel中，外部尽量只调用实例方法
*    以确保逻辑收敛且维护性更强
* */

import { segment } from "oicq";
import fs from "fs";
import fetch from "node-fetch";
import lodash from "lodash";
import { MysApi } from "../index.js"

const _path = process.cwd();
const cookieFilePath = "data/NoteCookie/NoteCookie.json";

const redisPrefix = "cache";

// Redis相关操作方法
const Cache = {
  async get(type, key) {
    return await redis.get(`${redisPrefix}:${type}:${key}`);
  },
  async set(type, key, val, exp = 2592000) {
    return await redis.set(`${redisPrefix}:${type}:${key}`, val, { EX: exp });
  },
  async del(type, key) {
    return await redis.del(`${redisPrefix}:${type}:${key}`);
  },
};

const Data = {
  async save() {
    return fs.writeFileSync(cookieFilePath, JSON.stringify(NoteCookie, "", "\t"));
  },
};

// UserModel class
class UserModel {

  // 初始化用户
  constructor(qq) {
    // 一个qq对应一个用户，根据qq检索用户信息
    this.qq = qq;

    // 检索是否存在NoteCookie信息
    let data = NoteCookie[qq];

    if (data) {
      this._data = data;

      this.isPush = data.isPush;
      this.isSignAuto = data.isAutoSign;
      this.isAutoSign = data.isAutoSign;
    } else {
      this._data = "";
    }

  }

  // 是否是绑定cookie用户
  get isBind() {
    return !!NoteCookie[this.qq];
  }

  // 是否是管理员
  get isMaster() {

  }

  // 获取当前用户cookie
  get cookie() {
    return this._data.cookie;
  }

  // 获取当前用户uid
  get uid() {
    return this._data.uid;
  }

  // 保存用户信息
  async _save() {
    let data = NoteCookie[this.qq] || this._data || {};
    console.log('__save', data)
    // 将信息更新至 NoteCookie
    data.isPush = this.isPush;
    data.isAutoSign = !!this.isAutoSign;
    data.cookie = this._cookie || this._data.cookie;
    data.uid = this._uid || this._data.uid;
    NoteCookie[this.qq] = data;
    this._data = data;
    await Data.save();

    // 建立当前用户相关缓存
    this.refreshCache();
    return this;
  }

  // 删除用户
  async _del() {
    delete NoteCookie[this.qq];
    await Data.save();
    // 删除用户缓存
    this.delCache();
    Bot.logger.mark(`解绑用户：QQ${this.qq},UID${this.uid}`);
  }

  // 更新用户缓存
  async refreshCache() {
    // 设置缓存
    await Cache.set('qq-uid', this.qq, this.uid);
    await Cache.set('uid-qq', this.uid, this.qq);
    Bot.logger.mark(`绑定用户：QQ${this.qq},UID${this.uid}`);
  }

  // 删除用户缓存
  async delCache() {
    await Cache.del("qq-uid", this.qq);
    await Cache.del("uid-qq", this.uid);
  }

  // 解绑用户
  async unbind() {
    // 删除用户JSON记录
    return await this._del();
  }

  async bindCookie(uid, cookie, params) {
    // 调用一次判断cookie及uid是否正确
    let self = this;
    await MysApi.request("dailyNote", {
      uid,
      cookie,
      error: async (retcode, res) => {
        if (retcode === 10104) {
          cookieContext[qq] = cookieStr;
          Bot.logger.mark(`uid错误，请重新输入:${res.message}`);
          throw `uid错误，请重新输入`;
        }

        if (retcode !== 10102) {
          Bot.logger.mark(`添加cookie失败:${res.message}`);
          throw `cookie错误：${res.message}`;
        }
        throw "米游社接口错误";
      },
      success: async (data) => {
        console.log(this);
        this._uid = uid;
        this._cookie = cookie;
        let { isPush, isSignAuto } = params;
        this.isPush = isPush;
        this.isSignAuto = isSignAuto;
        Bot.logger.mark(`添加cookie成功:${this.qq}`);
        await this._save();
      }
    })

  }


}

/* UserModel static function */

UserModel.find = async function (query) {
  let qq = "";
  if (typeof (query) === "string" || typeof (query) === "number") {
    qq = query;
  }

  if (query.uid) {
    qq = await Cache.get('uid-qq', query.uid);
  }

  if (NoteCookie[qq]) {
    return qq;
  }

  return false;
}

export default UserModel;
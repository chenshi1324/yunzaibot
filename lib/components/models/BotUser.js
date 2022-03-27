import User from "./User.js";
import Data from "../Data.js";

class BotUser extends User {
  constructor(ds) {
    super(ds, false);
    if (ds.botId) {
      this._botId = ds._botId;
    }
  }

  get isBot() {
    return true;
  }

  disableBotToday() {
    redis.set(`genshin:ds:max:${this._botId}`, "1", { EX: Data.getDayEnd() });
  }

}

/*
* 获取可用的机器人，作为UserModel返回
* noticeError： 在无可用机器人时是否 e.reply 错误信息
* */
BotUser.getAvailableBot = async function (e, uid, noticeError = false) {
  // 分配机器人

  if (BotConfig.mysCookies.length <= 0) {
    Bot.logger.error("请打开config.js,配置米游社cookie");
    // { retcode: -300 };
    return false;
  }

  // 获取uid集合
  // 限制一个用户一天查询的uid个数
  let uid_arr = await redis.get(`genshin:ds:qq:${e.user_id}`);

  if (uid_arr) {
    uid_arr = JSON.parse(uid_arr);
    if (!uid_arr.includes(uid)) {
      uid_arr.push(uid);
      await redis.set(`genshin:ds:qq:${e.user_id}`, JSON.stringify(uid_arr), {
        EX: dayEnd,
      });
    }
  } else {
    uid_arr = [uid];
    await redis.set(`genshin:ds:qq:${e.user_id}`, JSON.stringify(uid_arr), {
      EX: dayEnd,
    });
  }

  if (uid_arr.length > e.groupConfig.mysUidLimit && !e.isMaster) {
    // { retcode: -200 };
    return false;
  }


  let isNew = false;
  let index = await redis.get(`genshin:ds:uid:${uid}`);

  if (!index) {
    //获取没有到30次的index
    for (let i in BotConfig.mysCookies) {
      //跳过达到上限的cookie
      if (await redis.get(`genshin:ds:max:${i}}`)) {
        continue;
      }
      let count = await redis.sendCommand(["scard", `genshin:ds:index:${i}`]);
      if (count < 27) {
        index = i;
        break;
      }
    }
    //查询已达上限
    if (!index) {
      // { retcode: -100 };
      return false;
    }
    isNew = true;
  }
  if (!BotConfig.mysCookies[index]) {
    // { retcode: -300 };
    return false;
  }

  if (!BotConfig.mysCookies[index].includes("ltoken")) {
    Bot.logger.error("米游社cookie错误，请重新配置");
    // { retcode: -400 };
    return false;
  }
  let cookie = BotConfig.mysCookies[index];

  if (isNew) {
    await redis.sendCommand(["sadd", `genshin:ds:index:${index}`, uid]);
    redis.expire(`genshin:ds:index:${index}`, dayEnd);
    redis.set(`genshin:ds:uid:${uid}`, index, { EX: dayEnd });
  }

  return User.get({ cookie, botId: index }, true);

};

export default BotUser;
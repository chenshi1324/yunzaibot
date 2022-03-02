/**
 * 发送私聊消息，非好友以临时聊天发送
 * @param user_id qq号
 * @param msg 消息
 */
async function relpyPrivate(user_id, msg) {
  if (Bot.fl.get(user_id)) {
    Bot.pickUser(user_id)
      .sendMsg(msg)
      .catch((err) => {
        Bot.logger.mark(`发送失败[${user_id}]:${JSON.stringify(err)}`);
      });
  } else {
    let key = `Yunzai:group_id:${user_id}`;
    let group_id = await redis.get(key);
    if(!group_id){
      for (let group of Bot.gl) {
        let info = await Bot.getGroupMemberInfo(group[0],user_id).catch((err) => {});
        if (info) {
          group_id = group[0];
          redis.set(key, group_id.toString(), {EX: 1209600});
          break;
        }
      }
    }
    if(group_id){
      let res = await Bot.pickMember(group_id,user_id).sendMsg(msg).catch((err) => {
        Bot.logger.mark(`发送失败[${user_id}]:${JSON.stringify(err)}`);
        redis.del(key);
      });
      if(res) redis.expire(key, 86400 * 15);
    }
  }
}

/**
 * 休眠函数
 * @param ms 毫秒
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 获取今天23:59:59秒的时间戳
 */
function getDayEnd() {
  let now = new Date();
  let dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), "23", "59", "59").getTime() / 1000;

  return dayEnd - parseInt(now.getTime() / 1000);
}

export default { relpyPrivate, sleep, getDayEnd };

import { segment } from "oicq";
import lodash from "lodash";

const _path = process.cwd().trim("\\lib");

function help(e) {
  e.reply(segment.image(`file:///${_path}/resources/help/help.png`));
  return true;
}

//复读机
async function repeat(e) {
  let repeatRand = 70;
  let repeatImgRand = 10; //打断复读概率
  let repeatNum = 5;

  if (!e.isGroup || e.hasReply) {
    return false;
  }

  if (lodash.random(0, 100) > repeatRand) {
    return false;
  }

  let key = `Yunzai:repeat:${e.group_id}`;
  let res = await global.redis.get(key);
  let oldMsg = e.toString();

  if (!res) {
    res = { msgNum: 1, msg: oldMsg, sendMsg: "" };
    await global.redis.set(key, JSON.stringify(res), {
      EX: 3600 * 8,
    });
    return true;
  } else {
    res = JSON.parse(res);
  }

  if (oldMsg == res.msg) {
    res.msgNum++;
  } else {
    res.msg = oldMsg;
    res.msgNum = 1;
  }

  if (res.msgNum >= repeatNum && oldMsg != res.sendMsg) {
    res.sendMsg = oldMsg;
    if (lodash.random(0, 100) < repeatImgRand) {
      YunzaiApps.face.getRandomImg("复读").then((img) => {
        if (img) {
          let msg = segment.image(img);
          msg.asface = true;
          e.reply(msg);
        }
      });
    } else {
      e.reply(e.message);
    }

    await global.redis.set(key, JSON.stringify(res), {
      EX: 3600 * 8,
    });

    return true;
  }

  await global.redis.set(key, JSON.stringify(res), {
    EX: 3600 * 8,
  });

  return false;
}

export { help, repeat };

import { segment } from "oicq";

const _path = process.cwd().trim("\\lib");

function help(e) {
  e.reply(segment.image(`file:///${_path}/resources/help/help.png`));
  return true;
}

//复读-暂时只复读文字
async function repeat(e) {
  let repeatRand = 70;
  let repeatNum  = 5;

  if (!e.isGroup || e.img || e.at || e.hasReply) {
    return false;
  }

  if(Math.floor(Math.random() * 100)>repeatRand){
    return false;
  }

  let key = `Yunzai:repeat:${e.group_id}`;
  let res = await global.redis.get(key);

  if (!res) {
    res = { msgNum: 1, msg: e.msg, sendMsg: "" };
    await global.redis.set(key, JSON.stringify(res), {
      EX: 3600 * 8,
    });
    return true;
  }else{
    res = JSON.parse(res);
  }

  if (e.msg == res.msg) {
    res.msgNum++;
  } else {
    res.msg = e.msg;
    res.msgNum = 1;
  }

  if (res.msgNum >= repeatNum && e.msg != res.sendMsg) {
    res.sendMsg = e.msg;
    e.reply(e.msg);

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

export { help, repeat, };

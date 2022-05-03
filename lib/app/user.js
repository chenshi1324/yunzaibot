import lodash from "lodash";

export const rule = {
  bindUid: {
    reg: "^#绑定(uid)?\\s*(\\d{9})*$",
    hashMark: true,
    priority: 500,
    describe: "【#个人】绑定UID",
  },
  getUid: {
    reg: "^#(我的)?uid[0-9]{0,2}$",
    hashMark: true,
    priority: 500,
    describe: "【#个人】查看uid",
  }
};


export async function bindUid(e, { Models }) {
  let checkRet = /^#绑定(?:uid)?\s*(\d{9})$/.exec(e.msg || "");
  if (!checkRet || !checkRet[1]) {
    e.reply(`请输入【#绑定+你的UID】，进行绑定`)
    return true;
  }
  let selfUser = await e.checkAuth({ auth: 'self' });

  if (!selfUser) {
    return true;
  }

  if (selfUser.isCookieUser) {
    e.reply(`你已经绑定Cookie，UID为:${selfUser.uid}`)
  }

  let { MysUser } = Models;

  let mysUser = await MysUser.get(checkRet[1]);
  if (!mysUser) {
    return true;
  }

  await selfUser.regMysUser(mysUser, true);

  mysUser = await selfUser.getMysUser();
  e.reply(`UID已绑定${checkRet[1]}`);
  return true;
}

export async function getUid(e) {
  let selfUser = await e.checkAuth({ auth: 'self' });

  if (!selfUser) {
    return false;
  }

  let regRet = /uid([0-9]{0,2})$/.exec(e.msg), switchIdx;
  if (regRet && regRet[1]) {
    switchIdx = regRet[1] * 1;
  }

  if (selfUser.isCookieUser) {
    let mUsers = await selfUser.getAllMysUser();
    if (mUsers.length > 0) {
      if (switchIdx && mUsers[switchIdx - 1]) {
        let switchRet = await selfUser.bindMysUser(mUsers[switchIdx - 1]);
        if (switchRet) {
          e.reply(`切换成功，当前UID为${selfUser.uid}`);
          return true;
        }
      } else {
        let msg = [`你已经注册Cookie，可私聊Bot绑定更多Cookie以快速切换uid\n通过命令【#uid+序号】来切换指定的uid`];
        lodash.forEach(mUsers, (mUser, idx) => {
          if (mUser.uid * 1 === selfUser.uid * 1) {
            msg.push(`${idx + 1}: uid${mUser.uid}(当前)`);
          } else {
            msg.push(`${idx + 1}: uid${mUser.uid}`);
          }

        });
        e.reply(msg.join("\n"))
        return true;
      }
    }

  }

  let mysUser = await selfUser.getMysUser();
  if (mysUser) {
    e.reply(`您尚绑定Cookie，绑定Cookie可使用更多能力。使用【#体力帮助】可获得绑定方式\n你当前绑定的UID为${mysUser.uid}。通过【#绑定+你的UID】可更换uid`)
    return true;
  }
  e.reply("当前的用户尚未绑定uid\n回复【#绑定+你的UID】可绑定uid\n绑定Cookie可使用Bot的更多能力，使用命令【#体力帮助】可获得绑定帮助");
  return true;
}

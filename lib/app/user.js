export const rule = {
  bindUid: {
    reg: "^#绑定uid\\s*(\\d{9})*$",
    priority: 500,
    describe: "【#个人】绑定UID",
  },
  getUid: {
    reg: "#(我的)?uid",
    priority: 500,
    describe: "【#个人】查看uid",
  }
};


export async function bindUid(e, { Models }) {
  let checkRet = /^#绑定uid\s*(\d{9})$/.exec(e.msg || "");
  if (!checkRet || !checkRet[1]) {
    e.reply(`请输入#绑定uid+你的UID，进行绑定`)
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

  if (selfUser.isCookieUser) {
    e.reply(`你已经注册Cookie，Cookie的UID为${selfUser.uid}`)
    return true;
  }

  let mysUser = await selfUser.getMysUser();
  if (mysUser) {
    e.reply(`您尚未绑定Cookie，你绑定的UID为${mysUser.uid}。`);
    e.reply(`通过 #绑定uid+你的UID 可更换绑定UID\n或者通过绑定Cookie即可关联Cookie对应UID`)
    return true;
  }
  e.reply("当前的用户尚未绑定uid");
  return true;
}

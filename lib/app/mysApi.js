import md5 from "md5";

function getUrl(type, uid, data = {}) {
  // let host = "https://api-takumi-record.mihoyo.com/game_record/app/genshin/api/";
  let host = "https://api-takumi.mihoyo.com/game_record/app/genshin/api/";

  let server = getServer(uid);
  let query = "";
  let body = "";
  switch (type) {
    //首页宝箱
    case "index":
      query = `role_id=${uid}&server=${server}`;
      break;
    //深渊
    case "spiralAbyss":
      query = `role_id=${uid}&schedule_type=${data.schedule_type}&server=${server}`;
      break;
    //角色详情
    case "character":
      body = JSON.stringify(data);
    //树脂每日任务（只能当前id）
    case "dailyNote":
      query = `role_id=${uid}&server=${server}`;
      break;
    //角色天赋等级接口
    case "detail":
      host = "https://api-takumi.mihoyo.com/event/e20200928calculate/v1/sync/avatar/detail";
      query = `uid=${uid}&region=${server}&avatar_id=${data.avatar_id}`;
      type = "";
      break;
  }

  let url = host + type + "?" + query;

  return { url, query, body };
}

function getServer(uid) {
  switch (uid.toString()[0]) {
    case "1":
    case "2":
      return "cn_gf01"; //官服
    case "5":
      return "cn_qd01"; //B服
  }
  return "cn_gf01"; //官服
}

//# Github-@lulu666lulu
function getDs(q = "", b = "") {
  let n = "xV8v4Qu54lUKrEYFZkJhB8cuOh9Asafs";
  let t = Math.round(new Date().getTime() / 1000);
  let r = Math.floor(Math.random() * 900000 + 100000);
  let DS = md5(`salt=${n}&t=${t}&r=${r}&b=${b}&q=${q}`);
  return `${t},${r},${DS}`;
}

export { getUrl, getDs, getServer };

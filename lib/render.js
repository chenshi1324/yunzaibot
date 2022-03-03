import template from "art-template";
import fs from "fs";
import puppeteer from "puppeteer";

const _path = process.cwd();
//html模板
const html = {};
//浏览器
let browser = "";
//截图数达到时重启浏览器 避免生成速度越来越慢
let restartNum = 400;
//截图次数
let renderNum = 0;
//锁住
let lock = false;
//截图中
let shoting = [];

/**
 * 渲染生成图片
 * @param app 应用名称
 * @param type 方法名
 * @param data 前端参数
 * @param imgType 图片类型 jpeg，png
 */
async function render(app = "", type = "", data = {}, imgType = "jpeg") {
  if (!html[type] || global.debugView) {
    //读取模板
    html[type] = fs.readFileSync(_path + `/resources/${app}/${type}/${type}.html`, "utf8");
  }

  //替换模板
  let tmpHtml = template.render(html[type], data);
  //保存模板
  let save_path = _path + `/data/html/${app}/${type}/${data.save_id}.html`;
  fs.writeFileSync(save_path, tmpHtml);

  if (!(await browserInit())) {
    return false;
  }

  let base64 = "";
  let start = Date.now();
  try {
    shoting.push(data.save_id);
    //图片渲染
    const page = await browser.newPage();
    await page.goto("file://" + save_path);
    let body = await page.$("#container");
    base64 = await body.screenshot({
      type: imgType,
      encoding: "base64",
      // quality:100,
    });
    if (!global.debugView) {
      page.close().catch((err) => Bot.logger.error(err));
    }
    shoting.pop();
  } catch (error) {
    Bot.logger.error(`图片生成失败:${type}:${error}`);
    //重启浏览器
    if (browser) {
      await browser.close().catch((err) => Bot.logger.error(err));
    }
    browser = "";
    base64 = "";
    return false;
  }

  if (!base64) {
    Bot.logger.error(`图片生成为空:${type}`);
    return false;
  }

  renderNum++;
  Bot.logger.mark(`图片生成 ${type}:${Date.now() - start}ms 次数:${renderNum}`);

  if (typeof test != "undefined") {
    return `图片base64:${type}`;
  }

  //截图超过重启数时，自动关闭重启浏览器，避免生成速度越来越慢
  if (renderNum % restartNum == 0) {
    if (shoting.length <= 0) {
      setTimeout(async function () {
        browser.removeAllListeners("disconnected");
        await browser.close().catch((err) => Bot.logger.error(err));
        browser = "";
        Bot.logger.mark("puppeteer 关闭重启");
      }, 100);
    }
  }

  return base64;
}

async function browserInit() {
  if (browser) {
    return browser;
  }
  if (lock) {
    return false;
  }
  lock = true;
  Bot.logger.mark("puppeteer 启动中。。");
  //初始化puppeteer
  browser = await puppeteer
    .launch({
      // executablePath:'',//chromium其他路径
      headless: global.debugView ? false : true,
      args: [
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--disable-setuid-sandbox",
        "--no-first-run",
        "--no-sandbox",
        "--no-zygote",
        "--single-process",
      ],
    })
    .catch((err) => {
      Bot.logger.error(err);
    });

  lock = false;

  if (browser) {
    Bot.logger.mark("puppeteer 启动成功");

    //监听Chromium实例是否断开
    browser.on("disconnected", function (e) {
      Bot.logger.error("Chromium实例关闭或崩溃！");
      browser = "";
    });

    return browser;
  } else {
    Bot.logger.error("puppeteer 启动失败");
    return false;
  }
}

export { render, browserInit, renderNum };

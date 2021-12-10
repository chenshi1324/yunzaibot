import template from "art-template";
import fs from "fs";
import puppeteer from "puppeteer";

const _path = process.cwd().trim("\\lib");
//html模板
const html = {};
//浏览器
let browser = "";
//截图数达到时重启浏览器 避免生成速度越来越慢
let restartNum = 200;
//截图次数
let renderNum = 0;
//锁住
let lock = false;

//生成图片
async function render(app, type, data, imgType = "jpeg") {
  if (!html[type]) {
    //读取模板
    html[type] = fs.readFileSync(_path + `/resources/${app}/${type}/${type}.html`, "utf8");
  }

  //替换模板
  let tmpHtml = template.render(html[type], data);
  //保存模板
  let save_path = _path + `/data/html/${app}/${type}/${data.save_id}.html`;
  fs.writeFileSync(save_path, tmpHtml);

  if (!browser) {
    //浏览器还在启动中
    if (lock) {
      return false;
    }
    await browserInit();
    if (!browser) {
      return false;
    }
  }
  renderNum++;
  let base64 = "";
  try {
    const start = Date.now();
    //图片渲染
    const page = await browser.newPage();
    await page.goto("file://" + save_path);
    let body = await page.$("#container");
    base64 = await body.screenshot({
      type: imgType,
      encoding: "base64",
      // quality:100,
    });
    page.close();

    let end = Date.now();
    let responseTime = end - start;
    Bot.logger.mark(`图片生成 ${type}:${responseTime}ms 次数:${renderNum}`);
  } catch (error) {
    Bot.logger.error(`图片失败:${type}`);
    return false;
  }

  if (!base64) {
    Bot.logger.error(`图片失败:${type}`);
    return false;
  }

  if (typeof test != "undefined") {
    return `图片base64:${type}`;
  }

  //截图超过重启数时，自动关闭重启浏览器，避免生成速度越来越慢
  if (renderNum >= restartNum) {
    await browser.close();
    renderNum = 0;
    browser = "";
    Bot.logger.info("puppeteer 关闭重启");
  }

  return base64;
}

async function browserInit() {
  if (browser) {
    return browser;
  }
  lock = true;
  Bot.logger.info("puppeteer 启动中。。");
  //初始化puppeteer
  browser = await puppeteer.launch({
    // executablePath:'',//chromium其他路径
    headless: true,
    args: [
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-setuid-sandbox",
      "--no-first-run",
      "--no-sandbox",
      "--no-zygote",
      "--single-process",
    ],
    defaultViewport: {
      width: 900,
      height: 600,
    },
  });

  lock = false;

  if (browser) {
    Bot.logger.info("puppeteer 启动成功");
    return browser;
  } else {
    Bot.logger.error("puppeteer 启动失败");
    return false;
  }
}

export { render, browserInit };

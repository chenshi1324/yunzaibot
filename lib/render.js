import template from "art-template";
import fs from "fs";
import puppeteer from "puppeteer";

const _path = process.cwd().trim("\\lib");
//html模板
const html = {};
//浏览器ws
let browserWSEndpoint = "";

//生成图片
async function render(app,type, data) {
  if (!html[type]) {
    //读取模板
    html[type] = fs.readFileSync(
      _path + `/resources/${app}/${type}/${type}.html`,
      "utf8"
    );
  }

  //替换模板
  let tmpHtml = template.render(html[type], data);
  //保存模板
  let save_path = _path + `/data/html/${app}/${type}/${data.save_id}.html`;
  fs.writeFileSync(save_path, tmpHtml);

  if (!browserWSEndpoint) {
    await browserInit();
    if (!browserWSEndpoint) {
      return false;
    }
  }

  const start = Date.now();
  //图片渲染
  const browser = await puppeteer.connect({ browserWSEndpoint });
  const page = await browser.newPage();
  await page.goto("file://" + save_path);
  let body = await page.$("#container");
  let base64 = await body.screenshot({
    type: "jpeg",
    encoding: "base64",
    // quality:100,
  });
  await page.close();

  if (!base64) {
    logger.error(`图片失败:${type}`);
    return false;
  }

  const end = Date.now();
  const responseTime = end - start;
  logger.info(`图片生成 ${type}:${responseTime}ms`);

  if (typeof test != "undefined") {
    return `图片base64:${type}`;
  }

  return base64;
}

async function browserInit() {
  //初始化puppeteer
  let browser = await puppeteer.launch({
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
  });
  browserWSEndpoint = await browser.wsEndpoint();

  if (browserWSEndpoint) {
    logger.info("puppeteer 启动成功");
  } else {
    logger.error("puppeteer 启动失败");
  }
}

export { render };

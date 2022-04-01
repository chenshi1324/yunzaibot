#!/bin/sh
set -e

echo -e "\n ======== \n ${Info} ${GreenBG} 拉取最新项目 ${Font} \n ======== \n"
git pull
echo -e "\n ======== \n ${Info} ${GreenBG} 更新运行依赖 ${Font} \n ======== \n"
cnpm install
echo -e "\n ======== \n ${Info} ${GreenBG} 启动云崽-BOT ${Font} \n ======== \n"
node app
#!/bin/bash
# CentOS 8.2 Node.js 14.16.1
# 2021年12月3日16:26:06

# 安装并运行redis
yum -y install redis 
systemctl start redis.service

# 切换cnpm镜像
npm install cnpm -g --registry=https://registry.npm.taobao.org
# 安装模块，主要安装Puppeteer，下载chrome浏览器
cnpm install

# 安装chrome依赖库
yum install pango.x86_64 libXcomposite.x86_64 libXcursor.x86_64 libXdamage.x86_64 libXext.x86_64 libXi.x86_64 libXtst.x86_64 cups-libs.x86_64 libXScrnSaver.x86_64 libXrandr.x86_64 GConf2.x86_64 alsa-lib.x86_64 atk.x86_64 gtk3.x86_64 -y 
yum install libdrm libgbm libxshmfence -y 
yum install nss -y 
yum update nss -y

# 安装中文字体
yum -y install fontconfig 
yum -y install mkfontscale

cd /usr/share/fonts/

wget https://hub.fastgit.org/adobe-fonts/source-han-sans/raw/release/Variable/TTF/Subset/SourceHanSansCN-VF.ttf

mkfontscale && mkfontdir

echo '安装完成';
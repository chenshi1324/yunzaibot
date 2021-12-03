#!/bin/bash

yum -y install redis 
systemctl start redis.service

npm install cnpm -g --registry=https://registry.npm.taobao.org

cnpm install

yum install pango.x86_64 libXcomposite.x86_64 libXcursor.x86_64 libXdamage.x86_64 libXext.x86_64 libXi.x86_64 libXtst.x86_64 cups-libs.x86_64 libXScrnSaver.x86_64 libXrandr.x86_64 GConf2.x86_64 alsa-lib.x86_64 atk.x86_64 gtk3.x86_64 -y 
yum install libdrm libgbm libxshmfence -y 
yum install nss -y 
yum update nss -y

yum -y install fontconfig 
yum -y install mkfontscale

cd /usr/share/fonts/

wget https://hub.fastgit.org/adobe-fonts/source-han-sans/raw/release/Variable/TTF/Subset/SourceHanSansCN-VF.ttf

mkfontscale && mkfontdir

echo '安装完成';
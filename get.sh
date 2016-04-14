#!/usr/bin/env bash

latest_uri='http://astronautlevel2.github.io'
latest_path="${latest_uri}/AuReiNand/"
release_uri='https://github.com'
release_path="${release_uri}/AuroraWright/AuReiNand/releases"
latest="${latest_uri}$(curl ${latest_path} 2>/dev/null | xmllint --xpath 'string(//tr[1]/td[1]//a/@href)' --html - 2>/dev/null)"
release="${release_uri}$(curl ${release_path} 2>/dev/null | xmllint --xpath 'string(//*[contains(concat(" ", normalize-space(@class), " "), " label-latest ")]//*[@class="release-downloads"]/li[1]/a/@href)' --html - 2>/dev/null)"

echo $release

wget -O latest.zip ${latest}
unzip latest.zip out/arm9loaderhax.bin
rm latest.zip
newsha=$(sha256sum out/arm9loaderhax.bin | awk '{print $1}')
oldsha=$(sha256sum latest.bin | awk '{print $1}')
if [ "${newsha}" != "${oldsha}" ]
then
  echo 'Latest updated'
  mv out/arm9loaderhax.bin latest.bin
else
  echo 'Latest Unchanged'
fi
rm -r out

wget -O release.7z ${release}
7z x -Oout release.7z arm9loaderhax.bin
rm release.7z
newsha=$(sha256sum out/arm9loaderhax.bin | awk '{print $1}')
oldsha=$(sha256sum release.bin | awk '{print $1}')
if [ "${newsha}" != "${oldsha}" ]
then
  echo 'Release updated'
  mv out/arm9loaderhax.bin release.bin
else
  echo 'Release Unchanged'
fi
rm -r out

echo 'All done!'

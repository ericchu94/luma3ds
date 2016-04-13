#!/usr/bin/env bash

uri='http://astronautlevel2.github.io'
path="${uri}/AuReiNand/"
latest="${uri}$(xmllint --xpath 'string(//tr[1]/td[1]//a/@href)' --html ${path})"

wget -O latest.zip ${latest}
unzip latest.zip out/arm9loaderhax.bin
rm latest.zip
newsha=$(sha256sum out/arm9loaderhax.bin | awk '{print $1}')
oldsha=$(sha256sum arm9loaderhax.bin | awk '{print $1}')
if [ "${newsha}" != "${oldsha}" ]
then
  echo 'Binary updated'
  mv out/arm9loaderhax.bin arm9loaderhax.bin
else
  echo 'No change'
fi
rm -r out

echo 'All done!'

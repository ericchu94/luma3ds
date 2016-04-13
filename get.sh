#!/usr/bin/env bash

uri='http://astronautlevel2.github.io'
path="${uri}/AuReiNand/"
latest="${uri}$(xmllint --xpath 'string(//tr[1]/td[1]//a/@href)' --html ${path})"

wget -O latest.zip ${latest}
unzip latest.zip out/arm9loaderhax.bin
rm latest.zip
rm files/*
mv out/arm9loaderhax.bin files/arm9loaderhax.bin
rmdir out

echo 'All done!'

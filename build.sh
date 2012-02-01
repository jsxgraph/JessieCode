#!/bin/bash


YUI=~/Tools/yuicompressor/build/yuicompressor*.jar

#if test bin/jessiecode.bnf.js -nt bin/jessiecode.js; then
  echo Recompiling BNF to js...
  rhino jscc/jscc.js -v -w -o bin/jessiecode.bnf.js -p jessie -t jscc/driver_jxg.js_ src/jessiecode.par.bnf
#fi

echo Creating jessiecode.js...
cat src/jessiecode.par.js bin/jessiecode.bnf.js > bin/jessiecode.js

echo Copying new version to JSXGraph...
cp bin/jessiecode.js ../JSXGraph/src/JessieCode.js

echo Creating minified version
java -jar $YUI --type js bin/jessiecode.js >> bin/jessiecode-min.js

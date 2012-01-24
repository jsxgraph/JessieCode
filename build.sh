#!/bin/bash

if test jessiecode.bnf.js -nt jessiecode.js; then
  echo Recompiling BNF to js...
  rhino tools/jscc.js -v -w -o jessiecode.bnf.js -p jessie -t tools/driver_jxg.js_ jessiecode.par.bnf
fi

echo Creating jessiecode.js...
cat jessiecode.par.js jessiecode.bnf.js > jessiecode.js

echo Copying new version to JSXGraph...
cp jessiecode.js ../JSXGraph/src/JessieCode.js

#!/bin/bash

rhino tools/jscc.js -v -w -o jessiecode.bnf.js -p jessie -t tools/driver_jxg.js_ jessiecode.par.bnf
cat jessiecode.par.js jessiecode.bnf.js > jessiecode.js

cp jessiecode.js ../JSXGraph/src/JessieCode.js

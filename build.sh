#!/bin/bash

rhino tools/jscc.js -v -w -o jessiecode.bnf.js -p jessie -t tools/driver_web.js_ jessiecode.par.bnf
cat jessiecode.par.js jessiecode.bnf.js > jessiecode.js

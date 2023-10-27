.PHONY: core deploy test test-server clean

# directories
OUTPUT=bin
TMP=tmp
BIN=./node_modules/.bin
JSXGRAPH=../JSXGraph

# build tools
# REQUIREJS=$(BIN)/r.js
# UGLIFYJS=$(BIN)/uglifyjs
MINIFYER=./node_modules/terser/bin/terser
LINT=$(BIN)/jslint
ESLINT=./node_modules/eslint/bin/eslint.js
HINT=$(BIN)/jshint
JSTESTDRIVER=java -jar ./node_modules/jstestdriver/lib/jstestdriver.jar
JISON=$(BIN)/jison

# general tools
CP=cp
CAT=cat
MKDIR=mkdir
RM=rm
CD=cd
ZIP=zip
SED=sed

# flags
MKDIRFLAGS=-p
RMFLAGS=-rf
JSDOC2FLAGS=-v -p -t=$(JSDOC2TPL) -d=$(TMP)/docs
ZIPFLAGS=-r
JSTESTPORT=4224
JSTESTSERVER=localhost:4224
JSTESTFLAGS=--reset --captureConsole --tests all

# filelists - required for docs, linters, and to build the readers
GRAMMAR=src/grammar.jison
INTERPRETER=src/interpreter.js

# rules
all: core deploy

deploy: core
	$(CP) $(OUTPUT)/jessiecode.js ../JSXGraph/src/parser/jessiecode.js

core: parser.js $(INTERPRETER)
	$(SED) -e '/#include "parser\.js"/{r '"$(OUTPUT)"'/parser.js' -e 'd}' $(INTERPRETER) > $(OUTPUT)/jessiecode.js
	$(SED) -i -e 's/"use strict"//' $(OUTPUT)/jessiecode.js
	$(MINIFYER) $(OUTPUT)/jessiecode.js -c -m -o $(OUTPUT)/jessiecode.min.js

parser.js: $(GRAMMAR)
	$(MKDIR) $(MKDIRFLAGS) $(OUTPUT)
	$(JISON) $^ -o $(OUTPUT)/parser.js -m js

test-server:
	$(JSTESTDRIVER) --port $(JSTESTPORT)

test: jsxgraph
	$(JSTESTDRIVER) $(JSTESTSERVER) $(JSTESTFLAGS) --basePath ./ --config test/jsTestDriver.conf

jsxgraph: deploy
	$(CD) ../JSXGraph; make OUTPUT=../JessieCode/bin core-min; git checkout -- src/parser/jessiecode.js

clean:
	rm -f bin/*

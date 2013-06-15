.PHONY: test test-server

# directories
OUTPUT=bin
TMP=tmp
BIN=./node_modules/.bin

# build tools
REQUIREJS=$(BIN)/r.js
UGLIFYJS=$(BIN)/uglifyjs
LINT=$(BIN)/jslint
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
all: parser

parser: $(GRAMMAR)
	$(MKDIR) $(MKDIRFLAGS) $(OUTPUT)
	$(JISON) $^ -o $(OUTPUT)/parser.js

test-server:
	$(JSTESTDRIVER) --port $(JSTESTPORT)

test: parser
	$(JSTESTDRIVER) $(JSTESTSERVER) $(JSTESTFLAGS) --basePath ./ --config test/jsTestDriver.conf

#!/bin/bash

JTD=~/Tools/JsTestDriver/JsTestDriver-1.3.2.jar


java -jar $JTD --reset --tests all --basePath ./ --config test/jsTestDriver.conf --captureConsole $@

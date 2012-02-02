#!/usr/bin/env python
# -*- coding: utf-8 -*-

license = """/*
    Copyright 2011-2012
        Michael Gerhaeuser,
        Alfred Wassermann

    This file is part of JessieCode - Licensed under LGPL v3.
*/
    """

import sys;
# Parse command line options
import getopt;

# Used for makeRelease & makeCompressor
import os
import re
import tempfile
import shutil

# Used for JSHint
import urllib


# Default values for options. May be overridden via command line options
yui = "~/Tools/yuicompressor"
jstest = "~/Tools/JsTestDriver/JsTestDriver-1.3.1.jar"
output = "bin"
version = None
hint = None
reset = ""
port = 4224
server = ""


'''
    Prints some instructions on how to use this script
'''
def usage():
    print
    print "Usage:  python", sys.argv[0], "[OPTIONS]... TARGET"
    print "Compile and minify the JessieCode source code, and run unit tests."
    print
    print "Options:"
    print "  -h, --help             Display this help and exit."
    print "  -l, --hint=FILE        Set the file you want to check with JSHint."
    print "  -j, --jsdoc=PATH       Search for jsdoc-toolkit in PATH."
    print "  -o, --output=PATH      Override the default output path distrib/ by PATH."
    print "  -p, --port=PORT        Set server port for the JsTestDriver server. Default is 4224."
    print "      --reset            Force the test server to reload the browsers."
    print "  -s, --server=URL       Overrides the server option in the JsTestDriver config."
    print "  -v, --version=VERSION  Use VERSION as release version for proper zip archive and"
    print "                         folder names."
    print "  -y, --yui=PATH         Search for YUI Compressor in PATH."
    print
    print "Targets:"
    print "  Core                   Concatenates and minifies JessieCode source files into"
    print "                         bin/jessiecode.js and bin/jessiecode-min.js."
    print "  Release                Builds target Core and creates distribution ready zip archives"
    print "                         in bin/ ."
    print "  Hint                   Run JSHint on the file given with -l or --hint."
    print "  Test                   Run Unit Tests with JsTestDriver."
    print "  TestServer             Run JsTestDriver server."


'''
    Generate jsxgraphcore.js and place it in <output>
'''
def makeCore():
    global yui, version, output, license

    print "Making Core..."

    jstxt = ''
    license = ("/* Version %s */\n" % version) + license

    # Compile BNF with JS/CC
    print "build BNF"
    s = "rhino jscc/jscc.js -v -w -o bin/jessiecode.bnf.js -p jessie -t jscc/driver_jxg.js_ src/jessiecode.par.bnf > /dev/null"
    print s
    os.system(s)

    # Take the source files and write them into jstxt

    files = ['src/jessiecode.par.js', 'bin/jessiecode.bnf.js']
    for f in files:
        print 'take ', f
        jstxt += open(f,'r').read()
        jstxt += '\n';

    # tmpfilename = tempfile.mktemp()
    tmpfilename = output + '/jessiecode.js'

    fout = open(tmpfilename,'w')
    fout.write(jstxt)
    fout.close()

    # Prepend license text
    minFilename = output + "/jessiecode-min.js"
    fout = open(minFilename,'w')
    fout.write(license)
    fout.close()

    # Minify; YUI compressor from Yahoo
    s = "java -jar " + yui + "/build/yuicompressor*.jar --type js " + tmpfilename + " >>" + minFilename
    print s
    os.system(s)


'''
    Make targets Core and Docs and create distribution-ready zip archives in <output>
'''
def makeRelease():
    print "Make Release"

    makeCore()

    shutil.copy(output + "/jessiecode-min.js", "tmp/jessiecode-min.js")
    shutil.copy(output + "/jessiecode.js", "tmp/jessiecode.js")
    shutil.copy("README.md", "tmp/README.md")
    shutil.copy("LICENSE", "tmp/LICENSE")
    os.system("cd tmp && zip -r jessiecode-" + version + ".zip jessiecode.js jessiecode-min.js README.md LICENSE && cd ..")
    shutil.move("tmp/jessiecode-" + version + ".zip", output + "/jessiecode-" + version + ".zip")

'''
    Fetch a file from the web
'''
def fetch(url, local):
	webFile = urllib.urlopen(url)
	localFile = open(local, 'w')
	localFile.write(webFile.read())
	webFile.close()
	localFile.close()

'''
    Check a file with JSHint
'''
def makeHint():
    global hint

    # TODO: If hint is None use all files in src/*
    if hint is None:
        print "No file given. Please provide a file with the -l or --hint option."
        return

    # Fetch program files
    fetch('https://github.com/jshint/jshint/raw/master/env/rhino.js', '/tmp/rhino.js')
    fetch('http://jshint.com/jshint.js', '/tmp/jshint.js')

    abshint = os.path.abspath(hint)
    os.system('cd /tmp && rhino /tmp/rhino.js ' + abshint)


'''
    Run Unit Tests
'''
def makeTest():
    global jstest, reset, server

    os.system('java -jar ' + jstest + ' ' + reset + ' ' + server + ' --tests all --basePath ./ --config test/jsTestDriver.conf --captureConsole');

'''
    Run Unit Tests Server
'''
def makeTestServer():
    global jstest, reset, port

    os.system('java -jar ' + jstest + ' --port ' + str(port));


def main(argv):
    global yui, jsdoc, version, output, hint, jstest, reset, port, server

    try:
        opts, args = getopt.getopt(argv, "hy:v:o:l:t:p:s:", ["help", "yui=", "version=", "output=", "hint=", "test=", "reset", "port=", "server="])
    except getopt.GetoptError as (errono, strerror):
        usage()
        sys.exit(2)
    for opt, arg in opts:
        if opt in ("-h", "--help"):
            usage()
            sys.exit(2)
        elif opt in ("-o", "--output"):
            output = os.path.expanduser(arg)
        elif opt in ("-v", "--version"):
            version = arg
        elif opt in ("-y", "--yui"):
            yui = arg
        elif opt in ("-l", "--hint"):
            hint = arg
        elif opt in ("-t", "--test"):
            jstest = arg
        elif opt in ("-p", "--port"):
            port = arg
        elif opt in ("--reset"):
            reset = '--reset'
        elif opt in ("-s", "--server"):
            server = "--server " + arg

    target = "".join(args)

    # Search for the version and print it before the license text.
    if not version:
        version = "na"
    #    expr = re.compile("JSXGraph v(.*) Copyright")
    #    r = expr.search(open("src/jsxgraph.js").read())
    #    version = r.group(1)

    try:
        # Create tmp directory and output directory
        if not os.path.exists(output):
            os.mkdir(output)
        if not os.path.exists("tmp"):
            os.mkdir("tmp")

        # Call the target make function
        globals()["make" + target]()
        shutil.rmtree("tmp/")
    except KeyError:
        # Oooops, target doesn't exist.
        print "Error: Target", target, "does not exist."
        usage()
        shutil.rmtree("tmp/")
        sys.exit(1)
    except IOError as (errno, strerror):
        print "Error: Can't create tmp directories.", strerror
        sys.exit(1)

if __name__ == "__main__":
    main(sys.argv[1:])

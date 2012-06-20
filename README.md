JessieCode - A script language for JSXGraph
===========================================

&copy; 2011-2012 Michael Gerhäuser, michael.gerhaeuser@gmail.com

Licensed under the LGPL v3. See LICENSE or http://www.gnu.org/licenses/lgpl.txt

About
-----

JessieCode is a scripting language designed to provide a interface to JSXGraph. It is
similar to JavaScript, but prevents access to the DOM. Hence, it can be used in community
driven web sites which want to use JSXGraph to display interactive math graphics.

JSXGraph (http://jsxgraph.org) is required to use JessieCode.

Compile
-------

Required tools:

* Rhino
* YUICompressor

Use the make.py script to compile the .bnf file into a javascript parser and to concatenate
the parser and interpreter into a single .js file.


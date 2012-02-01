JessieCode - A script language for JSXGraph
===========================================

&copy; 2011-2012 Michael Gerhäuser, michael.gerhaeuser@gmail.com

Licensed under the LGPL v3. See LICENSE or http://www.gnu.org/licenses/lgpl.txt

About
-----

JessieCode is a scripting language designed to provide a simple scripting language to build constructions
with JSXGraph. It is similar to JavaScript, but prevents access to the DOM. Hence, it can be used in community
driven Math portals which want to use JSXGraph to display interactive math graphics.

JSXGraph (http://jsxgraph.org) is required to use JessieCode.

Compile
-------

Required tools:

* Rhino
* YUICompressor

Use the build.sh script to compile the .bnf file into a javascript parser and to create a single .js file. You
might want to adjust the YUICompressor path in build.sh

Usage
-----

See the documentation files under docs/
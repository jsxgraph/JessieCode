JessieCode - A script language for JSXGraph
===========================================

(c) 2011-2013
    Michael Gerhäuser, michael.gerhaeuser@gmail.com
    Alfred Wassermann, alfred.wassermann@uni-bayreuth.de


About
-----

JessieCode is a scripting language designed to provide a interface to JSXGraph. It is
similar to JavaScript, but prevents access to the DOM. Hence, it can be used in community
driven web sites which want to use JSXGraph to display interactive math graphics.

JSXGraph (https://jsxgraph.org) is required to use JessieCode. See [SketchBin](https://bin.sketchometry.com)
for a live editor.

Compile
-------

Required tools:

* Rhino
* yuglify
* Jison

Use `make` to compile the .bnf file into a javascript parser and to concatenate
the parser and interpreter into a single .js file, see `Makefile`.

License
-------

JessieCode is free software dual licensed under the GNU LGPL or MIT License.

You can redistribute it and/or modify it under the terms of the

  * GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version
  OR
  * MIT License: https://github.com/jsxgraph/jsxgraph/blob/master/LICENSE.MIT

JessieCode is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Lesser General Public License for more details.

You should have received a copy of the GNU Lesser General Public License and
the MIT License along with JessieCode. If not, see <http://www.gnu.org/licenses/>
and <http://opensource.org/licenses/MIT/>.

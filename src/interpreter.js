/*
 JessieCode Interpreter and Compiler

    Copyright 2011-2016
        Michael Gerhaeuser,
        Alfred Wassermann

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
 */

/*global JXG: true, define: true, window: true, console: true, self: true, document: true, parser: true*/
/*jslint nomen: true, plusplus: true*/

/* depends:
 jxg
 parser/geonext
 base/constants
 base/text
 math/math
 math/geometry
 math/statistics
 utils/type
 utils/uuid
 */

/**
 * @fileoverview JessieCode is a scripting language designed to provide a simple scripting language to build constructions
 * with JSXGraph. It is similar to JavaScript, but prevents access to the DOM. Hence, it can be used in community driven
 * Math portals which want to use JSXGraph to display interactive math graphics.
 */

define([
    'jxg', 'base/constants', 'base/text', 'math/math', 'math/geometry', 'math/statistics', 'utils/type', 'utils/uuid', 'utils/env'
], function (JXG, Const, Text, Mat, Geometry, Statistics, Type, UUID, Env) {

    "use strict";

    // IE 6-8 compatibility
    if (!Object.create) {
        Object.create = function(o, properties) {
            if (typeof o !== 'object' && typeof o !== 'function') throw new TypeError('Object prototype may only be an Object: ' + o);
            else if (o === null) throw new Error("This browser's implementation of Object.create is a shim and doesn't support 'null' as the first argument.");

            if (typeof properties != 'undefined') throw new Error("This browser's implementation of Object.create is a shim and doesn't support a second argument.");

            function F() {}

            F.prototype = o;

            return new F();
        };
    }

    var priv = {
            modules: {
                'math': Mat,
                'math/geometry': Geometry,
                'math/statistics': Statistics,
                'math/numerics': Mat.Numerics
            }
        };

    /**
     * A JessieCode object provides an interface to the parser and stores all variables and objects used within a JessieCode script.
     * The optional argument <tt>code</tt> is interpreted after initializing. To evaluate more code after initializing a JessieCode instance
     * please use {@link JXG.JessieCode#parse}. For code snippets like single expressions use {@link JXG.JessieCode#snippet}.
     * @constructor
     * @param {String} [code] Code to parse.
     * @param {Boolean} [geonext=false] Geonext compatibility mode.
     */
    JXG.JessieCode = function (code, geonext) {
        // Control structures

        /**
         * The global scope.
         * @type {Object}
         */
        this.scope = {
            id: 0,
            hasChild: true,
            args: [],
            locals: {},
            context: null,
            previous: null
        };

        /**
         * Keeps track of all possible scopes every required.
         * @type {Array}
         */
        this.scopes = [];
        this.scopes.push(this.scope);

        /**
         * A stack to store debug information (like line and column where it was defined) of a parameter
         * @type Array
         * @private
         */
        this.dpstack = [[]];

        /**
         * Determines the parameter stack scope.
         * @type Number
         * @private
         */
        this.pscope = 0;

        /**
         * Used to store the property-value definition while parsing an object literal.
         * @type Array
         * @private
         */
        this.propstack = [{}];

        /**
         * The current scope of the object literal stack {@link JXG.JessieCode#propstack}.
         * @type Number
         * @private
         */
        this.propscope = 0;

        /**
         * Store the left hand side of an assignment. If an element is constructed and no attributes are given, this is
         * used as the element's name.
         * @type Array
         * @private
         */
        this.lhs = [];

        /**
         * lhs flag, used by JXG.JessieCode#replaceNames
         * @type Boolean
         * @default false
         */
        this.isLHS = false;

        /**
         * The id of an HTML node in which innerHTML all warnings are stored (if no <tt>console</tt> object is available).
         * @type String
         * @default 'jcwarn'
         */
        this.warnLog = 'jcwarn';

        /**
         * Store $log messages in case there's no console.
         * @type {Array}
         */
        this.$log = [];

        /**
         * Built-in functions and constants
         * @type Object
         */
        this.builtIn = this.defineBuiltIn();

        /**
         * The board which currently is used to create and look up elements.
         * @type JXG.Board
         */
        this.board = null;

        /**
         * Keep track of which element is created in which line.
         * @type Object
         */
        this.lineToElement = {};

        this.parCurLine = 1;
        this.parCurColumn = 0;
        this.line = 1;
        this.col = 1;

        this.code = '';

        if (typeof code === 'string') {
            this.parse(code, geonext);
        }
    };


    JXG.extend(JXG.JessieCode.prototype, /** @lends JXG.JessieCode.prototype */ {
        /**
         * Create a new parse tree node.
         * @param {String} type Type of node, e.g. node_op, node_var, or node_const
         * @param value The nodes value, e.g. a variables value or a functions body.
         * @param {Array} children Arbitrary number of child nodes.
         */
        node: function (type, value, children) {
            return {
                type: type,
                value: value,
                children: children
            };
        },

        /**
         * Create a new parse tree node. Basically the same as node(), but this builds
         * the children part out of an arbitrary number of parameters, instead of one
         * array parameter.
         * @param {String} type Type of node, e.g. node_op, node_var, or node_const
         * @param value The nodes value, e.g. a variables value or a functions body.
         * @param children Arbitrary number of parameters; define the child nodes.
         */
        createNode: function (type, value, children) {
            var n = this.node(type, value, []),
                i;

            for (i = 2; i < arguments.length; i++) {
                n.children.push(arguments[i]);
            }

            n.line = this.parCurLine;
            n.col = this.parCurColumn;

            return n;
        },

        /**
         * Create a new scope.
         * @param {Array} args
         * @returns {Object}
         */
        pushScope: function (args) {
            var scope = {
                    args: args,
                    locals: {},
                    context: null,
                    previous: this.scope
                };

            this.scope.hasChild = true;
            this.scope = scope;
            scope.id = this.scopes.push(scope) - 1;

            return scope;
        },

        /**
         * Remove the current scope and reinstate the previous scope
         * @returns {Object}
         */
        popScope: function () {
            var s = this.scope.previous;

            // make sure the global scope is not lost
            this.scope = s !== null ? s : this.scope;

            return this.scope;
        },

        /**
         * Looks up an {@link JXG.GeometryElement} by its id.
         * @param {String} id
         * @returns {JXG.GeometryElement}
         */
        getElementById: function (id) {
            return this.board.objects[id];
        },

        log: function () {
            this.$log.push(arguments);

            if (typeof console === 'object' && console.log) {
                console.log.apply(console, arguments);
            }
        },

        /**
         * Returns a element creator function which takes two parameters: the parents array and the attributes object.
         * @param {String} vname The element type, e.g. 'point', 'line', 'midpoint'
         * @returns {function}
         */
        creator: (function () {
            // stores the already defined creators
            var _ccache = {}, r;

            r = function (vname) {
                var f;

                // _ccache is global, i.e. it is the same for ALL JessieCode instances.
                // That's why we need the board id here
                if (typeof _ccache[this.board.id + vname] === 'function') {
                    f =  _ccache[this.board.id + vname];
                } else {
                    f = (function (that) {
                        return function (parameters, attributes) {
                            var attr;

                            if (Type.exists(attributes)) {
                                attr = attributes;
                            } else {
                                attr = {name: (that.lhs[that.scope] !== 0 ? that.lhs[that.scope] : '')};
                            }
                            return that.board.create(vname, parameters, attr);
                        };
                    }(this));

                    f.creator = true;
                    _ccache[this.board.id + vname] = f;
                }

                return f;
            };

            r.clearCache = function () {
                _ccache = {};
            };

            return r;
        }()),

        /**
         * Assigns a value to a variable in the current scope.
         * @param {String} vname Variable name
         * @param value Anything
         * @see JXG.JessieCode#sstack
         * @see JXG.JessieCode#scope
         */
        letvar: function (vname, value) {
            if (this.builtIn[vname]) {
                this._warn('"' + vname + '" is a predefined value.');
            }

            this.scope.locals[vname] = value;
        },

        /**
         * Checks if the given variable name can be found in the current scope chain.
         * @param {String} vname
         * @returns {Object} A reference to the scope object the variable can be found in or null if it can't be found.
         */
        isLocalVariable: function (vname) {
            var s = this.scope;

            while (s !== null) {
                if (Type.exists(s.locals[vname])) {
                    return s;
                }

                s = s.previous;
            }

            return null;
        },

        /**
         * Checks if the given variable name is a parameter in any scope from the current to the global scope.
         * @param {String} vname
         * @returns {Object} A reference to the scope object that contains the variable in its arg list.
         */
        isParameter: function (vname) {
            var s = this.scope;

            while (s !== null) {
                if (Type.indexOf(s.args, vname) > -1) {
                    return s;
                }

                s = s.previous;
            }

            return null;
        },

        /**
         * Checks if the given variable name is a valid creator method.
         * @param {String} vname
         * @returns {Boolean}
         */
        isCreator: function (vname) {
            // check for an element with this name
            return !!JXG.elements[vname];
        },

        /**
         * Checks if the given variable identifier is a valid member of the JavaScript Math Object.
         * @param {String} vname
         * @returns {Boolean}
         */
        isMathMethod: function (vname) {
            return vname !== 'E' && !!Math[vname];
        },

        /**
         * Returns true if the given identifier is a builtIn variable/function.
         * @param {String} vname
         * @returns {Boolean}
         */
        isBuiltIn: function (vname) {
            return !!this.builtIn[vname];
        },

        /**
         * Looks up the value of the given variable.
         * @param {String} vname Name of the variable
         * @param {Boolean} [local=false] Only look up the internal symbol table and don't look for
         * the <tt>vname</tt> in Math or the element list.
         */
        getvar: function (vname, local) {
            var s;

            local = Type.def(local, false);

            s = this.isLocalVariable(vname);
            if (s !== null) {
                return s.locals[vname];
            }

            // check for an element with this name
            if (this.isCreator(vname)) {
                return this.creator(vname);
            }

            if (this.isBuiltIn(vname)) {
                return this.builtIn[vname];
            }

            if (this.isMathMethod(vname)) {
                return Math[vname];
            }

            if (!local) {
                s = this.board.select(vname);
                if (s !== vname) {
                    return s;
                }
            }
        },

        /**
         * Look up the value of a local variable.
         * @param {string} vname
         * @returns {*}
         */
        resolve: function (vname) {
            var s = this.scope;

            while (s !== null) {
                if (Type.exists(s.locals[vname])) {
                    return s.locals[vname];
                }

                s = s.previous;
            }
        },

        /**
         * TODO this needs to be called from JS and should not generate JS code
         * Looks up a variable identifier in various tables and generates JavaScript code that could be eval'd to get the value.
         * @param {String} vname Identifier
         * @param {Boolean} [local=false] Don't resolve ids and names of elements
         * @param {Boolean} [withProps=false]
         */
        getvarJS: function (vname, local, withProps) {
            var s, r = '';

            local = Type.def(local, false);
            withProps = Type.def(withProps, false);

            s = this.isParameter(vname);
            if (s !== null) {
                return vname;
            }

            s = this.isLocalVariable(vname);
            if (s !== null && !withProps) {
                return '$jc$.resolve(\'' + vname + '\')';
            }

            // check for an element with this name
            if (this.isCreator(vname)) {
                return '(function () { var a = Array.prototype.slice.call(arguments, 0), props = ' + (withProps ? 'a.pop()' : '{}') + '; return $jc$.board.create.apply($jc$.board, [\'' + vname + '\'].concat([a, props])); })';
            }

            if (withProps) {
                this._error('Syntax error (attribute values are allowed with element creators only)');
            }

            if (this.isBuiltIn(vname)) {
                // if src does not exist, it is a number. in that case, just return the value.
                return this.builtIn[vname].src || this.builtIn[vname];
            }

            if (this.isMathMethod(vname)) {
                return 'Math.' + vname;
            }

            if (!local) {
                if (Type.isId(this.board, vname)) {
                    r = '$jc$.board.objects[\'' + vname + '\']';
                } else if (Type.isName(this.board, vname)) {
                    r = '$jc$.board.elementsByName[\'' + vname + '\']';
                } else if (Type.isGroup(this.board, vname)) {
                    r = '$jc$.board.groups[\'' + vname + '\']';
                }

                return r;
            }

            return '';
        },

        /**
         * Adds the property <tt>isMap</tt> to a function and sets it to true.
         * @param {function} f
         * @returns {function}
         */
        makeMap: function (f) {
            f.isMap = true;

            return f;
        },

        functionCodeJS: function (node) {
            var p = node.children[0].join(', '),
                bo = '',
                bc = '';

            if (node.value === 'op_map') {
                bo = '{ return  ';
                bc = ' }';
            }

            return 'function (' + p + ') {\n' +
                    'var $oldscope$ = $jc$.scope;\n' +
                    '$jc$.scope = $jc$.scopes[' + this.scope.id + '];\n' +
                    'var r = (function () ' + bo + this.compile(node.children[1], true) + bc + ')();\n' +
                    '$jc$.scope = $oldscope$;\n' +
                    'return r;\n' +
                '}';
        },

        /**
         * Converts a node type <tt>node_op</tt> and value <tt>op_map</tt> or <tt>op_function</tt> into a executable
         * function.
         * @param {Object} node
         * @returns {function}
         */
        defineFunction: function (node) {
            var fun, i,
                list = node.children[0],
                scope = this.pushScope(list);

            if (this.board.options.jc.compile) {
                this.isLHS = false;

                // we currently need to put the parameters into the local scope
                // until the compiled JS variable lookup code is fixed
                for (i = 0; i < list.length; i++) {
                    scope.locals[list[i]] = list[i];
                }

                this.replaceNames(node.children[1]);

                fun = (function ($jc$) {
                    var fun,
                        str = 'var f = ' + $jc$.functionCodeJS(node) + '; f;';

                    try {
                        // yeah, eval is evil, but we don't have much choice here.
                        // the str is well defined and there is no user input in it that we didn't check before

                        /*jslint evil:true*/
                        fun = eval(str);
                        /*jslint evil:false*/

                        return fun;
                    } catch (e) {
                        $jc$._warn('error compiling function\n\n' + str + '\n\n' + e.toString());
                        return function () {};
                    }
                }(this));

                // clean up scope
                this.popScope();
            } else {
                fun = (function (_pstack, that, id) {
                    return function () {
                        var r, oldscope;

                        oldscope = that.scope;
                        that.scope = that.scopes[id];

                        for (r = 0; r < _pstack.length; r++) {
                            that.scope.locals[_pstack[r]] = arguments[r];
                        }

                        r = that.execute(node.children[1]);
                        that.scope = oldscope;

                        return r;
                    };
                }(list, this, scope.id));
            }

            fun.node = node;
            fun.scope = scope;
            fun.toJS = fun.toString;
            fun.toString = (function (_that) {
                return function () {
                    return _that.compile(_that.replaceIDs(Type.deepCopy(node)));
                };
            }(this));

            fun.deps = {};
            this.collectDependencies(node.children[1], fun.deps);

            return fun;
        },

        /**
         * Merge all atribute values given with an element creator into one object.
         * @param {Object} o An arbitrary number of objects
         * @returns {Object} All given objects merged into one. If properties appear in more (case sensitive) than one
         * object the last value is taken.
         */
        mergeAttributes: function (o) {
            var i, attr = {};

            for (i = 0; i < arguments.length; i++) {
                attr = Type.deepCopy(attr, arguments[i], true);
            }

            return attr;
        },

        /**
         * Sets the property <tt>what</tt> of <tt>o</tt> to <tt>value</tt>
         * @param {JXG.Point|JXG.Text} o
         * @param {String} what
         * @param value
         */
        setProp: function (o, what, value) {
            var par = {}, x, y;

            if (o.elementClass === Const.OBJECT_CLASS_POINT && (what === 'X' || what === 'Y')) {
                // set coords

                what = what.toLowerCase();

                // we have to deal with three cases here:
                // o.isDraggable && typeof value === number:
                //   stay draggable, just set the new coords (e.g. via moveTo)
                // o.isDraggable && typeof value === function:
                //   convert to !o.isDraggable, set the new coords via o.addConstraint()
                // !o.isDraggable:
                //   stay !o.isDraggable, update the given coord by overwriting X/YEval

                if (o.isDraggable && typeof value === 'number') {
                    x = what === 'x' ? value : o.X();
                    y = what === 'y' ? value : o.Y();

                    o.setPosition(Const.COORDS_BY_USER, [x, y]);
                } else if (o.isDraggable && (typeof value === 'function' || typeof value === 'string')) {
                    x = what === 'x' ? value : o.coords.usrCoords[1];
                    y = what === 'y' ? value : o.coords.usrCoords[2];

                    o.addConstraint([x, y]);
                } else if (!o.isDraggable) {
                    x = what === 'x' ? value : o.XEval.origin;
                    y = what === 'y' ? value : o.YEval.origin;

                    o.addConstraint([x, y]);
                }

                this.board.update();
            } else if (o.elementClass === Const.OBJECT_CLASS_TEXT && (what === 'X' || what === 'Y')) {
                if (typeof value === 'number') {
                    o[what] = function () { return value; };
                } else if (typeof value === 'function') {
                    o.isDraggable = false;
                    o[what] = value;
                } else if (typeof value === 'string') {
                    o.isDraggable = false;
                    o[what] = Type.createFunction(value, this.board, null, true);
                    o[what + 'jc'] = value;
                }

                o[what].origin = value;

                this.board.update();
            } else if (o.type && o.elementClass && o.visProp) {
                if (Type.exists(o[o.methodMap[what]]) && typeof o[o.methodMap[what]] !== 'function') {
                    o[o.methodMap[what]] = value;
                } else {
                    par[what] = value;
                    o.setAttribute(par);
                }
            } else {
                o[what] = value;
            }
        },

        /**
         * Parses JessieCode
         * @param {String} code
         * @param {Boolean} [geonext=false] Geonext compatibility mode.
         * @param {Boolean} dontstore
         */
        parse: function (code, geonext, dontstore) {
            var i, setTextBackup, ast, result,
                ccode = code.replace(/\r\n/g, '\n').split('\n'),
                cleaned = [];

            if (!dontstore) {
                this.code += code + '\n';
            }

            if (Text) {
                setTextBackup = Text.Text.prototype.setText;
                Text.Text.prototype.setText = Text.Text.prototype.setTextJessieCode;
            }

            try {
                if (!Type.exists(geonext)) {
                    geonext = false;
                }

                for (i = 0; i < ccode.length; i++) {
                    if (geonext) {
                        ccode[i] = JXG.GeonextParser.geonext2JS(ccode[i], this.board);
                    }
                    cleaned.push(ccode[i]);
                }

                code = cleaned.join('\n');
                ast = parser.parse(code);
                ast = this.expandDerivatives(ast, null, ast);
                ast = this.removeTrivialNodes(ast);
                console.log(this.compile(ast));
                result = this.execute(ast);
            } catch (e) {  // catch is mandatory in old IEs
            } finally {
                // make sure the original text method is back in place
                if (Text) {
                    Text.Text.prototype.setText = setTextBackup;
                }
            }

            return result;
        },

        /**
         * Parses a JessieCode snippet, e.g. "3+4", and wraps it into a function, if desired.
         * @param {String} code A small snippet of JessieCode. Must not be an assignment.
         * @param {Boolean} funwrap If true, the code is wrapped in a function.
         * @param {String} varname Name of the parameter(s)
         * @param {Boolean} [geonext=false] Geonext compatibility mode.
         */
        snippet: function (code, funwrap, varname, geonext) {
            var c;

            funwrap = Type.def(funwrap, true);
            varname = Type.def(varname, '');
            geonext = Type.def(geonext, false);

            c = (funwrap ? ' function (' + varname + ') { return ' : '') + code + (funwrap ? '; }' : '') + ';';

            return this.parse(c, geonext, true);
        },

        /**
         * Traverses through the given subtree and changes all values of nodes with the replaced flag set by
         * {@link JXG.JessieCode#replaceNames} to the name of the element (if not empty).
         * @param {Object} node
         */
        replaceIDs: function (node) {
            var i, v;

            if (node.replaced) {
                // these children exist, if node.replaced is set.
                v = this.board.objects[node.children[1][0].value];

                if (Type.exists(v) && v.name !== "") {
                    node.type = 'node_var';
                    node.value = v.name;

                    // maybe it's not necessary, but just to be sure that everything is cleaned up we better delete all
                    // children and the replaced flag
                    node.children.length = 0;
                    delete node.replaced;
                }
            }

            if (node.children) {
                // assignments are first evaluated on the right hand side
                for (i = node.children.length; i > 0; i--) {
                    if (Type.exists(node.children[i - 1])) {
                        node.children[i - 1] = this.replaceIDs(node.children[i - 1]);
                    }

                }
            }

            return node;
        },

        /**
         * Traverses through the given subtree and changes all elements referenced by names through referencing them by ID.
         * An identifier is only replaced if it is not found in all scopes above the current scope and if it
         * has not been blacklisted within the codeblock determined by the given subtree.
         * @param {Object} node
         */
        replaceNames: function (node) {
            var i, v;

            v = node.value;

            // we are interested only in nodes of type node_var and node_op > op_lhs.
            // currently, we are not checking if the id is a local variable. in this case, we're stuck anyway.

            if (node.type === 'node_op' && v === 'op_lhs' && node.children.length === 1) {
                this.isLHS = true;
            } else if (node.type === 'node_var') {
                if (this.isLHS) {
                    this.letvar(v, true);
                } else if (!Type.exists(this.getvar(v, true)) && Type.exists(this.board.elementsByName[v])) {
                    node = this.createReplacementNode(node);
                }
            }

            if (node.children) {
                // assignments are first evaluated on the right hand side
                for (i = node.children.length; i > 0; i--) {
                    if (Type.exists(node.children[i - 1])) {
                        node.children[i - 1] = this.replaceNames(node.children[i - 1]);
                    }
                }
            }

            if (node.type === 'node_op' && node.value === 'op_lhs' && node.children.length === 1) {
                this.isLHS = false;
            }

            return node;
        },

        /**
         * Replaces node_var nodes with node_op&gt;op_execfun nodes, calling the internal $() function with the id of the
         * element accessed by the node_var node.
         * @param {Object} node
         * @returns {Object} op_execfun node
         */
        createReplacementNode: function (node) {
            var v = node.value,
                el = this.board.elementsByName[v];

            node = this.createNode('node_op', 'op_execfun',
                this.createNode('node_var', '$'),
                [this.createNode('node_str', el.id)]);

            node.replaced = true;

            return node;
        },

        /**
         * Search the parse tree below <tt>node</tt> for <em>stationary</em> dependencies, i.e. dependencies hard coded into
         * the function.
         * @param {Object} node
         * @param {Object} result An object where the referenced elements will be stored. Access key is their id.
         */
        collectDependencies: function (node, result) {
            var i, v, e;

            v = node.value;

            if (node.type === 'node_var') {
                e = this.getvar(v);
                if (e && e.visProp && e.type && e.elementClass && e.id) {
                    result[e.id] = e;
                }
            }

            // the $()-function-calls are special because their parameter is given as a string, not as a node_var.
            if (node.type === 'node_op' && node.value === 'op_execfun' && node.children.length > 1 && node.children[0].value === '$' && node.children[1].length > 0) {
                e = node.children[1][0].value;
                result[e] = this.board.objects[e];
            }

            if (node.children) {
                for (i = node.children.length; i > 0; i--) {
                    if (Type.exists(node.children[i - 1])) {
                        this.collectDependencies(node.children[i - 1], result);
                    }

                }
            }
        },

        resolveProperty: function (e, v, compile) {
            compile = Type.def(compile, false);

            // is it a geometry element or a board?
            if (e /*&& e.type && e.elementClass*/ && e.methodMap) {
                // yeah, it is. but what does the user want?
                if (Type.exists(e.subs) && Type.exists(e.subs[v])) {
                    // a subelement it is, good sir.
                    e = e.subs;
                } else if (Type.exists(e.methodMap[v])) {
                    // the user wants to call a method
                    v = e.methodMap[v];
                } else {
                    // the user wants to change an attribute
                    e = e.visProp;
                    v = v.toLowerCase();
                }
            }

            if (!Type.exists(e)) {
                this._error(e + ' is not an object');
            }

            if (!Type.exists(e[v])) {
                this._error('unknown property ' + v);
            }

            if (compile && typeof e[v] === 'function') {
                return function () { return e[v].apply(e, arguments); };
            }

            return e[v];
        },

        /**
         * Resolves the lefthand side of an assignment operation
         * @param node
         * @returns {Object} An object with two properties. <strong>o</strong> which contains the object, and
         * a string <strong>what</strong> which contains the property name.
         */
        getLHS: function (node) {
            var res;

            if (node.type === 'node_var') {
                res = {
                    o: this.scope.locals,
                    what: node.value
                };
            } else if (node.type === 'node_op' && node.value === 'op_property') {
                res = {
                    o: this.execute(node.children[0]),
                    what: node.children[1]
                };
            } else if (node.type === 'node_op' && node.value === 'op_extvalue') {
                res = {
                    o: this.execute(node.children[0]),
                    what: this.execute(node.children[1])
                };
            } else {
                throw new Error('Syntax error: Invalid left-hand side of assignment.');
            }

            return res;
        },

        getLHSCompiler: function (node, js) {
            var res;

            if (node.type === 'node_var') {
                res = node.value;
            } else if (node.type === 'node_op' && node.value === 'op_property') {
                res = [
                    this.compile(node.children[0], js),
                    "'" + node.children[1] + "'"
                ];
            } else if (node.type === 'node_op' && node.value === 'op_extvalue') {
                res = [
                    this.compile(node.children[0], js),
                    node.children[1].type === 'node_const' ? node.children[1].value : this.compile(node.children[1], js)
                ];
            } else {
                throw new Error('Syntax error: Invalid left-hand side of assignment.');
            }

            return res;
        },

        /**
         * Executes a parse subtree.
         * @param {Object} node
         * @returns {Number|String|Object|Boolean} Something
         * @private
         */
        execute: function (node) {
            var ret, v, i, e, l, undef, list, ilist,
                parents = [],
                // exec fun
                fun, attr, sc;

            ret = 0;

            if (!node) {
                return ret;
            }

            this.line = node.line;
            this.col = node.col;

            switch (node.type) {
            case 'node_op':
                switch (node.value) {
                case 'op_none':
                    if (node.children[0]) {
                        this.execute(node.children[0]);
                    }
                    if (node.children[1]) {
                        ret = this.execute(node.children[1]);
                    }
                    break;
                case 'op_assign':
                    v = this.getLHS(node.children[0]);

                    this.lhs[this.scope.id] = v[1];

                    if (v.o.type && v.o.elementClass && v.o.methodMap && v.what === 'label') {
                        this._error('Left-hand side of assignment is read-only.');
                    }

                    ret = this.execute(node.children[1]);
                    if (v.o !== this.scope.locals || (Type.isArray(v.o) && typeof v.what === 'number')) {
                        // it is either an array component being set or a property of an object.
                        this.setProp(v.o, v.what, ret);
                    } else {
                        // this is just a local variable inside JessieCode
                        this.letvar(v.what, ret);
                    }

                    this.lhs[this.scope.id] = 0;
                    break;
                case 'op_if':
                    if (this.execute(node.children[0])) {
                        ret = this.execute(node.children[1]);
                    }
                    break;
                case 'op_conditional':
                    // fall through
                case 'op_if_else':
                    if (this.execute(node.children[0])) {
                        ret = this.execute(node.children[1]);
                    } else {
                        ret = this.execute(node.children[2]);
                    }
                    break;
                case 'op_while':
                    while (this.execute(node.children[0])) {
                        this.execute(node.children[1]);
                    }
                    break;
                case 'op_do':
                    do {
                        this.execute(node.children[0]);
                    } while (this.execute(node.children[1]));
                    break;
                case 'op_for':
                    for (this.execute(node.children[0]); this.execute(node.children[1]); this.execute(node.children[2])) {
                        this.execute(node.children[3]);
                    }
                    break;
                case 'op_proplst':
                    if (node.children[0]) {
                        this.execute(node.children[0]);
                    }
                    if (node.children[1]) {
                        this.execute(node.children[1]);
                    }
                    break;
                case 'op_emptyobject':
                    ret = {};
                    break;
                case 'op_proplst_val':
                    this.propstack.push({});
                    this.propscope++;

                    this.execute(node.children[0]);
                    ret = this.propstack[this.propscope];

                    this.propstack.pop();
                    this.propscope--;
                    break;
                case 'op_prop':
                    // child 0: Identifier
                    // child 1: Value
                    this.propstack[this.propscope][node.children[0]] = this.execute(node.children[1]);
                    break;
                case 'op_array':
                    ret = [];
                    l = node.children[0].length;

                    for (i = 0; i < l; i++) {
                        ret.push(this.execute(node.children[0][i]));
                    }

                    break;
                case 'op_extvalue':
                    ret = this.execute(node.children[0]);
                    i = this.execute(node.children[1]);

                    if (typeof i === 'number' && Math.abs(Math.round(i) - i) < Mat.eps) {
                        ret = ret[i];
                    } else {
                        ret = undef;
                    }
                    break;
                case 'op_return':
                    if (this.scope === 0) {
                        this._error('Unexpected return.');
                    } else {
                        return this.execute(node.children[0]);
                    }
                    break;
                case 'op_map':
                    if (!node.children[1].isMath) {
                        this._error('In a map only function calls and mathematical expressions are allowed.');
                    }

                    fun = this.defineFunction(node);
                    fun.isMap = true;

                    ret = fun;
                    break;
                case 'op_function':
                    // parse the parameter list
                    // after this, the parameters are in pstack

                    fun = this.defineFunction(node);
                    fun.isMap = false;

                    ret = fun;
                    break;
                case 'op_execfun':
                    // node.children:
                    //   [0]: Name of the function
                    //   [1]: Parameter list as a parse subtree
                    //   [2]: Properties, only used in case of a create function
                    this.dpstack.push([]);
                    this.pscope++;

                    // parameter parsing is done below
                    list = node.children[1];

                    // parse the properties only if given
                    if (Type.exists(node.children[2])) {
                        if (node.children[3]) {
                            ilist = node.children[2];
                            attr = {};

                            for (i = 0; i < ilist.length; i++) {
                                attr = Type.deepCopy(attr, this.execute(ilist[i]), true);
                            }
                        } else {
                            attr = this.execute(node.children[2]);
                        }
                    }

                    // look up the variables name in the variable table
                    fun = this.execute(node.children[0]);

                    // determine the scope the function wants to run in
                    if (fun && fun.sc) {
                        sc = fun.sc;
                    } else {
                        sc = this;
                    }

                    if (!fun.creator && Type.exists(node.children[2])) {
                        this._error('Unexpected value. Only element creators are allowed to have a value after the function call.');
                    }

                    // interpret ALL the parameters
                    for (i = 0; i < list.length; i++) {
                        parents[i] = this.execute(list[i]);
                        this.dpstack[this.pscope].push({
                            line: node.children[1][i].line,
                            // SketchBin currently works only if the last column of the
                            // parent position is taken. This is due to how I patched JS/CC
                            // to count the lines and columns. So, ecol will do for now
                            col: node.children[1][i].ecol
                        });
                    }

                    // check for the function in the variable table
                    if (typeof fun === 'function' && !fun.creator) {
                        ret = fun.apply(sc, parents);
                    } else if (typeof fun === 'function' && !!fun.creator) {
                        e = this.line;

                        // creator methods are the only ones that take properties, hence this special case
                        try {
                            ret = fun(parents, attr);
                            ret.jcLineStart = e;
                            ret.jcLineEnd = node.eline;

                            for (i = e; i <= node.line; i++) {
                                this.lineToElement[i] = ret;
                            }

                            ret.debugParents = this.dpstack[this.pscope];
                        } catch (ex) {
                            this._error(ex.toString());
                        }
                    } else {
                        this._error('Function \'' + fun + '\' is undefined.');
                    }

                    // clear parameter stack
                    this.dpstack.pop();
                    this.pscope--;
                    break;
                case 'op_property':
                    e = this.execute(node.children[0]);
                    v = node.children[1];

                    ret = this.resolveProperty(e, v, false);

                    // set the scope, in case this is a method the user wants to call
                    if (Type.exists(ret)) {
                        ret.sc = e;
                    }

                    break;
                case 'op_use':
                    this._warn('Use of the \'use\' operator is deprecated.');
                    this.use(node.children[0].toString());
                    break;
                case 'op_delete':
                    this._warn('Use of the \'delete\' operator is deprecated. Please use the remove() function.');
                    v = this.getvar(node.children[0]);
                    ret = this.del(v);
                    break;
                case 'op_equ':
                    // == is intentional
                    /*jslint eqeq:true*/
                    ret = this.execute(node.children[0]) == this.execute(node.children[1]);
                    /*jslint eqeq:false*/
                    break;
                case 'op_neq':
                    // != is intentional
                    /*jslint eqeq:true*/
                    ret = this.execute(node.children[0]) != this.execute(node.children[1]);
                    /*jslint eqeq:true*/
                    break;
                case 'op_approx':
                    ret = Math.abs(this.execute(node.children[0]) - this.execute(node.children[1])) < Mat.eps;
                    break;
                case 'op_grt':
                    ret = this.execute(node.children[0]) > this.execute(node.children[1]);
                    break;
                case 'op_lot':
                    ret = this.execute(node.children[0]) < this.execute(node.children[1]);
                    break;
                case 'op_gre':
                    ret = this.execute(node.children[0]) >= this.execute(node.children[1]);
                    break;
                case 'op_loe':
                    ret = this.execute(node.children[0]) <= this.execute(node.children[1]);
                    break;
                case 'op_or':
                    ret = this.execute(node.children[0]) || this.execute(node.children[1]);
                    break;
                case 'op_and':
                    ret = this.execute(node.children[0]) && this.execute(node.children[1]);
                    break;
                case 'op_not':
                    ret = !this.execute(node.children[0]);
                    break;
                case 'op_add':
                    ret = this.add(this.execute(node.children[0]), this.execute(node.children[1]));
                    break;
                case 'op_sub':
                    ret = this.sub(this.execute(node.children[0]), this.execute(node.children[1]));
                    break;
                case 'op_div':
                    ret = this.div(this.execute(node.children[0]), this.execute(node.children[1]));
                    break;
                case 'op_mod':
                    // use mathematical modulo, JavaScript implements the symmetric modulo.
                    ret = this.mod(this.execute(node.children[0]), this.execute(node.children[1]), true);
                    break;
                case 'op_mul':
                    ret = this.mul(this.execute(node.children[0]), this.execute(node.children[1]));
                    break;
                case 'op_exp':
                    ret = this.pow(this.execute(node.children[0]),  this.execute(node.children[1]));
                    break;
                case 'op_neg':
                    ret = this.execute(node.children[0]) * -1;
                    break;
                }
                break;

            case 'node_var':
                ret = this.getvar(node.value);
                break;

            case 'node_const':
                ret = Number(node.value);
                break;

            case 'node_const_bool':
                ret = node.value;
                break;

            case 'node_str':
                //ret = node.value.replace(/\\'/, "'").replace(/\\"/, '"').replace(/\\\\/, '\\');
                /*jslint regexp:true*/
                ret = node.value.replace(/\\(.)/, '$1');
                /*jslint regexp:false*/
                break;
            }

            return ret;
        },

        /**
         * Compiles a parse tree back to JessieCode.
         * @param {Object} node
         * @param {Boolean} [js=false] Currently ignored. Compile either to JavaScript or back to JessieCode (required for the UI).
         * @returns Something
         * @private
         */
        compile: function (node, js) {
            var e, i, list, scope,
                ret = '';

            if (!Type.exists(js)) {
                js = false;
            }

            if (!node) {
                return ret;
            }

            switch (node.type) {
            case 'node_op':
                switch (node.value) {
                case 'op_none':
                    if (node.children[0]) {
                        ret = this.compile(node.children[0], js);
                    }
                    if (node.children[1]) {
                        ret += this.compile(node.children[1], js);
                    }
                    break;
                case 'op_assign':
                    //e = this.compile(node.children[0], js);
                    if (js) {
                        e = this.getLHSCompiler(node.children[0], js);
                        if (Type.isArray(e)) {
                            ret = '$jc$.setProp(' + e[0] + ', ' + e[1] + ', ' + this.compile(node.children[1], js) + ');\n';
                        } else {
                            if (this.isLocalVariable(e) !== this.scope) {
                                this.scope.locals[e] = true;
                            }
                            ret = '$jc$.scopes[' + this.scope.id + '].locals[\'' + e + '\'] = ' + this.compile(node.children[1], js) + ';\n';
                        }
                    } else {
                        e = this.compile(node.children[0]);
                        ret = e + ' = ' + this.compile(node.children[1], js) + ';\n';
                    }
                    break;
                case 'op_if':
                    ret = ' if (' + this.compile(node.children[0], js) + ') ' + this.compile(node.children[1], js);
                    break;
                case 'op_if_else':
                    ret = ' if (' + this.compile(node.children[0], js) + ')' + this.compile(node.children[1], js);
                    ret += ' else ' + this.compile(node.children[2], js);
                    break;
                case 'op_conditional':
                    ret = '((' + this.compile(node.children[0], js) + ')?(' + this.compile(node.children[1], js);
                    ret += '):(' + this.compile(node.children[2], js) + '))';
                    break;
                case 'op_while':
                    ret = ' while (' + this.compile(node.children[0], js) + ') {\n' + this.compile(node.children[1], js) + '}\n';
                    break;
                case 'op_do':
                    ret = ' do {\n' + this.compile(node.children[0], js) + '} while (' + this.compile(node.children[1], js) + ');\n';
                    break;
                case 'op_for':
                    ret = ' for (' + this.compile(node.children[0], js) + '; ' + this.compile(node.children[1], js) + '; ' + this.compile(node.children[2], js) + ') {\n' + this.compile(node.children[3], js) + '\n}\n';
                    break;
                case 'op_proplst':
                    if (node.children[0]) {
                        ret = this.compile(node.children[0], js) + ', ';
                    }

                    ret += this.compile(node.children[1], js);
                    break;
                case 'op_prop':
                    // child 0: Identifier
                    // child 1: Value
                    ret = node.children[0] + ': ' + this.compile(node.children[1], js);
                    break;
                case 'op_emptyobject':
                    ret = js ? '{}' : '<< >>';
                    break;
                case 'op_proplst_val':
                    ret = this.compile(node.children[0], js);
                    break;
                case 'op_array':
                    list = [];
                    for (i = 0; i < node.children[0].length; i++) {
                        list.push(this.compile(node.children[0][i], js));
                    }
                    ret = '[' + list.join(', ') + ']';
                    break;
                case 'op_extvalue':
                    ret = this.compile(node.children[0], js) + '[' + this.compile(node.children[1], js) + ']';
                    break;
                case 'op_return':
                    ret = ' return ' + this.compile(node.children[0], js) + ';\n';
                    break;
                case 'op_map':
                    if (!node.children[1].isMath) {
                        this._error('In a map only function calls and mathematical expressions are allowed.');
                    }

                    list = node.children[0];
                    if (js) {
                        ret = ' $jc$.makeMap(function (' + list.join(', ') + ') { return ' + this.compile(node.children[1], js) + '; })';
                    } else {
                        ret = 'map (' + list.join(', ') + ') -> ' + this.compile(node.children[1], js);
                    }

                    break;
                case 'op_function':
                    list = node.children[0];
                    scope = this.pushScope(list);
                    if (js) {
                        ret = this.functionCodeJS(node);
                    } else {
                        ret = ' function (' + list.join(', ') + ') ' + this.compile(node.children[1], js);
                    }
                    this.popScope();
                    break;
                case 'op_execfunmath':
                    console.log('TODO');
                    ret = '-1';
                    break;
                case 'op_execfun':
                    // parse the properties only if given
                    if (node.children[2]) {
                        list = [];
                        for (i = 0; i < node.children[2].length; i++) {
                            list.push(this.compile(node.children[2][i], js));
                        }

                        if (js) {
                            e = '$jc$.mergeAttributes(' + list.join(', ') + ')';
                        }
                    }
                    node.children[0].withProps = !!node.children[2];
                    list = [];
                    for (i = 0; i < node.children[1].length; i++) {
                        list.push(this.compile(node.children[1][i], js));
                    }
                    ret = this.compile(node.children[0], js) + '(' + list.join(', ') + (node.children[2] && js ? ', ' + e : '') + ')' + (node.children[2] && !js ? e : '');

                    // save us a function call when compiled to javascript
                    if (js && node.children[0].value === '$') {
                        ret = '$jc$.board.objects[' + this.compile(node.children[1][0], js) + ']';
                    }

                    break;
                case 'op_property':
                    if (js && node.children[1] !== 'X' && node.children[1] !== 'Y') {
                        ret = '$jc$.resolveProperty(' + this.compile(node.children[0], js) + ', \'' + node.children[1] + '\', true)';
                    } else {
                        ret = this.compile(node.children[0], js) + '.' + node.children[1];
                    }
                    break;
                case 'op_use':
                    this._warn('Use of the \'use\' operator is deprecated.');
                    if (js) {
                        ret = '$jc$.use(\'';
                    } else {
                        ret = 'use(\'';
                    }

                    ret += node.children[0].toString() + '\');';
                    break;
                case 'op_delete':
                    this._warn('Use of the \'delete\' operator is deprecated. Please use the remove() function.');
                    if (js) {
                        ret = '$jc$.del(';
                    } else {
                        ret = 'remove(';
                    }

                    ret += this.compile(node.children[0], js) + ')';
                    break;
                case 'op_equ':
                    ret = '(' + this.compile(node.children[0], js) + ' == ' + this.compile(node.children[1], js) + ')';
                    break;
                case 'op_neq':
                    ret = '(' + this.compile(node.children[0], js) + ' != ' + this.compile(node.children[1], js) + ')';
                    break;
                case 'op_approx':
                    ret = '(' + this.compile(node.children[0], js) + ' ~= ' + this.compile(node.children[1], js) + ')';
                    break;
                case 'op_grt':
                    ret = '(' + this.compile(node.children[0], js) + ' > ' + this.compile(node.children[1], js) + ')';
                    break;
                case 'op_lot':
                    ret = '(' + this.compile(node.children[0], js) + ' < ' + this.compile(node.children[1], js) + ')';
                    break;
                case 'op_gre':
                    ret = '(' + this.compile(node.children[0], js) + ' >= ' + this.compile(node.children[1], js) + ')';
                    break;
                case 'op_loe':
                    ret = '(' + this.compile(node.children[0], js) + ' <= ' + this.compile(node.children[1], js) + ')';
                    break;
                case 'op_or':
                    ret = '(' + this.compile(node.children[0], js) + ' || ' + this.compile(node.children[1], js) + ')';
                    break;
                case 'op_and':
                    ret = '(' + this.compile(node.children[0], js) + ' && ' + this.compile(node.children[1], js) + ')';
                    break;
                case 'op_not':
                    ret = '!(' + this.compile(node.children[0], js) + ')';
                    break;
                case 'op_add':
                    if (js) {
                        ret = '$jc$.add(' + this.compile(node.children[0], js) + ', ' + this.compile(node.children[1], js) + ')';
                    } else {
                        ret = '(' + this.compile(node.children[0], js) + ' + ' + this.compile(node.children[1], js) + ')';
                    }
                    break;
                case 'op_sub':
                    if (js) {
                        ret = '$jc$.sub(' + this.compile(node.children[0], js) + ', ' + this.compile(node.children[1], js) + ')';
                    } else {
                        ret = '(' + this.compile(node.children[0], js) + ' - ' + this.compile(node.children[1], js) + ')';
                    }
                    break;
                case 'op_div':
                    if (js) {
                        ret = '$jc$.div(' + this.compile(node.children[0], js) + ', ' + this.compile(node.children[1], js) + ')';
                    } else {
                        ret = '(' + this.compile(node.children[0], js) + ' / ' + this.compile(node.children[1], js) + ')';
                    }
                    break;
                case 'op_mod':
                    if (js) {
                        ret = '$jc$.mod(' + this.compile(node.children[0], js) + ', ' + this.compile(node.children[1], js) + ', true)';
                    } else {
                        ret = '(' + this.compile(node.children[0], js) + ' % ' + this.compile(node.children[1], js) + ')';
                    }
                    break;
                case 'op_mul':
                    if (js) {
                        ret = '$jc$.mul(' + this.compile(node.children[0], js) + ', ' + this.compile(node.children[1], js) + ')';
                    } else {
                        ret = '(' + this.compile(node.children[0], js) + ' * ' + this.compile(node.children[1], js) + ')';
                    }
                    break;
                case 'op_exp':
                    if (js) {
                        ret = '$jc$.pow(' + this.compile(node.children[0], js) + ', ' + this.compile(node.children[1], js) + ')';
                    } else {
                        ret = '(' + this.compile(node.children[0], js) + '^' + this.compile(node.children[1], js) + ')';
                    }
                    break;
                case 'op_neg':
                    ret = '(-' + this.compile(node.children[0], js) + ')';
                    break;
                }
                break;

            case 'node_var':
                if (js) {
                    ret = this.getvarJS(node.value, false, node.withProps);
                } else {
                    ret = node.value;
                }
                break;

            case 'node_const':
                ret = node.value;
                break;

            case 'node_const_bool':
                ret = node.value;
                break;

            case 'node_str':
                ret = '\'' + node.value + '\'';
                break;
            }

            if (node.needsBrackets) {
                ret = '{\n' + ret + '}\n';
            }

            return ret;
        },

        findMapNode: function(mapname, node) {
            var i, len, ret;

            //console.log("FINDMAP", node);
            if (node.value === 'op_assign' && node.children[0].value === mapname) {
                return node.children[1];
            } else if (node.children) {
                len = node.children.length;
                for (i = 0; i < len; ++i) {
                    ret = this.findMapNode(mapname, node.children[i]);
                    if (ret !== null) {
                        return ret;
                    }
                }
            }
            return null;
        },

        /**
         * Declare all subnodes as math nodes,
         * i.e recursively set node.isMath = true;
         */
        setMath: function(node) {
            var i, len;

            if ((node.type == 'node_op' && (
                node.value == 'op_add' || node.value == 'op_sub' ||
                node.value == 'op_mul' || node.value == 'op_div' ||
                node.value == 'op_neg' || node.value == 'op_execfun' ||
                node.value == 'op_exp')) ||
                node.type == 'node_var' || node.type == 'node_const') {

                node.isMath = true;
            }
            if (node.children) {
                len = node.children.length;
                for (i = 0; i < len; ++i) {
                    this.setMath(node.children[i]);
                }
            }
        },

        deriveElementary: function(node, varname, order) {
            var fun = node.children[0].value,
                arg = node.children[1],
                newNode;


            switch (fun) {
            case 'abs':
                // x / sqrt(x * x)
                newNode = this.createNode('node_op', 'op_div',
                        arg[0],
                        this.createNode('node_op', 'op_execfun',
                            this.createNode('node_var', 'sqrt'),
                            [this.createNode('node_op', 'op_mul',
                                arg[0],
                                arg[0]
                            )]
                        )
                    );
                break;

            case 'sqrt':
                newNode = this.createNode('node_op', 'op_div',
                        this.createNode('node_const', 1.0),
                        this.createNode('node_op', 'op_mul',
                            this.createNode('node_const', 2.0),
                            this.createNode(node.type, node.value,
                                node.children[0],
                                node.children[1]
                            )
                        )
                    );
                break;

            case 'sin':
                newNode = this.createNode('node_op', 'op_execfun',
                        this.createNode('node_var', 'cos'),
                        arg
                    );
                break;

            case 'cos':
                newNode = this.createNode('node_op', 'op_neg',
                            this.createNode('node_op', 'op_execfun',
                                this.createNode('node_var', 'sin'),
                                arg
                            )
                        );
                break;

            case 'tan':
                newNode = this.createNode('node_op', 'op_div',
                            this.createNode('node_const', 1.0),
                            this.createNode('node_op', 'op_exp',
                                this.createNode('node_op', 'op_execfun',
                                    this.createNode('node_var', 'cos'),
                                    arg
                                ),
                                this.createNode('node_const', 2)
                            )
                        );
                break;

            case 'exp':
                newNode = this.createNode(node.type, node.value,
                            node.children[0],
                            node.children[1]
                        );
                break;

            case 'pow':
                // (f^g)' = f^g*(f'g/f + g' log(f))
                newNode = this.createNode('node_op', 'op_mul',
                        this.createNode('node_op', 'op_execfun',
                            node.children[0],
                            node.children[1]
                        ),
                        this.createNode('node_op', 'op_add',
                            this.createNode('node_op', 'op_mul',
                                this.derivative(node.children[1][0], varname, order),
                                this.createNode('node_op', 'op_div',
                                    node.children[1][1],
                                    node.children[1][0]
                                )
                            ),
                            this.createNode('node_op', 'op_mul',
                                this.derivative(node.children[1][1], varname, order),
                                this.createNode('node_op', 'op_execfun',
                                    this.createNode('node_var', 'log'),
                                    [node.children[1][0]]
                                )
                            )
                        )
                    );
                break;

            case 'log':
            case 'ln':
                newNode = this.createNode('node_op', 'op_div',
                            this.createNode('node_const', 1.0),
                            // Attention: single variable mode
                            arg[0]
                        );
                break;

            case 'log2':
            case 'lb':
            case 'ld':
                newNode = this.createNode('node_op', 'op_mul',
                            this.createNode('node_op', 'op_div',
                                this.createNode('node_const', 1.0),
                                // Attention: single variable mode
                                arg[0]
                            ),
                            this.createNode('node_const', 1.4426950408889634)  // 1/log(2)
                        );
                break;

            case 'log10':
            case 'lg':
                newNode = this.createNode('node_op', 'op_mul',
                            this.createNode('node_op', 'op_div',
                                this.createNode('node_const', 1.0),
                                // Attention: single variable mode
                                arg[0]
                            ),
                            this.createNode('node_const', 0.43429448190325176)  // 1/log(10)
                        );
                break;

            case 'asin':
                newNode = this.createNode('node_op', 'op_div',
                            this.createNode('node_const', 1.0),
                            this.createNode('node_op', 'op_execfun',
                                this.createNode('node_var', 'sqrt'),
                                [
                                    this.createNode('node_op', 'op_sub',
                                        this.createNode('node_const', 1.0),
                                        this.createNode('node_op', 'op_mul',
                                            arg[0],
                                            arg[0]
                                        )
                                    )
                                ]
                            )
                        );
                break;

            case 'acos':
                newNode = this.createNode('node_op', 'op_neg',
                        this.createNode('node_op', 'op_div',
                            this.createNode('node_const', 1.0),
                            this.createNode('node_op', 'op_execfun',
                                this.createNode('node_var', 'sqrt'),
                                [
                                    this.createNode('node_op', 'op_sub',
                                        this.createNode('node_const', 1.0),
                                        this.createNode('node_op', 'op_mul',
                                            arg[0],
                                            arg[0]
                                        )
                                    )
                                ]
                            )
                        )
                    );
                break;

            case 'atan':
                newNode = this.createNode('node_op', 'op_div',
                            this.createNode('node_const', 1.0),
                            this.createNode('node_op', 'op_add',
                                this.createNode('node_const', 1.0),
                                this.createNode('node_op', 'op_mul',
                                    arg[0],
                                    arg[0]
                                )
                            )
                        );
                break;

            //case 'atan2':
            case 'sinh':
                newNode = this.createNode('node_op', 'op_execfun',
                            this.createNode('node_var', 'cosh'),
                            [arg[0]]
                        );
                break;

            case 'cosh':
                newNode = this.createNode('node_op', 'op_execfun',
                            this.createNode('node_var', 'sinh'),
                            [arg[0]]
                        );
                break;

            case 'tanh':
                newNode = this.createNode('node_op', 'op_sub',
                            this.createNode('node_const', 1.0),
                            this.createNode('node_op', 'op_exp',
                                this.createNode('node_op', 'op_execfun',
                                    this.createNode('node_var', 'tanh'),
                                    [arg[0]]
                                ),
                                this.createNode('node_const', 2.0)
                            )
                        );
                break;

            case 'asinh':
                newNode = this.createNode('node_op', 'op_div',
                            this.createNode('node_const', 1.0),
                            this.createNode('node_op', 'op_execfun',
                                this.createNode('node_var', 'sqrt'),
                                [
                                    this.createNode('node_op', 'op_add',
                                        this.createNode('node_op', 'op_mul',
                                            arg[0],
                                            arg[0]
                                        ),
                                        this.createNode('node_const', 1.0)
                                    )
                                ]
                            )
                        );
                break;

            case 'acosh':
                newNode = this.createNode('node_op', 'op_div',
                            this.createNode('node_const', 1.0),
                            this.createNode('node_op', 'op_execfun',
                                this.createNode('node_var', 'sqrt'),
                                [
                                    this.createNode('node_op', 'op_sub',
                                        this.createNode('node_op', 'op_mul',
                                            arg[0],
                                            arg[0]
                                        ),
                                        this.createNode('node_const', 1.0)
                                    )
                                ]
                            )
                        );
                break;

            case 'atanh':
                newNode = this.createNode('node_op', 'op_div',
                            this.createNode('node_const', 1.0),
                            this.createNode('node_op', 'op_sub',
                                this.createNode('node_const', 1.0),
                                this.createNode('node_op', 'op_mul',
                                    arg[0],
                                    arg[0]
                                )
                            )
                        );
                break;

            default:
                newNode = this.createNode('node_const', 0.0);
                this._error('Derivative of "' + fun + '" not yet implemented');
            }

            return newNode;
        },

        derivative: function(node, varname, order) {
            var i, len, newNode;

            switch (node.type) {
            case 'node_op':
                switch (node.value) {
                /*
                case 'op_map':
                    if (true) {
                        newNode = this.createNode('node_op', 'op_map',
                                node.children[0],
                                this.derivative(node.children[1], varname, order)
                            );
                    } else {
                        newNode = this.derivative(node.children[1], varname, order);
                    }
                    break;
                */
                case 'op_execfun':
                    // f'(g(x))g'(x)
                    if (node.children[0].value == 'pow') {
                        newNode = this.deriveElementary(node, varname, order);
                    } else {
                        newNode = this.createNode('node_op', 'op_mul',
                                    this.derivElementary(node, varname, order),
                                    // Warning: single variable mode
                                    this.derivative(node.children[1][0], varname, order)
                                );

                    }
                    break;

                case 'op_div':
                    // (f'g − g'f )/(g*g)
                    newNode = this.createNode('node_op', 'op_div',
                                this.createNode('node_op', 'op_sub',
                                    this.createNode('node_op', 'op_mul',
                                        this.derivative(node.children[0], varname, order),
                                        node.children[1]
                                    ),
                                    this.createNode('node_op', 'op_mul',
                                        node.children[0],
                                        this.derivative(node.children[1], varname, order)
                                    )
                                ),
                                this.createNode('node_op', 'op_mul',
                                    node.children[1],
                                    node.children[1]
                                )
                            );
                    break;

                case 'op_mul':
                    // fg' + f'g
                    newNode = this.createNode('node_op', 'op_add',
                                this.createNode('node_op', 'op_mul',
                                    node.children[0],
                                    this.derivative(node.children[1], varname, order)),
                                this.createNode('node_op', 'op_mul',
                                    this.derivative(node.children[0], varname, order),
                                    node.children[1])
                            );
                    break;

                case 'op_neg':
                    newNode = this.createNode('node_op', 'op_neg',
                                this.derivative(node.children[0], varname, order)
                            );
                    break;

                case 'op_add':
                case 'op_sub':
                    newNode = this.createNode('node_op', node.value,
                                this.derivative(node.children[0], varname, order),
                                this.derivative(node.children[1], varname, order)
                            );
                    break;

                case 'op_exp':
                    // (f^g)' = f^g*(f'g/f + g' log(f))
                    newNode = this.createNode('node_op', 'op_mul',
                                node,
                                this.createNode('node_op', 'op_add',
                                    this.createNode('node_op', 'op_mul',
                                        this.derivative(node.children[0], varname, order),
                                        this.createNode('node_op', 'op_div',
                                            node.children[1],
                                            node.children[0]
                                        )
                                    ),
                                    this.createNode('node_op', 'op_mul',
                                        this.derivative(node.children[1], varname, order),
                                        this.createNode('node_op', 'op_execfun',
                                            this.createNode('node_var', 'log'),
                                            [node.children[0]]
                                        )
                                    )
                                )
                            );
                    break;
                }
                break;

            case 'node_var':
                //console.log('node_var', node);
                if (node.value === varname) {
                    newNode = this.createNode('node_const', 1.0);
                } else {
                    newNode = this.createNode('node_const', 0.0);
                }
                break;

            case 'node_const':
                newNode = this.createNode('node_const', 0.0);
                break;

            case 'node_const_bool':
                break;

            case 'node_str':
                break;

            }

            return newNode;
        },

        /**
         * f = map (x) -> x*sin(x);
         * Usages:
         * h = D(f,x);
         * h = map (x) -> D(f,x);
         *
         * @param  {[type]} node   [description]
         * @param  {[type]} parent [description]
         * @param  {[type]} ast    [description]
         * @return {[type]}        [description]
         */
        expandDerivatives: function(node, parent, ast) {
            var len, i, j, mapNode, codeNode, ret, node2, newNode,
                mapName, varname, vArray, order;

            ret = 0;
            if (!node) {
                return ret;
            }

            this.line = node.line;
            this.col = node.col;

            // First we have to go down in the tree.
            // This ensures that in cases like D(D(f,x),x) the inner D is expanded first.
            len = node.children.length;
            for (i = 0; i < len; ++i) {
                if (node.children[i] && node.children[i].type) {
                    node.children[i] = this.expandDerivatives(node.children[i], node, ast);
                } else if (Type.isArray(node.children[i])) {
                    for (j = 0; j < node.children[i].length; ++j) {
                        if (node.children[i][j] && node.children[i][j].type) {
                            node.children[i][j] = this.expandDerivatives(node.children[i][j], node, ast);
                        }
                    }
                }
            }

            switch (node.type) {
            case 'node_op':
                switch (node.value) {
                case 'op_execfun':
                    if (node.children[0] && node.children[0].value === 'D') {
                        if (node.children[1][0].type == 'node_var') {
                            // Derive map, that is compute  D(f,x)
                            // where e.g. f = map (x) -> x^2
                            // First, find node where the map is defined
                            mapName = node.children[1][0].value;
                            mapNode = this.findMapNode(mapName, ast);
                            vArray = mapNode.children[0];

                            // Variable name for differentiation
                            if (node.children[1].length >= 2) {
                                varname = node.children[1][1].value;
                            } else {
                                varname = mapNode.children[0][0]; // Usually it's 'x'
                            }
                            codeNode = mapNode.children[1];
                        } else {
                            // Derive expression, e.g. D(2*x,x)
                            codeNode = node.children[1][0];
                            vArray = ['x'];

                            // Variable name for differentiation and order
                            if (node.children[1].length >= 2) {
                                varname = node.children[1][1].value;
                            } else {
                                varname = 'x';
                            }
                        }

                        // Differentiation order (unused)
                        if (false && node.children[1].length >= 3) {
                            order = node.children[1][2].value;
                        } else {
                            order = 1;
                        }

                        // Create node which contains the derivative
                        newNode = this.derivative(codeNode, varname, order);

                        // Replace the node containing e.g. D(f,x) by the derivative.
                        if (parent.type == 'node_op' && parent.value == 'op_assign') {
                            // If D is an assignment it has to be replaced by a map
                            // h = D(f, x)
                            node2 = this.createNode('node_op', 'op_map',
                                    vArray,
                                    newNode
                                );
                        } else {
                            node2 = newNode;
                        }

                        this.setMath(node2);
                        node.type = node2.type;
                        node.value = node2.value;
                        node.children[0] = node2.children[0];
                        node.children[1] = node2.children[1];
                    }
                }
                break;

            case 'node_var':
            case 'node_const':
            case 'node_const_bool':
            case 'node_str':
                break;
            }

            return node;
        },

        removeTrivialNodes: function(node) {
            var i, len, n0, n1;

            if (node.type != 'node_op' || !node.children) {
                return node;
            }

            len = node.children.length;
            for (i = 0; i < len; ++i) {
                node.children[i] = this.removeTrivialNodes(node.children[i]);
            }

            switch (node.value) {
            // a + 0 -> a
            // 0 + a -> a
            case 'op_add':
                n0 = node.children[0];
                n1 = node.children[1];
                if (n0.type == 'node_const' && n0.value == 0.0) {
                    return n1;
                }
                if (n1.type == 'node_const' && n1.value == 0.0) {
                    return n0;
                }
                break;

            // 1 * a = a
            // a * 1 = a
            // a * 0 = 0 ???
            // 0 * a = 0 ???
            case 'op_mul':
                n0 = node.children[0];
                n1 = node.children[1];
                if (n0.type == 'node_const' && n0.value == 1.0) {
                    return n1;
                }
                if (n1.type == 'node_const' && n1.value == 1.0) {
                    return n0;
                }
                if (n0.type == 'node_const' && n0.value == 0.0) {
                    return n0;
                }
                if (n1.type == 'node_const' && n1.value == 0.0) {
                    return n1;
                }
                break;

            // 0 - a -> -a
            // a - 0 -> a
            // a - a -> 0
            case 'op_sub':
                n0 = node.children[0];
                n1 = node.children[1];
                if (n0.type == 'node_const' && n0.value == 0.0) {
                    return this.createNode('node_op', 'op_neg', n1);
                }
                if (n1.type == 'node_const' && n1.value == 0.0) {
                    return n0;
                }
                if (n0.type == 'node_const' && n1.type == 'node_const' &&
                    n0.value == n1.value) {
                    return this.createNode('node_const', 0.0);
                }
                if (n0.type == 'node_var' && n1.type == 'node_var' &&
                    n0.value == n1.value) {
                    return this.createNode('node_const', 0.0);
                }
                break;

            // -0 -> 0
            case 'op_neg':
                n0 = node.children[0];
                if (n0.type == 'node_const' && n0.value == 0.0) {
                    return n0;
                }
                break;

            // a / a -> 1, a != 0
            // 0 / a -> 0, a != 0
            case 'op_div':
                n0 = node.children[0];
                n1 = node.children[1];
                if (n0.type == 'node_const' && n1.type == 'node_const' &&
                    n0.value == n1.value && n0.value != 0) {
                    n0.value = 1.0;
                    return n0;
                }
                if (n0.type == 'node_const' && n0.value == 0 &&
                    n1.type == 'node_const' && n1.value != 0) {
                    n0.value = 0.0;
                    return n0;
                }
                if (n0.type == 'node_var' && n1.type == 'node_var' &&
                    n0.value == n1.value) {
                    return this.createNode('node_const', 1.0);
                }

                break;

            // a^0 = 1
            // a^1 -> a
            // 1^a -> 1
            // 0^a -> 0: a const != 0
            case 'op_exp':
                n0 = node.children[0];
                n1 = node.children[1];
                if (n1.type == 'node_const' && n1.value == 0.0) {
                    n1.value = 1.0;
                    return n1;
                }
                if (n1.type == 'node_const' && n1.value == 1.0) {
                    return n0;
                }
                if (n0.type == 'node_const' && n0.value == 1.0) {
                    return n0;
                }
                if (n0.type == 'node_const' && n0.value == 0.0 &&
                    n1.type == 'node_const' && n1.value != 0.0) {
                    return n0;
                }
                break;
            }

            switch (node.value) {
            // a + a -> 2*a
            // a + (-b) = a - b
            case 'op_add':
                n0 = node.children[0];
                n1 = node.children[1];
                if (n0.type == 'node_const' && n1.type == 'node_const' &&
                    n0.value == n1.value) {
                    n0.value += n1.value;
                    return n0;
                }

                if (n0.type == 'node_var' && n1.type == 'node_var' &&
                    n0.value == n1.value) {
                    node.children[0] = this.createNode('node_const', 2.0);
                    node.value = 'op_mul';
                    return node;
                }

                if (n0.type == 'node_op' && n0.value == 'op_neg') {
                    node.value = 'op_sub';
                    node.children[0] = n1;
                    node.children[1] = n0.children[0];
                    return node;
                }

                if (n1.type == 'node_op' && n1.value == 'op_neg') {
                    node.value = 'op_sub';
                    node.children[1] = n1.children[0];
                    return node;
                }
                break;

            // a - (-b) = a + b
            case 'op_sub':
                n0 = node.children[0];
                n1 = node.children[1];
                if (n1.type == 'node_op' && n1.value == 'op_neg') {
                    node.value = 'op_add';
                    node.children[1] = n1.children[0];
                    return node;
                }
                break;

            // -(-b) = b
            case 'op_neg':
                n0 = node.children[0];
                if (n0.type == 'node_op' && n0.value == 'op_neg') {
                    return n0.children[0];
                }
                break;

            }

            return node;
        },

        /**
         * This is used as the global X() function.
         * @param {JXG.Point|JXG.Text} e
         * @returns {Number}
         */
        X: function (e) {
            return e.X();
        },

        /**
         * This is used as the global Y() function.
         * @param {JXG.Point|JXG.Text} e
         * @returns {Number}
         */
        Y: function (e) {
            return e.Y();
        },

        /**
         * This is used as the global V() function.
         * @param {Glider|Slider} e
         * @returns {Number}
         */
        V: function (e) {
            return e.Value();
        },

        /**
         * This is used as the global L() function.
         * @param {JXG.Line} e
         * @returns {Number}
         */
        L: function (e) {
            return e.L();
        },

        /**
         * This is used as the global dist() function.
         * @param {JXG.Point} p1
         * @param {JXG.Point} p2
         * @returns {Number}
         */
        dist: function (p1, p2) {
            if (!Type.exists(p1) || !Type.exists(p1.Dist)) {
                this._error('Error: Can\'t calculate distance.');
            }

            return p1.Dist(p2);
        },

        /**
         * + operator implementation
         * @param {Number|Array|JXG.Point} a
         * @param {Number|Array|JXG.Point} b
         * @returns {Number|Array}
         */
        add: function (a, b) {
            var i, len, res;

            a = Type.evalSlider(a);
            b = Type.evalSlider(b);

            if (Type.isArray(a) && Type.isArray(b)) {
                len = Math.min(a.length, b.length);
                res = [];

                for (i = 0; i < len; i++) {
                    res[i] = a[i] + b[i];
                }
            } else if (Type.isNumber(a) && Type.isNumber(b)) {
                res = a + b;
            } else if (Type.isString(a) || Type.isString(b)) {
                res = a.toString() + b.toString();
            } else {
                this._error('Operation + not defined on operands ' + typeof a + ' and ' + typeof b);
            }

            return res;
        },

        /**
         * + operator implementation
         * @param {Number|Array|JXG.Point} a
         * @param {Number|Array|JXG.Point} b
         * @returns {Number|Array}
         */
        sub: function (a, b) {
            var i, len, res;

            a = Type.evalSlider(a);
            b = Type.evalSlider(b);

            if (Type.isArray(a) && Type.isArray(b)) {
                len = Math.min(a.length, b.length);
                res = [];

                for (i = 0; i < len; i++) {
                    res[i] = a[i] - b[i];
                }
            } else if (Type.isNumber(a) && Type.isNumber(b)) {
                res = a - b;
            } else {
                this._error('Operation - not defined on operands ' + typeof a + ' and ' + typeof b);
            }

            return res;
        },

        /**
         * Multiplication of vectors and numbers
         * @param {Number|Array} a
         * @param {Number|Array} b
         * @returns {Number|Array} (Inner) product of the given input values.
         */
        mul: function (a, b) {
            var i, len, res;

            a = Type.evalSlider(a);
            b = Type.evalSlider(b);

            if (Type.isArray(a) && Type.isNumber(b)) {
                // swap b and a
                i = a;
                a = b;
                b = a;
            }

            if (Type.isArray(a) && Type.isArray(b)) {
                len = Math.min(a.length, b.length);
                res = Mat.innerProduct(a, b, len);
            } else if (Type.isNumber(a) && Type.isArray(b)) {
                len = b.length;
                res = [];

                for (i = 0; i < len; i++) {
                    res[i] = a * b[i];
                }
            } else if (Type.isNumber(a) && Type.isNumber(b)) {
                res = a * b;
            } else {
                this._error('Operation * not defined on operands ' + typeof a + ' and ' + typeof b);
            }

            return res;
        },

        /**
         * Implementation of the / operator.
         * @param {Number|Array} a
         * @param {Number} b
         * @returns {Number|Array}
         */
        div: function (a, b) {
            var i, len, res;

            a = Type.evalSlider(a);
            b = Type.evalSlider(b);

            if (Type.isArray(a) && Type.isNumber(b)) {
                len = a.length;
                res = [];

                for (i = 0; i < len; i++) {
                    res[i] = a[i] / b;
                }
            } else if (Type.isNumber(a) && Type.isNumber(b)) {
                res = a / b;
            } else {
                this._error('Operation * not defined on operands ' + typeof a + ' and ' + typeof b);
            }

            return res;
        },

        /**
         * Implementation of the % operator.
         * @param {Number|Array} a
         * @param {Number} b
         * @returns {Number|Array}
         */
        mod: function (a, b) {
            var i, len, res;

            a = Type.evalSlider(a);
            b = Type.evalSlider(b);

            if (Type.isArray(a) && Type.isNumber(b)) {
                len = a.length;
                res = [];

                for (i = 0; i < len; i++) {
                    res[i] = Mat.mod(a[i], b, true);
                }
            } else if (Type.isNumber(a) && Type.isNumber(b)) {
                res = Mat.mod(a, b, true);
            } else {
                this._error('Operation * not defined on operands ' + typeof a + ' and ' + typeof b);
            }

            return res;
        },

        /**
         * Pow function wrapper to allow direct usage of sliders.
         * @param {Number|Slider} a
         * @param {Number|Slider} b
         * @returns {Number}
         */
        pow: function (a, b) {
            a = Type.evalSlider(a);
            b = Type.evalSlider(b);

            return Math.pow(a, b);
        },

        DDD: function(f) {
            console.log('Dummy derivative function. This should never appear!');
        },

        /**
         * Implementation of the ?: operator
         * @param {Boolean} cond Condition
         * @param {*} v1
         * @param {*} v2
         * @returns {*} Either v1 or v2.
         */
        ifthen: function (cond, v1, v2) {
            if (cond) {
                return v1;
            }

            return v2;
        },

        /**
         * Implementation of the delete() builtin function
         * @param {JXG.GeometryElement} element
         */
        del: function (element) {
            if (typeof element === 'object' && JXG.exists(element.type) && JXG.exists(element.elementClass)) {
                this.board.removeObject(element);
            }
        },

        /**
         * Implementation of the use() builtin function
         * @param {String} board
         */
        use: function (board) {
            var b, ref,
                found = false;

            if (typeof board === 'string') {
                // search all the boards for the one with the appropriate container div
                for (b in JXG.boards) {
                    if (JXG.boards.hasOwnProperty(b) && JXG.boards[b].container === board) {
                        ref = JXG.boards[b];
                        found = true;
                        break;
                    }
                }
            } else {
                ref = board;
                found = true;
            }

            if (found) {
                this.board = ref;
                this.builtIn.$board = ref;
                this.builtIn.$board.src = '$jc$.board';
            } else {
                this._error('Board \'' + board + '\' not found!');
            }
        },

        /**
         * Find the first symbol to the given value from the given scope upwards.
         * @param v Value
         * @param {Number} [scope=-1] The scope, default is to start with current scope (-1).
         * @returns {Array} An array containing the symbol and the scope if a symbol could be found,
         * an empty array otherwise;
         */
        findSymbol: function (v, scope) {
            var i, s;

            scope = Type.def(scope, -1);

            if (scope === -1) {
                s = this.scope;
            } else {
                s = this.scopes[scope];
            }

            while (s !== null) {
                for (i in s.locals) {
                    if (s.locals.hasOwnProperty(i) && s.locals[i] === v) {
                        return [i, s];
                    }
                }

                s = s.previous;
            }

            return [];
        },

        /**
         * Import modules into a JessieCode script.
         * @param {String} module
         */
        importModule: function (module) {
            return priv.modules[module.toLowerCase()];
        },

        /**
         * Defines built in methods and constants.
         * @returns {Object} BuiltIn control object
         */
        defineBuiltIn: function () {
            var that = this,
                builtIn = {
                    PI: Math.PI,
                    EULER: Math.E,
                    X: that.X,
                    Y: that.Y,
                    V: that.V,
                    L: that.L,
                    dist: that.dist,
                    rad: Geometry.rad,
                    deg: Geometry.trueAngle,
                    factorial: Mat.factorial,
                    trunc: Type.trunc,
                    log: Mat.log,
                    ln: Math.log,
                    log10: Mat.log10,
                    lg: Mat.log10,
                    log2: Mat.log2,
                    lb: Mat.log2,
                    ld: Mat.log2,
                    cosh: Mat.cosh,
                    sinh: Mat.sinh,
                    IfThen: that.ifthen,
                    'import': that.importModule,
                    'use': that.use,
                    'remove': that.del,
                    '$': that.getElementById,
                    '$board': that.board,
                    '$log': that.log,
                    D: that.DDD
                };

            // special scopes for factorial, deg, and rad
            builtIn.rad.sc = Geometry;
            builtIn.deg.sc = Geometry;
            builtIn.factorial.sc = Mat;

            // set the javascript equivalent for the builtIns
            // some of the anonymous functions should be replaced by global methods later on
            // EULER and PI don't get a source attribute - they will be lost anyways and apparently
            // some browser will throw an exception when a property is assigned to a primitive value.
            builtIn.X.src = '$jc$.X';
            builtIn.Y.src = '$jc$.Y';
            builtIn.V.src = '$jc$.V';
            builtIn.L.src = '$jc$.L';
            builtIn.dist.src = '$jc$.dist';
            builtIn.rad.src = 'JXG.Math.Geometry.rad';
            builtIn.deg.src = 'JXG.Math.Geometry.trueAngle';
            builtIn.factorial.src = 'JXG.Math.factorial';
            builtIn.trunc.src = 'JXG.trunc';
            builtIn.ln.src = 'Math.log';
            builtIn.log10.src = 'JXG.Math.log10';
            builtIn.lg.src = 'JXG.Math.log10';
            builtIn.log2.src = 'JXG.Math.log2';
            builtIn.lb.src = 'JXG.Math.log2';
            builtIn.ld.src = 'JXG.Math.log2';
            builtIn.cosh.src = 'JXG.Math.cosh';
            builtIn.sinh.src = 'JXG.Math.sinh';
            builtIn['import'].src = '$jc$.importModule';
            builtIn.use.src = '$jc$.use';
            builtIn.remove.src = '$jc$.del';
            builtIn.IfThen.src = '$jc$.ifthen';
            // usually unused, see node_op > op_execfun
            builtIn.$.src = '(function (n) { return $jc$.board.select(n); })';
            if (builtIn.$board) {
                builtIn.$board.src = '$jc$.board';
            }
            builtIn.$log.src = '$jc$.log';

            return builtIn;
        },

        /**
         * Output a debugging message. Uses debug console, if available. Otherwise an HTML element with the
         * id "debug" and an innerHTML property is used.
         * @param {String} log
         * @private
         */
        _debug: function (log) {
            if (typeof console === 'object') {
                console.log(log);
            } else if (Env.isBrowser && document && document.getElementById('debug') !== null) {
                document.getElementById('debug').innerHTML += log + '<br />';
            }
        },

        /**
         * Throws an exception with the given error message.
         * @param {String} msg Error message
         */
        _error: function (msg) {
            var e = new Error('Error(' + this.line + '): ' + msg);
            e.line = this.line;
            throw e;
        },

        /**
         * Output a warning message using {@link JXG#debug} and precedes the message with "Warning: ".
         * @param {String} msg
         */
        _warn: function (msg) {
            if (typeof console === 'object') {
                console.log('Warning(' + this.line + '): ' + msg);
            } else if (Env.isBrowser && document && document.getElementById(this.warnLog) !== null) {
                document.getElementById(this.warnLog).innerHTML += 'Warning(' + this.line + '): ' + msg + '<br />';
            }
        },

        _log: function (msg) {
            if (typeof window !== 'object' && typeof self === 'object' && self.postMessage) {
                self.postMessage({type: 'log', msg: 'Log: ' + msg.toString()});
            } else {
                console.log('Log: ', arguments);
            }
        }

    });

    //#include "parser.js"


    // Work around an issue with browsers that don't support Object.getPrototypeOf()
    parser.yy.parseError = parser.parseError;

    return JXG.JessieCode;
});

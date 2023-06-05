/*
 JessieCode Interpreter and Compiler

    Copyright 2011-2023
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
    the MIT License along with JessieCode. If not, see <https://www.gnu.org/licenses/>
    and <https://opensource.org/licenses/MIT/>.
 */

/*global JXG: true, define: true, window: true, console: true, self: true, document: true, parser: true*/
/*jslint nomen: true, plusplus: true*/

/**
 * @fileoverview JessieCode is a scripting language designed to provide a
 * simple scripting language to build constructions
 * with JSXGraph. It is similar to JavaScript, but prevents access to the DOM.
 * Hence, it can be used in community driven math portals which want to use
 * JSXGraph to display interactive math graphics.
 */

import JXG from "../jxg";
import Const from "../base/constants";
import Text from "../base/text";
import Mat from "../math/math";
import Interval from "../math/ia";
import Geometry from "../math/geometry";
import Statistics from "../math/statistics";
import Type from "../utils/type";
import Env from "../utils/env";

// IE 6-8 compatibility
if (!Object.create) {
    Object.create = function (o, properties) {
        if (typeof o !== 'object' && typeof o !== 'function') throw new TypeError('Object prototype may only be an Object: ' + o);
        else if (o === null) throw new Error("This browser's implementation of Object.create is a shim and doesn't support 'null' as the first argument.");

        if (typeof properties != 'undefined') throw new Error("This browser's implementation of Object.create is a shim and doesn't support a second argument.");

        function F() { }

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
     * @type Object
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
     * @type Array
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
     * @type Array
     */
    this.$log = [];

    /**
     * Built-in functions and constants
     * @type Object
     */
    this.builtIn = this.defineBuiltIn();

    /**
     * List of all possible operands in JessieCode (except of JSXGraph objects).
     * @type Object
     */
    this.operands = this.getPossibleOperands();

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

    if (JXG.CA) {
        this.CA = new JXG.CA(this.node, this.createNode, this);
    }

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

        if (n.type == 'node_const' && Type.isNumber(n.value)) {
            n.isMath = true;
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
                f = _ccache[this.board.id + vname];
            } else {
                f = (function (that) {
                    return function (parameters, attributes) {
                        var attr;

                        if (Type.exists(attributes)) {
                            attr = attributes;
                        } else {
                            attr = {};
                        }
                        if (attr.name === undefined && attr.id === undefined) {
                            attr.name = (that.lhs[that.scope.id] !== 0 ? that.lhs[that.scope.id] : '');
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
     * Looks up the value of the given variable. We use a simple type inspection.
     *
     * @param {String} vname Name of the variable
     * @param {Boolean} [local=false] Only look up the internal symbol table and don't look for
     * the <tt>vname</tt> in Math or the element list.
     * @param {Boolean} [isFunctionName=false] Lookup function of type builtIn, Math.*, creator.
     *
     * @see JXG.JessieCode#resolveType
     */
    getvar: function (vname, local, isFunctionName) {
        var s;

        local = Type.def(local, false);

        // Local scope has always precedence
        s = this.isLocalVariable(vname);

        if (s !== null) {
            return s.locals[vname];
        }

        // Handle the - so far only - few constants by hard coding them.
        if (vname === '$board' || vname === 'EULER' || vname === 'PI') {
            return this.builtIn[vname];
        }

        if (!!isFunctionName) {
            if (this.isBuiltIn(vname)) {
                return this.builtIn[vname];
            }

            if (this.isMathMethod(vname)) {
                return Math[vname];
            }

            // check for an element with this name
            if (this.isCreator(vname)) {
                return this.creator(vname);
            }
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
        var s, r = '', re;

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
            // If src does not exist, it is a number. In that case, just return the value.
            r = this.builtIn[vname].src || this.builtIn[vname];

            // Get the "real" name of the function
            if (Type.isNumber(r)) {
                return r;
            }
            // Search a JSXGraph object in board
            if (r.match(/board\.select/)) {
                return r;
            }

            vname = r.split('.').pop();
            if (Type.exists(this.board.mathLib)) {
                // Handle builtin case: ln(x) -> Math.log
                re = new RegExp('^Math\.' + vname);
                if (re.exec(r) !== null) {
                    return r.replace(re, '$jc$.board.mathLib.' + vname);
                }
            }
            if (Type.exists(this.board.mathLibJXG)) {
                // Handle builtin case: factorial(x) -> JXG.Math.factorial
                re = new RegExp('^JXG\.Math\.');
                if (re.exec(r) !== null) {
                    return r.replace(re, '$jc$.board.mathLibJXG.');
                }
                return r;
            }
            return r;

            // return this.builtIn[vname].src || this.builtIn[vname];
        }

        if (this.isMathMethod(vname)) {
            return '$jc$.board.mathLib.' + vname;
            //                return 'Math.' + vname;
        }

        // if (!local) {
        //     if (Type.isId(this.board, vname)) {
        //         r = '$jc$.board.objects[\'' + vname + '\']';
        //     } else if (Type.isName(this.board, vname)) {
        //         r = '$jc$.board.elementsByName[\'' + vname + '\']';
        //     } else if (Type.isGroup(this.board, vname)) {
        //         r = '$jc$.board.groups[\'' + vname + '\']';
        //     }

        //     return r;
        // }
        if (!local) {
            if (Type.isId(this.board, vname)) {
                r = '$jc$.board.objects[\'' + vname + '\']';
                if (this.board.objects[vname].elType === 'slider') {
                    r += '.Value()';
                }
            } else if (Type.isName(this.board, vname)) {
                r = '$jc$.board.elementsByName[\'' + vname + '\']';
                if (this.board.elementsByName[vname].elType === 'slider') {
                    r += '.Value()';
                }
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
     * function. Does a simple type inspection.
     * @param {Object} node
     * @returns {function}
     * @see JXG.JessieCode#resolveType
     */
    defineFunction: function (node) {
        var fun, i, that = this,
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

            /** @ignore */
            fun = (function (jc) {
                var fun,
                    // str = 'var f = ' + $jc$.functionCodeJS(node) + '; f;';
                    str = 'var f = function($jc$) { return ' +
                        jc.functionCodeJS(node) +
                        '}; f;';

                try {
                    // yeah, eval is evil, but we don't have much choice here.
                    // the str is well defined and there is no user input in it that we didn't check before

                    /*jslint evil:true*/
                    // fun = eval(str);
                    fun = eval(str)(jc);
                    /*jslint evil:false*/

                    scope.argtypes = [];
                    for (i = 0; i < list.length; i++) {
                        scope.argtypes.push(that.resolveType(list[i], node));
                    }

                    return fun;
                } catch (e) {
                    // $jc$._warn('error compiling function\n\n' + str + '\n\n' + e.toString());
                    jc._warn("error compiling function\n\n" + str + "\n\n" + e.toString());
                    return function () { };
                }
            }(this));

            // clean up scope
            this.popScope();
        } else {
            /** @ignore */
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
        this.collectDependencies(node.children[1], node.children[0], fun.deps);

        return fun;
    },

    /**
     * Merge all attribute values given with an element creator into one object.
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
     * Generic method to parse JessieCode.
     * This consists of generating an AST with parser.parse,
     * apply simplifying rules from CA and
     * manipulate the AST according to the second parameter "cmd".
     * @param  {String} code      JessieCode code to be parsed
     * @param  {String} cmd       Type of manipulation to be done with AST
     * @param {Boolean} [geonext=false] Geonext compatibility mode.
     * @param {Boolean} dontstore If false, the code string is stored in this.code.
     * @return {Object}           Returns result of computation as directed in cmd.
     */
    _genericParse: function (code, cmd, geonext, dontstore) {
        var i, setTextBackup, ast, result,
            ccode = code.replace(/\r\n/g, '\n').split('\n'),
            cleaned = [];

        if (!dontstore) {
            this.code += code + '\n';
        }

        if (Text) {
            setTextBackup = Text.prototype.setText;
            Text.prototype.setText = Text.prototype.setTextJessieCode;
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
            if (this.CA) {
                ast = this.CA.expandDerivatives(ast, null, ast);
                ast = this.CA.removeTrivialNodes(ast);
            }
            switch (cmd) {
                case 'parse':
                    result = this.execute(ast);
                    break;
                case 'manipulate':
                    result = this.compile(ast);
                    break;
                case 'getAst':
                    result = ast;
                    break;
                default:
                    result = false;
            }
        } catch (e) {  // catch is mandatory in old IEs
            // console.log(e);
            // We throw the error again,
            // so the user can catch it.
            throw e;
        } finally {
            // make sure the original text method is back in place
            if (Text) {
                Text.prototype.setText = setTextBackup;
            }
        }

        return result;
    },

    /**
     * Parses JessieCode.
     * This consists of generating an AST with parser.parse, apply simplifying rules
     * from CA and executing the ast by calling this.execute(ast).
     *
     * @param {String} code             JessieCode code to be parsed
     * @param {Boolean} [geonext=false] Geonext compatibility mode.
     * @param {Boolean} dontstore       If false, the code string is stored in this.code.
     * @return {Object}                 Parse JessieCode code and execute it.
     */
    parse: function (code, geonext, dontstore) {
        return this._genericParse(code, 'parse', geonext, dontstore);
    },

    /**
     * Manipulate JessieCode.
     * This consists of generating an AST with parser.parse,
     * apply simlifying rules from CA
     * and compile the AST back to JessieCode.
     *
     * @param {String} code             JessieCode code to be parsed
     * @param {Boolean} [geonext=false] Geonext compatibility mode.
     * @param {Boolean} dontstore       If false, the code string is stored in this.code.
     * @return {String}                 Simplified JessieCode code
     */
    manipulate: function (code, geonext, dontstore) {
        return this._genericParse(code, 'manipulate', geonext, dontstore);
    },

    /**
     * Get abstract syntax tree (AST) from JessieCode code.
     * This consists of generating an AST with parser.parse.
     *
     * @param {String} code
     * @param {Boolean} [geonext=false] Geonext compatibility mode.
     * @param {Boolean} dontstore
     * @return {Node}  AST
     */
    getAST: function (code, geonext, dontstore) {
        return this._genericParse(code, 'getAst', geonext, dontstore);
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
            // These children exist, if node.replaced is set.
            v = this.board.objects[node.children[1][0].value];

            if (Type.exists(v) && v.name !== "") {
                node.type = 'node_var';
                node.value = v.name;

                // Maybe it's not necessary, but just to be sure that everything is cleaned up we better delete all
                // children and the replaced flag
                node.children.length = 0;
                delete node.replaced;
            }
        }

        if (Type.isArray(node)) {
            for (i = 0; i < node.length; i++) {
                node[i] = this.replaceIDs(node[i]);
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

        // We are interested only in nodes of type node_var and node_op > op_lhs.
        // Currently, we are not checking if the id is a local variable. in this case, we're stuck anyway.

        if (node.type === 'node_op' && v === 'op_lhs' && node.children.length === 1) {
            this.isLHS = true;
        } else if (node.type === 'node_var') {
            if (this.isLHS) {
                this.letvar(v, true);
            } else if (!Type.exists(this.getvar(v, true)) && Type.exists(this.board.elementsByName[v])) {
                node = this.createReplacementNode(node);
            }
        }

        if (Type.isArray(node)) {
            for (i = 0; i < node.length; i++) {
                node[i] = this.replaceNames(node[i]);
            }
        }

        if (node.children) {
            // Assignments are first evaluated on the right hand side
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
     * @param {Array} varnames List of variable names of the function
     * @param {Object} result An object where the referenced elements will be stored. Access key is their id.
     */
    collectDependencies: function (node, varnames, result) {
        var i, v, e, le;

        if (Type.isArray(node)) {
            le = node.length;
            for (i = 0; i < le; i++) {
                this.collectDependencies(node[i], varnames, result);
            }
            return;
        }

        v = node.value;

        if (node.type === 'node_var' &&
            varnames.indexOf(v) < 0 // v is not contained in the list of variables of that function
        ) {
            e = this.getvar(v);
            if (e && e.visProp && e.type && e.elementClass && e.id &&
                e.type === Const.OBJECT_TYPE_SLIDER // Sliders are the only elements which are given by names.
            ) {
                result[e.id] = e;
            }
        }

        // The $()-function-calls are special because their parameter is given as a string, not as a node_var.
        if (node.type === 'node_op' && node.value === 'op_execfun' &&
            node.children.length > 1 && node.children[0].value === '$' &&
            node.children[1].length > 0) {

            e = node.children[1][0].value;
            result[e] = this.board.objects[e];
        }

        if (node.children) {
            for (i = node.children.length; i > 0; i--) {
                if (Type.exists(node.children[i - 1])) {
                    this.collectDependencies(node.children[i - 1], varnames, result);
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

        if (Type.isFunction(e)) {
            this._error('Accessing function properties is not allowed.');
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
     * Type inspection: check if the string vname appears as function name in the
     * AST node. Used in "op_execfun". This allows the JessieCode exmples below.
     *
     * @private
     * @param {String} vname
     * @param {Object} node
     * @returns 'any' or 'function'
     * @see JXG.JessieCode#execute
     * @see JXG.JessieCode#getvar
     *
     * @example
     *  var p = board.create('point', [2, 0], {name: 'X'});
     *  var txt = 'X(X)';
     *  console.log(board.jc.parse(txt));
     *
     * @example
     *  var p = board.create('point', [2, 0], {name: 'X'});
     *  var txt = 'f = function(el, X) { return X(el); }; f(X, X);';
     *  console.log(board.jc.parse(txt));
     *
     * @example
     *  var p = board.create('point', [2, 0], {name: 'point'});
     *  var txt = 'B = point(1,3); X(point);';
     *  console.log(board.jc.parse(txt));
     *
     * @example
     *  var p = board.create('point', [2, 0], {name: 'A'});
     *  var q = board.create('point', [-2, 0], {name: 'X'});
     *  var txt = 'getCoord=function(p, f){ return f(p); }; getCoord(A, X);';
     *  console.log(board.jc.parse(txt));
     */
    resolveType: function (vname, node) {
        var i, t,
            type = 'any'; // Possible values: 'function', 'any'

        if (Type.isArray(node)) {
            // node contains the parameters of a function call or function declaration
            for (i = 0; i < node.length; i++) {
                t = this.resolveType(vname, node[i]);
                if (t !== 'any') {
                    type = t;
                    return type;
                }
            }
        }

        if (node.type === 'node_op' && node.value === 'op_execfun' &&
            node.children[0].type === 'node_var' && node.children[0].value === vname) {
            return 'function';
        }

        if (node.type === 'node_op') {
            for (i = 0; i < node.children.length; i++) {
                if (node.children[0].type === 'node_var' && node.children[0].value === vname &&
                    (node.value === 'op_add' || node.value === 'op_sub' || node.value === 'op_mul' ||
                        node.value === 'op_div' || node.value === 'op_mod' || node.value === 'op_exp' ||
                        node.value === 'op_neg')) {
                    return 'any';
                }
            }

            for (i = 0; i < node.children.length; i++) {
                t = this.resolveType(vname, node.children[i]);
                if (t !== 'any') {
                    type = t;
                    return type;
                }
            }
        }

        return 'any';
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
                        this.lhs[this.scope.id] = v.what;

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
                        if (!node.children[1].isMath && node.children[1].type !== 'node_var') {
                            this._error('execute: In a map only function calls and mathematical expressions are allowed.');
                        }

                        /** @ignore */
                        fun = this.defineFunction(node);
                        fun.isMap = true;

                        ret = fun;
                        break;
                    case 'op_function':
                        // parse the parameter list
                        // after this, the parameters are in pstack

                        /** @ignore */
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
                        node.children[0]._isFunctionName = true;
                        fun = this.execute(node.children[0]);
                        delete node.children[0]._isFunctionName;

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
                            if (Type.exists(fun.scope) && Type.exists(fun.scope.argtypes) && fun.scope.argtypes[i] === 'function') {
                                // Type inspection
                                list[i]._isFunctionName = true;
                                parents[i] = this.execute(list[i]);
                                delete list[i]._isFunctionName;
                            } else {
                                parents[i] = this.execute(list[i]);
                            }
                            //parents[i] = Type.evalSlider(this.execute(list[i]));
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
                    case 'op_eq':
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
                    case 'op_gt':
                        ret = this.execute(node.children[0]) > this.execute(node.children[1]);
                        break;
                    case 'op_lt':
                        ret = this.execute(node.children[0]) < this.execute(node.children[1]);
                        break;
                    case 'op_geq':
                        ret = this.execute(node.children[0]) >= this.execute(node.children[1]);
                        break;
                    case 'op_leq':
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
                        ret = this.pow(this.execute(node.children[0]), this.execute(node.children[1]));
                        break;
                    case 'op_neg':
                        ret = this.neg(this.execute(node.children[0]));
                        break;
                }
                break;

            case 'node_var':
                // node._isFunctionName is set in execute: at op_execfun.
                ret = this.getvar(node.value, false, node._isFunctionName);
                break;

            case 'node_const':
                if (node.value === null) {
                    ret = null;
                } else {
                    ret = Number(node.value);
                }
                break;

            case 'node_const_bool':
                ret = node.value;
                break;

            case 'node_str':
                //ret = node.value.replace(/\\'/, "'").replace(/\\"/, '"').replace(/\\\\/, '\\');
                /*jslint regexp:true*/
                ret = node.value.replace(/\\(.)/g, '$1'); // Remove backslash, important in JessieCode tags
                /*jslint regexp:false*/
                break;
        }

        return ret;
    },

    /**
     * Compiles a parse tree back to JessieCode.
     * @param {Object} node
     * @param {Boolean} [js=false] Compile either to JavaScript or back to JessieCode (required for the UI).
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
                        //ret = ' for (' + this.compile(node.children[0], js) + '; ' + this.compile(node.children[1], js) + '; ' + this.compile(node.children[2], js) + ') {\n' + this.compile(node.children[3], js) + '\n}\n';
                        ret = ' for (' + this.compile(node.children[0], js) +               // Assignment ends with ";"
                            this.compile(node.children[1], js) + '; ' +         // Logical test comes without ";"
                            this.compile(node.children[2], js).slice(0, -2) +   // Counting comes with ";" which has to be removed
                            ') {\n' + this.compile(node.children[3], js) + '\n}\n';
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
                        if (!node.children[1].isMath && node.children[1].type !== 'node_var') {
                            this._error('compile: In a map only function calls and mathematical expressions are allowed.');
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
                        console.log('op_execfunmath: TODO');
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
                            } else {
                                e = list.join(', ');
                            }
                        }
                        node.children[0].withProps = !!node.children[2];
                        list = [];
                        for (i = 0; i < node.children[1].length; i++) {
                            list.push(this.compile(node.children[1][i], js));
                        }
                        ret = this.compile(node.children[0], js) + '(' + list.join(', ') + (node.children[2] && js ? ', ' + e : '') + ')' + (node.children[2] && !js ? ' ' + e : '');
                        if (js) {
                            // Inserting a newline here allows simultaneously
                            // - procedural calls like Q.moveTo(...); and
                            // - function calls in expressions like log(x) + 1;
                            // Problem: procedural calls will not be ended by a semicolon.
                            ret += '\n';
                        }

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
                    case 'op_eq':
                        ret = '(' + this.compile(node.children[0], js) + ' === ' + this.compile(node.children[1], js) + ')';
                        break;
                    case 'op_neq':
                        ret = '(' + this.compile(node.children[0], js) + ' !== ' + this.compile(node.children[1], js) + ')';
                        break;
                    case 'op_approx':
                        ret = '(' + this.compile(node.children[0], js) + ' ~= ' + this.compile(node.children[1], js) + ')';
                        break;
                    case 'op_gt':
                        if (js) {
                            ret = '$jc$.gt(' + this.compile(node.children[0], js) + ', ' + this.compile(node.children[1], js) + ')';
                        } else {
                            ret = '(' + this.compile(node.children[0], js) + ' > ' + this.compile(node.children[1], js) + ')';
                        }
                        break;
                    case 'op_lt':
                        if (js) {
                            ret = '$jc$.lt(' + this.compile(node.children[0], js) + ', ' + this.compile(node.children[1], js) + ')';
                        } else {
                            ret = '(' + this.compile(node.children[0], js) + ' < ' + this.compile(node.children[1], js) + ')';
                        }
                        break;
                    case 'op_geq':
                        if (js) {
                            ret = '$jc$.geq(' + this.compile(node.children[0], js) + ', ' + this.compile(node.children[1], js) + ')';
                        } else {
                            ret = '(' + this.compile(node.children[0], js) + ' >= ' + this.compile(node.children[1], js) + ')';
                        }
                        break;
                    case 'op_leq':
                        if (js) {
                            ret = '$jc$.leq(' + this.compile(node.children[0], js) + ', ' + this.compile(node.children[1], js) + ')';
                        } else {
                            ret = '(' + this.compile(node.children[0], js) + ' <= ' + this.compile(node.children[1], js) + ')';
                        }
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
                        if (js) {
                            ret = '$jc$.neg(' + this.compile(node.children[0], js) + ')';
                        } else {
                            ret = '(-' + this.compile(node.children[0], js) + ')';
                        }
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
            if (js) {
                ret = '{\n' + ret + '\n}\n';
            } else {
                ret = '<< ' + ret + ' >>';
            }
        }

        return ret;
    },

    /**
     * This is used as the global getName() function.
     * @param {JXG.GeometryElement} obj
     * @param {Boolean} useId
     * @returns {String}
     */
    getName: function (obj, useId) {
        var name = '';

        if (Type.exists(obj) && Type.exists(obj.getName)) {
            name = obj.getName();
            if ((!Type.exists(name) || name === '') && !!useId) {
                name = obj.id;
            }
        } else if (!!useId) {
            name = obj.id;
        }

        return name;
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
     * This is used as the global area() function.
     * @param {JXG.Circle|JXG.Polygon} obj
     * @returns {Number}
     */
    area: function (obj) {
        if (!Type.exists(obj) || !Type.exists(obj.Area)) {
            this._error('Error: Can\'t calculate area.');
        }

        return obj.Area();
    },

    /**
     * This is used as the global perimeter() function.
     * @param {JXG.Circle|JXG.Polygon} obj
     * @returns {Number}
     */
    perimeter: function (obj) {
        if (!Type.exists(obj) || !Type.exists(obj.Perimeter)) {
            this._error('Error: Can\'t calculate perimeter.');
        }

        return obj.Perimeter();
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
     * This is used as the global radius() function.
     * @param {JXG.Circle|Sector} obj
     * @returns {Number}
     */
    radius: function (obj) {
        if (!Type.exists(obj) || !Type.exists(obj.Radius)) {
            this._error('Error: Can\'t calculate radius.');
        }

        return obj.Radius();
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

        if (Interval.isInterval(a) || Interval.isInterval(b)) {
            res = Interval.add(a, b);
        } else if (Type.isArray(a) && Type.isArray(b)) {
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
     * - operator implementation
     * @param {Number|Array|JXG.Point} a
     * @param {Number|Array|JXG.Point} b
     * @returns {Number|Array}
     */
    sub: function (a, b) {
        var i, len, res;

        a = Type.evalSlider(a);
        b = Type.evalSlider(b);

        if (Interval.isInterval(a) || Interval.isInterval(b)) {
            res = Interval.sub(a, b);
        } else if (Type.isArray(a) && Type.isArray(b)) {
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
     * unary - operator implementation
     * @param {Number|Array|JXG.Point} a
     * @returns {Number|Array}
     */
    neg: function (a) {
        var i, len, res;

        a = Type.evalSlider(a);

        if (Interval.isInterval(a)) {
            res = Interval.negative(a);
        } else if (Type.isArray(a)) {
            len = a.length;
            res = [];

            for (i = 0; i < len; i++) {
                res[i] = -a[i];
            }
        } else if (Type.isNumber(a)) {
            res = -a;
        } else {
            this._error('Unary operation - not defined on operand ' + typeof a);
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

        if (Interval.isInterval(a) || Interval.isInterval(b)) {
            res = Interval.mul(a, b);
        } else if (Type.isArray(a) && Type.isArray(b)) {
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

        if (Interval.isInterval(a) || Interval.isInterval(b)) {
            res = Interval.div(a, b);
        } else if (Type.isArray(a) && Type.isNumber(b)) {
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

        if (Interval.isInterval(a) || Interval.isInterval(b)) {
            return Interval.fmod(a, b);
        } else if (Type.isArray(a) && Type.isNumber(b)) {
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

        if (Interval.isInterval(a) || Interval.isInterval(b)) {
            return Interval.pow(a, b);
        }
        return Mat.pow(a, b);
    },

    lt: function (a, b) {
        if (Interval.isInterval(a) || Interval.isInterval(b)) {
            return Interval.lt(a, b);
        }
        return a < b;
    },
    leq: function (a, b) {
        if (Interval.isInterval(a) || Interval.isInterval(b)) {
            return Interval.leq(a, b);
        }
        return a <= b;
    },
    gt: function (a, b) {
        if (Interval.isInterval(a) || Interval.isInterval(b)) {
            return Interval.gt(a, b);
        }
        return a > b;
    },
    geq: function (a, b) {
        if (Interval.isInterval(a) || Interval.isInterval(b)) {
            return Intervalt.geq(a, b);
        }
        return a >= b;
    },

    randint: function (min, max, step) {
        if (!Type.exists(step)) {
            step = 1;
        }
        return Math.round(Math.random() * (max - min) / step) * step + min;
    },

    DDD: function (f) {
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
                D: that.DDD,
                X: that.X,
                Y: that.Y,
                V: that.V,
                L: that.L,

                acosh: Mat.acosh,
                acot: Mat.acot,
                asinh: Mat.asinh,
                binomial: Mat.binomial,
                cbrt: Mat.cbrt,
                cosh: Mat.cosh,
                cot: Mat.cot,
                deg: Geometry.trueAngle,
                A: that.area,
                area: that.area,
                perimeter: that.perimeter,
                dist: that.dist,
                R: that.radius,
                radius: that.radius,
                erf: Mat.erf,
                erfc: Mat.erfc,
                erfi: Mat.erfi,
                factorial: Mat.factorial,
                gcd: Mat.gcd,
                lb: Mat.log2,
                lcm: Mat.lcm,
                ld: Mat.log2,
                lg: Mat.log10,
                ln: Math.log,
                log: Mat.log,
                log10: Mat.log10,
                log2: Mat.log2,
                ndtr: Mat.ndtr,
                ndtri: Mat.ndtri,
                nthroot: Mat.nthroot,
                pow: Mat.pow,
                rad: Geometry.rad,
                ratpow: Mat.ratpow,
                trunc: Type.trunc,
                sinh: Mat.sinh,

                randint: that.randint,

                IfThen: that.ifthen,
                'import': that.importModule,
                'use': that.use,
                'remove': that.del,
                '$': that.getElementById,
                getName: that.getName,
                name: that.getName,
                '$board': that.board,
                '$log': that.log,
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

        builtIn.acosh.src = 'JXG.Math.acosh';
        builtIn.acot.src = 'JXG.Math.acot';
        builtIn.asinh.src = 'JXG.Math.asinh';
        builtIn.binomial.src = 'JXG.Math.binomial';
        builtIn.cbrt.src = 'JXG.Math.cbrt';
        builtIn.cot.src = 'JXG.Math.cot';
        builtIn.cosh.src = 'JXG.Math.cosh';
        builtIn.deg.src = 'JXG.Math.Geometry.trueAngle';
        builtIn.erf.src = 'JXG.Math.erf';
        builtIn.erfc.src = 'JXG.Math.erfc';
        builtIn.erfi.src = 'JXG.Math.erfi';
        builtIn.A.src = '$jc$.area';
        builtIn.area.src = '$jc$.area';
        builtIn.perimeter.src = '$jc$.perimeter';
        builtIn.dist.src = '$jc$.dist';
        builtIn.R.src = '$jc$.radius';
        builtIn.radius.src = '$jc$.radius';
        builtIn.factorial.src = 'JXG.Math.factorial';
        builtIn.gcd.src = 'JXG.Math.gcd';
        builtIn.lb.src = 'JXG.Math.log2';
        builtIn.lcm.src = 'JXG.Math.lcm';
        builtIn.ld.src = 'JXG.Math.log2';
        builtIn.lg.src = 'JXG.Math.log10';
        builtIn.ln.src = 'Math.log';
        builtIn.log.src = 'JXG.Math.log';
        builtIn.log10.src = 'JXG.Math.log10';
        builtIn.log2.src = 'JXG.Math.log2';
        builtIn.ndtr.src = 'JXG.Math.ndtr';
        builtIn.ndtri.src = 'JXG.Math.ndtri';
        builtIn.nthroot.src = 'JXG.Math.nthroot';
        builtIn.pow.src = 'JXG.Math.pow';
        builtIn.rad.src = 'JXG.Math.Geometry.rad';
        builtIn.ratpow.src = 'JXG.Math.ratpow';
        builtIn.trunc.src = 'JXG.trunc';
        builtIn.sinh.src = 'JXG.Math.sinh';

        builtIn.randint.src = '$jc$.randint';

        builtIn['import'].src = '$jc$.importModule';
        builtIn.use.src = '$jc$.use';
        builtIn.remove.src = '$jc$.del';
        builtIn.IfThen.src = '$jc$.ifthen';
        // usually unused, see node_op > op_execfun
        builtIn.$.src = '(function (n) { return $jc$.board.select(n); })';
        builtIn.getName.src = '$jc$.getName';
        builtIn.name.src = '$jc$.getName';
        if (builtIn.$board) {
            builtIn.$board.src = '$jc$.board';
        }
        builtIn.$log.src = '$jc$.log';

        builtIn = JXG.merge(builtIn, that._addedBuiltIn);

        return builtIn;
    },

    _addedBuiltIn: {},

    addBuiltIn: function (name, func) {
        if (Type.exists(this.builtIn)) {
            if (Type.exists(this.builtIn[name])) {
                return;
            }
            this.builtIn[name] = func;
            this.builtIn[name].src = '$jc$.' + name;
        }

        if (Type.exists(this._addedBuiltIn[name])) {
            return;
        }
        this._addedBuiltIn[name] = func;
        this._addedBuiltIn[name].src = '$jc$.' + name;

        JXG.JessieCode.prototype[name] = func;

        console.log('added', name, func)
    },

    /**
     * Returns information about the possible functions and constants.
     * @returns {Object}
     */
    getPossibleOperands: function () {
        var FORBIDDEN = ['E'],
            jessiecode = this.builtIn || this.defineBuiltIn(),
            math = Math,
            jc, ma, merge,
            i, j, p, len, e,
            funcs, funcsJC, consts, operands,
            sort, pack;

        sort = function (a, b) {
            return a.toLowerCase().localeCompare(b.toLowerCase());
        };

        pack = function (name, origin) {
            var that = null;

            if (origin === 'jc') that = jessiecode[name];
            else if (origin === 'Math') that = math[name];
            else return;

            if (FORBIDDEN.indexOf(name) >= 0) {
                return;
            } else if (JXG.isFunction(that)) {
                return {
                    name: name,
                    type: 'function',
                    numParams: that.length,
                    origin: origin,
                };
            } else if (JXG.isNumber(that)) {
                return {
                    name: name,
                    type: 'constant',
                    value: that,
                    origin: origin,
                };
            } else if (name.startsWith('$')) {
                // do nothing
            } else if (that !== undefined) {
                console.error('undefined type', that);
            }
        };

        jc = Object.getOwnPropertyNames(jessiecode).sort(sort);
        ma = Object.getOwnPropertyNames(math).sort(sort);
        merge = [];
        i = 0;
        j = 0;

        while (i < jc.length || j < ma.length) {
            if (jc[i] === ma[j]) {
                p = pack(ma[j], 'Math');
                if (JXG.exists(p)) merge.push(p);
                i++;
                j++;
            } else if (!JXG.exists(ma[j]) || jc[i].toLowerCase().localeCompare(ma[j].toLowerCase()) < 0) {
                p = pack(jc[i], 'jc');
                if (JXG.exists(p)) merge.push(p);
                i++;
            } else {
                p = pack(ma[j], 'Math');
                if (JXG.exists(p)) merge.push(p);
                j++;
            }
        }

        funcs = [];
        funcsJC = [];
        consts = [];
        operands = {};
        len = merge.length;
        for (i = 0; i < len; i++) {
            e = merge[i];
            switch (e.type) {
                case 'function':
                    funcs.push(e.name);
                    if (e.origin === 'jc')
                        funcsJC.push(e.name);
                    break;
                case 'constant':
                    consts.push(e.name);
                    break;
            }
            operands[e.name] = e;
        }

        return {
            all: operands,
            list: merge,
            functions: funcs,
            functions_jessiecode: funcsJC,
            constants: consts,
        };
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
            self.postMessage({ type: 'log', msg: 'Log: ' + msg.toString() });
        } else {
            console.log('Log: ', arguments);
        }
    }

});

//#include "parser.js"

// Work around an issue with browsers that don't support Object.getPrototypeOf()
parser.yy.parseError = parser.parseError;

export default JXG.JessieCode;

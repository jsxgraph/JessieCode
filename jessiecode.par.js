/*
    Copyright 2008-2011
        Matthias Ehmann,
        Michael Gerhaeuser,
        Carsten Miller,
        Bianca Valentin,
        Alfred Wassermann,
        Peter Wilfahrt

    This file is part of JSXGraph.

    JSXGraph is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    JSXGraph is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with JSXGraph.  If not, see <http://www.gnu.org/licenses/>.
*/

/**
 * @fileoverview JessieCode is a scripting language designed to provide a simple scripting language to build constructions
 * with JSXGraph. It is similar to JavaScript, but prevents access to the DOM. Hence, it can be used in community driven
 * Math portals which want to use JSXGraph to display interactive math graphics.
 */

/**
 * A JessieCode object provides an interfacce to the parser and stores all variables and objects used within a JessieCode script.
 * The optional argument <tt>code</tt> is interpreted after initializing. To evaluate more code after initializing a JessieCode instance
 * please use {@link JXG.JessieCode#parse}. For code snippets like single expressions use {@link JXG.JessieCode#snippet}.
 * @constructor
 * @param {String} [code] Code to parse.
 * @param {Boolean} [geonext=false] Geonext compatibility mode.
 */
JXG.JessieCode = function(code, geonext) {
    var i;

    // Control structures

    /**
     * Stores all variables, local and global. The current scope is determined by {@link JXG.JessieCode#scope}.
     * @type Array
     * @private
     */
    this.sstack = [{
        PI: Math.PI
    }];

    /**
     * Defines the current variable scope.
     * @type Number
     * @private
     */
    this.scope = 0;

    /**
     * A stack used to store the parameter lists for function definitions and calls.
     * @type Array
     * @private
     */
    this.pstack = [[]];

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
     * Whenever an element attribute is set via <tt>element.attribute = 'something';</tt>, the element is stored
     * in here, so following attribute changes can be set without the element: <tt>.attribute = 'something else';</tt>.
     * @type JXG.GeometryElement
     * @private
     */
    this.propobj = 0;

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
     * This is a stub that might be used later on.
     * @type Boolean
     * @private
     */
    this.isfuncall = true;

    /**
     * The id of an HTML node in which innerHTML all warnings are stored (if no <tt>console</tt> object is available).
     * @type String
     * @default 'jcwarn'
     */
    this.warnLog = 'jcwarn';

    /**
     * Element attributes that are not allowed to be set in JessieCode.
     * @type Array
     */
    this.visPropBlacklist = ['cssclass', 'highlightcssclass'];

    /**
     * Built-in functions and constants
     * @type Object
     */
    this.builtIn = {
        PI: Math.PI,
        X: function (el) {
            return el.X();
        },
        Y: function (el) {
            return el.Y();
        },
        V: function (el) {
            return el.Value();
        },
        L: function (el) {
            return el.L();
        },
        dist: function (p1, p2) {
            if (!JXG.exists(p1) || !JXG.exists(p1.Dist)) {
                this._error('Error: Can\'t calculate distance.');
            }

            return p1.Dist(p2);
        },
        rad: JXG.Math.Geometry.rad,
        deg: JXG.Math.Geometry.trueAngle,
        factorial: JXG.Math.factorial,
        '$': this.getElementById
    };

    // special scopes for factorial, deg, and rad
    this.builtIn.rad.sc = JXG.Math.Geometry;
    this.builtIn.deg.sc = JXG.Math.Geometry;
    this.builtIn.factorial.sc = JXG.Math;

    /**
     * The board which currently is used to create and look up elements.
     * @type JXG.Board
     */
    this.board = null;

    if (typeof code === 'string') {
        this.parse(code);
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
     * Output a debugging message. Uses debug console, if available. Otherwise an HTML element with the
     * id "debug" and an innerHTML property is used.
     * @param {String} log
     * @private
     */
    _debug: function (log) {
        if(typeof console !== "undefined") {
            console.log(log);
        } else if(document.getElementById('debug') !== null) {
            document.getElementById('debug').innerHTML += log + '<br />';
        }
    },

    /**
     * Throws an exception with the given error message.
     * @param {String} msg Error message
     */
    _error: function (msg) {
        throw new Error(msg);
    },

    _warn: function (msg) {
        if(typeof console !== "undefined") {
            console.log('Warning: ' + msg);
        } else if(document.getElementById(this.warnLog) !== null) {
            document.getElementById(this.warnLog).innerHTML += 'Warning: ' + msg + '<br />';
        }
    },

    /**
     * Checks if the given string is a valid identifier.
     * @param {String} s
     * @returns {Boolean}
     */
    isIdentifier: function (s) {
        return /[A-Za-z_\$][A-Za-z0-9_\$]*/.test(s);
    },

    /**
     * Looks up an {@link JXG.GeometryElement} by its id.
     * @param {String} id
     * @returns {JXG.GeometryElement}
     */
    getElementById: function (id) {
        return this.board.objects[id];
    },

    /**
     * Returns a element creator function which takes two parameters: the parents array and the attributes object.
     * @param {String} vname The element type, e.g. 'point', 'line', 'midpoint'
     * @returns {function}
     */
    creator: (function () {
        // stores the already defined creators
        var _ccache = {};

        return function (vname) {
            var f;

            // _ccache is global, i.e. it is the same for ALL JessieCode instances.
            // That's why we need the board id here
            if (typeof _ccache[this.board.id + vname] === 'function') {
                return _ccache[this.board.id + vname];
            } else {
                f = (function (that) {
                    return function (parameters, attributes) {
                        var attr;

                        if (JXG.exists(attributes)) {
                            attr = attributes;
                        } else {
                            attr = {name: (that.lhs[that.scope] !== 0 ? that.lhs[that.scope] : '')};
                        }
                        return that.board.create(vname, parameters, attr);
                    }
                })(this);

                f.creator = true;
                _ccache[this.board.id + vname] = f;

                return f;
            }

        };
    })(),

    /**
     * Assigns a value to a variable in the current scope.
     * @param {String} vname Variable name
     * @param {%} value Anything
     * @see JXG.JessieCode#sstack
     * @see JXG.JessieCode#scope
     */
    letvar: function (vname, value) {
        if (this.builtIn[vname]) {
            this._warn('"' + vname + '" is a predefined value.');
        }

        this.sstack[this.scope][vname] = value;
    },

    /**
     * Looks up the value of the given variable.
     * @param {String} vname Name of the variable
     * @paran {Boolean} [local=false] Only look up the internal symbol table and don't look for
     * the <tt>vname</tt> in Math or the element list.
     */
    getvar: function (vname, local) {
        var s, undef;

        if (!JXG.exists(local)) {
            local = false;
        }

        for (s = this.scope; s > -1; s--) {
            if (JXG.exists(this.sstack[s][vname])) {
                return this.sstack[s][vname];
            }
        }

        // check for an element with this name
        if (JXG.JSXGraph.elements[vname]) {
            return this.creator(vname);
        }

        if (Math[vname]) {
            return Math[vname];
        }

        if (this.builtIn[vname]) {
            return this.builtIn[vname];
        }

        if (!local) {
            s = JXG.getRef(this.board, vname);
            if (s !== vname) {
                return s;
            }
        }

        return undef;
    },

    /**
     * Sets the property <tt>what</tt> of {@link JXG.JessieCode#propobj} to <tt>value</tt>
     * @param {String} what
     * @param {%} value
     */
    setProp: function (o, what, value) {
        var par = {}, x, y;

        if (o.elementClass === JXG.OBJECT_CLASS_POINT && (what === 'X' || what === 'Y')) {
            // set coords

            what = what.toLowerCase();

            // be advised, we've spotted three cases in your AO:
            // o.isDraggable && typeof value === number:
            //   stay draggable, just set the new coords (e.g. via moveTo)
            // o.isDraggable && typeof value === function:
            //   convert to !o.isDraggable, set the new coords via o.addConstraint()
            // !o.isDraggable:
            //   stay !o.isDraggable, update the given coord by overwriting X/YEval

            if (o.isDraggable && typeof value === 'number') {
                x = what === 'x' ? value : o.X();
                y = what === 'y' ? value : o.Y();

                o.XEval = function() { return this.coords.usrCoords[1]; };
                o.YEval = function() { return this.coords.usrCoords[2]; };
                o.setPosition(JXG.COORDS_BY_USER, x, y);
            } else if (o.isDraggable && (typeof value === 'function' || typeof value === 'string')) {
                x = what === 'x' ? value : function () { return this.coords.usrCoords[1]; };
                y = what === 'y' ? value : function () { return this.coords.usrCoords[2]; };

                o.isDraggable = false;
                o.addConstraint([x, y]);
            } else if (!o.isDraggable) {
                x = what === 'x' ? value : o.XEval;
                y = what === 'y' ? value : o.YEval;

                o.addConstraint(x, y);
            }

            this.board.update();
        } else if (o.type === JXG.OBJECT_TYPE_TEXT && (what === 'X' || what === 'Y')) {
            if (typeof value === 'number') {
                o[what] = function () { return value; };
            } else if (typeof value === 'function') {
                o.isDraggable = false;
                o[what] = value;
            } else if (typeof value === 'string') {
                o.isDraggable = false;
                o[what] = JXG.createFunction(value, this.board, null, true);
                o[what + 'jc'] = value;
            }

            this.board.update();

        } else if (o.type && o.elementClass && o.visProp) {
            if (this.visPropBlacklist.indexOf(what.toLowerCase && what.toLowerCase()) === -1) {
                par[what] = value;
                o.setProperty(par);
            } else {
                this._warn('Attribute "' + what + '" can not be set with JessieCode.');
            }
        } else {
            o[what] = value;
        }
    },

    /**
     * Parses JessieCode
     * @param {String} code
     * @param {Boolean} [geonext=false] Geonext compatibility mode.
     */
    parse: function (code, geonext) {
        var error_cnt = 0,
            error_off = [],
            error_la = [],
            ccode = code.split('\n'), i, cleaned = [];

        if (!JXG.exists(geonext)) {
            geonext = false;
        }

        for (i = 0; i < ccode.length; i++) {
            if (!(JXG.trim(ccode[i])[0] === '/' && JXG.trim(ccode[i])[1] === '/')) {
                if (geonext) {
                    ccode[i] = ccode[i].replace(/Deg\(/g, 'deg(')
                                       .replace(/Rad\(/g, 'rad(')
                                       .replace(/Sin\(/g, 'sin(')
                                       .replace(/Cos\(/g, 'cos(')
                                       .replace(/Dist/g, 'dist(')
                                       .replace(/Factorial\(/g, 'factorial(')
                                       .replace(/If\(/g, 'if(')
                                       .replace(/Round\(/, 'round(');
                }

                cleaned.push(ccode[i]);
            }
        }
        code = cleaned.join('\n');

        if((error_cnt = this._parse(code, error_off, error_la)) > 0) {
            for(i = 0; i < error_cnt; i++)
                this._error("Parse error near >"  + code.substr( error_off[i], 30 ) + "<, expecting \"" + error_la[i].join() + "\"");
        }

        this.board.update();
    },

    /**
     * Parses a JessieCode snippet, e.g. "3+4", and wraps it into a function, if desired.
     * @param {String} code A small snippet of JessieCode. Must not be an assignment.
     * @param {Boolean} funwrap If true, the code is wrapped in a function.
     * @param {String} varname Name of the parameter(s)
     * @param {Boolean} [geonext=false] Geonext compatibility mode.
     */
    snippet: function (code, funwrap, varname, geonext) {
        var vname, c, tmp, result;

        vname = 'jxg__tmp__intern_' + JXG.Util.genUUID().replace(/\-/g, '');

        if (!JXG.exists(funwrap)) {
            funwrap = true;
        }

        if (!JXG.exists(varname)) {
            varname = '';
        }

        if (!JXG.exists(geonext)) {
            geonext = false;
        }

        // just in case...
        tmp = this.sstack[0][vname];

        c = vname + ' = ' + (funwrap ? ' function (' + varname + ') { return ' : '') + code + (funwrap ? '; }' : '') + ';';
        this.parse(c, geonext);

        result = this.sstack[0][vname];
        if (JXG.exists(tmp)) {
            this.sstack[0][vname] = tmp;
        } else {
            delete this.sstack[0][vname];
        }

        return result;
    },

    /**
     * Traverses through the given subtree and changes all values of nodes with the replaced flag set by
     * {@link JXG.JessieCode#replaceNames} to the name of the element (if not empty).
     * @param {Object} node
     */
    replaceIDs: function (node) {
        var i, v;

        if (node.replaced) {
            v = this.board.objects[node.value];
            if (JXG.exists(v) && JXG.exists(v) && v.name !== '') {
                node.value = v.name;
                // maybe it's not necessary, but just to be sure that everything's cleaned up...
                delete node.replaced;
            }
        }

        if (node.children) {
            // assignments are first evaluated on the right hand side
            for (i = node.children.length ; i > 0; i--) {
                if (JXG.exists(node.children[i-1])) {
                    node.children[i-1] = this.replaceIDs(node.children[i-1]);
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

        if (node.type == 'node_op' && v == 'op_lhs' && node.children.length === 1) {
            this.isLHS = true;
        } else if (node.type == 'node_var') {
            if (this.isLHS) {
                this.letvar(v, true);
            } else if (!JXG.exists(this.getvar(v, true)) && JXG.exists(this.board.elementsByName[v])) {
                node.value = this.board.elementsByName[v].id;
                node.replaced = true;
            }
        }

        if (node.children) {
            // assignments are first evaluated on the right hand side
            for (i = node.children.length ; i > 0; i--) {
                if (JXG.exists(node.children[i-1])) {
                    node.children[i-1] = this.replaceNames(node.children[i-1]);
                }

            }
        }

        if (node.type == 'node_op' && node.value == 'op_lhs' && node.children.length === 1) {
            this.isLHS = false;
        }

        return node;
    },

    /**
     * Executes a parse subtree.
     * @param {Object} node
     * @returns Something
     * @private
     */
    execute: function (node) {
        var ret, v, i, e, parents = [];

        ret = 0;

        if (!node)
            return ret;

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
                        v = this.execute(node.children[0]);
                        this.lhs[this.scope] = v[1];

                        if (v[0].type && v[0].elementClass && v[0].methodMap && v[1] === 'label') {
                            this._error('Error: Left-hand side of assignment is read-only.');
                        }

                        if (v[0] !== this.sstack[this.scope] || (JXG.isArray(v[0]) && typeof v[1] === 'number')) {
                            // it is either an array component being set or a property of an object.
                            this.setProp(v[0], v[1], this.execute(node.children[1]));
                        } else {
                            // this is just a local variable inside JessieCode
                            this.letvar(v[1], this.execute(node.children[1]));
                        }

                        this.lhs[this.scope] = 0;
                        break;
                    case 'op_noassign':
                        ret = this.execute(node.children[0]);
                        break;
                    case 'op_if':
                        if (this.execute(node.children[0])) {
                            ret = this.execute(node.children[1]);
                        }
                        break;
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
                    case 'op_param':
                        if (node.children[1]) {
                            this.execute(node.children[1]);
                        }

                        ret = node.children[0];
                        this.pstack[this.pscope].push(ret);
                        break;
                    case 'op_paramdef':
                        if (node.children[1]) {
                            this.execute(node.children[1]);
                        }

                        ret = node.children[0];
                        this.pstack[this.pscope].push(ret);
                        break;
                    case 'op_proplst':
                        if (node.children[0]) {
                            this.execute(node.children[0]);
                        }
                        if (node.children[1]) {
                            this.execute(node.children[1]);
                        }
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
                        var l;

                        this.pstack.push([]);
                        this.pscope++;

                        this.execute(node.children[0]);

                        ret = [];
                        l = this.pstack[this.pscope].length;

                        for (i = 0; i < l; i++) {
                            ret.push(this.execute(this.pstack[this.pscope][i]));
                        }

                        this.pstack.pop();
                        this.pscope--;

                        break;
                    case 'op_extvalue':
                        var undef;

                        ret = this.execute(node.children[0]);
                        i = this.execute(node.children[1]);

                        if (typeof i === 'number' && Math.abs(Math.round(i) - i) < JXG.Math.eps) {
                            ret = ret[i];
                        } else {
                            ret = undef;
                        }
                        break;
                    case 'op_return':
                        if (this.scope === 0) {
                            this._error('Error: Unexpected return.');
                        } else {
                            return this.execute(node.children[0]);
                        }
                        break;
                    case 'op_function':
                        this.pstack.push([]);
                        this.pscope++;

                        // parse the parameter list
                        // after this, the parameters are in pstack
                        this.execute(node.children[0]);

                        ret = (function(_pstack, that) { return function() {
                            var r;

                            that.sstack.push({});
                            that.scope++;
                            for(r = 0; r < _pstack.length; r++) {
                                that.sstack[that.scope][_pstack[r]] = arguments[r];
                            }

                            r = that.execute(node.children[1]);

                            that.sstack.pop();
                            that.scope--;
                            return r;
                        }; })(this.pstack[this.pscope], this);

                        ret.parseTree = node.children[1];

                        this.isLHS = false;

                        // new scope for parameters & local variables
                        this.sstack.push([]);
                        this.scope++;
                        for(i = 0; i < this.pstack[this.pscope].length; i++) {
                            this.sstack[this.scope][this.pstack[this.pscope][i]] = this.pstack[this.pscope][i];
                        }

                        ret.replacedNames = this.replaceNames(node.children[1]);

                        // clean up scope
                        this.sstack.pop();
                        this.scope--;


                        this.pstack.pop();
                        this.pscope--;
                        break;
                    case 'op_execfun':
                        // node.children:
                        //   [0]: Name of the function
                        //   [1]: Parameter list as a parse subtree
                        //   [2]: Properties, only used in case of a create function
                        var fun, props, attr, sc;

                        this.pstack.push([]);
                        this.pscope++;

                        // assume there are no properties given
                        props = false;

                        // parse the parameter list
                        // after this, the parameters are in pstack
                        this.execute(node.children[1]);

                        // parse the properties only if given
                        if (typeof node.children[2] !== 'undefined') {
                            this.propstack.push({});
                            this.propscope++;

                            props = true;
                            this.execute(node.children[2]);
                        }

                        // look up the variables name in the variable table
                        fun = this.execute(node.children[0]);

                        // determine the scope the function wants to run in
                        if (fun.sc) {
                            sc = fun.sc;
                        } else {
                            sc = this;
                        }

                        // interpret ALL the parameters
                        for(i = 0; i < this.pstack[this.pscope].length; i++) {
                            parents[i] = this.execute(this.pstack[this.pscope][i]);
                        }

                        // get the properties from the propstack
                        if (props) {
                            attr = this.propstack[this.propscope];
                            for (i in attr) {
                                if (this.visPropBlacklist.indexOf(i.toLowerCase()) > -1) {
                                    this._warn('Attribute "' + i + '" can not be set with JessieCode.');
                                    delete attr[i];
                                }
                            }
                        }

                        // check for the function in the variable table
                        if (typeof fun === 'function' && !fun.creator) {
                            ret = fun.apply(sc, parents);
                        } else if (typeof fun === 'function' && !!fun.creator) {
                            // creator methods are the only ones that take properties, hence this special case
                            ret = fun(parents, attr);
                        } else {
                            this._error('Error: Function \'' + node.children[0] + '\' is undefined.');
                        }

                        // clear props stack
                        if (props) {
                            this.propstack.pop();
                            this.propscope--;
                        }

                        // clear parameter stack
                        this.pstack.pop();
                        this.pscope--;
                        break;
                    case 'op_property':
                        e = this.execute(node.children[0]);
                        v = node.children[1];

                        // is it a geometry element?
                        if (e.type && e.elementClass && e.methodMap) {
                            // yeah, it is. but what does the user want?
                            if (v === 'label') {
                                // he wants to access the label properties!
                                // adjust the base object...
                                e = e.label;
                                // and the property we are accessing
                                v = 'content';
                            } else {
                                // ok, it's not the label he wants to change

                                // well, what then?
                                if (JXG.exists(e.subs[v])) {
                                    // a subelement it is, good sir.
                                    e = e.subs;
                                } else if (JXG.exists(e.methodMap[v])) {
                                    // the user wants to call a method
                                    v = e.methodMap[v];
                                } else {
                                    // the user wants to change an attribute
                                    e = e.visProp;
                                    v = v.toLowerCase();
                                }
                            }
                        }

                        if (!JXG.exists(e)) {
                            this._error('Error: ' + e + ' is not an object.');
                        }

                        if (!JXG.exists(e[v])) {
                            this._error('Error: unknown property ' + v + '.');
                        }

                        ret = e[v];

                        // set the scope, in case this is a method the user wants to call
                        ret.sc = e;
                        break;
                    case 'op_lhs':
                        v = node.children[0];

                        // we have a subtree here (in case this is an array component)
                        if (v.children && v.type && v.value) {
                            v = this.execute(v);
                        }

                        if (node.children.length === 1) {
                            e = this.sstack[this.scope];
                        } else {
                            e = this.execute(node.children[1]);

                            if (e.type && e.elementClass && v.toLowerCase && v.toLowerCase() !== 'x' && v.toLowerCase() !== 'y') {
                                v = v.toLowerCase();
                            }
                        }

                        ret = [e, v];
                        break;
                    case 'op_use':
                        // node.children:
                        //   [0]: A string providing the id of the div the board is in.
                        var found = false;

                        // search all the boards for the one with the appropriate container div
                        for(var b in JXG.JSXGraph.boards) {
                            if(JXG.JSXGraph.boards[b].container === node.children[0].toString()) {
                                this.board = JXG.JSXGraph.boards[b];
                                found = true;
                            }
                        }

                        if(!found)
                            this._error('Board \'' + node.children[0].toString() + '\' not found!');
                        break;
                    case 'op_delete':
                        v = this.getvar(node.children[0]);

                        if (typeof v === 'object' && JXG.exists(v.type) && JXG.exists(v.elementClass)) {
                            this.board.removeObject(v);
                        }
                        break;
                    case 'op_equ':
                        ret = this.execute(node.children[0]) == this.execute(node.children[1]);
                        break;
                    case 'op_neq':
                        ret = this.execute(node.children[0]) != this.execute(node.children[1]);
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
                    case 'op_add':
                        ret = this.execute(node.children[0]) + this.execute(node.children[1]);
                        break;
                    case 'op_sub':
                        ret = this.execute(node.children[0]) - this.execute(node.children[1]);
                        break;
                    case 'op_div':
                        ret = this.execute(node.children[0]) / this.execute(node.children[1]);
                        break;
                    case 'op_mul':
                        ret = this.execute(node.children[0]) * this.execute(node.children[1]);
                        break;
                    case 'op_exp':
                        ret = Math.pow(this.execute(node.children[0]),  this.execute(node.children[1]));
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
                ret = node.value !== 'false';
                break;

            case 'node_str':
                ret = node.value;
                break;
        }

        return ret;
    },

    /**
     * Compiles a parse tree back to JessieCode.
     * @param {Object} node
     * @param {Boolean} [javascript=false] Currently ignored. Compile either to JavaScript or back to JessieCode (required for the UI).
     * @returns Something
     * @private
     */
    compile: function (node, javascript) {
        var ret, i, e;

        ret = '';

        if (!JXG.exists(javascript)) {
            javascript = false
        }

        // ignore it
        javascript = false;

        if (!node)
            return ret;

        switch (node.type) {
            case 'node_op':
                switch (node.value) {
                    case 'op_none':
                        if (node.children[0]) {
                            ret = this.compile(node.children[0]);
                        }
                        if (node.children[1]) {
                            ret += this.compile(node.children[1]);
                        }
                        break;
                    case 'op_assign':
                        ret = this.compile(node.children[0]) + ' = ' + this.compile(node.children[1]) + ';\n';
                        break;
                    case 'op_noassign':
                        ret = this.compile(node.children[0]);
                        break;
                    case 'op_if':
                        ret = ' if ' + this.compile(node.children[0]) + this.compile(node.children[1]);
                        break;
                    case 'op_if_else':
                        ret = ' if ' + this.compile(node.children[0]) + this.compile(node.children[1]);
                        ret += ' else ' + this.compile(node.children[2]);
                        break;
                    case 'op_while':
                        ret = ' while (' + this.compile(node.children[0]) + ') {\n' + this.compile(node.children[1]) + '}\n';
                        break;
                    case 'op_do':
                        ret = ' do {\n' + this.compile(node.children[0]) + '} while (' + this.compile(node.children[1]) + ');\n';
                        break;
                    case 'op_param':
                        if (node.children[1]) {
                            ret = this.compile(node.children[1]) + ', ';
                        }

                        ret += this.compile(node.children[0]);
                        break;
                    case 'op_paramdef':
                        if (node.children[1]) {
                            ret = this.compile(node.children[1]) + ', ';
                        }

                        ret += node.children[0];
                        break;
                    case 'op_proplst':
                        if (node.children[0]) {
                            ret = this.compile(node.children[0]) + ', ';
                        }

                        ret += this.compile(node.children[1]);
                        break;
                    case 'op_prop':
                        // child 0: Identifier
                        // child 1: Value
                        ret = node.children[0] + ': ' + this.compile(node.children[1]);
                        break;
                    case 'op_proplst_val':
                        ret = (javascript ? '{' : '<<') + this.compile(node.children[0]) + (javascript ? '}' : '>>');
                        break;
                    case 'op_array':
                        ret = '[' + this.compile(node.children[0]) + ']';
                        break;
                    case 'op_extvalue':
                        ret = this.compile(node.children[0]) + '[' + this.compile(node.children[1]) + ']';
                        break;
                    case 'op_return':
                        ret = ' return ' + this.compile(node.children[0]) + ';\n';
                        break;
                    case 'op_function':
                        ret = ' function (' + this.compile(node.children[0]) + ') {\n' + this.compile(node.children[1]) + '}';
                        break;
                    case 'op_execfun':
                        ret = this.compile(node.children[0]) + '(' + this.compile(node.children[1]) + ')';
                        // parse the properties only if given
                        if (node.children[2]) {
                            ret += (javascript ? '{' : '<<') + this.compile(node.children[2]) + (javascript ? '}' : '>>');
                        }
                        break;
                    case 'op_property':
                        ret = this.compile(node.children[0]) + '.' + node.children[1];
                        break;
                    case 'op_lhs':
                        if (node.children.length === 1) {
                            ret = node.children[0];
                        } else if (node.children[2] === 'dot') {
                            ret = this.compile(node.children[1]) + '.' + node.children[0];
                        } else if (node.children[2] === 'bracket') {
                            ret = this.compile(node.children[1]) + '[' + this.compile(node.children[0]) + ']';
                        }
                        break;
                    case 'op_use':
                        ret = 'use ' + node.children[0] + ';';
                        break;
                    case 'op_delete':
                        ret = 'delete ' + node.children[0];
                        break;
                    case 'op_equ':
                        ret = '(' + this.compile(node.children[0]) + ' == ' + this.compile(node.children[1]) + ')';
                        break;
                    case 'op_neq':
                        ret = '(' + this.compile(node.children[0]) + ' != ' + this.compile(node.children[1]) + ')';
                        break;
                    case 'op_grt':
                        ret = '(' + this.compile(node.children[0]) + ' > ' + this.compile(node.children[1]) + ')';
                        break;
                    case 'op_lot':
                        ret = '(' + this.compile(node.children[0]) + ' < ' + this.compile(node.children[1]) + ')';
                        break;
                    case 'op_gre':
                        ret = '(' + this.compile(node.children[0]) + ' >= ' + this.compile(node.children[1]) + ')';
                        break;
                    case 'op_loe':
                        ret = '(' + this.compile(node.children[0]) + ' <= ' + this.compile(node.children[1]) + ')';
                        break;
                    case 'op_add':
                        ret = '(' + this.compile(node.children[0]) + ' + ' + this.compile(node.children[1]) + ')';
                        break;
                    case 'op_sub':
                        ret = '(' + this.compile(node.children[0]) + ' - ' + this.compile(node.children[1]) + ')';
                        break;
                    case 'op_div':
                        ret = '(' + this.compile(node.children[0]) + ' / ' + this.compile(node.children[1]) + ')';
                        break;
                    case 'op_mul':
                        ret = '(' + this.compile(node.children[0]) + ' * ' + this.compile(node.children[1]) + ')';
                        break;
                    case 'op_exp':
                        ret = '(' + this.compile(node.children[0]) + '^' + this.compile(node.children[1]) + ')';
                        break;
                    case 'op_neg':
                        ret = '(-' + this.compile(node.children[0]) + ')';
                        break;
                }
                break;

            case 'node_var':
                ret = node.value;
                break;

            case 'node_const':
                ret = node.value;
                break;

            case 'node_const_bool':
                ret = node.value;
                break;

            case 'node_str':
                ret = '\'' + node.value.replace(/'/g, '\\\'') + '\'';
                break;
        }

        if (node.needsBrackets) {
            ret = '{\n' + ret + '}\n';
        }

        return ret;
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

        for(i = 2; i < arguments.length; i++)
            n.children.push( arguments[i] );

        return n;
    }

});
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


JXG.JessieCode = function(code) {
    // Control structures
    // scope stack
    this.sstack = [{}];
    this.scope = 0;
    // parameter stack
    this.pstack = [[]];
    this.pscope = 0;

    // properties stack
    this.propstack = [{}];
    this.propscope = 0;

    // array access list stack
    this.aalstack = [[]];
    this.aalscope = 0;

    // property object, if a property is set, the last object is saved and re-used, if there is no object given
    this.propobj = 0;

    // save left-hand-side of variable assignment
    this.lhs = [];

    // board currently in use
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
    node: function(type, value, children) {
        return {
            type: type,
            value: value,
            children: children
        };
    },

    _debug: function(log) {
        if(typeof console !== "undefined") {
            console.log(log);
        } else if(document.getElementById('debug') !== null) {
            document.getElementById('debug').innerHTML += log + '<br />';
        }
    },

    _error: function(msg) {
        throw new Error(msg);
    },

    letvar: function(vname, value) {
        this.sstack[this.scope][vname] = value;
    },

    getvar: function(vname) {
        var s;

        for (s = this.scope; s > -1; s--) {
            if (JXG.exists(this.sstack[s][vname])) {
                return this.sstack[s][vname];
            }
        }

        return 0;
    },

    parse: function(code) {
        var error_cnt = 0,
            error_off = [],
            error_la = [],
            ccode = code.split('\n'), i, cleaned = [];

        for (i = 0; i < ccode.length; i++) {
            if (!(JXG.trim(ccode[i])[0] === '/' && JXG.trim(ccode[i])[1] === '/')) {
                cleaned.push(ccode[i]);
            }
        }
        code = cleaned.join('\n');

        if((error_cnt = this._parse(code, error_off, error_la)) > 0) {
            for(i = 0; i < error_cnt; i++)
                alert("Parse error near >"  + code.substr( error_off[i], 30 ) + "<, expecting \"" + error_la[i].join() + "\"");
        }
    },

    execute: function( node ) {
        var ret = 0;

        if( !node )
            return 0;

        switch( node.type ) {
            case 'node_op':
                switch( node.value ) {
                    case 'op_none':
                        if (node.children[0]) {
                            this.execute(node.children[0]);
                        }
                        if (node.children[1]) {
                            ret = this.execute(node.children[1]);
                        }
                        break;
                    case 'op_assign':
                        this.lhs[this.scope] = node.children[0];
                        this.letvar(node.children[0], this.execute(node.children[1]));
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
                    case 'op_for':
                        // todo
                        do {
                            this.execute(node.children[0]);
                        } while (this.execute(node.children[1]));
                        break;
                    case 'op_paramlst':
                        if (node.children[0]) {
                            this.execute(node.children[0]);
                        }

                        if (node.children[1]) {
                            ret = node.children[1];
                            this.pstack[this.pscope].push(ret);
                        }
                        break;
                    case 'op_param':
                        if (node.children[0]) {
                            ret = node.children[0];
                            this.pstack[this.pscope].push(ret);
                        }
                        break;
                    case 'op_paramdeflst':
                        if (node.children[0]) {
                            this.execute(node.children[0]);
                        }
                        if (node.children[1]) {
                            ret = node.children[1];
                            this.pstack[this.pscope].push(ret);
                        }
                        break;
                    case 'op_paramdef':
                        if (node.children[0]) {
                            ret = node.children[0];
                            this.pstack[this.pscope].push(ret);
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
                            for(r = 0; r < _pstack.length; r++)
                                that.sstack[that.scope][_pstack[r]] = arguments[r];

                            r = that.execute(node.children[1]);

                            that.sstack.pop();
                            that.scope--;
                            return r;
                        }; })(this.pstack[this.pscope], this);

                        ret.functionCode = node.children[1];

                        this.pstack.pop();
                        this.pscope--;
                        break;
                    case 'op_execfun':
                        // node.children:
                        //   [0]: Name of the function
                        //   [1]: Parameter list as a parse subtree
                        //   [2]: Properties, only used in case of a create function
                        var fun, i, parents = [], props = false, attr;

                        this.pstack.push([]);
                        this.pscope++;

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
                        fun = this.getvar(node.children[0]);

                        // check for the function in the variable table
                        if(JXG.exists(fun) && typeof fun === 'function') {
                            for(i = 0; i < this.pstack[this.pscope].length; i++) {
                                parents[i] = this.execute(this.pstack[this.pscope][i]);
                            }
                            ret = fun.apply(this, parents);

                            // check for an element with this name
                        } else if (node.children[0] in JXG.JSXGraph.elements) {
                            for(i = 0; i < this.pstack[this.pscope].length; i++) {
                                if (node.children[0] === 'point' || node.children[0] === 'text') {
                                    if (this.pstack[this.pscope][i].type === 'node_const' || (this.pstack[this.pscope][i].value === 'op_neg' && this.pstack[this.pscope][i].children[0].type === 'node_const')) {
                                        parents[i] = (this.execute(this.pstack[this.pscope][i]));
                                    } else {
                                        parents[i] = ((function(stree, that) {
                                            return function() {
                                                return that.execute(stree)
                                            };
                                        })(this.pstack[this.pscope][i], this));
                                    }
                                } else {
                                    parents[i] = (this.execute(this.pstack[this.pscope][i]));
                                }
                            }

                            if (props) {
                                attr = this.propstack[this.propscope];
                            } else {
                                attr = {name: (this.lhs[this.scope] !== 0 ? this.lhs[this.scope] : '')};
                            }

                            ret = this.board.create(node.children[0], parents, attr);

                            // nothing found, throw an error
                            // todo: check for a valid identifier and appropriate parameters and create a point
                            //       this resembles the legacy JessieScript behaviour of A(1, 2);
                        } else if (typeof Math[node.children[0].toLowerCase()] !== 'undefined') {
                            for(i = 0; i < this.pstack[this.pscope].length; i++) {
                                parents[i] = this.execute(this.pstack[this.pscope][i]);
                            }
                            ret = Math[node.children[0].toLowerCase()].apply(this, parents);
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
                        var v = this.execute(node.children[2]),
                            e = this.getvar(node.children[0]),
                            par = {};

                        this.propobj = e;
                        par[node.children[1]] = v;
                        e.setProperty(par);
                        break;
                    case 'op_method':
                        var v = this.getvar(node.children[0]),
                            parents = [];
                        this.pstack.push([]);
                        this.pscope++;
console.log(node.children[2]);
                        this.execute(node.children[2]);

                        for(i = 0; i < this.pstack[this.pscope].length; i++) {
console.log((this.execute(this.pstack[this.pscope][i])));
                            parents[i] = (this.execute(this.pstack[this.pscope][i]));
                        }
console.log(parents);

                        if (typeof v[node.children[1]] === 'function') {
                            v[node.children[1]].apply(v, parents);
                        } else {
                            this._error('Error: "' + node.children[0] + '" has no method "' + node.children[1] + '".');
                        }

                        this.pstack.pop();
                        this.pscope--;
                        break;
                    case 'op_propnoob':
                        var v = this.execute(node.children[1]),
                            par = {};

                        if (this.propobj === 0) {
                            this._error('Object <null> not found.');
                        } else {
                            par[node.children[0]] = v;
                            this.propobj.setProperty(par);
                        }
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
                    case 'op_neg':
                        ret = this.execute(node.children[0]) * -1;
                        break;
                }
                break;

            case 'node_property':
                var e = this.getvar(node.value);

                ret = e.getProperty(node.children[0]);
                break;

            case 'node_var':
                ret = this.getvar(node.value);
                break;

            case 'node_const':
                ret = Number(node.value);
                break;

            case 'node_const_bool':
                if (node.value === 'false') {
                    ret = false;
                } else {
                    ret = true;
                }
                break;

            case 'node_str':
                ret = node.value;
                break;

            case 'node_method':
                switch(node.value) {
                    case 'x':
                        if(this.getvar(node.children[0]) === 0) {
                            this._error(node.children[0] + ' is undefined.');
                            ret = NaN;
                        } else if(!JXG.exists(this.getvar(node.children[0]).X)) {
                            this._error(node.children[0] + ' has no property \'X\'.');
                            ret = NaN;
                        } else
                            ret = this.getvar(node.children[0]).X();
                        break;
                    case 'y':
                        if(this.getvar(node.children[0]) === 0) {
                            this._error(node.children[0] + ' is undefined.');
                            ret = NaN;
                        } else if(!JXG.exists(this.getvar(node.children[0]).Y)) {
                            this._error(node.children[0] + ' has no property \'Y\'.');
                            ret = NaN;
                        } else
                            ret = this.getvar(node.children[0]).Y();
                        break;
                }
                break;
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
    createNode: function(type, value, children) {
        var n = this.node(type, value, []),
            i;

        for(i = 2; i < arguments.length; i++)
            n.children.push( arguments[i] );

        return n;
    }

});
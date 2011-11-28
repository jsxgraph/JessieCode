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

        if((error_cnt = JXG.JessieCode._parse(code, error_off, error_la)) > 0) {
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

                            r = that..execute(node.children[1]);
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
                                        parents[i] = (this..execute(this.pstack[this.pscope][i]));
                                    } else {
                                        parents[i] = ((function(stree, that) {
                                            return function() {
                                                return that..execute(stree)
                                            };
                                        })(this.pstack[this.pscope][i], this));
                                    }
                                } else {
                                    parents[i] = (this..execute(this.pstack[this.pscope][i]));
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
                ret = Boolean(node.value);
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
/*
    Default template driver for JS/CC generated parsers running as
    browser-based JavaScript/ECMAScript applications.
    
    WARNING:     This parser template will only run together with JSXGraph on a website.
    
    Features:
    - Parser trace messages
    - Integrated panic-mode error recovery
    
    Written 2007, 2008 by Jan Max Meyer, J.M.K S.F. Software Technologies
    
    This is in the public domain.
*/


JXG.extend(JXG.JessieCode.prototype, /** @lends JXG.JessieCode.prototype */ {
    _dbg_withtrace: false,
    _dbg_string: '',

    _dbg_print: function (text) {
        this._dbg_string += text + "\n";
    },

    _lex: function (info) {
        var state = 0,
            match = -1,
            match_pos = 0,
            start = 0,
            pos = info.offset + 1;

        do {
            pos--;
            state = 0;
            match = -2;
            start = pos;

            if (info.src.length <= start) {
                return 52;
            }

            do {

switch( state )
{
	case 0:
		if( ( info.src.charCodeAt( pos ) >= 9 && info.src.charCodeAt( pos ) <= 10 ) || info.src.charCodeAt( pos ) == 13 || info.src.charCodeAt( pos ) == 32 ) state = 1;
		else if( info.src.charCodeAt( pos ) == 35 ) state = 2;
		else if( info.src.charCodeAt( pos ) == 40 ) state = 3;
		else if( info.src.charCodeAt( pos ) == 41 ) state = 4;
		else if( info.src.charCodeAt( pos ) == 42 ) state = 5;
		else if( info.src.charCodeAt( pos ) == 43 ) state = 6;
		else if( info.src.charCodeAt( pos ) == 44 ) state = 7;
		else if( info.src.charCodeAt( pos ) == 45 ) state = 8;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 9;
		else if( info.src.charCodeAt( pos ) == 47 ) state = 10;
		else if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) ) state = 11;
		else if( info.src.charCodeAt( pos ) == 58 ) state = 12;
		else if( info.src.charCodeAt( pos ) == 59 ) state = 13;
		else if( info.src.charCodeAt( pos ) == 60 ) state = 14;
		else if( info.src.charCodeAt( pos ) == 61 ) state = 15;
		else if( info.src.charCodeAt( pos ) == 62 ) state = 16;
		else if( ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 67 ) || ( info.src.charCodeAt( pos ) >= 71 && info.src.charCodeAt( pos ) <= 72 ) || ( info.src.charCodeAt( pos ) >= 74 && info.src.charCodeAt( pos ) <= 81 ) || info.src.charCodeAt( pos ) == 83 || info.src.charCodeAt( pos ) == 86 || info.src.charCodeAt( pos ) == 90 || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 99 ) || ( info.src.charCodeAt( pos ) >= 103 && info.src.charCodeAt( pos ) <= 104 ) || ( info.src.charCodeAt( pos ) >= 106 && info.src.charCodeAt( pos ) <= 113 ) || info.src.charCodeAt( pos ) == 115 || info.src.charCodeAt( pos ) == 118 || ( info.src.charCodeAt( pos ) >= 120 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else if( info.src.charCodeAt( pos ) == 88 ) state = 18;
		else if( info.src.charCodeAt( pos ) == 89 ) state = 19;
		else if( info.src.charCodeAt( pos ) == 123 ) state = 20;
		else if( info.src.charCodeAt( pos ) == 124 ) state = 21;
		else if( info.src.charCodeAt( pos ) == 125 ) state = 22;
		else if( info.src.charCodeAt( pos ) == 33 ) state = 40;
		else if( info.src.charCodeAt( pos ) == 68 || info.src.charCodeAt( pos ) == 100 ) state = 41;
		else if( info.src.charCodeAt( pos ) == 39 ) state = 42;
		else if( info.src.charCodeAt( pos ) == 73 || info.src.charCodeAt( pos ) == 105 ) state = 43;
		else if( info.src.charCodeAt( pos ) == 85 || info.src.charCodeAt( pos ) == 117 ) state = 51;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 58;
		else if( info.src.charCodeAt( pos ) == 84 || info.src.charCodeAt( pos ) == 116 ) state = 59;
		else if( info.src.charCodeAt( pos ) == 70 || info.src.charCodeAt( pos ) == 102 ) state = 64;
		else if( info.src.charCodeAt( pos ) == 87 || info.src.charCodeAt( pos ) == 119 ) state = 65;
		else if( info.src.charCodeAt( pos ) == 82 || info.src.charCodeAt( pos ) == 114 ) state = 68;
		else state = -1;
		break;

	case 1:
		state = -1;
		match = 1;
		match_pos = pos;
		break;

	case 2:
		state = -1;
		match = 30;
		match_pos = pos;
		break;

	case 3:
		state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 4:
		state = -1;
		match = 29;
		match_pos = pos;
		break;

	case 5:
		state = -1;
		match = 26;
		match_pos = pos;
		break;

	case 6:
		state = -1;
		match = 23;
		match_pos = pos;
		break;

	case 7:
		state = -1;
		match = 27;
		match_pos = pos;
		break;

	case 8:
		state = -1;
		match = 24;
		match_pos = pos;
		break;

	case 9:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) ) state = 25;
		else state = -1;
		match = 33;
		match_pos = pos;
		break;

	case 10:
		state = -1;
		match = 25;
		match_pos = pos;
		break;

	case 11:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) ) state = 11;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 25;
		else state = -1;
		match = 38;
		match_pos = pos;
		break;

	case 12:
		state = -1;
		match = 31;
		match_pos = pos;
		break;

	case 13:
		state = -1;
		match = 15;
		match_pos = pos;
		break;

	case 14:
		if( info.src.charCodeAt( pos ) == 60 ) state = 26;
		else if( info.src.charCodeAt( pos ) == 61 ) state = 27;
		else state = -1;
		match = 22;
		match_pos = pos;
		break;

	case 15:
		if( info.src.charCodeAt( pos ) == 61 ) state = 28;
		else state = -1;
		match = 16;
		match_pos = pos;
		break;

	case 16:
		if( info.src.charCodeAt( pos ) == 61 ) state = 29;
		else if( info.src.charCodeAt( pos ) == 62 ) state = 30;
		else state = -1;
		match = 21;
		match_pos = pos;
		break;

	case 17:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 18:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else state = -1;
		match = 11;
		match_pos = pos;
		break;

	case 19:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else state = -1;
		match = 12;
		match_pos = pos;
		break;

	case 20:
		state = -1;
		match = 13;
		match_pos = pos;
		break;

	case 21:
		state = -1;
		match = 32;
		match_pos = pos;
		break;

	case 22:
		state = -1;
		match = 14;
		match_pos = pos;
		break;

	case 23:
		state = -1;
		match = 18;
		match_pos = pos;
		break;

	case 24:
		if( info.src.charCodeAt( pos ) == 39 ) state = 42;
		else state = -1;
		match = 37;
		match_pos = pos;
		break;

	case 25:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) ) state = 25;
		else state = -1;
		match = 39;
		match_pos = pos;
		break;

	case 26:
		state = -1;
		match = 34;
		match_pos = pos;
		break;

	case 27:
		state = -1;
		match = 19;
		match_pos = pos;
		break;

	case 28:
		state = -1;
		match = 17;
		match_pos = pos;
		break;

	case 29:
		state = -1;
		match = 20;
		match_pos = pos;
		break;

	case 30:
		state = -1;
		match = 35;
		match_pos = pos;
		break;

	case 31:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else state = -1;
		match = 5;
		match_pos = pos;
		break;

	case 32:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else state = -1;
		match = 2;
		match_pos = pos;
		break;

	case 33:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else state = -1;
		match = 7;
		match_pos = pos;
		break;

	case 34:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else state = -1;
		match = 3;
		match_pos = pos;
		break;

	case 35:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else state = -1;
		match = 9;
		match_pos = pos;
		break;

	case 36:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else state = -1;
		match = 10;
		match_pos = pos;
		break;

	case 37:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else state = -1;
		match = 4;
		match_pos = pos;
		break;

	case 38:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else state = -1;
		match = 8;
		match_pos = pos;
		break;

	case 39:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else state = -1;
		match = 6;
		match_pos = pos;
		break;

	case 40:
		if( info.src.charCodeAt( pos ) == 61 ) state = 23;
		else state = -1;
		break;

	case 41:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 78 ) || ( info.src.charCodeAt( pos ) >= 80 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 110 ) || ( info.src.charCodeAt( pos ) >= 112 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else if( info.src.charCodeAt( pos ) == 79 || info.src.charCodeAt( pos ) == 111 ) state = 31;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 42:
		if( info.src.charCodeAt( pos ) == 39 ) state = 24;
		else if( ( info.src.charCodeAt( pos ) >= 0 && info.src.charCodeAt( pos ) <= 38 ) || ( info.src.charCodeAt( pos ) >= 40 && info.src.charCodeAt( pos ) <= 254 ) ) state = 42;
		else state = -1;
		break;

	case 43:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 69 ) || ( info.src.charCodeAt( pos ) >= 71 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 101 ) || ( info.src.charCodeAt( pos ) >= 103 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else if( info.src.charCodeAt( pos ) == 70 || info.src.charCodeAt( pos ) == 102 ) state = 32;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 44:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 68 ) || ( info.src.charCodeAt( pos ) >= 70 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 100 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 33;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 45:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 68 ) || ( info.src.charCodeAt( pos ) >= 70 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 100 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 34;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 46:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 68 ) || ( info.src.charCodeAt( pos ) >= 70 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 100 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 35;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 47:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 68 ) || ( info.src.charCodeAt( pos ) >= 70 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 100 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 36;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 48:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 68 ) || ( info.src.charCodeAt( pos ) >= 70 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 100 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 37;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 49:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 77 ) || ( info.src.charCodeAt( pos ) >= 79 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 109 ) || ( info.src.charCodeAt( pos ) >= 111 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else if( info.src.charCodeAt( pos ) == 78 || info.src.charCodeAt( pos ) == 110 ) state = 38;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 50:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 77 ) || ( info.src.charCodeAt( pos ) >= 79 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 109 ) || ( info.src.charCodeAt( pos ) >= 111 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else if( info.src.charCodeAt( pos ) == 78 || info.src.charCodeAt( pos ) == 110 ) state = 39;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 51:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 82 ) || ( info.src.charCodeAt( pos ) >= 84 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 114 ) || ( info.src.charCodeAt( pos ) >= 116 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else if( info.src.charCodeAt( pos ) == 83 || info.src.charCodeAt( pos ) == 115 ) state = 44;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 52:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 82 ) || ( info.src.charCodeAt( pos ) >= 84 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 114 ) || ( info.src.charCodeAt( pos ) >= 116 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else if( info.src.charCodeAt( pos ) == 83 || info.src.charCodeAt( pos ) == 115 ) state = 45;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 53:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 84 ) || ( info.src.charCodeAt( pos ) >= 86 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 116 ) || ( info.src.charCodeAt( pos ) >= 118 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else if( info.src.charCodeAt( pos ) == 85 || info.src.charCodeAt( pos ) == 117 ) state = 46;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 54:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 82 ) || ( info.src.charCodeAt( pos ) >= 84 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 114 ) || ( info.src.charCodeAt( pos ) >= 116 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else if( info.src.charCodeAt( pos ) == 83 || info.src.charCodeAt( pos ) == 115 ) state = 47;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 55:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 75 ) || ( info.src.charCodeAt( pos ) >= 77 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 107 ) || ( info.src.charCodeAt( pos ) >= 109 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else if( info.src.charCodeAt( pos ) == 76 || info.src.charCodeAt( pos ) == 108 ) state = 48;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 56:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 81 ) || ( info.src.charCodeAt( pos ) >= 83 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 113 ) || ( info.src.charCodeAt( pos ) >= 115 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else if( info.src.charCodeAt( pos ) == 82 || info.src.charCodeAt( pos ) == 114 ) state = 49;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 57:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 78 ) || ( info.src.charCodeAt( pos ) >= 80 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 110 ) || ( info.src.charCodeAt( pos ) >= 112 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else if( info.src.charCodeAt( pos ) == 79 || info.src.charCodeAt( pos ) == 111 ) state = 50;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 58:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 75 ) || ( info.src.charCodeAt( pos ) >= 77 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 107 ) || ( info.src.charCodeAt( pos ) >= 109 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else if( info.src.charCodeAt( pos ) == 76 || info.src.charCodeAt( pos ) == 108 ) state = 52;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 59:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 81 ) || ( info.src.charCodeAt( pos ) >= 83 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 113 ) || ( info.src.charCodeAt( pos ) >= 115 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else if( info.src.charCodeAt( pos ) == 82 || info.src.charCodeAt( pos ) == 114 ) state = 53;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 60:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 75 ) || ( info.src.charCodeAt( pos ) >= 77 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 107 ) || ( info.src.charCodeAt( pos ) >= 109 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else if( info.src.charCodeAt( pos ) == 76 || info.src.charCodeAt( pos ) == 108 ) state = 54;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 61:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 72 ) || ( info.src.charCodeAt( pos ) >= 74 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 104 ) || ( info.src.charCodeAt( pos ) >= 106 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else if( info.src.charCodeAt( pos ) == 73 || info.src.charCodeAt( pos ) == 105 ) state = 55;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 62:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 84 ) || ( info.src.charCodeAt( pos ) >= 86 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 116 ) || ( info.src.charCodeAt( pos ) >= 118 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else if( info.src.charCodeAt( pos ) == 85 || info.src.charCodeAt( pos ) == 117 ) state = 56;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 63:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 72 ) || ( info.src.charCodeAt( pos ) >= 74 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 104 ) || ( info.src.charCodeAt( pos ) >= 106 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else if( info.src.charCodeAt( pos ) == 73 || info.src.charCodeAt( pos ) == 105 ) state = 57;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 64:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 66 && info.src.charCodeAt( pos ) <= 84 ) || ( info.src.charCodeAt( pos ) >= 86 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 98 && info.src.charCodeAt( pos ) <= 116 ) || ( info.src.charCodeAt( pos ) >= 118 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else if( info.src.charCodeAt( pos ) == 65 || info.src.charCodeAt( pos ) == 97 ) state = 60;
		else if( info.src.charCodeAt( pos ) == 85 || info.src.charCodeAt( pos ) == 117 ) state = 70;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 65:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 71 ) || ( info.src.charCodeAt( pos ) >= 73 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 103 ) || ( info.src.charCodeAt( pos ) >= 105 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else if( info.src.charCodeAt( pos ) == 72 || info.src.charCodeAt( pos ) == 104 ) state = 61;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 66:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 83 ) || ( info.src.charCodeAt( pos ) >= 85 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 115 ) || ( info.src.charCodeAt( pos ) >= 117 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else if( info.src.charCodeAt( pos ) == 84 || info.src.charCodeAt( pos ) == 116 ) state = 62;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 67:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 83 ) || ( info.src.charCodeAt( pos ) >= 85 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 115 ) || ( info.src.charCodeAt( pos ) >= 117 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else if( info.src.charCodeAt( pos ) == 84 || info.src.charCodeAt( pos ) == 116 ) state = 63;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 68:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 68 ) || ( info.src.charCodeAt( pos ) >= 70 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 100 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 66;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 69:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 66 ) || ( info.src.charCodeAt( pos ) >= 68 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 98 ) || ( info.src.charCodeAt( pos ) >= 100 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else if( info.src.charCodeAt( pos ) == 67 || info.src.charCodeAt( pos ) == 99 ) state = 67;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

	case 70:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 77 ) || ( info.src.charCodeAt( pos ) >= 79 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 109 ) || ( info.src.charCodeAt( pos ) >= 111 && info.src.charCodeAt( pos ) <= 122 ) ) state = 17;
		else if( info.src.charCodeAt( pos ) == 78 || info.src.charCodeAt( pos ) == 110 ) state = 69;
		else state = -1;
		match = 36;
		match_pos = pos;
		break;

}


                pos++;

            } while( state > -1 );

        } while (1 > -1 && match == 1);

        if (match > -1) {
            info.att = info.src.substr( start, match_pos - start );
            info.offset = match_pos;
        
switch( match )
{
	case 37:
		{
		 info.att = info.att.substr( 1, info.att.length - 2 );
                                                                                info.att = info.att.replace( /''/g, "\'" );    
		}
		break;

}


        } else {
            info.att = new String();
            match = -1;
        }

        return match;
    },


    _parse: function (src, err_off, err_la) {
        var sstack = [],
            vstack = [],
            err_cnt = 0,
            act,
            go,
            la,
            rval,
            i,
            parseinfo = new Function( "", "var offset; var src; var att;" ),
            info = new parseinfo();

/* Pop-Table */
var pop_tab = new Array(
	new Array( 0/* Program' */, 1 ),
	new Array( 40/* Program */, 2 ),
	new Array( 40/* Program */, 0 ),
	new Array( 42/* Stmt_List */, 2 ),
	new Array( 42/* Stmt_List */, 0 ),
	new Array( 43/* Param_List */, 3 ),
	new Array( 43/* Param_List */, 1 ),
	new Array( 45/* Prop_List */, 3 ),
	new Array( 45/* Prop_List */, 1 ),
	new Array( 45/* Prop_List */, 0 ),
	new Array( 46/* Prop */, 3 ),
	new Array( 47/* Param_Def_List */, 3 ),
	new Array( 47/* Param_Def_List */, 1 ),
	new Array( 47/* Param_Def_List */, 0 ),
	new Array( 41/* Stmt */, 3 ),
	new Array( 41/* Stmt */, 5 ),
	new Array( 41/* Stmt */, 3 ),
	new Array( 41/* Stmt */, 5 ),
	new Array( 41/* Stmt */, 3 ),
	new Array( 41/* Stmt */, 2 ),
	new Array( 41/* Stmt */, 4 ),
	new Array( 41/* Stmt */, 6 ),
	new Array( 41/* Stmt */, 5 ),
	new Array( 41/* Stmt */, 2 ),
	new Array( 41/* Stmt */, 3 ),
	new Array( 41/* Stmt */, 1 ),
	new Array( 44/* Expression */, 3 ),
	new Array( 44/* Expression */, 3 ),
	new Array( 44/* Expression */, 3 ),
	new Array( 44/* Expression */, 3 ),
	new Array( 44/* Expression */, 3 ),
	new Array( 44/* Expression */, 3 ),
	new Array( 44/* Expression */, 1 ),
	new Array( 48/* AddSubExp */, 3 ),
	new Array( 48/* AddSubExp */, 3 ),
	new Array( 48/* AddSubExp */, 1 ),
	new Array( 49/* MulDivExp */, 3 ),
	new Array( 49/* MulDivExp */, 3 ),
	new Array( 49/* MulDivExp */, 1 ),
	new Array( 50/* NegExp */, 2 ),
	new Array( 50/* NegExp */, 1 ),
	new Array( 51/* Value */, 1 ),
	new Array( 51/* Value */, 1 ),
	new Array( 51/* Value */, 1 ),
	new Array( 51/* Value */, 3 ),
	new Array( 51/* Value */, 1 ),
	new Array( 51/* Value */, 4 ),
	new Array( 51/* Value */, 7 ),
	new Array( 51/* Value */, 7 ),
	new Array( 51/* Value */, 4 ),
	new Array( 51/* Value */, 4 ),
	new Array( 51/* Value */, 3 ),
	new Array( 51/* Value */, 3 ),
	new Array( 51/* Value */, 1 ),
	new Array( 51/* Value */, 1 )
);

/* Action-Table */
var act_tab = new Array(
	/* State 0 */ new Array( 52/* "$" */,-2 , 2/* "IF" */,-2 , 4/* "WHILE" */,-2 , 5/* "DO" */,-2 , 7/* "USE" */,-2 , 8/* "RETURN" */,-2 , 36/* "Identifier" */,-2 , 33/* "." */,-2 , 13/* "{" */,-2 , 15/* ";" */,-2 , 24/* "-" */,-2 , 38/* "Integer" */,-2 , 39/* "Float" */,-2 , 28/* "(" */,-2 , 37/* "String" */,-2 , 6/* "FUNCTION" */,-2 , 11/* "X" */,-2 , 12/* "Y" */,-2 , 34/* "<<" */,-2 , 9/* "TRUE" */,-2 , 10/* "FALSE" */,-2 ),
	/* State 1 */ new Array( 2/* "IF" */,3 , 4/* "WHILE" */,4 , 5/* "DO" */,5 , 7/* "USE" */,6 , 8/* "RETURN" */,7 , 36/* "Identifier" */,8 , 33/* "." */,9 , 13/* "{" */,11 , 15/* ";" */,12 , 24/* "-" */,16 , 38/* "Integer" */,18 , 39/* "Float" */,19 , 28/* "(" */,20 , 37/* "String" */,21 , 6/* "FUNCTION" */,22 , 11/* "X" */,23 , 12/* "Y" */,24 , 34/* "<<" */,25 , 9/* "TRUE" */,26 , 10/* "FALSE" */,27 , 52/* "$" */,0 ),
	/* State 2 */ new Array( 52/* "$" */,-1 , 2/* "IF" */,-1 , 4/* "WHILE" */,-1 , 5/* "DO" */,-1 , 7/* "USE" */,-1 , 8/* "RETURN" */,-1 , 36/* "Identifier" */,-1 , 33/* "." */,-1 , 13/* "{" */,-1 , 15/* ";" */,-1 , 24/* "-" */,-1 , 38/* "Integer" */,-1 , 39/* "Float" */,-1 , 28/* "(" */,-1 , 37/* "String" */,-1 , 6/* "FUNCTION" */,-1 , 11/* "X" */,-1 , 12/* "Y" */,-1 , 34/* "<<" */,-1 , 9/* "TRUE" */,-1 , 10/* "FALSE" */,-1 ),
	/* State 3 */ new Array( 24/* "-" */,16 , 38/* "Integer" */,18 , 39/* "Float" */,19 , 36/* "Identifier" */,29 , 28/* "(" */,20 , 37/* "String" */,21 , 6/* "FUNCTION" */,22 , 11/* "X" */,23 , 12/* "Y" */,24 , 34/* "<<" */,25 , 9/* "TRUE" */,26 , 10/* "FALSE" */,27 ),
	/* State 4 */ new Array( 24/* "-" */,16 , 38/* "Integer" */,18 , 39/* "Float" */,19 , 36/* "Identifier" */,29 , 28/* "(" */,20 , 37/* "String" */,21 , 6/* "FUNCTION" */,22 , 11/* "X" */,23 , 12/* "Y" */,24 , 34/* "<<" */,25 , 9/* "TRUE" */,26 , 10/* "FALSE" */,27 ),
	/* State 5 */ new Array( 2/* "IF" */,3 , 4/* "WHILE" */,4 , 5/* "DO" */,5 , 7/* "USE" */,6 , 8/* "RETURN" */,7 , 36/* "Identifier" */,8 , 33/* "." */,9 , 13/* "{" */,11 , 15/* ";" */,12 , 24/* "-" */,16 , 38/* "Integer" */,18 , 39/* "Float" */,19 , 28/* "(" */,20 , 37/* "String" */,21 , 6/* "FUNCTION" */,22 , 11/* "X" */,23 , 12/* "Y" */,24 , 34/* "<<" */,25 , 9/* "TRUE" */,26 , 10/* "FALSE" */,27 ),
	/* State 6 */ new Array( 36/* "Identifier" */,32 ),
	/* State 7 */ new Array( 2/* "IF" */,3 , 4/* "WHILE" */,4 , 5/* "DO" */,5 , 7/* "USE" */,6 , 8/* "RETURN" */,7 , 36/* "Identifier" */,8 , 33/* "." */,9 , 13/* "{" */,11 , 15/* ";" */,12 , 24/* "-" */,16 , 38/* "Integer" */,18 , 39/* "Float" */,19 , 28/* "(" */,20 , 37/* "String" */,21 , 6/* "FUNCTION" */,22 , 11/* "X" */,23 , 12/* "Y" */,24 , 34/* "<<" */,25 , 9/* "TRUE" */,26 , 10/* "FALSE" */,27 ),
	/* State 8 */ new Array( 33/* "." */,34 , 28/* "(" */,35 , 16/* "=" */,36 , 15/* ";" */,-43 , 17/* "==" */,-43 , 22/* "<" */,-43 , 21/* ">" */,-43 , 19/* "<=" */,-43 , 20/* ">=" */,-43 , 18/* "!=" */,-43 , 24/* "-" */,-43 , 23/* "+" */,-43 , 26/* "*" */,-43 , 25/* "/" */,-43 ),
	/* State 9 */ new Array( 36/* "Identifier" */,37 ),
	/* State 10 */ new Array( 18/* "!=" */,38 , 20/* ">=" */,39 , 19/* "<=" */,40 , 21/* ">" */,41 , 22/* "<" */,42 , 17/* "==" */,43 , 15/* ";" */,44 ),
	/* State 11 */ new Array( 14/* "}" */,-4 , 2/* "IF" */,-4 , 4/* "WHILE" */,-4 , 5/* "DO" */,-4 , 7/* "USE" */,-4 , 8/* "RETURN" */,-4 , 36/* "Identifier" */,-4 , 33/* "." */,-4 , 13/* "{" */,-4 , 15/* ";" */,-4 , 24/* "-" */,-4 , 38/* "Integer" */,-4 , 39/* "Float" */,-4 , 28/* "(" */,-4 , 37/* "String" */,-4 , 6/* "FUNCTION" */,-4 , 11/* "X" */,-4 , 12/* "Y" */,-4 , 34/* "<<" */,-4 , 9/* "TRUE" */,-4 , 10/* "FALSE" */,-4 ),
	/* State 12 */ new Array( 52/* "$" */,-25 , 2/* "IF" */,-25 , 4/* "WHILE" */,-25 , 5/* "DO" */,-25 , 7/* "USE" */,-25 , 8/* "RETURN" */,-25 , 36/* "Identifier" */,-25 , 33/* "." */,-25 , 13/* "{" */,-25 , 15/* ";" */,-25 , 24/* "-" */,-25 , 38/* "Integer" */,-25 , 39/* "Float" */,-25 , 28/* "(" */,-25 , 37/* "String" */,-25 , 6/* "FUNCTION" */,-25 , 11/* "X" */,-25 , 12/* "Y" */,-25 , 34/* "<<" */,-25 , 9/* "TRUE" */,-25 , 10/* "FALSE" */,-25 , 3/* "ELSE" */,-25 , 14/* "}" */,-25 ),
	/* State 13 */ new Array( 23/* "+" */,46 , 24/* "-" */,47 , 15/* ";" */,-32 , 17/* "==" */,-32 , 22/* "<" */,-32 , 21/* ">" */,-32 , 19/* "<=" */,-32 , 20/* ">=" */,-32 , 18/* "!=" */,-32 , 2/* "IF" */,-32 , 4/* "WHILE" */,-32 , 5/* "DO" */,-32 , 7/* "USE" */,-32 , 8/* "RETURN" */,-32 , 36/* "Identifier" */,-32 , 33/* "." */,-32 , 13/* "{" */,-32 , 38/* "Integer" */,-32 , 39/* "Float" */,-32 , 28/* "(" */,-32 , 37/* "String" */,-32 , 6/* "FUNCTION" */,-32 , 11/* "X" */,-32 , 12/* "Y" */,-32 , 34/* "<<" */,-32 , 9/* "TRUE" */,-32 , 10/* "FALSE" */,-32 , 29/* ")" */,-32 , 27/* "," */,-32 , 35/* ">>" */,-32 ),
	/* State 14 */ new Array( 25/* "/" */,48 , 26/* "*" */,49 , 15/* ";" */,-35 , 17/* "==" */,-35 , 22/* "<" */,-35 , 21/* ">" */,-35 , 19/* "<=" */,-35 , 20/* ">=" */,-35 , 18/* "!=" */,-35 , 24/* "-" */,-35 , 23/* "+" */,-35 , 2/* "IF" */,-35 , 4/* "WHILE" */,-35 , 5/* "DO" */,-35 , 7/* "USE" */,-35 , 8/* "RETURN" */,-35 , 36/* "Identifier" */,-35 , 33/* "." */,-35 , 13/* "{" */,-35 , 38/* "Integer" */,-35 , 39/* "Float" */,-35 , 28/* "(" */,-35 , 37/* "String" */,-35 , 6/* "FUNCTION" */,-35 , 11/* "X" */,-35 , 12/* "Y" */,-35 , 34/* "<<" */,-35 , 9/* "TRUE" */,-35 , 10/* "FALSE" */,-35 , 29/* ")" */,-35 , 27/* "," */,-35 , 35/* ">>" */,-35 ),
	/* State 15 */ new Array( 15/* ";" */,-38 , 17/* "==" */,-38 , 22/* "<" */,-38 , 21/* ">" */,-38 , 19/* "<=" */,-38 , 20/* ">=" */,-38 , 18/* "!=" */,-38 , 24/* "-" */,-38 , 23/* "+" */,-38 , 26/* "*" */,-38 , 25/* "/" */,-38 , 2/* "IF" */,-38 , 4/* "WHILE" */,-38 , 5/* "DO" */,-38 , 7/* "USE" */,-38 , 8/* "RETURN" */,-38 , 36/* "Identifier" */,-38 , 33/* "." */,-38 , 13/* "{" */,-38 , 38/* "Integer" */,-38 , 39/* "Float" */,-38 , 28/* "(" */,-38 , 37/* "String" */,-38 , 6/* "FUNCTION" */,-38 , 11/* "X" */,-38 , 12/* "Y" */,-38 , 34/* "<<" */,-38 , 9/* "TRUE" */,-38 , 10/* "FALSE" */,-38 , 29/* ")" */,-38 , 27/* "," */,-38 , 35/* ">>" */,-38 ),
	/* State 16 */ new Array( 38/* "Integer" */,18 , 39/* "Float" */,19 , 36/* "Identifier" */,29 , 28/* "(" */,20 , 37/* "String" */,21 , 6/* "FUNCTION" */,22 , 11/* "X" */,23 , 12/* "Y" */,24 , 34/* "<<" */,25 , 9/* "TRUE" */,26 , 10/* "FALSE" */,27 ),
	/* State 17 */ new Array( 15/* ";" */,-40 , 17/* "==" */,-40 , 22/* "<" */,-40 , 21/* ">" */,-40 , 19/* "<=" */,-40 , 20/* ">=" */,-40 , 18/* "!=" */,-40 , 24/* "-" */,-40 , 23/* "+" */,-40 , 26/* "*" */,-40 , 25/* "/" */,-40 , 2/* "IF" */,-40 , 4/* "WHILE" */,-40 , 5/* "DO" */,-40 , 7/* "USE" */,-40 , 8/* "RETURN" */,-40 , 36/* "Identifier" */,-40 , 33/* "." */,-40 , 13/* "{" */,-40 , 38/* "Integer" */,-40 , 39/* "Float" */,-40 , 28/* "(" */,-40 , 37/* "String" */,-40 , 6/* "FUNCTION" */,-40 , 11/* "X" */,-40 , 12/* "Y" */,-40 , 34/* "<<" */,-40 , 9/* "TRUE" */,-40 , 10/* "FALSE" */,-40 , 29/* ")" */,-40 , 27/* "," */,-40 , 35/* ">>" */,-40 ),
	/* State 18 */ new Array( 15/* ";" */,-41 , 17/* "==" */,-41 , 22/* "<" */,-41 , 21/* ">" */,-41 , 19/* "<=" */,-41 , 20/* ">=" */,-41 , 18/* "!=" */,-41 , 24/* "-" */,-41 , 23/* "+" */,-41 , 26/* "*" */,-41 , 25/* "/" */,-41 , 2/* "IF" */,-41 , 4/* "WHILE" */,-41 , 5/* "DO" */,-41 , 7/* "USE" */,-41 , 8/* "RETURN" */,-41 , 36/* "Identifier" */,-41 , 33/* "." */,-41 , 13/* "{" */,-41 , 38/* "Integer" */,-41 , 39/* "Float" */,-41 , 28/* "(" */,-41 , 37/* "String" */,-41 , 6/* "FUNCTION" */,-41 , 11/* "X" */,-41 , 12/* "Y" */,-41 , 34/* "<<" */,-41 , 9/* "TRUE" */,-41 , 10/* "FALSE" */,-41 , 29/* ")" */,-41 , 27/* "," */,-41 , 35/* ">>" */,-41 ),
	/* State 19 */ new Array( 15/* ";" */,-42 , 17/* "==" */,-42 , 22/* "<" */,-42 , 21/* ">" */,-42 , 19/* "<=" */,-42 , 20/* ">=" */,-42 , 18/* "!=" */,-42 , 24/* "-" */,-42 , 23/* "+" */,-42 , 26/* "*" */,-42 , 25/* "/" */,-42 , 2/* "IF" */,-42 , 4/* "WHILE" */,-42 , 5/* "DO" */,-42 , 7/* "USE" */,-42 , 8/* "RETURN" */,-42 , 36/* "Identifier" */,-42 , 33/* "." */,-42 , 13/* "{" */,-42 , 38/* "Integer" */,-42 , 39/* "Float" */,-42 , 28/* "(" */,-42 , 37/* "String" */,-42 , 6/* "FUNCTION" */,-42 , 11/* "X" */,-42 , 12/* "Y" */,-42 , 34/* "<<" */,-42 , 9/* "TRUE" */,-42 , 10/* "FALSE" */,-42 , 29/* ")" */,-42 , 27/* "," */,-42 , 35/* ">>" */,-42 ),
	/* State 20 */ new Array( 24/* "-" */,16 , 38/* "Integer" */,18 , 39/* "Float" */,19 , 36/* "Identifier" */,29 , 28/* "(" */,20 , 37/* "String" */,21 , 6/* "FUNCTION" */,22 , 11/* "X" */,23 , 12/* "Y" */,24 , 34/* "<<" */,25 , 9/* "TRUE" */,26 , 10/* "FALSE" */,27 ),
	/* State 21 */ new Array( 15/* ";" */,-45 , 17/* "==" */,-45 , 22/* "<" */,-45 , 21/* ">" */,-45 , 19/* "<=" */,-45 , 20/* ">=" */,-45 , 18/* "!=" */,-45 , 24/* "-" */,-45 , 23/* "+" */,-45 , 26/* "*" */,-45 , 25/* "/" */,-45 , 2/* "IF" */,-45 , 4/* "WHILE" */,-45 , 5/* "DO" */,-45 , 7/* "USE" */,-45 , 8/* "RETURN" */,-45 , 36/* "Identifier" */,-45 , 33/* "." */,-45 , 13/* "{" */,-45 , 38/* "Integer" */,-45 , 39/* "Float" */,-45 , 28/* "(" */,-45 , 37/* "String" */,-45 , 6/* "FUNCTION" */,-45 , 11/* "X" */,-45 , 12/* "Y" */,-45 , 34/* "<<" */,-45 , 9/* "TRUE" */,-45 , 10/* "FALSE" */,-45 , 29/* ")" */,-45 , 27/* "," */,-45 , 35/* ">>" */,-45 ),
	/* State 22 */ new Array( 28/* "(" */,52 ),
	/* State 23 */ new Array( 28/* "(" */,53 ),
	/* State 24 */ new Array( 28/* "(" */,54 ),
	/* State 25 */ new Array( 36/* "Identifier" */,57 , 35/* ">>" */,-9 , 27/* "," */,-9 ),
	/* State 26 */ new Array( 15/* ";" */,-53 , 17/* "==" */,-53 , 22/* "<" */,-53 , 21/* ">" */,-53 , 19/* "<=" */,-53 , 20/* ">=" */,-53 , 18/* "!=" */,-53 , 24/* "-" */,-53 , 23/* "+" */,-53 , 26/* "*" */,-53 , 25/* "/" */,-53 , 2/* "IF" */,-53 , 4/* "WHILE" */,-53 , 5/* "DO" */,-53 , 7/* "USE" */,-53 , 8/* "RETURN" */,-53 , 36/* "Identifier" */,-53 , 33/* "." */,-53 , 13/* "{" */,-53 , 38/* "Integer" */,-53 , 39/* "Float" */,-53 , 28/* "(" */,-53 , 37/* "String" */,-53 , 6/* "FUNCTION" */,-53 , 11/* "X" */,-53 , 12/* "Y" */,-53 , 34/* "<<" */,-53 , 9/* "TRUE" */,-53 , 10/* "FALSE" */,-53 , 29/* ")" */,-53 , 27/* "," */,-53 , 35/* ">>" */,-53 ),
	/* State 27 */ new Array( 15/* ";" */,-54 , 17/* "==" */,-54 , 22/* "<" */,-54 , 21/* ">" */,-54 , 19/* "<=" */,-54 , 20/* ">=" */,-54 , 18/* "!=" */,-54 , 24/* "-" */,-54 , 23/* "+" */,-54 , 26/* "*" */,-54 , 25/* "/" */,-54 , 2/* "IF" */,-54 , 4/* "WHILE" */,-54 , 5/* "DO" */,-54 , 7/* "USE" */,-54 , 8/* "RETURN" */,-54 , 36/* "Identifier" */,-54 , 33/* "." */,-54 , 13/* "{" */,-54 , 38/* "Integer" */,-54 , 39/* "Float" */,-54 , 28/* "(" */,-54 , 37/* "String" */,-54 , 6/* "FUNCTION" */,-54 , 11/* "X" */,-54 , 12/* "Y" */,-54 , 34/* "<<" */,-54 , 9/* "TRUE" */,-54 , 10/* "FALSE" */,-54 , 29/* ")" */,-54 , 27/* "," */,-54 , 35/* ">>" */,-54 ),
	/* State 28 */ new Array( 18/* "!=" */,38 , 20/* ">=" */,39 , 19/* "<=" */,40 , 21/* ">" */,41 , 22/* "<" */,42 , 17/* "==" */,43 , 2/* "IF" */,3 , 4/* "WHILE" */,4 , 5/* "DO" */,5 , 7/* "USE" */,6 , 8/* "RETURN" */,7 , 36/* "Identifier" */,8 , 33/* "." */,9 , 13/* "{" */,11 , 15/* ";" */,12 , 24/* "-" */,16 , 38/* "Integer" */,18 , 39/* "Float" */,19 , 28/* "(" */,20 , 37/* "String" */,21 , 6/* "FUNCTION" */,22 , 11/* "X" */,23 , 12/* "Y" */,24 , 34/* "<<" */,25 , 9/* "TRUE" */,26 , 10/* "FALSE" */,27 ),
	/* State 29 */ new Array( 33/* "." */,59 , 28/* "(" */,35 , 2/* "IF" */,-43 , 4/* "WHILE" */,-43 , 5/* "DO" */,-43 , 7/* "USE" */,-43 , 8/* "RETURN" */,-43 , 36/* "Identifier" */,-43 , 13/* "{" */,-43 , 15/* ";" */,-43 , 24/* "-" */,-43 , 38/* "Integer" */,-43 , 39/* "Float" */,-43 , 37/* "String" */,-43 , 6/* "FUNCTION" */,-43 , 11/* "X" */,-43 , 12/* "Y" */,-43 , 34/* "<<" */,-43 , 9/* "TRUE" */,-43 , 10/* "FALSE" */,-43 , 17/* "==" */,-43 , 22/* "<" */,-43 , 21/* ">" */,-43 , 19/* "<=" */,-43 , 20/* ">=" */,-43 , 18/* "!=" */,-43 , 23/* "+" */,-43 , 26/* "*" */,-43 , 25/* "/" */,-43 , 29/* ")" */,-43 , 27/* "," */,-43 , 35/* ">>" */,-43 ),
	/* State 30 */ new Array( 18/* "!=" */,38 , 20/* ">=" */,39 , 19/* "<=" */,40 , 21/* ">" */,41 , 22/* "<" */,42 , 17/* "==" */,43 , 2/* "IF" */,3 , 4/* "WHILE" */,4 , 5/* "DO" */,5 , 7/* "USE" */,6 , 8/* "RETURN" */,7 , 36/* "Identifier" */,8 , 33/* "." */,9 , 13/* "{" */,11 , 15/* ";" */,12 , 24/* "-" */,16 , 38/* "Integer" */,18 , 39/* "Float" */,19 , 28/* "(" */,20 , 37/* "String" */,21 , 6/* "FUNCTION" */,22 , 11/* "X" */,23 , 12/* "Y" */,24 , 34/* "<<" */,25 , 9/* "TRUE" */,26 , 10/* "FALSE" */,27 ),
	/* State 31 */ new Array( 4/* "WHILE" */,61 ),
	/* State 32 */ new Array( 15/* ";" */,62 ),
	/* State 33 */ new Array( 52/* "$" */,-19 , 2/* "IF" */,-19 , 4/* "WHILE" */,-19 , 5/* "DO" */,-19 , 7/* "USE" */,-19 , 8/* "RETURN" */,-19 , 36/* "Identifier" */,-19 , 33/* "." */,-19 , 13/* "{" */,-19 , 15/* ";" */,-19 , 24/* "-" */,-19 , 38/* "Integer" */,-19 , 39/* "Float" */,-19 , 28/* "(" */,-19 , 37/* "String" */,-19 , 6/* "FUNCTION" */,-19 , 11/* "X" */,-19 , 12/* "Y" */,-19 , 34/* "<<" */,-19 , 9/* "TRUE" */,-19 , 10/* "FALSE" */,-19 , 3/* "ELSE" */,-19 , 14/* "}" */,-19 ),
	/* State 34 */ new Array( 36/* "Identifier" */,63 ),
	/* State 35 */ new Array( 24/* "-" */,16 , 38/* "Integer" */,18 , 39/* "Float" */,19 , 36/* "Identifier" */,29 , 28/* "(" */,20 , 37/* "String" */,21 , 6/* "FUNCTION" */,22 , 11/* "X" */,23 , 12/* "Y" */,24 , 34/* "<<" */,25 , 9/* "TRUE" */,26 , 10/* "FALSE" */,27 ),
	/* State 36 */ new Array( 24/* "-" */,16 , 38/* "Integer" */,18 , 39/* "Float" */,19 , 36/* "Identifier" */,29 , 28/* "(" */,20 , 37/* "String" */,21 , 6/* "FUNCTION" */,22 , 11/* "X" */,23 , 12/* "Y" */,24 , 34/* "<<" */,25 , 9/* "TRUE" */,26 , 10/* "FALSE" */,27 ),
	/* State 37 */ new Array( 16/* "=" */,67 ),
	/* State 38 */ new Array( 24/* "-" */,16 , 38/* "Integer" */,18 , 39/* "Float" */,19 , 36/* "Identifier" */,29 , 28/* "(" */,20 , 37/* "String" */,21 , 6/* "FUNCTION" */,22 , 11/* "X" */,23 , 12/* "Y" */,24 , 34/* "<<" */,25 , 9/* "TRUE" */,26 , 10/* "FALSE" */,27 ),
	/* State 39 */ new Array( 24/* "-" */,16 , 38/* "Integer" */,18 , 39/* "Float" */,19 , 36/* "Identifier" */,29 , 28/* "(" */,20 , 37/* "String" */,21 , 6/* "FUNCTION" */,22 , 11/* "X" */,23 , 12/* "Y" */,24 , 34/* "<<" */,25 , 9/* "TRUE" */,26 , 10/* "FALSE" */,27 ),
	/* State 40 */ new Array( 24/* "-" */,16 , 38/* "Integer" */,18 , 39/* "Float" */,19 , 36/* "Identifier" */,29 , 28/* "(" */,20 , 37/* "String" */,21 , 6/* "FUNCTION" */,22 , 11/* "X" */,23 , 12/* "Y" */,24 , 34/* "<<" */,25 , 9/* "TRUE" */,26 , 10/* "FALSE" */,27 ),
	/* State 41 */ new Array( 24/* "-" */,16 , 38/* "Integer" */,18 , 39/* "Float" */,19 , 36/* "Identifier" */,29 , 28/* "(" */,20 , 37/* "String" */,21 , 6/* "FUNCTION" */,22 , 11/* "X" */,23 , 12/* "Y" */,24 , 34/* "<<" */,25 , 9/* "TRUE" */,26 , 10/* "FALSE" */,27 ),
	/* State 42 */ new Array( 24/* "-" */,16 , 38/* "Integer" */,18 , 39/* "Float" */,19 , 36/* "Identifier" */,29 , 28/* "(" */,20 , 37/* "String" */,21 , 6/* "FUNCTION" */,22 , 11/* "X" */,23 , 12/* "Y" */,24 , 34/* "<<" */,25 , 9/* "TRUE" */,26 , 10/* "FALSE" */,27 ),
	/* State 43 */ new Array( 24/* "-" */,16 , 38/* "Integer" */,18 , 39/* "Float" */,19 , 36/* "Identifier" */,29 , 28/* "(" */,20 , 37/* "String" */,21 , 6/* "FUNCTION" */,22 , 11/* "X" */,23 , 12/* "Y" */,24 , 34/* "<<" */,25 , 9/* "TRUE" */,26 , 10/* "FALSE" */,27 ),
	/* State 44 */ new Array( 52/* "$" */,-23 , 2/* "IF" */,-23 , 4/* "WHILE" */,-23 , 5/* "DO" */,-23 , 7/* "USE" */,-23 , 8/* "RETURN" */,-23 , 36/* "Identifier" */,-23 , 33/* "." */,-23 , 13/* "{" */,-23 , 15/* ";" */,-23 , 24/* "-" */,-23 , 38/* "Integer" */,-23 , 39/* "Float" */,-23 , 28/* "(" */,-23 , 37/* "String" */,-23 , 6/* "FUNCTION" */,-23 , 11/* "X" */,-23 , 12/* "Y" */,-23 , 34/* "<<" */,-23 , 9/* "TRUE" */,-23 , 10/* "FALSE" */,-23 , 3/* "ELSE" */,-23 , 14/* "}" */,-23 ),
	/* State 45 */ new Array( 14/* "}" */,75 , 2/* "IF" */,3 , 4/* "WHILE" */,4 , 5/* "DO" */,5 , 7/* "USE" */,6 , 8/* "RETURN" */,7 , 36/* "Identifier" */,8 , 33/* "." */,9 , 13/* "{" */,11 , 15/* ";" */,12 , 24/* "-" */,16 , 38/* "Integer" */,18 , 39/* "Float" */,19 , 28/* "(" */,20 , 37/* "String" */,21 , 6/* "FUNCTION" */,22 , 11/* "X" */,23 , 12/* "Y" */,24 , 34/* "<<" */,25 , 9/* "TRUE" */,26 , 10/* "FALSE" */,27 ),
	/* State 46 */ new Array( 24/* "-" */,16 , 38/* "Integer" */,18 , 39/* "Float" */,19 , 36/* "Identifier" */,29 , 28/* "(" */,20 , 37/* "String" */,21 , 6/* "FUNCTION" */,22 , 11/* "X" */,23 , 12/* "Y" */,24 , 34/* "<<" */,25 , 9/* "TRUE" */,26 , 10/* "FALSE" */,27 ),
	/* State 47 */ new Array( 24/* "-" */,16 , 38/* "Integer" */,18 , 39/* "Float" */,19 , 36/* "Identifier" */,29 , 28/* "(" */,20 , 37/* "String" */,21 , 6/* "FUNCTION" */,22 , 11/* "X" */,23 , 12/* "Y" */,24 , 34/* "<<" */,25 , 9/* "TRUE" */,26 , 10/* "FALSE" */,27 ),
	/* State 48 */ new Array( 24/* "-" */,16 , 38/* "Integer" */,18 , 39/* "Float" */,19 , 36/* "Identifier" */,29 , 28/* "(" */,20 , 37/* "String" */,21 , 6/* "FUNCTION" */,22 , 11/* "X" */,23 , 12/* "Y" */,24 , 34/* "<<" */,25 , 9/* "TRUE" */,26 , 10/* "FALSE" */,27 ),
	/* State 49 */ new Array( 24/* "-" */,16 , 38/* "Integer" */,18 , 39/* "Float" */,19 , 36/* "Identifier" */,29 , 28/* "(" */,20 , 37/* "String" */,21 , 6/* "FUNCTION" */,22 , 11/* "X" */,23 , 12/* "Y" */,24 , 34/* "<<" */,25 , 9/* "TRUE" */,26 , 10/* "FALSE" */,27 ),
	/* State 50 */ new Array( 15/* ";" */,-39 , 17/* "==" */,-39 , 22/* "<" */,-39 , 21/* ">" */,-39 , 19/* "<=" */,-39 , 20/* ">=" */,-39 , 18/* "!=" */,-39 , 24/* "-" */,-39 , 23/* "+" */,-39 , 26/* "*" */,-39 , 25/* "/" */,-39 , 2/* "IF" */,-39 , 4/* "WHILE" */,-39 , 5/* "DO" */,-39 , 7/* "USE" */,-39 , 8/* "RETURN" */,-39 , 36/* "Identifier" */,-39 , 33/* "." */,-39 , 13/* "{" */,-39 , 38/* "Integer" */,-39 , 39/* "Float" */,-39 , 28/* "(" */,-39 , 37/* "String" */,-39 , 6/* "FUNCTION" */,-39 , 11/* "X" */,-39 , 12/* "Y" */,-39 , 34/* "<<" */,-39 , 9/* "TRUE" */,-39 , 10/* "FALSE" */,-39 , 29/* ")" */,-39 , 27/* "," */,-39 , 35/* ">>" */,-39 ),
	/* State 51 */ new Array( 18/* "!=" */,38 , 20/* ">=" */,39 , 19/* "<=" */,40 , 21/* ">" */,41 , 22/* "<" */,42 , 17/* "==" */,43 , 29/* ")" */,80 ),
	/* State 52 */ new Array( 36/* "Identifier" */,82 , 29/* ")" */,-13 , 27/* "," */,-13 ),
	/* State 53 */ new Array( 36/* "Identifier" */,83 ),
	/* State 54 */ new Array( 36/* "Identifier" */,84 ),
	/* State 55 */ new Array( 27/* "," */,85 , 35/* ">>" */,86 ),
	/* State 56 */ new Array( 35/* ">>" */,-8 , 27/* "," */,-8 ),
	/* State 57 */ new Array( 31/* ":" */,87 ),
	/* State 58 */ new Array( 3/* "ELSE" */,88 , 52/* "$" */,-14 , 2/* "IF" */,-14 , 4/* "WHILE" */,-14 , 5/* "DO" */,-14 , 7/* "USE" */,-14 , 8/* "RETURN" */,-14 , 36/* "Identifier" */,-14 , 33/* "." */,-14 , 13/* "{" */,-14 , 15/* ";" */,-14 , 24/* "-" */,-14 , 38/* "Integer" */,-14 , 39/* "Float" */,-14 , 28/* "(" */,-14 , 37/* "String" */,-14 , 6/* "FUNCTION" */,-14 , 11/* "X" */,-14 , 12/* "Y" */,-14 , 34/* "<<" */,-14 , 9/* "TRUE" */,-14 , 10/* "FALSE" */,-14 , 14/* "}" */,-14 ),
	/* State 59 */ new Array( 36/* "Identifier" */,89 ),
	/* State 60 */ new Array( 52/* "$" */,-16 , 2/* "IF" */,-16 , 4/* "WHILE" */,-16 , 5/* "DO" */,-16 , 7/* "USE" */,-16 , 8/* "RETURN" */,-16 , 36/* "Identifier" */,-16 , 33/* "." */,-16 , 13/* "{" */,-16 , 15/* ";" */,-16 , 24/* "-" */,-16 , 38/* "Integer" */,-16 , 39/* "Float" */,-16 , 28/* "(" */,-16 , 37/* "String" */,-16 , 6/* "FUNCTION" */,-16 , 11/* "X" */,-16 , 12/* "Y" */,-16 , 34/* "<<" */,-16 , 9/* "TRUE" */,-16 , 10/* "FALSE" */,-16 , 3/* "ELSE" */,-16 , 14/* "}" */,-16 ),
	/* State 61 */ new Array( 24/* "-" */,16 , 38/* "Integer" */,18 , 39/* "Float" */,19 , 36/* "Identifier" */,29 , 28/* "(" */,20 , 37/* "String" */,21 , 6/* "FUNCTION" */,22 , 11/* "X" */,23 , 12/* "Y" */,24 , 34/* "<<" */,25 , 9/* "TRUE" */,26 , 10/* "FALSE" */,27 ),
	/* State 62 */ new Array( 52/* "$" */,-18 , 2/* "IF" */,-18 , 4/* "WHILE" */,-18 , 5/* "DO" */,-18 , 7/* "USE" */,-18 , 8/* "RETURN" */,-18 , 36/* "Identifier" */,-18 , 33/* "." */,-18 , 13/* "{" */,-18 , 15/* ";" */,-18 , 24/* "-" */,-18 , 38/* "Integer" */,-18 , 39/* "Float" */,-18 , 28/* "(" */,-18 , 37/* "String" */,-18 , 6/* "FUNCTION" */,-18 , 11/* "X" */,-18 , 12/* "Y" */,-18 , 34/* "<<" */,-18 , 9/* "TRUE" */,-18 , 10/* "FALSE" */,-18 , 3/* "ELSE" */,-18 , 14/* "}" */,-18 ),
	/* State 63 */ new Array( 16/* "=" */,91 , 15/* ";" */,-51 , 17/* "==" */,-51 , 22/* "<" */,-51 , 21/* ">" */,-51 , 19/* "<=" */,-51 , 20/* ">=" */,-51 , 18/* "!=" */,-51 , 24/* "-" */,-51 , 23/* "+" */,-51 , 26/* "*" */,-51 , 25/* "/" */,-51 ),
	/* State 64 */ new Array( 27/* "," */,92 , 29/* ")" */,93 ),
	/* State 65 */ new Array( 18/* "!=" */,38 , 20/* ">=" */,39 , 19/* "<=" */,40 , 21/* ">" */,41 , 22/* "<" */,42 , 17/* "==" */,43 , 29/* ")" */,-6 , 27/* "," */,-6 ),
	/* State 66 */ new Array( 18/* "!=" */,38 , 20/* ">=" */,39 , 19/* "<=" */,40 , 21/* ">" */,41 , 22/* "<" */,42 , 17/* "==" */,43 , 15/* ";" */,94 ),
	/* State 67 */ new Array( 24/* "-" */,16 , 38/* "Integer" */,18 , 39/* "Float" */,19 , 36/* "Identifier" */,29 , 28/* "(" */,20 , 37/* "String" */,21 , 6/* "FUNCTION" */,22 , 11/* "X" */,23 , 12/* "Y" */,24 , 34/* "<<" */,25 , 9/* "TRUE" */,26 , 10/* "FALSE" */,27 ),
	/* State 68 */ new Array( 23/* "+" */,46 , 24/* "-" */,47 , 15/* ";" */,-31 , 17/* "==" */,-31 , 22/* "<" */,-31 , 21/* ">" */,-31 , 19/* "<=" */,-31 , 20/* ">=" */,-31 , 18/* "!=" */,-31 , 2/* "IF" */,-31 , 4/* "WHILE" */,-31 , 5/* "DO" */,-31 , 7/* "USE" */,-31 , 8/* "RETURN" */,-31 , 36/* "Identifier" */,-31 , 33/* "." */,-31 , 13/* "{" */,-31 , 38/* "Integer" */,-31 , 39/* "Float" */,-31 , 28/* "(" */,-31 , 37/* "String" */,-31 , 6/* "FUNCTION" */,-31 , 11/* "X" */,-31 , 12/* "Y" */,-31 , 34/* "<<" */,-31 , 9/* "TRUE" */,-31 , 10/* "FALSE" */,-31 , 29/* ")" */,-31 , 27/* "," */,-31 , 35/* ">>" */,-31 ),
	/* State 69 */ new Array( 23/* "+" */,46 , 24/* "-" */,47 , 15/* ";" */,-30 , 17/* "==" */,-30 , 22/* "<" */,-30 , 21/* ">" */,-30 , 19/* "<=" */,-30 , 20/* ">=" */,-30 , 18/* "!=" */,-30 , 2/* "IF" */,-30 , 4/* "WHILE" */,-30 , 5/* "DO" */,-30 , 7/* "USE" */,-30 , 8/* "RETURN" */,-30 , 36/* "Identifier" */,-30 , 33/* "." */,-30 , 13/* "{" */,-30 , 38/* "Integer" */,-30 , 39/* "Float" */,-30 , 28/* "(" */,-30 , 37/* "String" */,-30 , 6/* "FUNCTION" */,-30 , 11/* "X" */,-30 , 12/* "Y" */,-30 , 34/* "<<" */,-30 , 9/* "TRUE" */,-30 , 10/* "FALSE" */,-30 , 29/* ")" */,-30 , 27/* "," */,-30 , 35/* ">>" */,-30 ),
	/* State 70 */ new Array( 23/* "+" */,46 , 24/* "-" */,47 , 15/* ";" */,-29 , 17/* "==" */,-29 , 22/* "<" */,-29 , 21/* ">" */,-29 , 19/* "<=" */,-29 , 20/* ">=" */,-29 , 18/* "!=" */,-29 , 2/* "IF" */,-29 , 4/* "WHILE" */,-29 , 5/* "DO" */,-29 , 7/* "USE" */,-29 , 8/* "RETURN" */,-29 , 36/* "Identifier" */,-29 , 33/* "." */,-29 , 13/* "{" */,-29 , 38/* "Integer" */,-29 , 39/* "Float" */,-29 , 28/* "(" */,-29 , 37/* "String" */,-29 , 6/* "FUNCTION" */,-29 , 11/* "X" */,-29 , 12/* "Y" */,-29 , 34/* "<<" */,-29 , 9/* "TRUE" */,-29 , 10/* "FALSE" */,-29 , 29/* ")" */,-29 , 27/* "," */,-29 , 35/* ">>" */,-29 ),
	/* State 71 */ new Array( 23/* "+" */,46 , 24/* "-" */,47 , 15/* ";" */,-28 , 17/* "==" */,-28 , 22/* "<" */,-28 , 21/* ">" */,-28 , 19/* "<=" */,-28 , 20/* ">=" */,-28 , 18/* "!=" */,-28 , 2/* "IF" */,-28 , 4/* "WHILE" */,-28 , 5/* "DO" */,-28 , 7/* "USE" */,-28 , 8/* "RETURN" */,-28 , 36/* "Identifier" */,-28 , 33/* "." */,-28 , 13/* "{" */,-28 , 38/* "Integer" */,-28 , 39/* "Float" */,-28 , 28/* "(" */,-28 , 37/* "String" */,-28 , 6/* "FUNCTION" */,-28 , 11/* "X" */,-28 , 12/* "Y" */,-28 , 34/* "<<" */,-28 , 9/* "TRUE" */,-28 , 10/* "FALSE" */,-28 , 29/* ")" */,-28 , 27/* "," */,-28 , 35/* ">>" */,-28 ),
	/* State 72 */ new Array( 23/* "+" */,46 , 24/* "-" */,47 , 15/* ";" */,-27 , 17/* "==" */,-27 , 22/* "<" */,-27 , 21/* ">" */,-27 , 19/* "<=" */,-27 , 20/* ">=" */,-27 , 18/* "!=" */,-27 , 2/* "IF" */,-27 , 4/* "WHILE" */,-27 , 5/* "DO" */,-27 , 7/* "USE" */,-27 , 8/* "RETURN" */,-27 , 36/* "Identifier" */,-27 , 33/* "." */,-27 , 13/* "{" */,-27 , 38/* "Integer" */,-27 , 39/* "Float" */,-27 , 28/* "(" */,-27 , 37/* "String" */,-27 , 6/* "FUNCTION" */,-27 , 11/* "X" */,-27 , 12/* "Y" */,-27 , 34/* "<<" */,-27 , 9/* "TRUE" */,-27 , 10/* "FALSE" */,-27 , 29/* ")" */,-27 , 27/* "," */,-27 , 35/* ">>" */,-27 ),
	/* State 73 */ new Array( 23/* "+" */,46 , 24/* "-" */,47 , 15/* ";" */,-26 , 17/* "==" */,-26 , 22/* "<" */,-26 , 21/* ">" */,-26 , 19/* "<=" */,-26 , 20/* ">=" */,-26 , 18/* "!=" */,-26 , 2/* "IF" */,-26 , 4/* "WHILE" */,-26 , 5/* "DO" */,-26 , 7/* "USE" */,-26 , 8/* "RETURN" */,-26 , 36/* "Identifier" */,-26 , 33/* "." */,-26 , 13/* "{" */,-26 , 38/* "Integer" */,-26 , 39/* "Float" */,-26 , 28/* "(" */,-26 , 37/* "String" */,-26 , 6/* "FUNCTION" */,-26 , 11/* "X" */,-26 , 12/* "Y" */,-26 , 34/* "<<" */,-26 , 9/* "TRUE" */,-26 , 10/* "FALSE" */,-26 , 29/* ")" */,-26 , 27/* "," */,-26 , 35/* ">>" */,-26 ),
	/* State 74 */ new Array( 14/* "}" */,-3 , 2/* "IF" */,-3 , 4/* "WHILE" */,-3 , 5/* "DO" */,-3 , 7/* "USE" */,-3 , 8/* "RETURN" */,-3 , 36/* "Identifier" */,-3 , 33/* "." */,-3 , 13/* "{" */,-3 , 15/* ";" */,-3 , 24/* "-" */,-3 , 38/* "Integer" */,-3 , 39/* "Float" */,-3 , 28/* "(" */,-3 , 37/* "String" */,-3 , 6/* "FUNCTION" */,-3 , 11/* "X" */,-3 , 12/* "Y" */,-3 , 34/* "<<" */,-3 , 9/* "TRUE" */,-3 , 10/* "FALSE" */,-3 ),
	/* State 75 */ new Array( 52/* "$" */,-24 , 2/* "IF" */,-24 , 4/* "WHILE" */,-24 , 5/* "DO" */,-24 , 7/* "USE" */,-24 , 8/* "RETURN" */,-24 , 36/* "Identifier" */,-24 , 33/* "." */,-24 , 13/* "{" */,-24 , 15/* ";" */,-24 , 24/* "-" */,-24 , 38/* "Integer" */,-24 , 39/* "Float" */,-24 , 28/* "(" */,-24 , 37/* "String" */,-24 , 6/* "FUNCTION" */,-24 , 11/* "X" */,-24 , 12/* "Y" */,-24 , 34/* "<<" */,-24 , 9/* "TRUE" */,-24 , 10/* "FALSE" */,-24 , 3/* "ELSE" */,-24 , 14/* "}" */,-24 ),
	/* State 76 */ new Array( 25/* "/" */,48 , 26/* "*" */,49 , 15/* ";" */,-34 , 17/* "==" */,-34 , 22/* "<" */,-34 , 21/* ">" */,-34 , 19/* "<=" */,-34 , 20/* ">=" */,-34 , 18/* "!=" */,-34 , 24/* "-" */,-34 , 23/* "+" */,-34 , 2/* "IF" */,-34 , 4/* "WHILE" */,-34 , 5/* "DO" */,-34 , 7/* "USE" */,-34 , 8/* "RETURN" */,-34 , 36/* "Identifier" */,-34 , 33/* "." */,-34 , 13/* "{" */,-34 , 38/* "Integer" */,-34 , 39/* "Float" */,-34 , 28/* "(" */,-34 , 37/* "String" */,-34 , 6/* "FUNCTION" */,-34 , 11/* "X" */,-34 , 12/* "Y" */,-34 , 34/* "<<" */,-34 , 9/* "TRUE" */,-34 , 10/* "FALSE" */,-34 , 29/* ")" */,-34 , 27/* "," */,-34 , 35/* ">>" */,-34 ),
	/* State 77 */ new Array( 25/* "/" */,48 , 26/* "*" */,49 , 15/* ";" */,-33 , 17/* "==" */,-33 , 22/* "<" */,-33 , 21/* ">" */,-33 , 19/* "<=" */,-33 , 20/* ">=" */,-33 , 18/* "!=" */,-33 , 24/* "-" */,-33 , 23/* "+" */,-33 , 2/* "IF" */,-33 , 4/* "WHILE" */,-33 , 5/* "DO" */,-33 , 7/* "USE" */,-33 , 8/* "RETURN" */,-33 , 36/* "Identifier" */,-33 , 33/* "." */,-33 , 13/* "{" */,-33 , 38/* "Integer" */,-33 , 39/* "Float" */,-33 , 28/* "(" */,-33 , 37/* "String" */,-33 , 6/* "FUNCTION" */,-33 , 11/* "X" */,-33 , 12/* "Y" */,-33 , 34/* "<<" */,-33 , 9/* "TRUE" */,-33 , 10/* "FALSE" */,-33 , 29/* ")" */,-33 , 27/* "," */,-33 , 35/* ">>" */,-33 ),
	/* State 78 */ new Array( 15/* ";" */,-37 , 17/* "==" */,-37 , 22/* "<" */,-37 , 21/* ">" */,-37 , 19/* "<=" */,-37 , 20/* ">=" */,-37 , 18/* "!=" */,-37 , 24/* "-" */,-37 , 23/* "+" */,-37 , 26/* "*" */,-37 , 25/* "/" */,-37 , 2/* "IF" */,-37 , 4/* "WHILE" */,-37 , 5/* "DO" */,-37 , 7/* "USE" */,-37 , 8/* "RETURN" */,-37 , 36/* "Identifier" */,-37 , 33/* "." */,-37 , 13/* "{" */,-37 , 38/* "Integer" */,-37 , 39/* "Float" */,-37 , 28/* "(" */,-37 , 37/* "String" */,-37 , 6/* "FUNCTION" */,-37 , 11/* "X" */,-37 , 12/* "Y" */,-37 , 34/* "<<" */,-37 , 9/* "TRUE" */,-37 , 10/* "FALSE" */,-37 , 29/* ")" */,-37 , 27/* "," */,-37 , 35/* ">>" */,-37 ),
	/* State 79 */ new Array( 15/* ";" */,-36 , 17/* "==" */,-36 , 22/* "<" */,-36 , 21/* ">" */,-36 , 19/* "<=" */,-36 , 20/* ">=" */,-36 , 18/* "!=" */,-36 , 24/* "-" */,-36 , 23/* "+" */,-36 , 26/* "*" */,-36 , 25/* "/" */,-36 , 2/* "IF" */,-36 , 4/* "WHILE" */,-36 , 5/* "DO" */,-36 , 7/* "USE" */,-36 , 8/* "RETURN" */,-36 , 36/* "Identifier" */,-36 , 33/* "." */,-36 , 13/* "{" */,-36 , 38/* "Integer" */,-36 , 39/* "Float" */,-36 , 28/* "(" */,-36 , 37/* "String" */,-36 , 6/* "FUNCTION" */,-36 , 11/* "X" */,-36 , 12/* "Y" */,-36 , 34/* "<<" */,-36 , 9/* "TRUE" */,-36 , 10/* "FALSE" */,-36 , 29/* ")" */,-36 , 27/* "," */,-36 , 35/* ">>" */,-36 ),
	/* State 80 */ new Array( 15/* ";" */,-44 , 17/* "==" */,-44 , 22/* "<" */,-44 , 21/* ">" */,-44 , 19/* "<=" */,-44 , 20/* ">=" */,-44 , 18/* "!=" */,-44 , 24/* "-" */,-44 , 23/* "+" */,-44 , 26/* "*" */,-44 , 25/* "/" */,-44 , 2/* "IF" */,-44 , 4/* "WHILE" */,-44 , 5/* "DO" */,-44 , 7/* "USE" */,-44 , 8/* "RETURN" */,-44 , 36/* "Identifier" */,-44 , 33/* "." */,-44 , 13/* "{" */,-44 , 38/* "Integer" */,-44 , 39/* "Float" */,-44 , 28/* "(" */,-44 , 37/* "String" */,-44 , 6/* "FUNCTION" */,-44 , 11/* "X" */,-44 , 12/* "Y" */,-44 , 34/* "<<" */,-44 , 9/* "TRUE" */,-44 , 10/* "FALSE" */,-44 , 29/* ")" */,-44 , 27/* "," */,-44 , 35/* ">>" */,-44 ),
	/* State 81 */ new Array( 27/* "," */,96 , 29/* ")" */,97 ),
	/* State 82 */ new Array( 29/* ")" */,-12 , 27/* "," */,-12 ),
	/* State 83 */ new Array( 29/* ")" */,98 ),
	/* State 84 */ new Array( 29/* ")" */,99 ),
	/* State 85 */ new Array( 36/* "Identifier" */,57 ),
	/* State 86 */ new Array( 15/* ";" */,-52 , 17/* "==" */,-52 , 22/* "<" */,-52 , 21/* ">" */,-52 , 19/* "<=" */,-52 , 20/* ">=" */,-52 , 18/* "!=" */,-52 , 24/* "-" */,-52 , 23/* "+" */,-52 , 26/* "*" */,-52 , 25/* "/" */,-52 , 2/* "IF" */,-52 , 4/* "WHILE" */,-52 , 5/* "DO" */,-52 , 7/* "USE" */,-52 , 8/* "RETURN" */,-52 , 36/* "Identifier" */,-52 , 33/* "." */,-52 , 13/* "{" */,-52 , 38/* "Integer" */,-52 , 39/* "Float" */,-52 , 28/* "(" */,-52 , 37/* "String" */,-52 , 6/* "FUNCTION" */,-52 , 11/* "X" */,-52 , 12/* "Y" */,-52 , 34/* "<<" */,-52 , 9/* "TRUE" */,-52 , 10/* "FALSE" */,-52 , 29/* ")" */,-52 , 27/* "," */,-52 , 35/* ">>" */,-52 ),
	/* State 87 */ new Array( 24/* "-" */,16 , 38/* "Integer" */,18 , 39/* "Float" */,19 , 36/* "Identifier" */,29 , 28/* "(" */,20 , 37/* "String" */,21 , 6/* "FUNCTION" */,22 , 11/* "X" */,23 , 12/* "Y" */,24 , 34/* "<<" */,25 , 9/* "TRUE" */,26 , 10/* "FALSE" */,27 ),
	/* State 88 */ new Array( 2/* "IF" */,3 , 4/* "WHILE" */,4 , 5/* "DO" */,5 , 7/* "USE" */,6 , 8/* "RETURN" */,7 , 36/* "Identifier" */,8 , 33/* "." */,9 , 13/* "{" */,11 , 15/* ";" */,12 , 24/* "-" */,16 , 38/* "Integer" */,18 , 39/* "Float" */,19 , 28/* "(" */,20 , 37/* "String" */,21 , 6/* "FUNCTION" */,22 , 11/* "X" */,23 , 12/* "Y" */,24 , 34/* "<<" */,25 , 9/* "TRUE" */,26 , 10/* "FALSE" */,27 ),
	/* State 89 */ new Array( 2/* "IF" */,-51 , 4/* "WHILE" */,-51 , 5/* "DO" */,-51 , 7/* "USE" */,-51 , 8/* "RETURN" */,-51 , 36/* "Identifier" */,-51 , 33/* "." */,-51 , 13/* "{" */,-51 , 15/* ";" */,-51 , 24/* "-" */,-51 , 38/* "Integer" */,-51 , 39/* "Float" */,-51 , 28/* "(" */,-51 , 37/* "String" */,-51 , 6/* "FUNCTION" */,-51 , 11/* "X" */,-51 , 12/* "Y" */,-51 , 34/* "<<" */,-51 , 9/* "TRUE" */,-51 , 10/* "FALSE" */,-51 , 17/* "==" */,-51 , 22/* "<" */,-51 , 21/* ">" */,-51 , 19/* "<=" */,-51 , 20/* ">=" */,-51 , 18/* "!=" */,-51 , 23/* "+" */,-51 , 26/* "*" */,-51 , 25/* "/" */,-51 , 29/* ")" */,-51 , 27/* "," */,-51 , 35/* ">>" */,-51 ),
	/* State 90 */ new Array( 18/* "!=" */,38 , 20/* ">=" */,39 , 19/* "<=" */,40 , 21/* ">" */,41 , 22/* "<" */,42 , 17/* "==" */,43 , 15/* ";" */,103 ),
	/* State 91 */ new Array( 24/* "-" */,16 , 38/* "Integer" */,18 , 39/* "Float" */,19 , 36/* "Identifier" */,29 , 28/* "(" */,20 , 37/* "String" */,21 , 6/* "FUNCTION" */,22 , 11/* "X" */,23 , 12/* "Y" */,24 , 34/* "<<" */,25 , 9/* "TRUE" */,26 , 10/* "FALSE" */,27 ),
	/* State 92 */ new Array( 24/* "-" */,16 , 38/* "Integer" */,18 , 39/* "Float" */,19 , 36/* "Identifier" */,29 , 28/* "(" */,20 , 37/* "String" */,21 , 6/* "FUNCTION" */,22 , 11/* "X" */,23 , 12/* "Y" */,24 , 34/* "<<" */,25 , 9/* "TRUE" */,26 , 10/* "FALSE" */,27 ),
	/* State 93 */ new Array( 34/* "<<" */,106 , 15/* ";" */,-46 , 17/* "==" */,-46 , 22/* "<" */,-46 , 21/* ">" */,-46 , 19/* "<=" */,-46 , 20/* ">=" */,-46 , 18/* "!=" */,-46 , 24/* "-" */,-46 , 23/* "+" */,-46 , 26/* "*" */,-46 , 25/* "/" */,-46 , 2/* "IF" */,-46 , 4/* "WHILE" */,-46 , 5/* "DO" */,-46 , 7/* "USE" */,-46 , 8/* "RETURN" */,-46 , 36/* "Identifier" */,-46 , 33/* "." */,-46 , 13/* "{" */,-46 , 38/* "Integer" */,-46 , 39/* "Float" */,-46 , 28/* "(" */,-46 , 37/* "String" */,-46 , 6/* "FUNCTION" */,-46 , 11/* "X" */,-46 , 12/* "Y" */,-46 , 9/* "TRUE" */,-46 , 10/* "FALSE" */,-46 , 29/* ")" */,-46 , 27/* "," */,-46 , 35/* ">>" */,-46 ),
	/* State 94 */ new Array( 52/* "$" */,-20 , 2/* "IF" */,-20 , 4/* "WHILE" */,-20 , 5/* "DO" */,-20 , 7/* "USE" */,-20 , 8/* "RETURN" */,-20 , 36/* "Identifier" */,-20 , 33/* "." */,-20 , 13/* "{" */,-20 , 15/* ";" */,-20 , 24/* "-" */,-20 , 38/* "Integer" */,-20 , 39/* "Float" */,-20 , 28/* "(" */,-20 , 37/* "String" */,-20 , 6/* "FUNCTION" */,-20 , 11/* "X" */,-20 , 12/* "Y" */,-20 , 34/* "<<" */,-20 , 9/* "TRUE" */,-20 , 10/* "FALSE" */,-20 , 3/* "ELSE" */,-20 , 14/* "}" */,-20 ),
	/* State 95 */ new Array( 18/* "!=" */,38 , 20/* ">=" */,39 , 19/* "<=" */,40 , 21/* ">" */,41 , 22/* "<" */,42 , 17/* "==" */,43 , 15/* ";" */,107 ),
	/* State 96 */ new Array( 36/* "Identifier" */,108 ),
	/* State 97 */ new Array( 13/* "{" */,109 ),
	/* State 98 */ new Array( 15/* ";" */,-49 , 17/* "==" */,-49 , 22/* "<" */,-49 , 21/* ">" */,-49 , 19/* "<=" */,-49 , 20/* ">=" */,-49 , 18/* "!=" */,-49 , 24/* "-" */,-49 , 23/* "+" */,-49 , 26/* "*" */,-49 , 25/* "/" */,-49 , 2/* "IF" */,-49 , 4/* "WHILE" */,-49 , 5/* "DO" */,-49 , 7/* "USE" */,-49 , 8/* "RETURN" */,-49 , 36/* "Identifier" */,-49 , 33/* "." */,-49 , 13/* "{" */,-49 , 38/* "Integer" */,-49 , 39/* "Float" */,-49 , 28/* "(" */,-49 , 37/* "String" */,-49 , 6/* "FUNCTION" */,-49 , 11/* "X" */,-49 , 12/* "Y" */,-49 , 34/* "<<" */,-49 , 9/* "TRUE" */,-49 , 10/* "FALSE" */,-49 , 29/* ")" */,-49 , 27/* "," */,-49 , 35/* ">>" */,-49 ),
	/* State 99 */ new Array( 15/* ";" */,-50 , 17/* "==" */,-50 , 22/* "<" */,-50 , 21/* ">" */,-50 , 19/* "<=" */,-50 , 20/* ">=" */,-50 , 18/* "!=" */,-50 , 24/* "-" */,-50 , 23/* "+" */,-50 , 26/* "*" */,-50 , 25/* "/" */,-50 , 2/* "IF" */,-50 , 4/* "WHILE" */,-50 , 5/* "DO" */,-50 , 7/* "USE" */,-50 , 8/* "RETURN" */,-50 , 36/* "Identifier" */,-50 , 33/* "." */,-50 , 13/* "{" */,-50 , 38/* "Integer" */,-50 , 39/* "Float" */,-50 , 28/* "(" */,-50 , 37/* "String" */,-50 , 6/* "FUNCTION" */,-50 , 11/* "X" */,-50 , 12/* "Y" */,-50 , 34/* "<<" */,-50 , 9/* "TRUE" */,-50 , 10/* "FALSE" */,-50 , 29/* ")" */,-50 , 27/* "," */,-50 , 35/* ">>" */,-50 ),
	/* State 100 */ new Array( 35/* ">>" */,-7 , 27/* "," */,-7 ),
	/* State 101 */ new Array( 18/* "!=" */,38 , 20/* ">=" */,39 , 19/* "<=" */,40 , 21/* ">" */,41 , 22/* "<" */,42 , 17/* "==" */,43 , 35/* ">>" */,-10 , 27/* "," */,-10 ),
	/* State 102 */ new Array( 52/* "$" */,-15 , 2/* "IF" */,-15 , 4/* "WHILE" */,-15 , 5/* "DO" */,-15 , 7/* "USE" */,-15 , 8/* "RETURN" */,-15 , 36/* "Identifier" */,-15 , 33/* "." */,-15 , 13/* "{" */,-15 , 15/* ";" */,-15 , 24/* "-" */,-15 , 38/* "Integer" */,-15 , 39/* "Float" */,-15 , 28/* "(" */,-15 , 37/* "String" */,-15 , 6/* "FUNCTION" */,-15 , 11/* "X" */,-15 , 12/* "Y" */,-15 , 34/* "<<" */,-15 , 9/* "TRUE" */,-15 , 10/* "FALSE" */,-15 , 3/* "ELSE" */,-15 , 14/* "}" */,-15 ),
	/* State 103 */ new Array( 52/* "$" */,-17 , 2/* "IF" */,-17 , 4/* "WHILE" */,-17 , 5/* "DO" */,-17 , 7/* "USE" */,-17 , 8/* "RETURN" */,-17 , 36/* "Identifier" */,-17 , 33/* "." */,-17 , 13/* "{" */,-17 , 15/* ";" */,-17 , 24/* "-" */,-17 , 38/* "Integer" */,-17 , 39/* "Float" */,-17 , 28/* "(" */,-17 , 37/* "String" */,-17 , 6/* "FUNCTION" */,-17 , 11/* "X" */,-17 , 12/* "Y" */,-17 , 34/* "<<" */,-17 , 9/* "TRUE" */,-17 , 10/* "FALSE" */,-17 , 3/* "ELSE" */,-17 , 14/* "}" */,-17 ),
	/* State 104 */ new Array( 18/* "!=" */,38 , 20/* ">=" */,39 , 19/* "<=" */,40 , 21/* ">" */,41 , 22/* "<" */,42 , 17/* "==" */,43 , 15/* ";" */,110 ),
	/* State 105 */ new Array( 18/* "!=" */,38 , 20/* ">=" */,39 , 19/* "<=" */,40 , 21/* ">" */,41 , 22/* "<" */,42 , 17/* "==" */,43 , 29/* ")" */,-5 , 27/* "," */,-5 ),
	/* State 106 */ new Array( 36/* "Identifier" */,57 , 35/* ">>" */,-9 , 27/* "," */,-9 ),
	/* State 107 */ new Array( 52/* "$" */,-22 , 2/* "IF" */,-22 , 4/* "WHILE" */,-22 , 5/* "DO" */,-22 , 7/* "USE" */,-22 , 8/* "RETURN" */,-22 , 36/* "Identifier" */,-22 , 33/* "." */,-22 , 13/* "{" */,-22 , 15/* ";" */,-22 , 24/* "-" */,-22 , 38/* "Integer" */,-22 , 39/* "Float" */,-22 , 28/* "(" */,-22 , 37/* "String" */,-22 , 6/* "FUNCTION" */,-22 , 11/* "X" */,-22 , 12/* "Y" */,-22 , 34/* "<<" */,-22 , 9/* "TRUE" */,-22 , 10/* "FALSE" */,-22 , 3/* "ELSE" */,-22 , 14/* "}" */,-22 ),
	/* State 108 */ new Array( 29/* ")" */,-11 , 27/* "," */,-11 ),
	/* State 109 */ new Array( 14/* "}" */,-4 , 2/* "IF" */,-4 , 4/* "WHILE" */,-4 , 5/* "DO" */,-4 , 7/* "USE" */,-4 , 8/* "RETURN" */,-4 , 36/* "Identifier" */,-4 , 33/* "." */,-4 , 13/* "{" */,-4 , 15/* ";" */,-4 , 24/* "-" */,-4 , 38/* "Integer" */,-4 , 39/* "Float" */,-4 , 28/* "(" */,-4 , 37/* "String" */,-4 , 6/* "FUNCTION" */,-4 , 11/* "X" */,-4 , 12/* "Y" */,-4 , 34/* "<<" */,-4 , 9/* "TRUE" */,-4 , 10/* "FALSE" */,-4 ),
	/* State 110 */ new Array( 52/* "$" */,-21 , 2/* "IF" */,-21 , 4/* "WHILE" */,-21 , 5/* "DO" */,-21 , 7/* "USE" */,-21 , 8/* "RETURN" */,-21 , 36/* "Identifier" */,-21 , 33/* "." */,-21 , 13/* "{" */,-21 , 15/* ";" */,-21 , 24/* "-" */,-21 , 38/* "Integer" */,-21 , 39/* "Float" */,-21 , 28/* "(" */,-21 , 37/* "String" */,-21 , 6/* "FUNCTION" */,-21 , 11/* "X" */,-21 , 12/* "Y" */,-21 , 34/* "<<" */,-21 , 9/* "TRUE" */,-21 , 10/* "FALSE" */,-21 , 3/* "ELSE" */,-21 , 14/* "}" */,-21 ),
	/* State 111 */ new Array( 27/* "," */,85 , 35/* ">>" */,113 ),
	/* State 112 */ new Array( 14/* "}" */,114 , 2/* "IF" */,3 , 4/* "WHILE" */,4 , 5/* "DO" */,5 , 7/* "USE" */,6 , 8/* "RETURN" */,7 , 36/* "Identifier" */,8 , 33/* "." */,9 , 13/* "{" */,11 , 15/* ";" */,12 , 24/* "-" */,16 , 38/* "Integer" */,18 , 39/* "Float" */,19 , 28/* "(" */,20 , 37/* "String" */,21 , 6/* "FUNCTION" */,22 , 11/* "X" */,23 , 12/* "Y" */,24 , 34/* "<<" */,25 , 9/* "TRUE" */,26 , 10/* "FALSE" */,27 ),
	/* State 113 */ new Array( 15/* ";" */,-47 , 17/* "==" */,-47 , 22/* "<" */,-47 , 21/* ">" */,-47 , 19/* "<=" */,-47 , 20/* ">=" */,-47 , 18/* "!=" */,-47 , 24/* "-" */,-47 , 23/* "+" */,-47 , 26/* "*" */,-47 , 25/* "/" */,-47 , 2/* "IF" */,-47 , 4/* "WHILE" */,-47 , 5/* "DO" */,-47 , 7/* "USE" */,-47 , 8/* "RETURN" */,-47 , 36/* "Identifier" */,-47 , 33/* "." */,-47 , 13/* "{" */,-47 , 38/* "Integer" */,-47 , 39/* "Float" */,-47 , 28/* "(" */,-47 , 37/* "String" */,-47 , 6/* "FUNCTION" */,-47 , 11/* "X" */,-47 , 12/* "Y" */,-47 , 34/* "<<" */,-47 , 9/* "TRUE" */,-47 , 10/* "FALSE" */,-47 , 29/* ")" */,-47 , 27/* "," */,-47 , 35/* ">>" */,-47 ),
	/* State 114 */ new Array( 15/* ";" */,-48 , 17/* "==" */,-48 , 22/* "<" */,-48 , 21/* ">" */,-48 , 19/* "<=" */,-48 , 20/* ">=" */,-48 , 18/* "!=" */,-48 , 24/* "-" */,-48 , 23/* "+" */,-48 , 26/* "*" */,-48 , 25/* "/" */,-48 , 2/* "IF" */,-48 , 4/* "WHILE" */,-48 , 5/* "DO" */,-48 , 7/* "USE" */,-48 , 8/* "RETURN" */,-48 , 36/* "Identifier" */,-48 , 33/* "." */,-48 , 13/* "{" */,-48 , 38/* "Integer" */,-48 , 39/* "Float" */,-48 , 28/* "(" */,-48 , 37/* "String" */,-48 , 6/* "FUNCTION" */,-48 , 11/* "X" */,-48 , 12/* "Y" */,-48 , 34/* "<<" */,-48 , 9/* "TRUE" */,-48 , 10/* "FALSE" */,-48 , 29/* ")" */,-48 , 27/* "," */,-48 , 35/* ">>" */,-48 )
);

/* Goto-Table */
var goto_tab = new Array(
	/* State 0 */ new Array( 40/* Program */,1 ),
	/* State 1 */ new Array( 41/* Stmt */,2 , 44/* Expression */,10 , 48/* AddSubExp */,13 , 49/* MulDivExp */,14 , 50/* NegExp */,15 , 51/* Value */,17 ),
	/* State 2 */ new Array(  ),
	/* State 3 */ new Array( 44/* Expression */,28 , 48/* AddSubExp */,13 , 49/* MulDivExp */,14 , 50/* NegExp */,15 , 51/* Value */,17 ),
	/* State 4 */ new Array( 44/* Expression */,30 , 48/* AddSubExp */,13 , 49/* MulDivExp */,14 , 50/* NegExp */,15 , 51/* Value */,17 ),
	/* State 5 */ new Array( 41/* Stmt */,31 , 44/* Expression */,10 , 48/* AddSubExp */,13 , 49/* MulDivExp */,14 , 50/* NegExp */,15 , 51/* Value */,17 ),
	/* State 6 */ new Array(  ),
	/* State 7 */ new Array( 41/* Stmt */,33 , 44/* Expression */,10 , 48/* AddSubExp */,13 , 49/* MulDivExp */,14 , 50/* NegExp */,15 , 51/* Value */,17 ),
	/* State 8 */ new Array(  ),
	/* State 9 */ new Array(  ),
	/* State 10 */ new Array(  ),
	/* State 11 */ new Array( 42/* Stmt_List */,45 ),
	/* State 12 */ new Array(  ),
	/* State 13 */ new Array(  ),
	/* State 14 */ new Array(  ),
	/* State 15 */ new Array(  ),
	/* State 16 */ new Array( 51/* Value */,50 ),
	/* State 17 */ new Array(  ),
	/* State 18 */ new Array(  ),
	/* State 19 */ new Array(  ),
	/* State 20 */ new Array( 44/* Expression */,51 , 48/* AddSubExp */,13 , 49/* MulDivExp */,14 , 50/* NegExp */,15 , 51/* Value */,17 ),
	/* State 21 */ new Array(  ),
	/* State 22 */ new Array(  ),
	/* State 23 */ new Array(  ),
	/* State 24 */ new Array(  ),
	/* State 25 */ new Array( 45/* Prop_List */,55 , 46/* Prop */,56 ),
	/* State 26 */ new Array(  ),
	/* State 27 */ new Array(  ),
	/* State 28 */ new Array( 41/* Stmt */,58 , 44/* Expression */,10 , 48/* AddSubExp */,13 , 49/* MulDivExp */,14 , 50/* NegExp */,15 , 51/* Value */,17 ),
	/* State 29 */ new Array(  ),
	/* State 30 */ new Array( 41/* Stmt */,60 , 44/* Expression */,10 , 48/* AddSubExp */,13 , 49/* MulDivExp */,14 , 50/* NegExp */,15 , 51/* Value */,17 ),
	/* State 31 */ new Array(  ),
	/* State 32 */ new Array(  ),
	/* State 33 */ new Array(  ),
	/* State 34 */ new Array(  ),
	/* State 35 */ new Array( 43/* Param_List */,64 , 44/* Expression */,65 , 48/* AddSubExp */,13 , 49/* MulDivExp */,14 , 50/* NegExp */,15 , 51/* Value */,17 ),
	/* State 36 */ new Array( 44/* Expression */,66 , 48/* AddSubExp */,13 , 49/* MulDivExp */,14 , 50/* NegExp */,15 , 51/* Value */,17 ),
	/* State 37 */ new Array(  ),
	/* State 38 */ new Array( 48/* AddSubExp */,68 , 49/* MulDivExp */,14 , 50/* NegExp */,15 , 51/* Value */,17 ),
	/* State 39 */ new Array( 48/* AddSubExp */,69 , 49/* MulDivExp */,14 , 50/* NegExp */,15 , 51/* Value */,17 ),
	/* State 40 */ new Array( 48/* AddSubExp */,70 , 49/* MulDivExp */,14 , 50/* NegExp */,15 , 51/* Value */,17 ),
	/* State 41 */ new Array( 48/* AddSubExp */,71 , 49/* MulDivExp */,14 , 50/* NegExp */,15 , 51/* Value */,17 ),
	/* State 42 */ new Array( 48/* AddSubExp */,72 , 49/* MulDivExp */,14 , 50/* NegExp */,15 , 51/* Value */,17 ),
	/* State 43 */ new Array( 48/* AddSubExp */,73 , 49/* MulDivExp */,14 , 50/* NegExp */,15 , 51/* Value */,17 ),
	/* State 44 */ new Array(  ),
	/* State 45 */ new Array( 41/* Stmt */,74 , 44/* Expression */,10 , 48/* AddSubExp */,13 , 49/* MulDivExp */,14 , 50/* NegExp */,15 , 51/* Value */,17 ),
	/* State 46 */ new Array( 49/* MulDivExp */,76 , 50/* NegExp */,15 , 51/* Value */,17 ),
	/* State 47 */ new Array( 49/* MulDivExp */,77 , 50/* NegExp */,15 , 51/* Value */,17 ),
	/* State 48 */ new Array( 50/* NegExp */,78 , 51/* Value */,17 ),
	/* State 49 */ new Array( 50/* NegExp */,79 , 51/* Value */,17 ),
	/* State 50 */ new Array(  ),
	/* State 51 */ new Array(  ),
	/* State 52 */ new Array( 47/* Param_Def_List */,81 ),
	/* State 53 */ new Array(  ),
	/* State 54 */ new Array(  ),
	/* State 55 */ new Array(  ),
	/* State 56 */ new Array(  ),
	/* State 57 */ new Array(  ),
	/* State 58 */ new Array(  ),
	/* State 59 */ new Array(  ),
	/* State 60 */ new Array(  ),
	/* State 61 */ new Array( 44/* Expression */,90 , 48/* AddSubExp */,13 , 49/* MulDivExp */,14 , 50/* NegExp */,15 , 51/* Value */,17 ),
	/* State 62 */ new Array(  ),
	/* State 63 */ new Array(  ),
	/* State 64 */ new Array(  ),
	/* State 65 */ new Array(  ),
	/* State 66 */ new Array(  ),
	/* State 67 */ new Array( 44/* Expression */,95 , 48/* AddSubExp */,13 , 49/* MulDivExp */,14 , 50/* NegExp */,15 , 51/* Value */,17 ),
	/* State 68 */ new Array(  ),
	/* State 69 */ new Array(  ),
	/* State 70 */ new Array(  ),
	/* State 71 */ new Array(  ),
	/* State 72 */ new Array(  ),
	/* State 73 */ new Array(  ),
	/* State 74 */ new Array(  ),
	/* State 75 */ new Array(  ),
	/* State 76 */ new Array(  ),
	/* State 77 */ new Array(  ),
	/* State 78 */ new Array(  ),
	/* State 79 */ new Array(  ),
	/* State 80 */ new Array(  ),
	/* State 81 */ new Array(  ),
	/* State 82 */ new Array(  ),
	/* State 83 */ new Array(  ),
	/* State 84 */ new Array(  ),
	/* State 85 */ new Array( 46/* Prop */,100 ),
	/* State 86 */ new Array(  ),
	/* State 87 */ new Array( 44/* Expression */,101 , 48/* AddSubExp */,13 , 49/* MulDivExp */,14 , 50/* NegExp */,15 , 51/* Value */,17 ),
	/* State 88 */ new Array( 41/* Stmt */,102 , 44/* Expression */,10 , 48/* AddSubExp */,13 , 49/* MulDivExp */,14 , 50/* NegExp */,15 , 51/* Value */,17 ),
	/* State 89 */ new Array(  ),
	/* State 90 */ new Array(  ),
	/* State 91 */ new Array( 44/* Expression */,104 , 48/* AddSubExp */,13 , 49/* MulDivExp */,14 , 50/* NegExp */,15 , 51/* Value */,17 ),
	/* State 92 */ new Array( 44/* Expression */,105 , 48/* AddSubExp */,13 , 49/* MulDivExp */,14 , 50/* NegExp */,15 , 51/* Value */,17 ),
	/* State 93 */ new Array(  ),
	/* State 94 */ new Array(  ),
	/* State 95 */ new Array(  ),
	/* State 96 */ new Array(  ),
	/* State 97 */ new Array(  ),
	/* State 98 */ new Array(  ),
	/* State 99 */ new Array(  ),
	/* State 100 */ new Array(  ),
	/* State 101 */ new Array(  ),
	/* State 102 */ new Array(  ),
	/* State 103 */ new Array(  ),
	/* State 104 */ new Array(  ),
	/* State 105 */ new Array(  ),
	/* State 106 */ new Array( 45/* Prop_List */,111 , 46/* Prop */,56 ),
	/* State 107 */ new Array(  ),
	/* State 108 */ new Array(  ),
	/* State 109 */ new Array( 42/* Stmt_List */,112 ),
	/* State 110 */ new Array(  ),
	/* State 111 */ new Array(  ),
	/* State 112 */ new Array( 41/* Stmt */,74 , 44/* Expression */,10 , 48/* AddSubExp */,13 , 49/* MulDivExp */,14 , 50/* NegExp */,15 , 51/* Value */,17 ),
	/* State 113 */ new Array(  ),
	/* State 114 */ new Array(  )
);



/* Symbol labels */
var labels = new Array(
	"Program'" /* Non-terminal symbol */,
	"WHITESPACE" /* Terminal symbol */,
	"IF" /* Terminal symbol */,
	"ELSE" /* Terminal symbol */,
	"WHILE" /* Terminal symbol */,
	"DO" /* Terminal symbol */,
	"FUNCTION" /* Terminal symbol */,
	"USE" /* Terminal symbol */,
	"RETURN" /* Terminal symbol */,
	"TRUE" /* Terminal symbol */,
	"FALSE" /* Terminal symbol */,
	"X" /* Terminal symbol */,
	"Y" /* Terminal symbol */,
	"{" /* Terminal symbol */,
	"}" /* Terminal symbol */,
	";" /* Terminal symbol */,
	"=" /* Terminal symbol */,
	"==" /* Terminal symbol */,
	"!=" /* Terminal symbol */,
	"<=" /* Terminal symbol */,
	">=" /* Terminal symbol */,
	">" /* Terminal symbol */,
	"<" /* Terminal symbol */,
	"+" /* Terminal symbol */,
	"-" /* Terminal symbol */,
	"/" /* Terminal symbol */,
	"*" /* Terminal symbol */,
	"," /* Terminal symbol */,
	"(" /* Terminal symbol */,
	")" /* Terminal symbol */,
	"#" /* Terminal symbol */,
	":" /* Terminal symbol */,
	"|" /* Terminal symbol */,
	"." /* Terminal symbol */,
	"<<" /* Terminal symbol */,
	">>" /* Terminal symbol */,
	"Identifier" /* Terminal symbol */,
	"String" /* Terminal symbol */,
	"Integer" /* Terminal symbol */,
	"Float" /* Terminal symbol */,
	"Program" /* Non-terminal symbol */,
	"Stmt" /* Non-terminal symbol */,
	"Stmt_List" /* Non-terminal symbol */,
	"Param_List" /* Non-terminal symbol */,
	"Expression" /* Non-terminal symbol */,
	"Prop_List" /* Non-terminal symbol */,
	"Prop" /* Non-terminal symbol */,
	"Param_Def_List" /* Non-terminal symbol */,
	"AddSubExp" /* Non-terminal symbol */,
	"MulDivExp" /* Non-terminal symbol */,
	"NegExp" /* Non-terminal symbol */,
	"Value" /* Non-terminal symbol */,
	"$" /* Terminal symbol */
);


    
        info.offset = 0;
        info.src = src;
        info.att = '';
    
        if( !err_off ) {
            err_off = [];
        }
        if( !err_la ) {
            err_la = [];
        }
    
        sstack.push(0);
        vstack.push(0);
    
        la = this._lex(info);

        while (true) {
            act = 116;
            for (i = 0; i < act_tab[sstack[sstack.length-1]].length; i+=2) {
                if (act_tab[sstack[sstack.length-1]][i] == la) {
                    act = act_tab[sstack[sstack.length-1]][i+1];
                    break;
                }
            }

            if (this._dbg_withtrace && sstack.length > 0) {
                this._dbg_print("\nState " + sstack[sstack.length-1] + "\n" +
                                "\tLookahead: " + labels[la] + " (\"" + info.att + "\")\n" +
                                "\tAction: " + act + "\n" +
                                "\tSource: \"" + info.src.substr( info.offset, 30 ) + ( ( info.offset + 30 < info.src.length ) ?
                                        "..." : "" ) + "\"\n" +
                                "\tStack: " + sstack.join() + "\n" +
                                "\tValue stack: " + vstack.join() + "\n");
            }
        
            //Panic-mode: Try recovery when parse-error occurs!
            if (act == 116) {
                if (this._dbg_withtrace)
                    this._dbg_print("Error detected: There is no reduce or shift on the symbol " + labels[la]);
            
                err_cnt++;
                err_off.push(info.offset - info.att.length);
                err_la.push([]);
                for (i = 0; i < act_tab[sstack[sstack.length-1]].length; i+=2) {
                    err_la[err_la.length-1].push( labels[act_tab[sstack[sstack.length-1]][i]] );
                }
            
                //Remember the original stack!
                var rsstack = [];
                var rvstack = [];
                for (i = 0; i < sstack.length; i++) {
                    rsstack[i] = sstack[i];
                    rvstack[i] = vstack[i];
                }

                while (act == 116 && la != 52) {
                    if (this._dbg_withtrace) {
                        this._dbg_print("\tError recovery\n" +
                                        "Current lookahead: " + labels[la] + " (" + info.att + ")\n" +
                                        "Action: " + act + "\n\n");
                    }
                    if (la == -1) {
                        info.offset++;
                    }

                    while (act == 116 && sstack.length > 0) {
                        sstack.pop();
                        vstack.pop();

                        if (sstack.length == 0) {
                            break;
                        }

                        act = 116;
                        for (i = 0; i < act_tab[sstack[sstack.length-1]].length; i+=2) {
                            if (act_tab[sstack[sstack.length-1]][i] == la) {
                                act = act_tab[sstack[sstack.length-1]][i+1];
                                break;
                            }
                        }
                    }

                    if (act != 116) {
                        break;
                    }

                    for (i = 0; i < rsstack.length; i++) {
                        sstack.push(rsstack[i]);
                        vstack.push(rvstack[i]);
                    }

                    la = this._lex(info);
                }

                if (act == 116) {
                    if (this._dbg_withtrace ) {
                        this._dbg_print("\tError recovery failed, terminating parse process...");
                    }
                    break;
                }

                if (this._dbg_withtrace) {
                    this._dbg_print("\tError recovery succeeded, continuing");
                }
            }

            //Shift
            if (act > 0) {
                if (this._dbg_withtrace) {
                    this._dbg_print("Shifting symbol: " + labels[la] + " (" + info.att + ")");
                }

                sstack.push(act);
                vstack.push(info.att);

                la = this._lex(info);

                if (this._dbg_withtrace) {
                    this._dbg_print("\tNew lookahead symbol: " + labels[la] + " (" + info.att + ")");
                }
            }
            //Reduce
            else {
                act *= -1;

                if (this._dbg_withtrace) {
                    this._dbg_print("Reducing by producution: " + act);
                }

                rval = void(0);

                if (this._dbg_withtrace) {
                    this._dbg_print("\tPerforming semantic action...");
                }

switch( act )
{
	case 0:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 1:
	{
		 this.execute( vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 2:
	{
		rval = vstack[ vstack.length - 0 ];
	}
	break;
	case 3:
	{
		 rval = this.createNode('node_op', 'op_none', vstack[ vstack.length - 2 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 4:
	{
		rval = vstack[ vstack.length - 0 ];
	}
	break;
	case 5:
	{
		 rval = this.createNode('node_op', 'op_paramlst', vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 6:
	{
		 rval = this.createNode('node_op', 'op_param', vstack[ vstack.length - 1 ]); 
	}
	break;
	case 7:
	{
		 rval = this.createNode('node_op', 'op_proplst', vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 8:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 9:
	{
		rval = vstack[ vstack.length - 0 ];
	}
	break;
	case 10:
	{
		 rval = this.createNode('node_op', 'op_prop', vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 11:
	{
		 rval = this.createNode('node_op', 'op_paramdeflst', vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 12:
	{
		 rval = this.createNode('node_op', 'op_paramdef', vstack[ vstack.length - 1 ]); 
	}
	break;
	case 13:
	{
		rval = vstack[ vstack.length - 0 ];
	}
	break;
	case 14:
	{
		 rval = this.createNode('node_op', 'op_if', vstack[ vstack.length - 2 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 15:
	{
		 rval = this.createNode('node_op', 'op_if_else', vstack[ vstack.length - 4 ], vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 16:
	{
		 rval = this.createNode('node_op', 'op_while', vstack[ vstack.length - 2 ], vstack[ vstack.length - 0 ] ); 
	}
	break;
	case 17:
	{
		 rval = this.createNode('node_op', 'op_for', vstack[ vstack.length - 4 ], vstack[ vstack.length - 2 ] ); 
	}
	break;
	case 18:
	{
		 rval = this.createNode('node_op', 'op_use', vstack[ vstack.length - 2 ] ); 
	}
	break;
	case 19:
	{
		 rval = this.createNode('node_op', 'op_return', vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 20:
	{
		 rval = this.createNode('node_op', 'op_assign', vstack[ vstack.length - 4 ], vstack[ vstack.length - 2 ] ); 
	}
	break;
	case 21:
	{
		 rval = this.createNode('node_op', 'op_property', vstack[ vstack.length - 6 ], vstack[ vstack.length - 4 ], vstack[ vstack.length - 2 ] ); 
	}
	break;
	case 22:
	{
		 rval = this.createNode('node_op', 'op_propnoob', vstack[ vstack.length - 4 ], vstack[ vstack.length - 2 ] ); 
	}
	break;
	case 23:
	{
		 rval = this.createNode('node_op', 'op_noassign', vstack[ vstack.length - 2 ] ); 
	}
	break;
	case 24:
	{
		 rval = vstack[ vstack.length - 2 ]; 
	}
	break;
	case 25:
	{
		 rval = this.createNode('node_op', 'op_none' ); 
	}
	break;
	case 26:
	{
		 rval = this.createNode('node_op', 'op_equ', vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 27:
	{
		 rval = this.createNode('node_op', 'op_lot', vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 28:
	{
		 rval = this.createNode('node_op', 'op_grt', vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 29:
	{
		 rval = this.createNode('node_op', 'op_loe', vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 30:
	{
		 rval = this.createNode('node_op', 'op_gre', vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 31:
	{
		 rval = this.createNode('node_op', 'op_neq', vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 32:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 33:
	{
		 rval = this.createNode('node_op', 'op_sub', vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 34:
	{
		 rval = this.createNode('node_op', 'op_add', vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 35:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 36:
	{
		 rval = this.createNode('node_op', 'op_mul', vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 37:
	{
		 rval = this.createNode('node_op', 'op_div', vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 38:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 39:
	{
		 rval = this.createNode('node_op', 'op_neg', vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 40:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 41:
	{
		 rval = this.createNode('node_const', vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 42:
	{
		 rval = this.createNode('node_const', vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 43:
	{
		 rval = this.createNode('node_var', vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 44:
	{
		 rval = vstack[ vstack.length - 2 ]; 
	}
	break;
	case 45:
	{
		 rval = this.createNode('node_str', vstack[ vstack.length - 1 ]); 
	}
	break;
	case 46:
	{
		 rval = this.createNode('node_op', 'op_execfun', vstack[ vstack.length - 4 ], vstack[ vstack.length - 2 ]); 
	}
	break;
	case 47:
	{
		 rval = this.createNode('node_op', 'op_execfun', vstack[ vstack.length - 7 ], vstack[ vstack.length - 5 ], vstack[ vstack.length - 2 ]); 
	}
	break;
	case 48:
	{
		 rval = this.createNode('node_op', 'op_function', vstack[ vstack.length - 5 ], vstack[ vstack.length - 2 ]); 
	}
	break;
	case 49:
	{
		 rval = this.createNode('node_method', 'x', vstack[ vstack.length - 2 ]); 
	}
	break;
	case 50:
	{
		 rval = this.createNode('node_method', 'y', vstack[ vstack.length - 2 ]); 
	}
	break;
	case 51:
	{
		 rval = this.createNode('node_property', vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ]); 
	}
	break;
	case 52:
	{
		 rval = this.createNode('node_op', 'op_proplst_val', vstack[ vstack.length - 2 ] ); 
	}
	break;
	case 53:
	{
		 rval = this.createNode('node_const_bool', vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 54:
	{
		 rval = this.createNode('node_const_bool', vstack[ vstack.length - 1 ] ); 
	}
	break;
}



                if (this._dbg_withtrace) {
                    this._dbg_print("\tPopping " + pop_tab[act][1] + " off the stack...");
                }

                for (i = 0; i < pop_tab[act][1]; i++) {
                    sstack.pop();
                    vstack.pop();
                }

                go = -1;
                for (i = 0; i < goto_tab[sstack[sstack.length-1]].length; i+=2) {
                    if (goto_tab[sstack[sstack.length-1]][i] == pop_tab[act][0]) {
                        go = goto_tab[sstack[sstack.length-1]][i+1];
                        break;
                    }
                }

                if (act == 0) {
                    break;
                }

                if (this._dbg_withtrace) {
                    this._dbg_print("\tPushing non-terminal " + labels[pop_tab[act][0]]);
                }

                sstack.push(go);
                vstack.push(rval);
            }

            if (this._dbg_withtrace ) {
                alert(this._dbg_string);
                this._dbg_string = '';
            }
        }

        if (this._dbg_withtrace) {
            this._dbg_print("\nParse complete.");
            alert(this._dbg_string);
        }

        return err_cnt;
    }
});



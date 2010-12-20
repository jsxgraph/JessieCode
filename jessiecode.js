

JXG.JessieCode = (function() {

// Control structures and functions
var

//Structs

/**
 * Create a new parse tree node.
 * @param {String} type Type of node, e.g. node_op, node_var, or node_const
 * @param value The nodes value, e.g. a variables value or a functions body.
 * @param {Array} children Arbitrary number of child nodes.
 */
node = function(type, value, children) {
    return {
        type: type,
        value: value,
        children: children
    };
},

// Management functions

// Parsed variables
// scope stack
sstack = [{}],
scope = 0,
// parameter stack
pstack = [],

// board currently in use
board,

_debug = function(log) {
    if(typeof console !== "undefined") {
        console.log(log);
    } else if(document.getElementById('debug') !== null) {
        document.getElementById('debug').innerHTML += log + '<br />';
    }
},

_error = function(msg) {
    throw new Error(msg);
},

//Interpreting function
letvar = function(vname, value) {
    sstack[scope][vname] = value;
},

getvar = function(vname) {
    return sstack[scope][vname] || 0;
};

    return {
        parse: function(code) {
            var error_cnt = 0,
                error_off = new Array(),
                error_la = new Array();

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
                            if( node.children[0] )
                                this.execute( node.children[0] );                    
                            if( node.children[1] )
                                ret = this.execute( node.children[1] );
                            break;
                        case 'op_assign':
                            letvar( node.children[0], this.execute( node.children[1] ) );
                            break;
                        case 'op_noassign':
                            this.execute(node.children[0]);
                            break;
                        case 'op_if':
                            if( this.execute( node.children[0] ) )
                                this.execute( node.children[1] );
                            break;
                        case 'op_if_else':
                            if( this.execute( node.children[0] ) )
                                this.execute( node.children[1] );
                            else
                                this.execute( node.children[2] );
                            break;
                        case 'op_while':
                            while( this.execute( node.children[0] ) )
                                this.execute( node.children[1] );
                            break;
                        case 'op_for':
                            // todo
                            do
                                this.execute( node.children[0] )
                            while( this.execute( node.children[1] ) );
                            break;
                        case 'op_paramlst':
                            if(node.children[0]) {
                                this.execute(node.children[0]);
                            }
                            if(node.children[1]) {
                                ret = node.children[1];
                                pstack.push(ret);
                            }
                            break;
                        case 'op_param':
                            if( node.children[0] ) {
                                ret = node.children[0];
                                pstack.push(ret);
                            }
                            break;
                        case 'op_paramdeflst':
                                if(node.children[0]) {
                                this.execute(node.children[0]);
                            }
                            if(node.children[1]) {
                                ret = node.children[1];
                                pstack.push(ret);
                            }
                            break;
                        case 'op_paramdef':
                            if( node.children[0] ) {
                                ret = node.children[0];
                                pstack.push(ret);
                            }
                            break;
                        case 'op_function':
                            this.execute(node.children[0]);

                            ret = (function(_pstack) { return function() {
                                var r;

                                sstack.push({});
                                scope++;
                                for(r = 0; r < _pstack.length; r++)
                                    sstack[scope][_pstack[r]] = arguments[r];
                                sstack[scope]['result'] = '';
                                pstack = [];

                                JXG.JessieCode.execute(node.children[1]);
                                r = sstack[scope]['result'];
                                sstack.pop();
                                scope--;

                                return r;
                            }; })(pstack);
                            pstack = [];
                            break;
                        case 'op_execfun':
                            // node.children:
                            //   [0]: Name of the function
                            //   [1]: Parameter list as a parse subtree
                            var fun, i, parents = [];
                            
                            // parse the parameter list
                            // after this, the parameters are in pstack
                            this.execute(node.children[1]);
                            fun = getvar(node.children[0]);
                            
                            // check for the function in the variable table
                            if(JXG.exists(fun) && typeof fun === 'function') {
                                ret = fun.apply(this, pstack);
                            
                            // check for an element with this name
                            } else if (node.children[0] in JXG.JSXGraph.elements) {
                                    for(i = 0; i < pstack.length; i++) {
                                        if(pstack[i].type !== 'node_const' && (node.children[0] === 'point' || node.children[0] === 'text')) {
                                            parents[i] = ((function(stree) {
                                                return function() {
                                                    return JXG.JessieCode.execute(stree)
                                                };
                                            })(pstack[i]));
                                        } else {
                                            parents[i] = (JXG.JessieCode.execute(pstack[i]));
                                        }
                                    }

                                ret = board.create(node.children[0], parents, {});
                                
                            // nothing found, throw an error
                            // todo: check for a valid identifier and appropriate parameters and create a point
                            //       this resembles the legacy JessieScript behaviour of A(1, 2);
                            } else {
                                throw new Error('Error: Function \'' + fun + '\' is undefined.');
                            }
                            
                            // clear parameter stack
                            pstack = [];
                            break;
                        case 'op_create':
                            this.execute(node.children[0]);
                            ret = board.create(pstack[0], pstack.slice(1));
                            pstack = [];
                            break;
                        case 'op_use':
                            var found = false;
                            for(var b in JXG.JSXGraph.boards) {
                                if(JXG.JSXGraph.boards[b].container === node.children[0].toString()) {
                                    board = JXG.JSXGraph.boards[b];
                                    found = true;

                                    _debug('now using board ' + board.id);
                                }
                            }
                    
                            if(!found)
                                alert(node.children[0].toString() + ' not found!');
                            break;
                        case 'op_equ':
                            ret = this.execute( node.children[0] ) == this.execute( node.children[1] );
                            break;
                        case 'op_neq':
                            ret = this.execute( node.children[0] ) != this.execute( node.children[1] );
                            break;
                        case 'op_grt':
                            ret = this.execute( node.children[0] ) > this.execute( node.children[1] );
                            break;
                        case 'op_lot':
                            ret = this.execute( node.children[0] ) < this.execute( node.children[1] );
                            break;
                        case 'op_gre':
                            ret = this.execute( node.children[0] ) >= this.execute( node.children[1] );
                            break;
                        case 'op_loe':
                            ret = this.execute( node.children[0] ) <= this.execute( node.children[1] );
                            break;
                        case 'op_add':
                            ret = this.execute( node.children[0] ) + this.execute( node.children[1] );
                            break;
                        case 'op_sub':
                            ret = this.execute( node.children[0] ) - this.execute( node.children[1] );
                            break;
                        case 'op_div':
                            ret = this.execute( node.children[0] ) / this.execute( node.children[1] );
                            break;
                        case 'op_mul':
                            ret = this.execute( node.children[0] ) * this.execute( node.children[1] );
                            break;
                        case 'op_neg':
                            ret = this.execute( node.children[0] ) * -1;
                            break;
                    }
                    break;

                case 'node_var':
                    ret = getvar(node.value);
                    break;

                case 'node_const':
                    ret = Number(node.value);
                    break;

                case 'node_str':
                    ret = node.value;
                    break;
        
                case 'node_method':
                    switch(node.value) {
                        case 'x':
                            if(!JXG.exists(sstack[scope][node.children[0]])) {
                                _error(node.children[0] + ' is undefined.');
                                ret = NaN;
                            } else if(!JXG.exists(sstack[scope][node.children[0]].X)) {
                                _error(node.children[0] + ' has no property \'X\'.');
                                ret = NaN;
                            } else
                                ret = sstack[scope][node.children[0]].X();
                            break;
                        case 'y':
                            if(!JXG.exists(sstack[scope][node.children[0]])) {
                                _error(node.children[0] + ' is undefined.');
                                ret = NaN;
                            } else if(!JXG.exists(sstack[scope][node.children[0]].Y)) {
                                _error(node.children[0] + ' has no property \'Y\'.');
                                ret = NaN;
                            } else
                                ret = sstack[scope][node.children[0]].Y();
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
            var n = node(type, value, []),
                i;
    
            for(i = 2; i < arguments.length; i++)
                n.children.push( arguments[i] );

            return n;
        }
    };

})();

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

JXG.JessieCode._dbg_withtrace = false;
JXG.JessieCode._dbg_string = new String();

JXG.JessieCode._dbg_print = function ( text ) {
    JXG.JessieCode._dbg_string += text + "\n";
};

JXG.JessieCode._lex = function(info) {
    var state       = 0,
        match       = -1,
        match_pos   = 0,
        start       = 0,
        pos         = info.offset + 1;

    do {
        pos--;
        state = 0;
        match = -2;
        start = pos;

        if( info.src.length <= start )
            return 42;

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
		else if( info.src.charCodeAt( pos ) == 47 ) state = 9;
		else if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) ) state = 10;
		else if( info.src.charCodeAt( pos ) == 59 ) state = 11;
		else if( info.src.charCodeAt( pos ) == 60 ) state = 12;
		else if( info.src.charCodeAt( pos ) == 61 ) state = 13;
		else if( info.src.charCodeAt( pos ) == 62 ) state = 14;
		else if( ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 67 ) || ( info.src.charCodeAt( pos ) >= 71 && info.src.charCodeAt( pos ) <= 72 ) || ( info.src.charCodeAt( pos ) >= 74 && info.src.charCodeAt( pos ) <= 84 ) || info.src.charCodeAt( pos ) == 86 || info.src.charCodeAt( pos ) == 90 || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 99 ) || ( info.src.charCodeAt( pos ) >= 103 && info.src.charCodeAt( pos ) <= 104 ) || ( info.src.charCodeAt( pos ) >= 106 && info.src.charCodeAt( pos ) <= 116 ) || info.src.charCodeAt( pos ) == 118 || ( info.src.charCodeAt( pos ) >= 120 && info.src.charCodeAt( pos ) <= 122 ) ) state = 15;
		else if( info.src.charCodeAt( pos ) == 88 ) state = 16;
		else if( info.src.charCodeAt( pos ) == 89 ) state = 17;
		else if( info.src.charCodeAt( pos ) == 123 ) state = 18;
		else if( info.src.charCodeAt( pos ) == 125 ) state = 19;
		else if( info.src.charCodeAt( pos ) == 33 ) state = 32;
		else if( info.src.charCodeAt( pos ) == 68 || info.src.charCodeAt( pos ) == 100 ) state = 33;
		else if( info.src.charCodeAt( pos ) == 39 ) state = 34;
		else if( info.src.charCodeAt( pos ) == 73 || info.src.charCodeAt( pos ) == 105 ) state = 35;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 36;
		else if( info.src.charCodeAt( pos ) == 85 || info.src.charCodeAt( pos ) == 117 ) state = 41;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 45;
		else if( info.src.charCodeAt( pos ) == 87 || info.src.charCodeAt( pos ) == 119 ) state = 48;
		else if( info.src.charCodeAt( pos ) == 70 || info.src.charCodeAt( pos ) == 102 ) state = 52;
		else state = -1;
		break;

	case 1:
		state = -1;
		match = 1;
		match_pos = pos;
		break;

	case 2:
		state = -1;
		match = 27;
		match_pos = pos;
		break;

	case 3:
		state = -1;
		match = 25;
		match_pos = pos;
		break;

	case 4:
		state = -1;
		match = 26;
		match_pos = pos;
		break;

	case 5:
		state = -1;
		match = 23;
		match_pos = pos;
		break;

	case 6:
		state = -1;
		match = 20;
		match_pos = pos;
		break;

	case 7:
		state = -1;
		match = 24;
		match_pos = pos;
		break;

	case 8:
		state = -1;
		match = 21;
		match_pos = pos;
		break;

	case 9:
		state = -1;
		match = 22;
		match_pos = pos;
		break;

	case 10:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) ) state = 10;
		else if( info.src.charCodeAt( pos ) == 46 ) state = 22;
		else state = -1;
		match = 30;
		match_pos = pos;
		break;

	case 11:
		state = -1;
		match = 12;
		match_pos = pos;
		break;

	case 12:
		if( info.src.charCodeAt( pos ) == 61 ) state = 23;
		else state = -1;
		match = 19;
		match_pos = pos;
		break;

	case 13:
		if( info.src.charCodeAt( pos ) == 61 ) state = 24;
		else state = -1;
		match = 13;
		match_pos = pos;
		break;

	case 14:
		if( info.src.charCodeAt( pos ) == 61 ) state = 25;
		else state = -1;
		match = 18;
		match_pos = pos;
		break;

	case 15:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 15;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 16:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 15;
		else state = -1;
		match = 8;
		match_pos = pos;
		break;

	case 17:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 15;
		else state = -1;
		match = 9;
		match_pos = pos;
		break;

	case 18:
		state = -1;
		match = 10;
		match_pos = pos;
		break;

	case 19:
		state = -1;
		match = 11;
		match_pos = pos;
		break;

	case 20:
		state = -1;
		match = 15;
		match_pos = pos;
		break;

	case 21:
		if( info.src.charCodeAt( pos ) == 39 ) state = 34;
		else state = -1;
		match = 29;
		match_pos = pos;
		break;

	case 22:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) ) state = 22;
		else state = -1;
		match = 31;
		match_pos = pos;
		break;

	case 23:
		state = -1;
		match = 16;
		match_pos = pos;
		break;

	case 24:
		state = -1;
		match = 14;
		match_pos = pos;
		break;

	case 25:
		state = -1;
		match = 17;
		match_pos = pos;
		break;

	case 26:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 15;
		else state = -1;
		match = 5;
		match_pos = pos;
		break;

	case 27:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 15;
		else state = -1;
		match = 2;
		match_pos = pos;
		break;

	case 28:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 15;
		else state = -1;
		match = 7;
		match_pos = pos;
		break;

	case 29:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 15;
		else state = -1;
		match = 3;
		match_pos = pos;
		break;

	case 30:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 15;
		else state = -1;
		match = 4;
		match_pos = pos;
		break;

	case 31:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 122 ) ) state = 15;
		else state = -1;
		match = 6;
		match_pos = pos;
		break;

	case 32:
		if( info.src.charCodeAt( pos ) == 61 ) state = 20;
		else state = -1;
		break;

	case 33:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 78 ) || ( info.src.charCodeAt( pos ) >= 80 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 110 ) || ( info.src.charCodeAt( pos ) >= 112 && info.src.charCodeAt( pos ) <= 122 ) ) state = 15;
		else if( info.src.charCodeAt( pos ) == 79 || info.src.charCodeAt( pos ) == 111 ) state = 26;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 34:
		if( info.src.charCodeAt( pos ) == 39 ) state = 21;
		else if( ( info.src.charCodeAt( pos ) >= 0 && info.src.charCodeAt( pos ) <= 38 ) || ( info.src.charCodeAt( pos ) >= 40 && info.src.charCodeAt( pos ) <= 254 ) ) state = 34;
		else state = -1;
		break;

	case 35:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 69 ) || ( info.src.charCodeAt( pos ) >= 71 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 101 ) || ( info.src.charCodeAt( pos ) >= 103 && info.src.charCodeAt( pos ) <= 122 ) ) state = 15;
		else if( info.src.charCodeAt( pos ) == 70 || info.src.charCodeAt( pos ) == 102 ) state = 27;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 36:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) ) state = 22;
		else state = -1;
		break;

	case 37:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 68 ) || ( info.src.charCodeAt( pos ) >= 70 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 100 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 122 ) ) state = 15;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 28;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 38:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 68 ) || ( info.src.charCodeAt( pos ) >= 70 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 100 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 122 ) ) state = 15;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 29;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 39:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 68 ) || ( info.src.charCodeAt( pos ) >= 70 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 100 ) || ( info.src.charCodeAt( pos ) >= 102 && info.src.charCodeAt( pos ) <= 122 ) ) state = 15;
		else if( info.src.charCodeAt( pos ) == 69 || info.src.charCodeAt( pos ) == 101 ) state = 30;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 40:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 77 ) || ( info.src.charCodeAt( pos ) >= 79 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 109 ) || ( info.src.charCodeAt( pos ) >= 111 && info.src.charCodeAt( pos ) <= 122 ) ) state = 15;
		else if( info.src.charCodeAt( pos ) == 78 || info.src.charCodeAt( pos ) == 110 ) state = 31;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 41:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 82 ) || ( info.src.charCodeAt( pos ) >= 84 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 114 ) || ( info.src.charCodeAt( pos ) >= 116 && info.src.charCodeAt( pos ) <= 122 ) ) state = 15;
		else if( info.src.charCodeAt( pos ) == 83 || info.src.charCodeAt( pos ) == 115 ) state = 37;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 42:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 82 ) || ( info.src.charCodeAt( pos ) >= 84 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 114 ) || ( info.src.charCodeAt( pos ) >= 116 && info.src.charCodeAt( pos ) <= 122 ) ) state = 15;
		else if( info.src.charCodeAt( pos ) == 83 || info.src.charCodeAt( pos ) == 115 ) state = 38;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 43:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 75 ) || ( info.src.charCodeAt( pos ) >= 77 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 107 ) || ( info.src.charCodeAt( pos ) >= 109 && info.src.charCodeAt( pos ) <= 122 ) ) state = 15;
		else if( info.src.charCodeAt( pos ) == 76 || info.src.charCodeAt( pos ) == 108 ) state = 39;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 44:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 78 ) || ( info.src.charCodeAt( pos ) >= 80 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 110 ) || ( info.src.charCodeAt( pos ) >= 112 && info.src.charCodeAt( pos ) <= 122 ) ) state = 15;
		else if( info.src.charCodeAt( pos ) == 79 || info.src.charCodeAt( pos ) == 111 ) state = 40;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 45:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 75 ) || ( info.src.charCodeAt( pos ) >= 77 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 107 ) || ( info.src.charCodeAt( pos ) >= 109 && info.src.charCodeAt( pos ) <= 122 ) ) state = 15;
		else if( info.src.charCodeAt( pos ) == 76 || info.src.charCodeAt( pos ) == 108 ) state = 42;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 46:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 72 ) || ( info.src.charCodeAt( pos ) >= 74 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 104 ) || ( info.src.charCodeAt( pos ) >= 106 && info.src.charCodeAt( pos ) <= 122 ) ) state = 15;
		else if( info.src.charCodeAt( pos ) == 73 || info.src.charCodeAt( pos ) == 105 ) state = 43;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 47:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 72 ) || ( info.src.charCodeAt( pos ) >= 74 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 104 ) || ( info.src.charCodeAt( pos ) >= 106 && info.src.charCodeAt( pos ) <= 122 ) ) state = 15;
		else if( info.src.charCodeAt( pos ) == 73 || info.src.charCodeAt( pos ) == 105 ) state = 44;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 48:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 71 ) || ( info.src.charCodeAt( pos ) >= 73 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 103 ) || ( info.src.charCodeAt( pos ) >= 105 && info.src.charCodeAt( pos ) <= 122 ) ) state = 15;
		else if( info.src.charCodeAt( pos ) == 72 || info.src.charCodeAt( pos ) == 104 ) state = 46;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 49:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 83 ) || ( info.src.charCodeAt( pos ) >= 85 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 115 ) || ( info.src.charCodeAt( pos ) >= 117 && info.src.charCodeAt( pos ) <= 122 ) ) state = 15;
		else if( info.src.charCodeAt( pos ) == 84 || info.src.charCodeAt( pos ) == 116 ) state = 47;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 50:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 66 ) || ( info.src.charCodeAt( pos ) >= 68 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 98 ) || ( info.src.charCodeAt( pos ) >= 100 && info.src.charCodeAt( pos ) <= 122 ) ) state = 15;
		else if( info.src.charCodeAt( pos ) == 67 || info.src.charCodeAt( pos ) == 99 ) state = 49;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 51:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 77 ) || ( info.src.charCodeAt( pos ) >= 79 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 109 ) || ( info.src.charCodeAt( pos ) >= 111 && info.src.charCodeAt( pos ) <= 122 ) ) state = 15;
		else if( info.src.charCodeAt( pos ) == 78 || info.src.charCodeAt( pos ) == 110 ) state = 50;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

	case 52:
		if( ( info.src.charCodeAt( pos ) >= 48 && info.src.charCodeAt( pos ) <= 57 ) || ( info.src.charCodeAt( pos ) >= 65 && info.src.charCodeAt( pos ) <= 84 ) || ( info.src.charCodeAt( pos ) >= 86 && info.src.charCodeAt( pos ) <= 90 ) || info.src.charCodeAt( pos ) == 95 || ( info.src.charCodeAt( pos ) >= 97 && info.src.charCodeAt( pos ) <= 116 ) || ( info.src.charCodeAt( pos ) >= 118 && info.src.charCodeAt( pos ) <= 122 ) ) state = 15;
		else if( info.src.charCodeAt( pos ) == 85 || info.src.charCodeAt( pos ) == 117 ) state = 51;
		else state = -1;
		match = 28;
		match_pos = pos;
		break;

}


            pos++;

        }
        while( state > -1 );

    }
    while( 1 > -1 && match == 1 );

    if( match > -1 ) {
        info.att = info.src.substr( start, match_pos - start );
        info.offset = match_pos;
        
switch( match )
{
	case 29:
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
};


JXG.JessieCode._parse = function(src, err_off, err_la) {
    var sstack      = new Array(),
        vstack      = new Array(),
        err_cnt     = 0,
        act,
        go,
        la,
        rval,
        parseinfo   = new Function( "", "var offset; var src; var att;" ),
        info        = new parseinfo();
    
/* Pop-Table */
var pop_tab = new Array(
	new Array( 0/* Program' */, 1 ),
	new Array( 32/* Program */, 2 ),
	new Array( 32/* Program */, 0 ),
	new Array( 34/* Stmt_List */, 2 ),
	new Array( 34/* Stmt_List */, 0 ),
	new Array( 35/* Param_List */, 3 ),
	new Array( 35/* Param_List */, 1 ),
	new Array( 37/* Param_Def_List */, 3 ),
	new Array( 37/* Param_Def_List */, 1 ),
	new Array( 37/* Param_Def_List */, 0 ),
	new Array( 33/* Stmt */, 3 ),
	new Array( 33/* Stmt */, 5 ),
	new Array( 33/* Stmt */, 3 ),
	new Array( 33/* Stmt */, 5 ),
	new Array( 33/* Stmt */, 3 ),
	new Array( 33/* Stmt */, 4 ),
	new Array( 33/* Stmt */, 2 ),
	new Array( 33/* Stmt */, 3 ),
	new Array( 33/* Stmt */, 1 ),
	new Array( 36/* Expression */, 3 ),
	new Array( 36/* Expression */, 3 ),
	new Array( 36/* Expression */, 3 ),
	new Array( 36/* Expression */, 3 ),
	new Array( 36/* Expression */, 3 ),
	new Array( 36/* Expression */, 3 ),
	new Array( 36/* Expression */, 1 ),
	new Array( 38/* AddSubExp */, 3 ),
	new Array( 38/* AddSubExp */, 3 ),
	new Array( 38/* AddSubExp */, 1 ),
	new Array( 39/* MulDivExp */, 3 ),
	new Array( 39/* MulDivExp */, 3 ),
	new Array( 39/* MulDivExp */, 1 ),
	new Array( 40/* NegExp */, 2 ),
	new Array( 40/* NegExp */, 1 ),
	new Array( 41/* Value */, 1 ),
	new Array( 41/* Value */, 1 ),
	new Array( 41/* Value */, 1 ),
	new Array( 41/* Value */, 3 ),
	new Array( 41/* Value */, 1 ),
	new Array( 41/* Value */, 4 ),
	new Array( 41/* Value */, 7 ),
	new Array( 41/* Value */, 4 ),
	new Array( 41/* Value */, 4 )
);

/* Action-Table */
var act_tab = new Array(
	/* State 0 */ new Array( 42/* "$" */,-2 , 2/* "IF" */,-2 , 4/* "WHILE" */,-2 , 5/* "DO" */,-2 , 7/* "USE" */,-2 , 28/* "Identifier" */,-2 , 10/* "{" */,-2 , 12/* ";" */,-2 , 21/* "-" */,-2 , 30/* "Integer" */,-2 , 31/* "Float" */,-2 , 25/* "(" */,-2 , 29/* "String" */,-2 , 6/* "FUNCTION" */,-2 , 8/* "X" */,-2 , 9/* "Y" */,-2 ),
	/* State 1 */ new Array( 2/* "IF" */,3 , 4/* "WHILE" */,4 , 5/* "DO" */,5 , 7/* "USE" */,6 , 28/* "Identifier" */,7 , 10/* "{" */,9 , 12/* ";" */,10 , 21/* "-" */,14 , 30/* "Integer" */,16 , 31/* "Float" */,17 , 25/* "(" */,18 , 29/* "String" */,19 , 6/* "FUNCTION" */,20 , 8/* "X" */,21 , 9/* "Y" */,22 , 42/* "$" */,0 ),
	/* State 2 */ new Array( 42/* "$" */,-1 , 2/* "IF" */,-1 , 4/* "WHILE" */,-1 , 5/* "DO" */,-1 , 7/* "USE" */,-1 , 28/* "Identifier" */,-1 , 10/* "{" */,-1 , 12/* ";" */,-1 , 21/* "-" */,-1 , 30/* "Integer" */,-1 , 31/* "Float" */,-1 , 25/* "(" */,-1 , 29/* "String" */,-1 , 6/* "FUNCTION" */,-1 , 8/* "X" */,-1 , 9/* "Y" */,-1 ),
	/* State 3 */ new Array( 21/* "-" */,14 , 30/* "Integer" */,16 , 31/* "Float" */,17 , 28/* "Identifier" */,24 , 25/* "(" */,18 , 29/* "String" */,19 , 6/* "FUNCTION" */,20 , 8/* "X" */,21 , 9/* "Y" */,22 ),
	/* State 4 */ new Array( 21/* "-" */,14 , 30/* "Integer" */,16 , 31/* "Float" */,17 , 28/* "Identifier" */,24 , 25/* "(" */,18 , 29/* "String" */,19 , 6/* "FUNCTION" */,20 , 8/* "X" */,21 , 9/* "Y" */,22 ),
	/* State 5 */ new Array( 2/* "IF" */,3 , 4/* "WHILE" */,4 , 5/* "DO" */,5 , 7/* "USE" */,6 , 28/* "Identifier" */,7 , 10/* "{" */,9 , 12/* ";" */,10 , 21/* "-" */,14 , 30/* "Integer" */,16 , 31/* "Float" */,17 , 25/* "(" */,18 , 29/* "String" */,19 , 6/* "FUNCTION" */,20 , 8/* "X" */,21 , 9/* "Y" */,22 ),
	/* State 6 */ new Array( 28/* "Identifier" */,27 ),
	/* State 7 */ new Array( 25/* "(" */,28 , 13/* "=" */,29 , 12/* ";" */,-36 , 14/* "==" */,-36 , 19/* "<" */,-36 , 18/* ">" */,-36 , 16/* "<=" */,-36 , 17/* ">=" */,-36 , 15/* "!=" */,-36 , 21/* "-" */,-36 , 20/* "+" */,-36 , 23/* "*" */,-36 , 22/* "/" */,-36 ),
	/* State 8 */ new Array( 15/* "!=" */,30 , 17/* ">=" */,31 , 16/* "<=" */,32 , 18/* ">" */,33 , 19/* "<" */,34 , 14/* "==" */,35 , 12/* ";" */,36 ),
	/* State 9 */ new Array( 11/* "}" */,-4 , 2/* "IF" */,-4 , 4/* "WHILE" */,-4 , 5/* "DO" */,-4 , 7/* "USE" */,-4 , 28/* "Identifier" */,-4 , 10/* "{" */,-4 , 12/* ";" */,-4 , 21/* "-" */,-4 , 30/* "Integer" */,-4 , 31/* "Float" */,-4 , 25/* "(" */,-4 , 29/* "String" */,-4 , 6/* "FUNCTION" */,-4 , 8/* "X" */,-4 , 9/* "Y" */,-4 ),
	/* State 10 */ new Array( 42/* "$" */,-18 , 2/* "IF" */,-18 , 4/* "WHILE" */,-18 , 5/* "DO" */,-18 , 7/* "USE" */,-18 , 28/* "Identifier" */,-18 , 10/* "{" */,-18 , 12/* ";" */,-18 , 21/* "-" */,-18 , 30/* "Integer" */,-18 , 31/* "Float" */,-18 , 25/* "(" */,-18 , 29/* "String" */,-18 , 6/* "FUNCTION" */,-18 , 8/* "X" */,-18 , 9/* "Y" */,-18 , 3/* "ELSE" */,-18 , 11/* "}" */,-18 ),
	/* State 11 */ new Array( 20/* "+" */,38 , 21/* "-" */,39 , 12/* ";" */,-25 , 14/* "==" */,-25 , 19/* "<" */,-25 , 18/* ">" */,-25 , 16/* "<=" */,-25 , 17/* ">=" */,-25 , 15/* "!=" */,-25 , 2/* "IF" */,-25 , 4/* "WHILE" */,-25 , 5/* "DO" */,-25 , 7/* "USE" */,-25 , 28/* "Identifier" */,-25 , 10/* "{" */,-25 , 30/* "Integer" */,-25 , 31/* "Float" */,-25 , 25/* "(" */,-25 , 29/* "String" */,-25 , 6/* "FUNCTION" */,-25 , 8/* "X" */,-25 , 9/* "Y" */,-25 , 26/* ")" */,-25 , 24/* "," */,-25 ),
	/* State 12 */ new Array( 22/* "/" */,40 , 23/* "*" */,41 , 12/* ";" */,-28 , 14/* "==" */,-28 , 19/* "<" */,-28 , 18/* ">" */,-28 , 16/* "<=" */,-28 , 17/* ">=" */,-28 , 15/* "!=" */,-28 , 21/* "-" */,-28 , 20/* "+" */,-28 , 2/* "IF" */,-28 , 4/* "WHILE" */,-28 , 5/* "DO" */,-28 , 7/* "USE" */,-28 , 28/* "Identifier" */,-28 , 10/* "{" */,-28 , 30/* "Integer" */,-28 , 31/* "Float" */,-28 , 25/* "(" */,-28 , 29/* "String" */,-28 , 6/* "FUNCTION" */,-28 , 8/* "X" */,-28 , 9/* "Y" */,-28 , 26/* ")" */,-28 , 24/* "," */,-28 ),
	/* State 13 */ new Array( 12/* ";" */,-31 , 14/* "==" */,-31 , 19/* "<" */,-31 , 18/* ">" */,-31 , 16/* "<=" */,-31 , 17/* ">=" */,-31 , 15/* "!=" */,-31 , 21/* "-" */,-31 , 20/* "+" */,-31 , 23/* "*" */,-31 , 22/* "/" */,-31 , 2/* "IF" */,-31 , 4/* "WHILE" */,-31 , 5/* "DO" */,-31 , 7/* "USE" */,-31 , 28/* "Identifier" */,-31 , 10/* "{" */,-31 , 30/* "Integer" */,-31 , 31/* "Float" */,-31 , 25/* "(" */,-31 , 29/* "String" */,-31 , 6/* "FUNCTION" */,-31 , 8/* "X" */,-31 , 9/* "Y" */,-31 , 26/* ")" */,-31 , 24/* "," */,-31 ),
	/* State 14 */ new Array( 30/* "Integer" */,16 , 31/* "Float" */,17 , 28/* "Identifier" */,24 , 25/* "(" */,18 , 29/* "String" */,19 , 6/* "FUNCTION" */,20 , 8/* "X" */,21 , 9/* "Y" */,22 ),
	/* State 15 */ new Array( 12/* ";" */,-33 , 14/* "==" */,-33 , 19/* "<" */,-33 , 18/* ">" */,-33 , 16/* "<=" */,-33 , 17/* ">=" */,-33 , 15/* "!=" */,-33 , 21/* "-" */,-33 , 20/* "+" */,-33 , 23/* "*" */,-33 , 22/* "/" */,-33 , 2/* "IF" */,-33 , 4/* "WHILE" */,-33 , 5/* "DO" */,-33 , 7/* "USE" */,-33 , 28/* "Identifier" */,-33 , 10/* "{" */,-33 , 30/* "Integer" */,-33 , 31/* "Float" */,-33 , 25/* "(" */,-33 , 29/* "String" */,-33 , 6/* "FUNCTION" */,-33 , 8/* "X" */,-33 , 9/* "Y" */,-33 , 26/* ")" */,-33 , 24/* "," */,-33 ),
	/* State 16 */ new Array( 12/* ";" */,-34 , 14/* "==" */,-34 , 19/* "<" */,-34 , 18/* ">" */,-34 , 16/* "<=" */,-34 , 17/* ">=" */,-34 , 15/* "!=" */,-34 , 21/* "-" */,-34 , 20/* "+" */,-34 , 23/* "*" */,-34 , 22/* "/" */,-34 , 2/* "IF" */,-34 , 4/* "WHILE" */,-34 , 5/* "DO" */,-34 , 7/* "USE" */,-34 , 28/* "Identifier" */,-34 , 10/* "{" */,-34 , 30/* "Integer" */,-34 , 31/* "Float" */,-34 , 25/* "(" */,-34 , 29/* "String" */,-34 , 6/* "FUNCTION" */,-34 , 8/* "X" */,-34 , 9/* "Y" */,-34 , 26/* ")" */,-34 , 24/* "," */,-34 ),
	/* State 17 */ new Array( 12/* ";" */,-35 , 14/* "==" */,-35 , 19/* "<" */,-35 , 18/* ">" */,-35 , 16/* "<=" */,-35 , 17/* ">=" */,-35 , 15/* "!=" */,-35 , 21/* "-" */,-35 , 20/* "+" */,-35 , 23/* "*" */,-35 , 22/* "/" */,-35 , 2/* "IF" */,-35 , 4/* "WHILE" */,-35 , 5/* "DO" */,-35 , 7/* "USE" */,-35 , 28/* "Identifier" */,-35 , 10/* "{" */,-35 , 30/* "Integer" */,-35 , 31/* "Float" */,-35 , 25/* "(" */,-35 , 29/* "String" */,-35 , 6/* "FUNCTION" */,-35 , 8/* "X" */,-35 , 9/* "Y" */,-35 , 26/* ")" */,-35 , 24/* "," */,-35 ),
	/* State 18 */ new Array( 21/* "-" */,14 , 30/* "Integer" */,16 , 31/* "Float" */,17 , 28/* "Identifier" */,24 , 25/* "(" */,18 , 29/* "String" */,19 , 6/* "FUNCTION" */,20 , 8/* "X" */,21 , 9/* "Y" */,22 ),
	/* State 19 */ new Array( 12/* ";" */,-38 , 14/* "==" */,-38 , 19/* "<" */,-38 , 18/* ">" */,-38 , 16/* "<=" */,-38 , 17/* ">=" */,-38 , 15/* "!=" */,-38 , 21/* "-" */,-38 , 20/* "+" */,-38 , 23/* "*" */,-38 , 22/* "/" */,-38 , 2/* "IF" */,-38 , 4/* "WHILE" */,-38 , 5/* "DO" */,-38 , 7/* "USE" */,-38 , 28/* "Identifier" */,-38 , 10/* "{" */,-38 , 30/* "Integer" */,-38 , 31/* "Float" */,-38 , 25/* "(" */,-38 , 29/* "String" */,-38 , 6/* "FUNCTION" */,-38 , 8/* "X" */,-38 , 9/* "Y" */,-38 , 26/* ")" */,-38 , 24/* "," */,-38 ),
	/* State 20 */ new Array( 25/* "(" */,44 ),
	/* State 21 */ new Array( 25/* "(" */,45 ),
	/* State 22 */ new Array( 25/* "(" */,46 ),
	/* State 23 */ new Array( 15/* "!=" */,30 , 17/* ">=" */,31 , 16/* "<=" */,32 , 18/* ">" */,33 , 19/* "<" */,34 , 14/* "==" */,35 , 2/* "IF" */,3 , 4/* "WHILE" */,4 , 5/* "DO" */,5 , 7/* "USE" */,6 , 28/* "Identifier" */,7 , 10/* "{" */,9 , 12/* ";" */,10 , 21/* "-" */,14 , 30/* "Integer" */,16 , 31/* "Float" */,17 , 25/* "(" */,18 , 29/* "String" */,19 , 6/* "FUNCTION" */,20 , 8/* "X" */,21 , 9/* "Y" */,22 ),
	/* State 24 */ new Array( 25/* "(" */,28 , 2/* "IF" */,-36 , 4/* "WHILE" */,-36 , 5/* "DO" */,-36 , 7/* "USE" */,-36 , 28/* "Identifier" */,-36 , 10/* "{" */,-36 , 12/* ";" */,-36 , 21/* "-" */,-36 , 30/* "Integer" */,-36 , 31/* "Float" */,-36 , 29/* "String" */,-36 , 6/* "FUNCTION" */,-36 , 8/* "X" */,-36 , 9/* "Y" */,-36 , 14/* "==" */,-36 , 19/* "<" */,-36 , 18/* ">" */,-36 , 16/* "<=" */,-36 , 17/* ">=" */,-36 , 15/* "!=" */,-36 , 20/* "+" */,-36 , 23/* "*" */,-36 , 22/* "/" */,-36 , 26/* ")" */,-36 , 24/* "," */,-36 ),
	/* State 25 */ new Array( 15/* "!=" */,30 , 17/* ">=" */,31 , 16/* "<=" */,32 , 18/* ">" */,33 , 19/* "<" */,34 , 14/* "==" */,35 , 2/* "IF" */,3 , 4/* "WHILE" */,4 , 5/* "DO" */,5 , 7/* "USE" */,6 , 28/* "Identifier" */,7 , 10/* "{" */,9 , 12/* ";" */,10 , 21/* "-" */,14 , 30/* "Integer" */,16 , 31/* "Float" */,17 , 25/* "(" */,18 , 29/* "String" */,19 , 6/* "FUNCTION" */,20 , 8/* "X" */,21 , 9/* "Y" */,22 ),
	/* State 26 */ new Array( 4/* "WHILE" */,49 ),
	/* State 27 */ new Array( 12/* ";" */,50 ),
	/* State 28 */ new Array( 21/* "-" */,14 , 30/* "Integer" */,16 , 31/* "Float" */,17 , 28/* "Identifier" */,24 , 25/* "(" */,18 , 29/* "String" */,19 , 6/* "FUNCTION" */,20 , 8/* "X" */,21 , 9/* "Y" */,22 ),
	/* State 29 */ new Array( 21/* "-" */,14 , 30/* "Integer" */,16 , 31/* "Float" */,17 , 28/* "Identifier" */,24 , 25/* "(" */,18 , 29/* "String" */,19 , 6/* "FUNCTION" */,20 , 8/* "X" */,21 , 9/* "Y" */,22 ),
	/* State 30 */ new Array( 21/* "-" */,14 , 30/* "Integer" */,16 , 31/* "Float" */,17 , 28/* "Identifier" */,24 , 25/* "(" */,18 , 29/* "String" */,19 , 6/* "FUNCTION" */,20 , 8/* "X" */,21 , 9/* "Y" */,22 ),
	/* State 31 */ new Array( 21/* "-" */,14 , 30/* "Integer" */,16 , 31/* "Float" */,17 , 28/* "Identifier" */,24 , 25/* "(" */,18 , 29/* "String" */,19 , 6/* "FUNCTION" */,20 , 8/* "X" */,21 , 9/* "Y" */,22 ),
	/* State 32 */ new Array( 21/* "-" */,14 , 30/* "Integer" */,16 , 31/* "Float" */,17 , 28/* "Identifier" */,24 , 25/* "(" */,18 , 29/* "String" */,19 , 6/* "FUNCTION" */,20 , 8/* "X" */,21 , 9/* "Y" */,22 ),
	/* State 33 */ new Array( 21/* "-" */,14 , 30/* "Integer" */,16 , 31/* "Float" */,17 , 28/* "Identifier" */,24 , 25/* "(" */,18 , 29/* "String" */,19 , 6/* "FUNCTION" */,20 , 8/* "X" */,21 , 9/* "Y" */,22 ),
	/* State 34 */ new Array( 21/* "-" */,14 , 30/* "Integer" */,16 , 31/* "Float" */,17 , 28/* "Identifier" */,24 , 25/* "(" */,18 , 29/* "String" */,19 , 6/* "FUNCTION" */,20 , 8/* "X" */,21 , 9/* "Y" */,22 ),
	/* State 35 */ new Array( 21/* "-" */,14 , 30/* "Integer" */,16 , 31/* "Float" */,17 , 28/* "Identifier" */,24 , 25/* "(" */,18 , 29/* "String" */,19 , 6/* "FUNCTION" */,20 , 8/* "X" */,21 , 9/* "Y" */,22 ),
	/* State 36 */ new Array( 42/* "$" */,-16 , 2/* "IF" */,-16 , 4/* "WHILE" */,-16 , 5/* "DO" */,-16 , 7/* "USE" */,-16 , 28/* "Identifier" */,-16 , 10/* "{" */,-16 , 12/* ";" */,-16 , 21/* "-" */,-16 , 30/* "Integer" */,-16 , 31/* "Float" */,-16 , 25/* "(" */,-16 , 29/* "String" */,-16 , 6/* "FUNCTION" */,-16 , 8/* "X" */,-16 , 9/* "Y" */,-16 , 3/* "ELSE" */,-16 , 11/* "}" */,-16 ),
	/* State 37 */ new Array( 11/* "}" */,61 , 2/* "IF" */,3 , 4/* "WHILE" */,4 , 5/* "DO" */,5 , 7/* "USE" */,6 , 28/* "Identifier" */,7 , 10/* "{" */,9 , 12/* ";" */,10 , 21/* "-" */,14 , 30/* "Integer" */,16 , 31/* "Float" */,17 , 25/* "(" */,18 , 29/* "String" */,19 , 6/* "FUNCTION" */,20 , 8/* "X" */,21 , 9/* "Y" */,22 ),
	/* State 38 */ new Array( 21/* "-" */,14 , 30/* "Integer" */,16 , 31/* "Float" */,17 , 28/* "Identifier" */,24 , 25/* "(" */,18 , 29/* "String" */,19 , 6/* "FUNCTION" */,20 , 8/* "X" */,21 , 9/* "Y" */,22 ),
	/* State 39 */ new Array( 21/* "-" */,14 , 30/* "Integer" */,16 , 31/* "Float" */,17 , 28/* "Identifier" */,24 , 25/* "(" */,18 , 29/* "String" */,19 , 6/* "FUNCTION" */,20 , 8/* "X" */,21 , 9/* "Y" */,22 ),
	/* State 40 */ new Array( 21/* "-" */,14 , 30/* "Integer" */,16 , 31/* "Float" */,17 , 28/* "Identifier" */,24 , 25/* "(" */,18 , 29/* "String" */,19 , 6/* "FUNCTION" */,20 , 8/* "X" */,21 , 9/* "Y" */,22 ),
	/* State 41 */ new Array( 21/* "-" */,14 , 30/* "Integer" */,16 , 31/* "Float" */,17 , 28/* "Identifier" */,24 , 25/* "(" */,18 , 29/* "String" */,19 , 6/* "FUNCTION" */,20 , 8/* "X" */,21 , 9/* "Y" */,22 ),
	/* State 42 */ new Array( 12/* ";" */,-32 , 14/* "==" */,-32 , 19/* "<" */,-32 , 18/* ">" */,-32 , 16/* "<=" */,-32 , 17/* ">=" */,-32 , 15/* "!=" */,-32 , 21/* "-" */,-32 , 20/* "+" */,-32 , 23/* "*" */,-32 , 22/* "/" */,-32 , 2/* "IF" */,-32 , 4/* "WHILE" */,-32 , 5/* "DO" */,-32 , 7/* "USE" */,-32 , 28/* "Identifier" */,-32 , 10/* "{" */,-32 , 30/* "Integer" */,-32 , 31/* "Float" */,-32 , 25/* "(" */,-32 , 29/* "String" */,-32 , 6/* "FUNCTION" */,-32 , 8/* "X" */,-32 , 9/* "Y" */,-32 , 26/* ")" */,-32 , 24/* "," */,-32 ),
	/* State 43 */ new Array( 15/* "!=" */,30 , 17/* ">=" */,31 , 16/* "<=" */,32 , 18/* ">" */,33 , 19/* "<" */,34 , 14/* "==" */,35 , 26/* ")" */,66 ),
	/* State 44 */ new Array( 28/* "Identifier" */,68 , 26/* ")" */,-9 , 24/* "," */,-9 ),
	/* State 45 */ new Array( 28/* "Identifier" */,69 ),
	/* State 46 */ new Array( 28/* "Identifier" */,70 ),
	/* State 47 */ new Array( 3/* "ELSE" */,71 , 42/* "$" */,-10 , 2/* "IF" */,-10 , 4/* "WHILE" */,-10 , 5/* "DO" */,-10 , 7/* "USE" */,-10 , 28/* "Identifier" */,-10 , 10/* "{" */,-10 , 12/* ";" */,-10 , 21/* "-" */,-10 , 30/* "Integer" */,-10 , 31/* "Float" */,-10 , 25/* "(" */,-10 , 29/* "String" */,-10 , 6/* "FUNCTION" */,-10 , 8/* "X" */,-10 , 9/* "Y" */,-10 , 11/* "}" */,-10 ),
	/* State 48 */ new Array( 42/* "$" */,-12 , 2/* "IF" */,-12 , 4/* "WHILE" */,-12 , 5/* "DO" */,-12 , 7/* "USE" */,-12 , 28/* "Identifier" */,-12 , 10/* "{" */,-12 , 12/* ";" */,-12 , 21/* "-" */,-12 , 30/* "Integer" */,-12 , 31/* "Float" */,-12 , 25/* "(" */,-12 , 29/* "String" */,-12 , 6/* "FUNCTION" */,-12 , 8/* "X" */,-12 , 9/* "Y" */,-12 , 3/* "ELSE" */,-12 , 11/* "}" */,-12 ),
	/* State 49 */ new Array( 21/* "-" */,14 , 30/* "Integer" */,16 , 31/* "Float" */,17 , 28/* "Identifier" */,24 , 25/* "(" */,18 , 29/* "String" */,19 , 6/* "FUNCTION" */,20 , 8/* "X" */,21 , 9/* "Y" */,22 ),
	/* State 50 */ new Array( 42/* "$" */,-14 , 2/* "IF" */,-14 , 4/* "WHILE" */,-14 , 5/* "DO" */,-14 , 7/* "USE" */,-14 , 28/* "Identifier" */,-14 , 10/* "{" */,-14 , 12/* ";" */,-14 , 21/* "-" */,-14 , 30/* "Integer" */,-14 , 31/* "Float" */,-14 , 25/* "(" */,-14 , 29/* "String" */,-14 , 6/* "FUNCTION" */,-14 , 8/* "X" */,-14 , 9/* "Y" */,-14 , 3/* "ELSE" */,-14 , 11/* "}" */,-14 ),
	/* State 51 */ new Array( 24/* "," */,73 , 26/* ")" */,74 ),
	/* State 52 */ new Array( 15/* "!=" */,30 , 17/* ">=" */,31 , 16/* "<=" */,32 , 18/* ">" */,33 , 19/* "<" */,34 , 14/* "==" */,35 , 26/* ")" */,-6 , 24/* "," */,-6 ),
	/* State 53 */ new Array( 15/* "!=" */,30 , 17/* ">=" */,31 , 16/* "<=" */,32 , 18/* ">" */,33 , 19/* "<" */,34 , 14/* "==" */,35 , 12/* ";" */,75 ),
	/* State 54 */ new Array( 20/* "+" */,38 , 21/* "-" */,39 , 12/* ";" */,-24 , 14/* "==" */,-24 , 19/* "<" */,-24 , 18/* ">" */,-24 , 16/* "<=" */,-24 , 17/* ">=" */,-24 , 15/* "!=" */,-24 , 2/* "IF" */,-24 , 4/* "WHILE" */,-24 , 5/* "DO" */,-24 , 7/* "USE" */,-24 , 28/* "Identifier" */,-24 , 10/* "{" */,-24 , 30/* "Integer" */,-24 , 31/* "Float" */,-24 , 25/* "(" */,-24 , 29/* "String" */,-24 , 6/* "FUNCTION" */,-24 , 8/* "X" */,-24 , 9/* "Y" */,-24 , 26/* ")" */,-24 , 24/* "," */,-24 ),
	/* State 55 */ new Array( 20/* "+" */,38 , 21/* "-" */,39 , 12/* ";" */,-23 , 14/* "==" */,-23 , 19/* "<" */,-23 , 18/* ">" */,-23 , 16/* "<=" */,-23 , 17/* ">=" */,-23 , 15/* "!=" */,-23 , 2/* "IF" */,-23 , 4/* "WHILE" */,-23 , 5/* "DO" */,-23 , 7/* "USE" */,-23 , 28/* "Identifier" */,-23 , 10/* "{" */,-23 , 30/* "Integer" */,-23 , 31/* "Float" */,-23 , 25/* "(" */,-23 , 29/* "String" */,-23 , 6/* "FUNCTION" */,-23 , 8/* "X" */,-23 , 9/* "Y" */,-23 , 26/* ")" */,-23 , 24/* "," */,-23 ),
	/* State 56 */ new Array( 20/* "+" */,38 , 21/* "-" */,39 , 12/* ";" */,-22 , 14/* "==" */,-22 , 19/* "<" */,-22 , 18/* ">" */,-22 , 16/* "<=" */,-22 , 17/* ">=" */,-22 , 15/* "!=" */,-22 , 2/* "IF" */,-22 , 4/* "WHILE" */,-22 , 5/* "DO" */,-22 , 7/* "USE" */,-22 , 28/* "Identifier" */,-22 , 10/* "{" */,-22 , 30/* "Integer" */,-22 , 31/* "Float" */,-22 , 25/* "(" */,-22 , 29/* "String" */,-22 , 6/* "FUNCTION" */,-22 , 8/* "X" */,-22 , 9/* "Y" */,-22 , 26/* ")" */,-22 , 24/* "," */,-22 ),
	/* State 57 */ new Array( 20/* "+" */,38 , 21/* "-" */,39 , 12/* ";" */,-21 , 14/* "==" */,-21 , 19/* "<" */,-21 , 18/* ">" */,-21 , 16/* "<=" */,-21 , 17/* ">=" */,-21 , 15/* "!=" */,-21 , 2/* "IF" */,-21 , 4/* "WHILE" */,-21 , 5/* "DO" */,-21 , 7/* "USE" */,-21 , 28/* "Identifier" */,-21 , 10/* "{" */,-21 , 30/* "Integer" */,-21 , 31/* "Float" */,-21 , 25/* "(" */,-21 , 29/* "String" */,-21 , 6/* "FUNCTION" */,-21 , 8/* "X" */,-21 , 9/* "Y" */,-21 , 26/* ")" */,-21 , 24/* "," */,-21 ),
	/* State 58 */ new Array( 20/* "+" */,38 , 21/* "-" */,39 , 12/* ";" */,-20 , 14/* "==" */,-20 , 19/* "<" */,-20 , 18/* ">" */,-20 , 16/* "<=" */,-20 , 17/* ">=" */,-20 , 15/* "!=" */,-20 , 2/* "IF" */,-20 , 4/* "WHILE" */,-20 , 5/* "DO" */,-20 , 7/* "USE" */,-20 , 28/* "Identifier" */,-20 , 10/* "{" */,-20 , 30/* "Integer" */,-20 , 31/* "Float" */,-20 , 25/* "(" */,-20 , 29/* "String" */,-20 , 6/* "FUNCTION" */,-20 , 8/* "X" */,-20 , 9/* "Y" */,-20 , 26/* ")" */,-20 , 24/* "," */,-20 ),
	/* State 59 */ new Array( 20/* "+" */,38 , 21/* "-" */,39 , 12/* ";" */,-19 , 14/* "==" */,-19 , 19/* "<" */,-19 , 18/* ">" */,-19 , 16/* "<=" */,-19 , 17/* ">=" */,-19 , 15/* "!=" */,-19 , 2/* "IF" */,-19 , 4/* "WHILE" */,-19 , 5/* "DO" */,-19 , 7/* "USE" */,-19 , 28/* "Identifier" */,-19 , 10/* "{" */,-19 , 30/* "Integer" */,-19 , 31/* "Float" */,-19 , 25/* "(" */,-19 , 29/* "String" */,-19 , 6/* "FUNCTION" */,-19 , 8/* "X" */,-19 , 9/* "Y" */,-19 , 26/* ")" */,-19 , 24/* "," */,-19 ),
	/* State 60 */ new Array( 11/* "}" */,-3 , 2/* "IF" */,-3 , 4/* "WHILE" */,-3 , 5/* "DO" */,-3 , 7/* "USE" */,-3 , 28/* "Identifier" */,-3 , 10/* "{" */,-3 , 12/* ";" */,-3 , 21/* "-" */,-3 , 30/* "Integer" */,-3 , 31/* "Float" */,-3 , 25/* "(" */,-3 , 29/* "String" */,-3 , 6/* "FUNCTION" */,-3 , 8/* "X" */,-3 , 9/* "Y" */,-3 ),
	/* State 61 */ new Array( 42/* "$" */,-17 , 2/* "IF" */,-17 , 4/* "WHILE" */,-17 , 5/* "DO" */,-17 , 7/* "USE" */,-17 , 28/* "Identifier" */,-17 , 10/* "{" */,-17 , 12/* ";" */,-17 , 21/* "-" */,-17 , 30/* "Integer" */,-17 , 31/* "Float" */,-17 , 25/* "(" */,-17 , 29/* "String" */,-17 , 6/* "FUNCTION" */,-17 , 8/* "X" */,-17 , 9/* "Y" */,-17 , 3/* "ELSE" */,-17 , 11/* "}" */,-17 ),
	/* State 62 */ new Array( 22/* "/" */,40 , 23/* "*" */,41 , 12/* ";" */,-27 , 14/* "==" */,-27 , 19/* "<" */,-27 , 18/* ">" */,-27 , 16/* "<=" */,-27 , 17/* ">=" */,-27 , 15/* "!=" */,-27 , 21/* "-" */,-27 , 20/* "+" */,-27 , 2/* "IF" */,-27 , 4/* "WHILE" */,-27 , 5/* "DO" */,-27 , 7/* "USE" */,-27 , 28/* "Identifier" */,-27 , 10/* "{" */,-27 , 30/* "Integer" */,-27 , 31/* "Float" */,-27 , 25/* "(" */,-27 , 29/* "String" */,-27 , 6/* "FUNCTION" */,-27 , 8/* "X" */,-27 , 9/* "Y" */,-27 , 26/* ")" */,-27 , 24/* "," */,-27 ),
	/* State 63 */ new Array( 22/* "/" */,40 , 23/* "*" */,41 , 12/* ";" */,-26 , 14/* "==" */,-26 , 19/* "<" */,-26 , 18/* ">" */,-26 , 16/* "<=" */,-26 , 17/* ">=" */,-26 , 15/* "!=" */,-26 , 21/* "-" */,-26 , 20/* "+" */,-26 , 2/* "IF" */,-26 , 4/* "WHILE" */,-26 , 5/* "DO" */,-26 , 7/* "USE" */,-26 , 28/* "Identifier" */,-26 , 10/* "{" */,-26 , 30/* "Integer" */,-26 , 31/* "Float" */,-26 , 25/* "(" */,-26 , 29/* "String" */,-26 , 6/* "FUNCTION" */,-26 , 8/* "X" */,-26 , 9/* "Y" */,-26 , 26/* ")" */,-26 , 24/* "," */,-26 ),
	/* State 64 */ new Array( 12/* ";" */,-30 , 14/* "==" */,-30 , 19/* "<" */,-30 , 18/* ">" */,-30 , 16/* "<=" */,-30 , 17/* ">=" */,-30 , 15/* "!=" */,-30 , 21/* "-" */,-30 , 20/* "+" */,-30 , 23/* "*" */,-30 , 22/* "/" */,-30 , 2/* "IF" */,-30 , 4/* "WHILE" */,-30 , 5/* "DO" */,-30 , 7/* "USE" */,-30 , 28/* "Identifier" */,-30 , 10/* "{" */,-30 , 30/* "Integer" */,-30 , 31/* "Float" */,-30 , 25/* "(" */,-30 , 29/* "String" */,-30 , 6/* "FUNCTION" */,-30 , 8/* "X" */,-30 , 9/* "Y" */,-30 , 26/* ")" */,-30 , 24/* "," */,-30 ),
	/* State 65 */ new Array( 12/* ";" */,-29 , 14/* "==" */,-29 , 19/* "<" */,-29 , 18/* ">" */,-29 , 16/* "<=" */,-29 , 17/* ">=" */,-29 , 15/* "!=" */,-29 , 21/* "-" */,-29 , 20/* "+" */,-29 , 23/* "*" */,-29 , 22/* "/" */,-29 , 2/* "IF" */,-29 , 4/* "WHILE" */,-29 , 5/* "DO" */,-29 , 7/* "USE" */,-29 , 28/* "Identifier" */,-29 , 10/* "{" */,-29 , 30/* "Integer" */,-29 , 31/* "Float" */,-29 , 25/* "(" */,-29 , 29/* "String" */,-29 , 6/* "FUNCTION" */,-29 , 8/* "X" */,-29 , 9/* "Y" */,-29 , 26/* ")" */,-29 , 24/* "," */,-29 ),
	/* State 66 */ new Array( 12/* ";" */,-37 , 14/* "==" */,-37 , 19/* "<" */,-37 , 18/* ">" */,-37 , 16/* "<=" */,-37 , 17/* ">=" */,-37 , 15/* "!=" */,-37 , 21/* "-" */,-37 , 20/* "+" */,-37 , 23/* "*" */,-37 , 22/* "/" */,-37 , 2/* "IF" */,-37 , 4/* "WHILE" */,-37 , 5/* "DO" */,-37 , 7/* "USE" */,-37 , 28/* "Identifier" */,-37 , 10/* "{" */,-37 , 30/* "Integer" */,-37 , 31/* "Float" */,-37 , 25/* "(" */,-37 , 29/* "String" */,-37 , 6/* "FUNCTION" */,-37 , 8/* "X" */,-37 , 9/* "Y" */,-37 , 26/* ")" */,-37 , 24/* "," */,-37 ),
	/* State 67 */ new Array( 24/* "," */,76 , 26/* ")" */,77 ),
	/* State 68 */ new Array( 26/* ")" */,-8 , 24/* "," */,-8 ),
	/* State 69 */ new Array( 26/* ")" */,78 ),
	/* State 70 */ new Array( 26/* ")" */,79 ),
	/* State 71 */ new Array( 2/* "IF" */,3 , 4/* "WHILE" */,4 , 5/* "DO" */,5 , 7/* "USE" */,6 , 28/* "Identifier" */,7 , 10/* "{" */,9 , 12/* ";" */,10 , 21/* "-" */,14 , 30/* "Integer" */,16 , 31/* "Float" */,17 , 25/* "(" */,18 , 29/* "String" */,19 , 6/* "FUNCTION" */,20 , 8/* "X" */,21 , 9/* "Y" */,22 ),
	/* State 72 */ new Array( 15/* "!=" */,30 , 17/* ">=" */,31 , 16/* "<=" */,32 , 18/* ">" */,33 , 19/* "<" */,34 , 14/* "==" */,35 , 12/* ";" */,81 ),
	/* State 73 */ new Array( 21/* "-" */,14 , 30/* "Integer" */,16 , 31/* "Float" */,17 , 28/* "Identifier" */,24 , 25/* "(" */,18 , 29/* "String" */,19 , 6/* "FUNCTION" */,20 , 8/* "X" */,21 , 9/* "Y" */,22 ),
	/* State 74 */ new Array( 12/* ";" */,-39 , 14/* "==" */,-39 , 19/* "<" */,-39 , 18/* ">" */,-39 , 16/* "<=" */,-39 , 17/* ">=" */,-39 , 15/* "!=" */,-39 , 21/* "-" */,-39 , 20/* "+" */,-39 , 23/* "*" */,-39 , 22/* "/" */,-39 , 2/* "IF" */,-39 , 4/* "WHILE" */,-39 , 5/* "DO" */,-39 , 7/* "USE" */,-39 , 28/* "Identifier" */,-39 , 10/* "{" */,-39 , 30/* "Integer" */,-39 , 31/* "Float" */,-39 , 25/* "(" */,-39 , 29/* "String" */,-39 , 6/* "FUNCTION" */,-39 , 8/* "X" */,-39 , 9/* "Y" */,-39 , 26/* ")" */,-39 , 24/* "," */,-39 ),
	/* State 75 */ new Array( 42/* "$" */,-15 , 2/* "IF" */,-15 , 4/* "WHILE" */,-15 , 5/* "DO" */,-15 , 7/* "USE" */,-15 , 28/* "Identifier" */,-15 , 10/* "{" */,-15 , 12/* ";" */,-15 , 21/* "-" */,-15 , 30/* "Integer" */,-15 , 31/* "Float" */,-15 , 25/* "(" */,-15 , 29/* "String" */,-15 , 6/* "FUNCTION" */,-15 , 8/* "X" */,-15 , 9/* "Y" */,-15 , 3/* "ELSE" */,-15 , 11/* "}" */,-15 ),
	/* State 76 */ new Array( 28/* "Identifier" */,83 ),
	/* State 77 */ new Array( 10/* "{" */,84 ),
	/* State 78 */ new Array( 12/* ";" */,-41 , 14/* "==" */,-41 , 19/* "<" */,-41 , 18/* ">" */,-41 , 16/* "<=" */,-41 , 17/* ">=" */,-41 , 15/* "!=" */,-41 , 21/* "-" */,-41 , 20/* "+" */,-41 , 23/* "*" */,-41 , 22/* "/" */,-41 , 2/* "IF" */,-41 , 4/* "WHILE" */,-41 , 5/* "DO" */,-41 , 7/* "USE" */,-41 , 28/* "Identifier" */,-41 , 10/* "{" */,-41 , 30/* "Integer" */,-41 , 31/* "Float" */,-41 , 25/* "(" */,-41 , 29/* "String" */,-41 , 6/* "FUNCTION" */,-41 , 8/* "X" */,-41 , 9/* "Y" */,-41 , 26/* ")" */,-41 , 24/* "," */,-41 ),
	/* State 79 */ new Array( 12/* ";" */,-42 , 14/* "==" */,-42 , 19/* "<" */,-42 , 18/* ">" */,-42 , 16/* "<=" */,-42 , 17/* ">=" */,-42 , 15/* "!=" */,-42 , 21/* "-" */,-42 , 20/* "+" */,-42 , 23/* "*" */,-42 , 22/* "/" */,-42 , 2/* "IF" */,-42 , 4/* "WHILE" */,-42 , 5/* "DO" */,-42 , 7/* "USE" */,-42 , 28/* "Identifier" */,-42 , 10/* "{" */,-42 , 30/* "Integer" */,-42 , 31/* "Float" */,-42 , 25/* "(" */,-42 , 29/* "String" */,-42 , 6/* "FUNCTION" */,-42 , 8/* "X" */,-42 , 9/* "Y" */,-42 , 26/* ")" */,-42 , 24/* "," */,-42 ),
	/* State 80 */ new Array( 42/* "$" */,-11 , 2/* "IF" */,-11 , 4/* "WHILE" */,-11 , 5/* "DO" */,-11 , 7/* "USE" */,-11 , 28/* "Identifier" */,-11 , 10/* "{" */,-11 , 12/* ";" */,-11 , 21/* "-" */,-11 , 30/* "Integer" */,-11 , 31/* "Float" */,-11 , 25/* "(" */,-11 , 29/* "String" */,-11 , 6/* "FUNCTION" */,-11 , 8/* "X" */,-11 , 9/* "Y" */,-11 , 3/* "ELSE" */,-11 , 11/* "}" */,-11 ),
	/* State 81 */ new Array( 42/* "$" */,-13 , 2/* "IF" */,-13 , 4/* "WHILE" */,-13 , 5/* "DO" */,-13 , 7/* "USE" */,-13 , 28/* "Identifier" */,-13 , 10/* "{" */,-13 , 12/* ";" */,-13 , 21/* "-" */,-13 , 30/* "Integer" */,-13 , 31/* "Float" */,-13 , 25/* "(" */,-13 , 29/* "String" */,-13 , 6/* "FUNCTION" */,-13 , 8/* "X" */,-13 , 9/* "Y" */,-13 , 3/* "ELSE" */,-13 , 11/* "}" */,-13 ),
	/* State 82 */ new Array( 15/* "!=" */,30 , 17/* ">=" */,31 , 16/* "<=" */,32 , 18/* ">" */,33 , 19/* "<" */,34 , 14/* "==" */,35 , 26/* ")" */,-5 , 24/* "," */,-5 ),
	/* State 83 */ new Array( 26/* ")" */,-7 , 24/* "," */,-7 ),
	/* State 84 */ new Array( 11/* "}" */,-4 , 2/* "IF" */,-4 , 4/* "WHILE" */,-4 , 5/* "DO" */,-4 , 7/* "USE" */,-4 , 28/* "Identifier" */,-4 , 10/* "{" */,-4 , 12/* ";" */,-4 , 21/* "-" */,-4 , 30/* "Integer" */,-4 , 31/* "Float" */,-4 , 25/* "(" */,-4 , 29/* "String" */,-4 , 6/* "FUNCTION" */,-4 , 8/* "X" */,-4 , 9/* "Y" */,-4 ),
	/* State 85 */ new Array( 11/* "}" */,86 , 2/* "IF" */,3 , 4/* "WHILE" */,4 , 5/* "DO" */,5 , 7/* "USE" */,6 , 28/* "Identifier" */,7 , 10/* "{" */,9 , 12/* ";" */,10 , 21/* "-" */,14 , 30/* "Integer" */,16 , 31/* "Float" */,17 , 25/* "(" */,18 , 29/* "String" */,19 , 6/* "FUNCTION" */,20 , 8/* "X" */,21 , 9/* "Y" */,22 ),
	/* State 86 */ new Array( 12/* ";" */,-40 , 14/* "==" */,-40 , 19/* "<" */,-40 , 18/* ">" */,-40 , 16/* "<=" */,-40 , 17/* ">=" */,-40 , 15/* "!=" */,-40 , 21/* "-" */,-40 , 20/* "+" */,-40 , 23/* "*" */,-40 , 22/* "/" */,-40 , 2/* "IF" */,-40 , 4/* "WHILE" */,-40 , 5/* "DO" */,-40 , 7/* "USE" */,-40 , 28/* "Identifier" */,-40 , 10/* "{" */,-40 , 30/* "Integer" */,-40 , 31/* "Float" */,-40 , 25/* "(" */,-40 , 29/* "String" */,-40 , 6/* "FUNCTION" */,-40 , 8/* "X" */,-40 , 9/* "Y" */,-40 , 26/* ")" */,-40 , 24/* "," */,-40 )
);

/* Goto-Table */
var goto_tab = new Array(
	/* State 0 */ new Array( 32/* Program */,1 ),
	/* State 1 */ new Array( 33/* Stmt */,2 , 36/* Expression */,8 , 38/* AddSubExp */,11 , 39/* MulDivExp */,12 , 40/* NegExp */,13 , 41/* Value */,15 ),
	/* State 2 */ new Array(  ),
	/* State 3 */ new Array( 36/* Expression */,23 , 38/* AddSubExp */,11 , 39/* MulDivExp */,12 , 40/* NegExp */,13 , 41/* Value */,15 ),
	/* State 4 */ new Array( 36/* Expression */,25 , 38/* AddSubExp */,11 , 39/* MulDivExp */,12 , 40/* NegExp */,13 , 41/* Value */,15 ),
	/* State 5 */ new Array( 33/* Stmt */,26 , 36/* Expression */,8 , 38/* AddSubExp */,11 , 39/* MulDivExp */,12 , 40/* NegExp */,13 , 41/* Value */,15 ),
	/* State 6 */ new Array(  ),
	/* State 7 */ new Array(  ),
	/* State 8 */ new Array(  ),
	/* State 9 */ new Array( 34/* Stmt_List */,37 ),
	/* State 10 */ new Array(  ),
	/* State 11 */ new Array(  ),
	/* State 12 */ new Array(  ),
	/* State 13 */ new Array(  ),
	/* State 14 */ new Array( 41/* Value */,42 ),
	/* State 15 */ new Array(  ),
	/* State 16 */ new Array(  ),
	/* State 17 */ new Array(  ),
	/* State 18 */ new Array( 36/* Expression */,43 , 38/* AddSubExp */,11 , 39/* MulDivExp */,12 , 40/* NegExp */,13 , 41/* Value */,15 ),
	/* State 19 */ new Array(  ),
	/* State 20 */ new Array(  ),
	/* State 21 */ new Array(  ),
	/* State 22 */ new Array(  ),
	/* State 23 */ new Array( 33/* Stmt */,47 , 36/* Expression */,8 , 38/* AddSubExp */,11 , 39/* MulDivExp */,12 , 40/* NegExp */,13 , 41/* Value */,15 ),
	/* State 24 */ new Array(  ),
	/* State 25 */ new Array( 33/* Stmt */,48 , 36/* Expression */,8 , 38/* AddSubExp */,11 , 39/* MulDivExp */,12 , 40/* NegExp */,13 , 41/* Value */,15 ),
	/* State 26 */ new Array(  ),
	/* State 27 */ new Array(  ),
	/* State 28 */ new Array( 35/* Param_List */,51 , 36/* Expression */,52 , 38/* AddSubExp */,11 , 39/* MulDivExp */,12 , 40/* NegExp */,13 , 41/* Value */,15 ),
	/* State 29 */ new Array( 36/* Expression */,53 , 38/* AddSubExp */,11 , 39/* MulDivExp */,12 , 40/* NegExp */,13 , 41/* Value */,15 ),
	/* State 30 */ new Array( 38/* AddSubExp */,54 , 39/* MulDivExp */,12 , 40/* NegExp */,13 , 41/* Value */,15 ),
	/* State 31 */ new Array( 38/* AddSubExp */,55 , 39/* MulDivExp */,12 , 40/* NegExp */,13 , 41/* Value */,15 ),
	/* State 32 */ new Array( 38/* AddSubExp */,56 , 39/* MulDivExp */,12 , 40/* NegExp */,13 , 41/* Value */,15 ),
	/* State 33 */ new Array( 38/* AddSubExp */,57 , 39/* MulDivExp */,12 , 40/* NegExp */,13 , 41/* Value */,15 ),
	/* State 34 */ new Array( 38/* AddSubExp */,58 , 39/* MulDivExp */,12 , 40/* NegExp */,13 , 41/* Value */,15 ),
	/* State 35 */ new Array( 38/* AddSubExp */,59 , 39/* MulDivExp */,12 , 40/* NegExp */,13 , 41/* Value */,15 ),
	/* State 36 */ new Array(  ),
	/* State 37 */ new Array( 33/* Stmt */,60 , 36/* Expression */,8 , 38/* AddSubExp */,11 , 39/* MulDivExp */,12 , 40/* NegExp */,13 , 41/* Value */,15 ),
	/* State 38 */ new Array( 39/* MulDivExp */,62 , 40/* NegExp */,13 , 41/* Value */,15 ),
	/* State 39 */ new Array( 39/* MulDivExp */,63 , 40/* NegExp */,13 , 41/* Value */,15 ),
	/* State 40 */ new Array( 40/* NegExp */,64 , 41/* Value */,15 ),
	/* State 41 */ new Array( 40/* NegExp */,65 , 41/* Value */,15 ),
	/* State 42 */ new Array(  ),
	/* State 43 */ new Array(  ),
	/* State 44 */ new Array( 37/* Param_Def_List */,67 ),
	/* State 45 */ new Array(  ),
	/* State 46 */ new Array(  ),
	/* State 47 */ new Array(  ),
	/* State 48 */ new Array(  ),
	/* State 49 */ new Array( 36/* Expression */,72 , 38/* AddSubExp */,11 , 39/* MulDivExp */,12 , 40/* NegExp */,13 , 41/* Value */,15 ),
	/* State 50 */ new Array(  ),
	/* State 51 */ new Array(  ),
	/* State 52 */ new Array(  ),
	/* State 53 */ new Array(  ),
	/* State 54 */ new Array(  ),
	/* State 55 */ new Array(  ),
	/* State 56 */ new Array(  ),
	/* State 57 */ new Array(  ),
	/* State 58 */ new Array(  ),
	/* State 59 */ new Array(  ),
	/* State 60 */ new Array(  ),
	/* State 61 */ new Array(  ),
	/* State 62 */ new Array(  ),
	/* State 63 */ new Array(  ),
	/* State 64 */ new Array(  ),
	/* State 65 */ new Array(  ),
	/* State 66 */ new Array(  ),
	/* State 67 */ new Array(  ),
	/* State 68 */ new Array(  ),
	/* State 69 */ new Array(  ),
	/* State 70 */ new Array(  ),
	/* State 71 */ new Array( 33/* Stmt */,80 , 36/* Expression */,8 , 38/* AddSubExp */,11 , 39/* MulDivExp */,12 , 40/* NegExp */,13 , 41/* Value */,15 ),
	/* State 72 */ new Array(  ),
	/* State 73 */ new Array( 36/* Expression */,82 , 38/* AddSubExp */,11 , 39/* MulDivExp */,12 , 40/* NegExp */,13 , 41/* Value */,15 ),
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
	/* State 84 */ new Array( 34/* Stmt_List */,85 ),
	/* State 85 */ new Array( 33/* Stmt */,60 , 36/* Expression */,8 , 38/* AddSubExp */,11 , 39/* MulDivExp */,12 , 40/* NegExp */,13 , 41/* Value */,15 ),
	/* State 86 */ new Array(  )
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
	"Identifier" /* Terminal symbol */,
	"String" /* Terminal symbol */,
	"Integer" /* Terminal symbol */,
	"Float" /* Terminal symbol */,
	"Program" /* Non-terminal symbol */,
	"Stmt" /* Non-terminal symbol */,
	"Stmt_List" /* Non-terminal symbol */,
	"Param_List" /* Non-terminal symbol */,
	"Expression" /* Non-terminal symbol */,
	"Param_Def_List" /* Non-terminal symbol */,
	"AddSubExp" /* Non-terminal symbol */,
	"MulDivExp" /* Non-terminal symbol */,
	"NegExp" /* Non-terminal symbol */,
	"Value" /* Non-terminal symbol */,
	"$" /* Terminal symbol */
);


    
    info.offset = 0;
    info.src = src;
    info.att = new String();
    
    if( !err_off )
        err_off    = new Array();
    if( !err_la )
    err_la = new Array();
    
    sstack.push( 0 );
    vstack.push( 0 );
    
    la = JXG.JessieCode._lex( info );

    while( true )
    {
        act = 88;
        for( var i = 0; i < act_tab[sstack[sstack.length-1]].length; i+=2 )
        {
            if( act_tab[sstack[sstack.length-1]][i] == la )
            {
                act = act_tab[sstack[sstack.length-1]][i+1];
                break;
            }
        }

        if( JXG.JessieCode._dbg_withtrace && sstack.length > 0 )
        {
            JXG.JessieCode._dbg_print( "\nState " + sstack[sstack.length-1] + "\n" +
                            "\tLookahead: " + labels[la] + " (\"" + info.att + "\")\n" +
                            "\tAction: " + act + "\n" + 
                            "\tSource: \"" + info.src.substr( info.offset, 30 ) + ( ( info.offset + 30 < info.src.length ) ?
                                    "..." : "" ) + "\"\n" +
                            "\tStack: " + sstack.join() + "\n" +
                            "\tValue stack: " + vstack.join() + "\n" );
        }
        
            
        //Panic-mode: Try recovery when parse-error occurs!
        if( act == 88 )
        {
            if( JXG.JessieCode._dbg_withtrace )
                JXG.JessieCode._dbg_print( "Error detected: There is no reduce or shift on the symbol " + labels[la] );
            
            err_cnt++;
            err_off.push( info.offset - info.att.length );            
            err_la.push( new Array() );
            for( var i = 0; i < act_tab[sstack[sstack.length-1]].length; i+=2 )
                err_la[err_la.length-1].push( labels[act_tab[sstack[sstack.length-1]][i]] );
            
            //Remember the original stack!
            var rsstack = new Array();
            var rvstack = new Array();
            for( var i = 0; i < sstack.length; i++ )
            {
                rsstack[i] = sstack[i];
                rvstack[i] = vstack[i];
            }
            
            while( act == 88 && la != 42 )
            {
                if( JXG.JessieCode._dbg_withtrace )
                    JXG.JessieCode._dbg_print( "\tError recovery\n" +
                                    "Current lookahead: " + labels[la] + " (" + info.att + ")\n" +
                                    "Action: " + act + "\n\n" );
                if( la == -1 )
                    info.offset++;
                    
                while( act == 88 && sstack.length > 0 )
                {
                    sstack.pop();
                    vstack.pop();
                    
                    if( sstack.length == 0 )
                        break;
                        
                    act = 88;
                    for( var i = 0; i < act_tab[sstack[sstack.length-1]].length; i+=2 )
                    {
                        if( act_tab[sstack[sstack.length-1]][i] == la )
                        {
                            act = act_tab[sstack[sstack.length-1]][i+1];
                            break;
                        }
                    }
                }
                
                if( act != 88 )
                    break;
                
                for( var i = 0; i < rsstack.length; i++ )
                {
                    sstack.push( rsstack[i] );
                    vstack.push( rvstack[i] );
                }
                
                la = JXG.JessieCode._lex( info );
            }
            
            if( act == 88 )
            {
                if( JXG.JessieCode._dbg_withtrace )
                    JXG.JessieCode._dbg_print( "\tError recovery failed, terminating parse process..." );
                break;
            }


            if( JXG.JessieCode._dbg_withtrace )
                JXG.JessieCode._dbg_print( "\tError recovery succeeded, continuing" );
        }
        
        /*
        if( act == 88 )
            break;
        */
        
        
        //Shift
        if( act > 0 )
        {            
            if( JXG.JessieCode._dbg_withtrace )
                JXG.JessieCode._dbg_print( "Shifting symbol: " + labels[la] + " (" + info.att + ")" );
        
            sstack.push( act );
            vstack.push( info.att );
            
            la = JXG.JessieCode._lex( info );
            
            if( JXG.JessieCode._dbg_withtrace )
                JXG.JessieCode._dbg_print( "\tNew lookahead symbol: " + labels[la] + " (" + info.att + ")" );
        }
        //Reduce
        else
        {        
            act *= -1;
            
            if( JXG.JessieCode._dbg_withtrace )
                JXG.JessieCode._dbg_print( "Reducing by producution: " + act );
            
            rval = void(0);
            
            if( JXG.JessieCode._dbg_withtrace )
                JXG.JessieCode._dbg_print( "\tPerforming semantic action..." );
            
switch( act )
{
	case 0:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 1:
	{
		 JXG.JessieCode.execute( vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 2:
	{
		rval = vstack[ vstack.length - 0 ];
	}
	break;
	case 3:
	{
		 rval = JXG.JessieCode.createNode('node_op', 'op_none', vstack[ vstack.length - 2 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 4:
	{
		rval = vstack[ vstack.length - 0 ];
	}
	break;
	case 5:
	{
		 rval = JXG.JessieCode.createNode('node_op', 'op_paramlst', vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 6:
	{
		 rval = JXG.JessieCode.createNode('node_op', 'op_param', vstack[ vstack.length - 1 ]); 
	}
	break;
	case 7:
	{
		 rval = JXG.JessieCode.createNode('node_op', 'op_paramdeflst', vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 8:
	{
		 rval = JXG.JessieCode.createNode('node_op', 'op_paramdef', vstack[ vstack.length - 1 ]); 
	}
	break;
	case 9:
	{
		rval = vstack[ vstack.length - 0 ];
	}
	break;
	case 10:
	{
		 rval = JXG.JessieCode.createNode('node_op', 'op_if', vstack[ vstack.length - 2 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 11:
	{
		 rval = JXG.JessieCode.createNode('node_op', 'op_if_else', vstack[ vstack.length - 4 ], vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 12:
	{
		 rval = JXG.JessieCode.createNode('node_op', 'op_while', vstack[ vstack.length - 2 ], vstack[ vstack.length - 0 ] ); 
	}
	break;
	case 13:
	{
		 rval = JXG.JessieCode.createNode('node_op', 'op_for', vstack[ vstack.length - 4 ], vstack[ vstack.length - 2 ] ); 
	}
	break;
	case 14:
	{
		 rval = JXG.JessieCode.createNode('node_op', 'op_use', vstack[ vstack.length - 2 ] ); 
	}
	break;
	case 15:
	{
		 rval = JXG.JessieCode.createNode('node_op', 'op_assign', vstack[ vstack.length - 4 ], vstack[ vstack.length - 2 ] ); 
	}
	break;
	case 16:
	{
		 rval = JXG.JessieCode.createNode('node_op', 'op_noassign', vstack[ vstack.length - 2 ] ); 
	}
	break;
	case 17:
	{
		 rval = vstack[ vstack.length - 2 ]; 
	}
	break;
	case 18:
	{
		 rval = JXG.JessieCode.createNode('node_op', 'op_none' ); 
	}
	break;
	case 19:
	{
		 rval = JXG.JessieCode.createNode('node_op', 'op_equ', vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 20:
	{
		 rval = JXG.JessieCode.createNode('node_op', 'op_lot', vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 21:
	{
		 rval = JXG.JessieCode.createNode('node_op', 'op_grt', vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 22:
	{
		 rval = JXG.JessieCode.createNode('node_op', 'op_loe', vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 23:
	{
		 rval = JXG.JessieCode.createNode('node_op', 'op_gre', vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 24:
	{
		 rval = JXG.JessieCode.createNode('node_op', 'op_neq', vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 25:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 26:
	{
		 rval = JXG.JessieCode.createNode('node_op', 'op_sub', vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 27:
	{
		 rval = JXG.JessieCode.createNode('node_op', 'op_add', vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 28:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 29:
	{
		 rval = JXG.JessieCode.createNode('node_op', 'op_mul', vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 30:
	{
		 rval = JXG.JessieCode.createNode('node_op', 'op_div', vstack[ vstack.length - 3 ], vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 31:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 32:
	{
		 rval = JXG.JessieCode.createNode('node_op', 'op_neg', vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 33:
	{
		rval = vstack[ vstack.length - 1 ];
	}
	break;
	case 34:
	{
		 rval = JXG.JessieCode.createNode('node_const', vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 35:
	{
		 rval = JXG.JessieCode.createNode('node_const', vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 36:
	{
		 rval = JXG.JessieCode.createNode('node_var', vstack[ vstack.length - 1 ] ); 
	}
	break;
	case 37:
	{
		 rval = vstack[ vstack.length - 2 ]; 
	}
	break;
	case 38:
	{
		 rval = JXG.JessieCode.createNode('node_str', vstack[ vstack.length - 1 ]); 
	}
	break;
	case 39:
	{
		 rval = JXG.JessieCode.createNode('node_op', 'op_execfun', vstack[ vstack.length - 4 ], vstack[ vstack.length - 2 ]); 
	}
	break;
	case 40:
	{
		 rval = JXG.JessieCode.createNode('node_op', 'op_function', vstack[ vstack.length - 5 ], vstack[ vstack.length - 2 ]); 
	}
	break;
	case 41:
	{
		 rval = JXG.JessieCode.createNode('node_method', 'x', vstack[ vstack.length - 2 ]); 
	}
	break;
	case 42:
	{
		 rval = JXG.JessieCode.createNode('node_method', 'y', vstack[ vstack.length - 2 ]); 
	}
	break;
}



            if( JXG.JessieCode._dbg_withtrace )
                JXG.JessieCode._dbg_print( "\tPopping " + pop_tab[act][1] + " off the stack..." );
                
            for( var i = 0; i < pop_tab[act][1]; i++ )
            {
                sstack.pop();
                vstack.pop();
            }
                                    
            go = -1;
            for( var i = 0; i < goto_tab[sstack[sstack.length-1]].length; i+=2 )
            {
                if( goto_tab[sstack[sstack.length-1]][i] == pop_tab[act][0] )
                {
                    go = goto_tab[sstack[sstack.length-1]][i+1];
                    break;
                }
            }
            
            if( act == 0 )
                break;
                
            if( JXG.JessieCode._dbg_withtrace )
                JXG.JessieCode._dbg_print( "\tPushing non-terminal " + labels[ pop_tab[act][0] ] );
                
            sstack.push( go );
            vstack.push( rval );            
        }
        
        if( JXG.JessieCode._dbg_withtrace )
        {        
            alert( JXG.JessieCode._dbg_string );
            JXG.JessieCode._dbg_string = new String();
        }
    }

    if( JXG.JessieCode._dbg_withtrace )
    {
        JXG.JessieCode._dbg_print( "\nParse complete." );
        alert( JXG.JessieCode._dbg_string );
    }
    
    return err_cnt;
}




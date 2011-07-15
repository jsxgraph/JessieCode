

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
pstack = [[]],
pscope = 0,

// save left-hand-side of variable assignment
lhs = [],

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
    var s;
    for (s = scope; s > -1; s--) {
        if (JXG.exists(sstack[s][vname])) {
            return sstack[s][vname];
        }
    }

    return 0;
};

    return {
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
                            if( node.children[0] )
                                this.execute( node.children[0] );                    
                            if( node.children[1] )
                                ret = this.execute( node.children[1] );
                            break;
                        case 'op_assign':
                            lhs[scope] = node.children[0];
                            letvar( node.children[0], this.execute( node.children[1] ) );
                            lhs[scope] = 0;
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
                                pstack[pscope].push(ret);
                            }
                            break;
                        case 'op_param':
                            if( node.children[0] ) {
                                ret = node.children[0];
                                pstack[pscope].push(ret);
                            }
                            break;
                        case 'op_paramdeflst':
                            if(node.children[0]) {
                                this.execute(node.children[0]);
                            }
                            if(node.children[1]) {
                                ret = node.children[1];
                                pstack[pscope].push(ret);
                            }
                            break;
                        case 'op_paramdef':
                            if( node.children[0] ) {
                                ret = node.children[0];
                                pstack[pscope].push(ret);
                            }
                            break;
                        case 'op_function':
                            pstack.push([]);
                            pscope++;

                            // parse the parameter list
                            // after this, the parameters are in pstack
                            this.execute(node.children[0]);

                            ret = (function(_pstack) { return function() {
                                var r;

                                sstack.push({});
                                scope++;
                                for(r = 0; r < _pstack.length; r++)
                                    sstack[scope][_pstack[r]] = arguments[r];
                                sstack[scope]['result'] = '';

                                JXG.JessieCode.execute(node.children[1]);
                                r = sstack[scope]['result'];
                                sstack.pop();
                                scope--;
                                return r;
                            }; })(pstack[pscope]);
                            pstack.pop();
                            pscope--;
                            break;
                        case 'op_execfun':
                            // node.children:
                            //   [0]: Name of the function
                            //   [1]: Parameter list as a parse subtree
                            var fun, i, parents = [];
                            
                            pstack.push([]);
                            pscope++;
                            
                            // parse the parameter list
                            // after this, the parameters are in pstack
                            this.execute(node.children[1]);
                            
                            // look up the variables name in the variable table
                            fun = getvar(node.children[0]);
                            
                            // check for the function in the variable table
                            if(JXG.exists(fun) && typeof fun === 'function') {
                                for(i = 0; i < pstack[pscope].length; i++) {
                                    parents[i] = this.execute(pstack[pscope][i]);
                                }
                                ret = fun.apply(this, parents);

                            // check for an element with this name
                            } else if (node.children[0] in JXG.JSXGraph.elements) {
                                    for(i = 0; i < pstack[pscope].length; i++) {
                                        if(pstack[pscope][i].type !== 'node_const' && (node.children[0] === 'point' || node.children[0] === 'text')) {
                                            parents[i] = ((function(stree) {
                                                return function() {
                                                    return JXG.JessieCode.execute(stree)
                                                };
                                            })(pstack[pscope][i]));
                                        } else {
                                            parents[i] = (JXG.JessieCode.execute(pstack[pscope][i]));
                                        }
                                    }

                                ret = board.create(node.children[0], parents, {name: (lhs[scope] !== 0 ? lhs[scope] : '')});
                                
                            // nothing found, throw an error
                            // todo: check for a valid identifier and appropriate parameters and create a point
                            //       this resembles the legacy JessieScript behaviour of A(1, 2);
                            } else {
                                _error('Error: Function \'' + node.children[0] + '\' is undefined.');
                            }
                            
                            // clear parameter stack
                            pstack.pop();
                            pscope--;
                            break;
                        case 'op_use':
                            // node.children:
                            //   [0]: A string providing the id of the div the board is in.
                            var found = false;
                            
                            // search all the boards for the one with the appropriate container div
                            for(var b in JXG.JSXGraph.boards) {
                                if(JXG.JSXGraph.boards[b].container === node.children[0].toString()) {
                                    board = JXG.JSXGraph.boards[b];
                                    found = true;
                                }
                            }
                    
                            if(!found)
                                _error('Board \'' + node.children[0].toString() + '\' not found!');
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
                            if(getvar(node.children[0]) === 0) {
                                _error(node.children[0] + ' is undefined.');
                                ret = NaN;
                            } else if(!JXG.exists(getvar(node.children[0]).X)) {
                                _error(node.children[0] + ' has no property \'X\'.');
                                ret = NaN;
                            } else
                                ret = getvar(node.children[0]).X();
                            break;
                        case 'y':
                            if(getvar(node.children[0]) === 0) {
                                _error(node.children[0] + ' is undefined.');
                                ret = NaN;
                            } else if(!JXG.exists(getvar(node.children[0]).Y)) {
                                _error(node.children[0] + ' has no property \'Y\'.');
                                ret = NaN;
                            } else
                                ret = getvar(node.children[0]).Y();
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

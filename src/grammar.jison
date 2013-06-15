/* -- JavaScript code -- */
%{

    var AST = {
        node: function (type, value, children) {
            return {
                type: type,
                value: value,
                children: children
            };
        },

        createNode: function (pos, type, value, children) {
            var i,
                n = this.node(type, value, []);

            for (i = 3; i < arguments.length; i++) {
                n.children.push(arguments[i]);
            }

console.log(type, value, n.children);

            n.line = pos[0];
            n.col = pos[1];

            return n;
        }
    };

    var lc = function (lc1) {
        return [lc1.first_line, lc1.first_column];
    };

%}

/* ----------------------------------------------------------------- */
/*  Grammar definition of JessieCode                                 */
/* ----------------------------------------------------------------- */
/*                                                                   */
/* Copyright 2011-2013                                               */
/*   Michael Gerhaeuser,                                             */
/*   Alfred Wassermann                                               */
/*                                                                   */
/* JessieCode is free software dual licensed under the GNU LGPL or   */
/* MIT License.                                                      */
/*                                                                   */
/* You can redistribute it and/or modify it under the terms of the   */
/*                                                                   */
/*  * GNU Lesser General Public License as published by              */
/*    the Free Software Foundation, either version 3 of the License, */
/*    or (at your option) any later version                          */
/*  OR                                                               */
/*  * MIT License:                                                   */
/*    https://github.com/jsxgraph/jsxgraph/blob/master/LICENSE.MIT   */
/*                                                                   */
/* JessieCode is distributed in the hope that it will be useful,     */
/* but WITHOUT ANY WARRANTY; without even the implied warranty of    */
/* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the     */
/* GNU Lesser General Public License for more details.               */
/*                                                                   */
/* You should have received a copy of the GNU Lesser General Public  */
/* License and the MIT License along with JessieCode. If not, see    */
/* <http://www.gnu.org/licenses/> and                                */
/* <http://opensource.org/licenses/MIT/>.                            */
/*                                                                   */
/* ----------------------------------------------------------------- */

%lex

%x string

%options flex
%%

\s+                                 /* ignore */
[0-9]+\.[0-9]*|[0-9]*\.[0-9]+\b     return 'NUMBER'
[0-9]+                              return 'NUMBER'


"'"                                 this.begin('string');
<string>"'"                         this.popState();
<string>(\\\'|[^'])*                { return 'STRING'; }

\/\/.*                              /* ignore comment */
"/*"(.|\n|\r)*?"*/"                 /* ignore multiline comment */

"if"                                return 'IF'
"else"                              return 'ELSE'
"while"                             return 'WHILE'
"do"                                return 'DO'
"for"                               return 'FOR'
"function"                          return 'FUNCTION'
"use"                               return 'USE'
"return"                            return 'RETURN'
"delete"                            return 'DELETE'
"true"                              return 'TRUE'
"false"                             return 'FALSE'
"<<"                                return '<<'
">>"                                return '>>'
"{"                                 return '{'
"}"                                 return '}'
";"                                 return ';'
"#"                                 return '#'
"?"                                 return '?'
":"                                 return ':'
"NaN"                               return 'NAN'
"."                                 return '.'
"["                                 return '['
"]"                                 return ']'
"("                                 return '('
")"                                 return ')'
"!"                                 return '!'
"^"                                 return '^'
"*"                                 return '*'
"/"                                 return '/'
"%"                                 return '%'
"+"                                 return '+'
"-"                                 return '-'
"<="                                return '<='
"<"                                 return '<'
">="                                return '>='
">"                                 return '>'
"=="                                return '=='
"~="                                return '~='
"!="                                return '!='
"&&"                                return '&&'
"||"                                return '||'
"="                                 return '='
","                                 return ','
<<EOF>>                             return 'EOF'

[A-Za-z_\$][A-Za-z0-9_]*\b          return 'IDENTIFIER'

.                                   return 'INVALID'


/lex

/* operator association and precedence */

// finish undo

/* member access */
%left '.' '[' ']'

/* function call */
%left '(' ')'

/* unary logical */
%right '!'

/* exponentiation */
%right '^'

/* unary minus */
%left NEG

/* multiplication arithmetic */
%left '*' '/' '%'

/* addition arithmetic */
%left '+' '-'

/* relational */
%left '<=' '<' '>=' '>'

/* equality */
%left '==' '~=' '!='

/* logical and */
%left '&&'

/* logical or */
%left '||'

%nonassoc '{' '}'

/* assignment */
%right '='

%right RETURN

%right IF ELSE DO FOR WHILE



/* comma */
%left ','


%start Program
%%

/* language grammar */

Program:  Stmt_List EOF                                                      { return $1; }
        ;

Stmt_List:
        | Stmt                                                               { $$ = $1; }
        | Stmt_List Stmt                                                     { $$ = AST.createNode(lc(@1), 'node_op', 'op_none', $1, $2); }
        ;

Param_List:    Param_List ',' Expression                                     { $$ = AST.createNode(lc(@1), 'node_op', 'op_param', $3, $1); }
        | Expression                                                         { $$ = AST.createNode(lc(@1), 'node_op', 'op_param', $1); }
        |
        ;

Prop_List:     Prop_List ',' Prop                                            { $$ = AST.createNode(lc(@1), 'node_op', 'op_proplst', $1, $3); }
        | Prop                                                               { $$ = $1; }
        |
        ;

Prop:          IDENTIFIER ':' Expression                                     { $$ = AST.createNode(lc(@1), 'node_op', 'op_prop', $1, $3); }
        ;

Param_Def_List:Param_Def_List ',' IDENTIFIER                                 { $$ = AST.createNode(lc(@1), 'node_op', 'op_paramdef', $3, $1); }
        | IDENTIFIER                                                         { $$ = AST.createNode(lc(@1), 'node_op', 'op_paramdef', $1); }
        |
        ;

Attr_List:    Attr_List ',' ExtValue                                         { $$ = AST.createNode(lc(@1), 'node_op', 'op_param', $3, $1); }
        | ExtValue                                                           { $$ = AST.createNode(lc(@1), 'node_op', 'op_param', $1); }
        ;

Assign:       Lhs '=' Expression                                             { $$ = AST.createNode(lc(@1), 'node_op', 'op_assign', $1, $3); }
        ;

Stmt:          IF Expression Stmt                                            { $$ = AST.createNode(lc(@1), 'node_op', 'op_if', $2, $3); }
        | IF Expression Stmt ELSE Stmt                                       { $$ = AST.createNode(lc(@1), 'node_op', 'op_if_else', $2, $3, $5); }
        | WHILE Expression Stmt                                              { $$ = AST.createNode(lc(@1), 'node_op', 'op_while', $2, $3); }
        | DO Stmt WHILE Expression ';'                                       { $$ = AST.createNode(lc(@1), 'node_op', 'op_do', $2, $4); }
        | FOR '(' Assign ';' Expression ';' Assign ')' Stmt                  { $$ = AST.createNode(lc(@1), 'node_op', 'op_for', $3, $5, $7, $9); }
        | USE IDENTIFIER ';'                                                 { $$ = AST.createNode(lc(@1), 'node_op', 'op_use', $2); }
        | DELETE IDENTIFIER                                                  { $$ = AST.createNode(lc(@1), 'node_op', 'op_delete', $2); }
        | RETURN Stmt                                                        { $$ = AST.createNode(lc(@1), 'node_op', 'op_return', $2); }
        | Expression ';'                                                     { $$ = AST.createNode(lc(@1), 'node_op', 'op_noassign', $1); }
        | Lhs '=' Expression ';'                                             { $$ = AST.createNode(lc(@1), 'node_op', 'op_assign', $1, $3); }
        | '{' Stmt_List '}'                                                  { $$ = $2; $$.needsBrackets = true; }
        | ';'                                                                { $$ = AST.createNode(lc(@1), 'node_op', 'op_none'); }
        ;

Lhs:          ExtValue '.' Identifier                                        { $$ = AST.createNode(lc(@1), 'node_op', 'op_lhs', $3, $1, 'dot'); }
        | ExtValue '[' AddSubExp ']'                                         { $$ = AST.createNode(lc(@1), 'node_op', 'op_lhs', $3, $1, 'bracket'); }
        | IDENTIFIER                                                         { $$ = AST.createNode(lc(@1), 'node_op', 'op_lhs', $1); }
        ;

Expression:       Expression '||' CmpExp                                     { $$ = AST.createNode(lc(@1), 'node_op', 'op_or', $1, $3); }
        | Expression '&&' CmpExp                                             { $$ = AST.createNode(lc(@1), 'node_op', 'op_and', $1, $3); }
        | '!' Expression                                                     { $$ = AST.createNode(lc(@1), 'node_op', 'op_not', $2); }
        | CmpExp                                                             { $$ = $1; }
        ;

CmpExp:    CmpExp '==' AddSubExp                                             { $$ = AST.createNode(lc(@1), 'node_op', 'op_equ', $1, $3); }
        | CmpExp '<' AddSubExp                                               { $$ = AST.createNode(lc(@1), 'node_op', 'op_lot', $1, $3); }
        | CmpExp '>' AddSubExp                                               { $$ = AST.createNode(lc(@1), 'node_op', 'op_grt', $1, $3); }
        | CmpExp '<=' AddSubExp                                              { $$ = AST.createNode(lc(@1), 'node_op', 'op_loe', $1, $3); }
        | CmpExp '>=' AddSubExp                                              { $$ = AST.createNode(lc(@1), 'node_op', 'op_gre', $1, $3); }
        | CmpExp '!=' AddSubExp                                              { $$ = AST.createNode(lc(@1), 'node_op', 'op_neq', $1, $3); }
        | CmpExp '~=' AddSubExp                                              { $$ = AST.createNode(lc(@1), 'node_op', 'op_approx', $1, $3); }
        | CmpExp '?' Value ':' Value                                         { $$ = AST.createNode(lc(@1), 'node_op', 'op_conditional', $1, $3, $5); }
        | AddSubExp                                                          { $$ = $1; }
        ;

AddSubExp:    AddSubExp '-' MulDivExp                                        { $$ = AST.createNode(lc(@1), 'node_op', 'op_sub', $1, $3); }
        | AddSubExp '+' MulDivExp                                            { $$ = AST.createNode(lc(@1), 'node_op', 'op_add', $1, $3); }
        | MulDivExp                                                          { $$ = $1; }
        ;

MulDivExp:    MulDivExp '*' NegExp                                           { $$ = AST.createNode(lc(@1), 'node_op', 'op_mul', $1, $3); }
        | MulDivExp '/' NegExp                                               { $$ = AST.createNode(lc(@1), 'node_op', 'op_div', $1, $3); }
        | MulDivExp '%' NegExp                                               { $$ = AST.createNode(lc(@1), 'node_op', 'op_mod', $1, $3); }
        | NegExp                                                             { $$ = $1; }
        ;

ExpExp:      ExtValue '^' ExpExp                                             { $$ = AST.createNode(lc(@1), 'node_op', 'op_exp', $1, $3); }
        | ExtValue                                                           { $$ = $1; }
        ;

NegExp:        '-' ExpExp    %prec NEG                                       { $$ = AST.createNode(lc(@1), 'node_op', 'op_neg', $2); }
        | '+' ExpExp         %prec NEG                                       { $$ = $2; }
        | ExpExp                                                             { $$ = $1; }
        ;

ExtValue:      ExtValue '[' AddSubExp ']'                                    { $$ = AST.createNode(lc(@1), 'node_op', 'op_extvalue', $1, $3); }
        | ExtValue '(' Param_List ')' '[' AddSubExp ']'                      { $$ = AST.createNode(lc(@1), 'node_op', 'op_extvalue', AST.createNode(lc(@1), 'node_op', 'op_execfun', $1, $3), $6); }
        | ExtValue '(' Param_List ')'                                        { $$ = AST.createNode(lc(@1), 'node_op', 'op_execfun', $1, $3); }
        | ExtValue '(' Param_List ')' Attr_List                              { $$ = AST.createNode(lc(@1), 'node_op', 'op_execfun', $1, $3, $5, true); }
        | ExtValue '.' IDENTIFIER                                            { $$ = AST.createNode(lc(@1), 'node_op', 'op_property', $1, $3); }
        | Value                                                              { $$ = $1; }
        ;

Value:        NUMBER                                                         { $$ = AST.createNode(lc(@1), 'node_const', parseFloat($1)); }
        | IDENTIFIER                                                         { $$ = AST.createNode(lc(@1), 'node_var', $1); }
        | '(' Expression ')'                                                 { $$ = $2; }
        | STRING                                                             { $$ = AST.createNode(lc(@1), 'node_str', $1); }
        | FUNCTION '(' Param_Def_List ')' '{' Stmt_List '}'                  { $$ = AST.createNode(lc(@1), 'node_op', 'op_function', $3, $6); }
        | '<<' Prop_List '>>'                                                { $$ = AST.createNode(lc(@1), 'node_op', 'op_proplst_val', $2); }
        | '[' Param_List ']'                                                 { $$ = AST.createNode(lc(@1), 'node_op', 'op_array', $2); }
        | TRUE                                                               { $$ = AST.createNode(lc(@1), 'node_const_bool', $1); }
        | FALSE                                                              { $$ = AST.createNode(lc(@1), 'node_const_bool', $1); }
        | NAN                                                                { $$ = AST.createNode(lc(@1), 'node_const', NaN); }
        ;



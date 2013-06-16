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
"null"                              return 'NULL'
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


%start Program
%%

/* language grammar */

Program
    : StatementList EOF                                                     { return $1; }
    ;

IfStatement
    : "IF" "(" Expression ")" Statement                                     { $$ = AST.createNode(lc(@1), 'node_op', 'op_if', $3, $5); }
    | "IF" "(" Expression ")" Statement "ELSE" Statement                    { $$ = AST.createNode(lc(@1), 'node_op', 'op_if_else', $3, $5, $7); }
    ;

LoopStatement
    : "WHILE" "(" Expression ")" Statement                                  { $$ = AST.createNode(lc(@1), 'node_op', 'op_while', $3, $5); }
    | "FOR" "(" Expression ";" Expression ";" Expression ")" Statement      { $$ = AST.createNode(lc(@1), 'node_op', 'op_for', $3, $5, $7, $9); }
    | "DO" Statement "WHILE" "(" Expression ")" ";"                         { $$ = AST.createNode(lc(@1), 'node_op', 'op_do', $2, $5); }
    ;

UnaryStatement
    : "USE" "IDENTIFIER"                                                    { $$ = AST.createNode(lc(@1), 'node_op', 'op_use', $2); }
    | "DELETE" "IDENTIFIER"                                                 { $$ = AST.createNode(lc(@1), 'node_op', 'op_delete', $2); }
    ;

ReturnStatement
    : "RETURN" ";"                                                          { $$ = AST.createNode(lc(@1), 'node_op', 'op_return', undefined); }
    | "RETURN" Expression ";"                                               { $$ = AST.createNode(lc(@1), 'node_op', 'op_return', $2); }
    ;

EmptyStatement
    : ";"                                                                   { $$ = AST.createNode(lc(@1), 'node_op', 'op_none'); }
    ;

StatementBlock
    : "{" StatementList "}"                                                 { $$ = $2; $$.needsBrackets = true; }
    ;

StatementList
    : StatementList Statement                                               { $$ = AST.createNode(lc(@1), 'node_op', 'op_none', $1, $2); }
    |
    ;

Statement
    : StatementBlock                                                        { $$ = $1; }
    | IfStatement                                                           { $$ = $1; }
    | LoopStatement                                                         { $$ = $1; }
    | UnaryStatement                                                        { $$ = $1; }
    | ReturnStatement                                                       { $$ = $1; }
    | ExpressionStatement                                                   { $$ = $1; }
    | EmptyStatement                                                        { $$ = $1; }
    ;

ExpressionStatement
    : Expression ";"                                                        { $$ = $1; }
    ;

Expression
    : AssignmentExpression                                                  { $$ = $1; }
    | Expression "," AssignmentExpression                                   { $$ = AST.createNode(lc(@1), 'node_op', 'op_none', $1, $3); }
    ;

AssignmentExpression
    : ConditionalExpression                                                 { $$ = $1; }
    | LeftHandSideExpression "=" AssignmentExpression                       { $$ = AST.createNode(lc(@1), 'node_op', 'op_assign', $1, $3); }
    /* TODO: Implement special assignment operators like +=, -=, ... */
    ;

ConditionalExpression
    : LogicalORExpression                                                   { $$ = $1; }
    | LogicalORExpression "?" AssignmentExpression ":" AssignmentExpression { $$ = AST.createNode(lc(@1), 'node_op', 'op_conditional', $1, $3, $5); }
    ;

LogicalORExpression
    : LogicalANDExpression                                                  { $$ = $1; }
    | LogicalORExpression "||" LogicalANDExpression                         { $$ = AST.createNode(lc(@1), 'node_op', 'op_or', $1, $3); }
    ;

LogicalANDExpression
    : EqualityExpression                                                    { $$ = $1; }
    | LogicalANDExpression "&&" EqualityExpression                          { $$ = AST.createNode(lc(@1), 'node_op', 'op_and', $1, $3); }
    ;

EqualityExpression
    : RelationalExpression                                                  { $$ = $1; }
    | EqualityExpression "==" RelationalExpression                          { $$ = AST.createNode(lc(@1), 'node_op', 'op_equ', $1, $3); }
    | EqualityExpression "!=" RelationalExpression                          { $$ = AST.createNode(lc(@1), 'node_op', 'op_neq', $1, $3); }
    | EqualityExpression "~=" RelationalExpression                          { $$ = AST.createNode(lc(@1), 'node_op', 'op_approx', $1, $3); }
    ;

RelationalExpression
    : AdditiveExpression                                                    { $$ = $1; }
    | RelationalExpression "<" AdditiveExpression                           { $$ = AST.createNode(lc(@1), 'node_op', 'op_lot', $1, $3); }
    | RelationalExpression ">" AdditiveExpression                           { $$ = AST.createNode(lc(@1), 'node_op', 'op_grt', $1, $3); }
    | RelationalExpression "<=" AdditiveExpression                          { $$ = AST.createNode(lc(@1), 'node_op', 'op_loe', $1, $3); }
    | RelationalExpression ">=" AdditiveExpression                          { $$ = AST.createNode(lc(@1), 'node_op', 'op_gre', $1, $3); }
    ;

AdditiveExpression
    : MultiplicativeExpression                                              { $$ = $1; }
    | AdditiveExpression "+" MultiplicativeExpression                       { $$ = AST.createNode(lc(@1), 'node_op', 'op_add', $1, $3); }
    | AdditiveExpression "-" MultiplicativeExpression                       { $$ = AST.createNode(lc(@1), 'node_op', 'op_sub', $1, $3); }
    ;

MultiplicativeExpression
    : ExponentExpression                                                    { $$ = $1; }
    | MultiplicativeExpression "*" ExponentExpression                       { $$ = AST.createNode(lc(@1), 'node_op', 'op_mul', $1, $3); }
    | MultiplicativeExpression "/" ExponentExpression                       { $$ = AST.createNode(lc(@1), 'node_op', 'op_div', $1, $3); }
    | MultiplicativeExpression "%" ExponentExpression                       { $$ = AST.createNode(lc(@1), 'node_op', 'op_mod', $1, $3); }
    ;

ExponentExpression
    : UnaryExpression                                                       { $$ = $1; }
    | UnaryExpression "^" ExponentExpression                                { $$ = AST.createNode(lc(@1), 'node_op', 'op_exp', $1, $3); }
    ;

UnaryExpression
    : LeftHandSideExpression                                                { $$ = $1; }
    | "!" UnaryExpression                                                   { $$ = AST.createNode(lc(@1), 'node_op', 'op_not', $2); }
    | "+" UnaryExpression               %prec NEG                           { $$ = $2; }
    | "-" UnaryExpression               %prec NEG                           { $$ = $2; }
    ;

LeftHandSideExpression
    : MemberExpression
    | CallExpression
    ;

MemberExpression
    : PrimaryExpression                                                     { $$ = $1; }
    | FunctionExpression                                                    { $$ = $1; }
    | MemberExpression "." "IDENTIFIER"                                     { $$ = AST.createNode(lc(@1), 'node_op', 'op_property', $1, $3); }
    | MemberExpression "[" Expression "]"                                   { $$ = AST.createNode(lc(@1), 'node_op', 'op_extvalue', $1, $3); }
    ;

PrimaryExpression
    : "IDENTIFIER"                                                          { $$ = $$ = AST.createNode(lc(@1), 'node_var', $1); }
    | BasicLiteral                                                          { $$ = $1; }
    | ObjectLiteral                                                         { $$ = $1; }
    | ArrayLiteral                                                          { $$ = $1; }
    | "(" Expression ")"                                                    { $$ = $2; }
    ;

BasicLiteral
    : NullLiteral                                                           { $$ = $1; }
    | BooleanLiteral                                                        { $$ = $1; }
    | StringLiteral                                                         { $$ = $1; }
    | NumberLiteral                                                         { $$ = $1; }
    ;

NullLiteral
    : "NULL"                                                                { $$ = AST.createNode(lc(@1), 'node_const', null); }
    ;

BooleanLiteral
    : "TRUE"                                                                { $$ = AST.createNode(lc(@1), 'node_const_bool', true); }
    | "FALSE"                                                               { $$ = AST.createNode(lc(@1), 'node_const_bool', false); }
    ;

StringLiteral
    : "STRING"                                                              { $$ = AST.createNode(lc(@1), 'node_str', $1); }
    ;

NumberLiteral
    : "NUMBER"                                                              { $$ = AST.createNode(lc(@1), 'node_const', parseFloat($1)); }
    | "NAN"                                                                 { $$ = AST.createNode(lc(@1), 'node_const', NaN); }
    ;

ArrayLiteral
    : "[" "]"                                                               { $$ = AST.createNode(lc(@1), 'node_op', 'op_array', []); }
    | "[" ElementList "]"                                                   { $$ = AST.createNode(lc(@1), 'node_op', 'op_array', $2); }
    ;

ObjectLiteral
    : "<<" ">>"                                                             { $$ = AST.createNode(lc(@1), 'node_op', 'op_emptyobject', {}); }
    | "<<" PropertyList ">>"                                                { $$ = AST.createNode(lc(@1), 'node_op', 'op_proplst_val', $2); }
    ;

PropertyList
    : Property                                                              { $$ = $1; }
    | PropertyList "," Property                                             { $$ = AST.createNode(lc(@1), 'node_op', 'op_proplst', $1, $3); }
    ;

Property
    : PropertyName ":" AssignmentExpression                                 { $$ = AST.createNode(lc(@1), 'node_op', 'op_prop', $1, $3); }
    ;

PropertyName
    : "IDENTIFIER"                                                          { $$ = $1; }
    | StringLiteral                                                         { $$ = $1; }
    | NumberLiteral                                                         { $$ = $1; }
    ;

CallExpression
    : MemberExpression Arguments                                            { $$ = AST.createNode(lc(@1), 'node_op', 'op_execfun', $1, $2); }
    | MemberExpression Arguments ElementList                                { $$ = AST.createNode(lc(@1), 'node_op', 'op_execfun', $1, $2, $3, true); }
    | CallExpression Arguments                                              { $$ = AST.createNode(lc(@1), 'node_op', 'op_execfun', $1, $2); }
    | CallExpression "[" Expression "]"                                     { $$ = AST.createNode(lc(@1), 'node_op', 'op_extvalue', $1, $3); }
    | CallExpression "." "IDENTIFIER"                                       { $$ = AST.createNode(lc(@1), 'node_op', 'op_property', $1, $3); }
    ;

Arguments
    : "(" ")"                                                               { $$ = []; }
    | "(" ElementList ")"                                                   { $$ = $2; }
    ;

ElementList
    : AssignmentExpression                                                  { $$ = [$1]; }
    | ElementList "," AssignmentExpression                                  { $$ = $1.concat($3); }
    ;
FunctionExpression
    : "FUNCTION" "(" ")" StatementBlock                                     { $$ = AST.createNode(lc(@1), 'node_op', 'op_function', null, $4); }
    | "FUNCTION" "(" ParameterDefinitionList ")" StatementBlock             { $$ = AST.createNode(lc(@1), 'node_op', 'op_function', $3, $5); }
    ;

ParameterDefinitionList
    : IDENTIFIER                                                            { $$ = AST.createNode(lc(@1), 'node_op', 'op_paramdef', $1); }
    | ParameterDefinitionList "," "IDENTIFIER"                              { $$ = AST.createNode(lc(@1), 'node_op', 'op_paramdef', $3, $1); }
    ;

/* previously the noassign node was expressions without assignment */
/* { $$ = AST.createNode(lc(@1), 'node_op', 'op_noassign', $1); } */


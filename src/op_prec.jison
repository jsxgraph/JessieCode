/* operator association and precedence */

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


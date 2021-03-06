/*
    Copyright 2011-2012
        Michael Gerhaeuser,
        Alfred Wassermann,

*/

/*
 *  Js-Test-Driver Test Suite for Generic JavaScript language tests
 *  http://code.google.com/p/js-test-driver
 */

TestCase("Arithmetic", {
    jc: null,

    setUp: function () {
        this.jc = new JXG.JessieCode();
    },

    tearDown: function () {
        this.jc = null;
    },

    testFloat: function () {
        expectAsserts(2);

        try {
            this.jc.parse('\
                a = 1;     \
                b = 1.5;   \
            ');
        } catch (e) {
            console.log(e);
        }

        assertEquals('int', 1, this.jc.scope.locals.a);
        assertEquals('float', 1.5, this.jc.scope.locals.b);
    },

    testAdd: function () {
        expectAsserts(7);

        try {
            this.jc.parse(
                'a = +1;'+
                'b = 1+1;'+

                'c = [1, 2] + [3, 4];'+
                's = \'hello\';' +
                'r = s + \' world\';' +
                't = s + b;'
            );
        } catch (e) {
            console.log(e);
        }

        assertEquals('unary add', 1, this.jc.scope.locals.a);
        assertEquals('binary add', 2, this.jc.scope.locals.b);
        assertEquals('vector add returns array', 2, this.jc.scope.locals.c.length);
        assertEquals('vector add result 0', 4, this.jc.scope.locals.c[0]);
        assertEquals('vector add result 1', 6, this.jc.scope.locals.c[1]);
        assertEquals('string/string add', 'hello world', this.jc.scope.locals.r);
        assertEquals('string/number add', 'hello2', this.jc.scope.locals.t);
    },

    testSub: function () {
        expectAsserts(7);

        try {
            this.jc.parse(
                'a = -1;'+
                'b = 1-1;' +
                'd = 1--1;' +
                'e = 1---1;'+

                'c = [3, 4] - [1, 2];');

        } catch (e) {
            console.log(e);
        }

        assertEquals('unary minus', -1, this.jc.scope.locals.a);
        assertEquals('subtraction', 0, this.jc.scope.locals.b);
        assertEquals('vector sub returns array', 2, this.jc.scope.locals.c.length);
        assertEquals('vector sub result 0', 2, this.jc.scope.locals.c[0]);
        assertEquals('vector sub result 1', 2, this.jc.scope.locals.c[1]);
        assertEquals('double minus result', 2, this.jc.scope.locals.d);
        assertEquals('double minus result', 0, this.jc.scope.locals.e);
    },

    testMul: function () {
         expectAsserts(6);

        try {
            this.jc.parse(
                'a = 1*2;'+
                'b = 3*-4;'+
                'c = -3*-2;'+

                'd = 3*[1, 2];'+
                'e = [1, 2]*[3, 4];');
        } catch (e) {
            console.log(e);
        }

        assertEquals('multiplication', 2, this.jc.scope.locals.a);
        assertEquals('multiplication with sign change', -12, this.jc.scope.locals.b);
        assertEquals('multiplication with double sign change', 6, this.jc.scope.locals.c);
        assertEquals('multiplication array result 0', 3, this.jc.scope.locals.d[0]);
        assertEquals('multiplication array result 1', 6, this.jc.scope.locals.d[1]);
        assertEquals('scalar product', 11, this.jc.scope.locals.e);
    },

    testDiv: function () {
        expectAsserts(6);

        try {
            this.jc.parse(
                'a = 1/2;'+
                'b = 12/4;'+
                'c = 4/-2;'+
                'd = -6/-4;'+

                'e = [4, 6] / 2;');
        } catch (e) {
            console.log(e);
        }

        assertEquals('float division', 0.5, this.jc.scope.locals.a);
        assertEquals('integer division', 3, this.jc.scope.locals.b);
        assertEquals('division with sign change', -2, this.jc.scope.locals.c);
        assertEquals('division with double sign change', 1.5, this.jc.scope.locals.d);
        assertEquals('div array result 0', 2, this.jc.scope.locals.e[0]);
        assertEquals('div array result 1', 3, this.jc.scope.locals.e[1]);
    },

    testMod: function () {
        expectAsserts(5);

        try {
            this.jc.parse(
                'a = 1%2;'+
                'b = 12%4;'+
                'c = 9%-4;'+

                'd = [3, 4] % 2;');
        } catch (e) {
            console.log(e);
        }

        assertEquals('mod#1', 1, this.jc.scope.locals.a);
        assertEquals('mod#2', 0, this.jc.scope.locals.b);
        // assure the mathematical mod is used, not the symmetric
        assertEquals('mod#3', -3, this.jc.scope.locals.c);

        assertEquals('mod vector 0', 1, this.jc.scope.locals.d[0]);
        assertEquals('mod vector 1', 0, this.jc.scope.locals.d[1]);
    },

    testPow: function () {
        expectAsserts(5);

        try {
            this.jc.parse('\
                a = 2^3;   \
                b = -2^3;  \
                c = 2^-3;  \
                d = 2^3^2; \
                e = -2^2;\
                2^3;\
            ');
        } catch (e) {
            console.log(e);
        }

        assertEquals('pow', 8, this.jc.scope.locals.a);
        assertEquals('neg pow with base', -8, this.jc.scope.locals.b);
        assertEquals('pow with neg exp', 1/8, this.jc.scope.locals.c);
        assertEquals('pow associativity', 512, this.jc.scope.locals.d);
        assertEquals('pow -2^2', -4, this.jc.scope.locals.e);
    },

    testPrecedence: function () {
        expectAsserts(7);

        try {
            this.jc.parse(
                'a = 3*4+5;'+
                'b = 7-2*3+4;'+
                'c = 2^3*4;'+
                'd = 4^3^2;');
        } catch (e) {
            console.log(e);
        }

        assertEquals('mul vs add', 17, this.jc.scope.locals.a);
        assertEquals('mul vs sub and add', 5, this.jc.scope.locals.b);
        assertEquals('pow vs mul', 32, this.jc.scope.locals.c);
        assertEquals('pow precedence order', 262144, this.jc.scope.locals.d);

        try {
            this.jc.parse('  \
                a = 3*(4+5); \
                b = (4^3)^2; \
                c = (-2)^3;  \
            ');
        } catch (e) {
            console.log(e);
        }

        assertEquals('caged add', 27, this.jc.scope.locals.a);
        assertEquals('change precedence of pow', 4096, this.jc.scope.locals.b);
        assertEquals('pow with neg base', -8, this.jc.scope.locals.c);
    },

    testUnaryMinus: function () {
        expectAsserts(1);

        try {
            this.jc.parse('y = -2^4;');
        } catch (e) {
            console.log(e);
        }

        assertEquals('unary minus test -x^n', -16, this.jc.scope.locals.y);
    }

});

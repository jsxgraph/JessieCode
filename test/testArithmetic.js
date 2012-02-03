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

        assertEquals('int', 1, this.jc.sstack[0].a);
        assertEquals('float', 1.5, this.jc.sstack[0].b);
    },

    testAdd: function () {
        expectAsserts(2);

        try {
            this.jc.parse('\
                a = +1;    \
                b = 1+1;   \
            ');
        } catch (e) {
            console.log(e);
        }

        assertEquals('unary add', 1, this.jc.sstack[0].a);
        assertEquals('binary add', 2, this.jc.sstack[0].b);
    },

    testSub: function () {
        expectAsserts(2);

        try {
            this.jc.parse('\
                a = -1;    \
                b = 1-1;   \
            ');

        } catch (e) {
            console.log(e);
        }

        assertEquals('unary minus', -1, this.jc.sstack[0].a);
        assertEquals('subtraction', 0, this.jc.sstack[0].b);
    },

    testMul: function () {
         expectAsserts(3);

        try {
            this.jc.parse('\
                a = 1*2;   \
                b = 3*-4;  \
                c = -3*-2; \
            ');
        } catch (e) {
            console.log(e);
        }

        assertEquals('multiplication', 2, this.jc.sstack[0].a);
        assertEquals('multiplication with sign change', -12, this.jc.sstack[0].b);
        assertEquals('multiplication with double sign change', 6, this.jc.sstack[0].c);
    },

    testDiv: function () {
        expectAsserts(4);

        try {
            this.jc.parse('\
                a = 1/2;   \
                b = 12/4;  \
                c = 4/-2;  \
                d = -6/-4; \
            ');
        } catch (e) {
            console.log(e);
        }

        assertEquals('float division', 0.5, this.jc.sstack[0].a);
        assertEquals('integer division', 3, this.jc.sstack[0].b);
        assertEquals('division with sign change', -2, this.jc.sstack[0].c);
        assertEquals('division with double sign change', 1.5, this.jc.sstack[0].d);
    },

    testMod: function () {
        expectAsserts(3);

        try {
            this.jc.parse('\
                a = 1%2;   \
                b = 12%4;  \
                c = 9%-4;  \
            ');
        } catch (e) {
            console.log(e);
        }

        assertEquals('mod#1', 1, this.jc.sstack[0].a);
        assertEquals('mod#2', 0, this.jc.sstack[0].b);
        // assure the mathematical mod is used, not the symmetric
        assertEquals('mod#3', -3, this.jc.sstack[0].c);
    },

    testPow: function () {
        expectAsserts(3);

        try {
            this.jc.parse('\
                a = 2^3;   \
                b = -2^3;  \
                c = 2^-3;  \
            ');
        } catch (e) {
            console.log(e);
        }

        assertEquals('pow', 8, this.jc.sstack[0].a);
        assertEquals('neg pow with base', -8, this.jc.sstack[0].b);
        assertEquals('pow with neg exp', 1/8, this.jc.sstack[0].c);
    },

    testPrecedence: function () {
        expectAsserts(7);

        try {
            this.jc.parse('  \
                a = 3*4+5;   \
                b = 7-2*3+4; \
                c = 2^3*4;   \
                d = 4^3^2;   \
            ');
        } catch (e) {
            console.log(e);
        }

        assertEquals('mul vs add', 17, this.jc.sstack[0].a);
        assertEquals('mul vs sub and add', 5, this.jc.sstack[0].b);
        assertEquals('pow vs mul', 32, this.jc.sstack[0].c);
        assertEquals('pow precedence order', 262144, this.jc.sstack[0].d);

        try {
            this.jc.parse('  \
                a = 3*(4+5); \
                b = (4^3)^2; \
                c = (-2)^3;  \
            ');
        } catch (e) {
            console.log(e);
        }

        assertEquals('caged add', 27, this.jc.sstack[0].a);
        assertEquals('change precedence of pow', 4096, this.jc.sstack[0].b);
        assertEquals('pow with neg base', -8, this.jc.sstack[0].c);
    }

});
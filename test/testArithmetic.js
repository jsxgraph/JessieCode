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

    testAdd: function () {
        expectAsserts(2);

        try {
            this.jc.parse('a = +1; b = 1+1;');
        } catch (e) {
            console.log(e);
        }

        assertEquals('unary add', 1, this.jc.sstack[0].a);
        assertEquals('binary add', 2, this.jc.sstack[0].b);
    }

});
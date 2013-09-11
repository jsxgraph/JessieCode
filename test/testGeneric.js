/*
    Copyright 2011-2012
        Michael Gerhaeuser,
        Alfred Wassermann,

*/

/*
 *  Js-Test-Driver Test Suite for Generic JavaScript language tests
 *  http://code.google.com/p/js-test-driver
 */

TestCase("Generic", {
    setUp: function () {
        abcdefg = 0
    },

    tearDown: function () {
        abcdefg = 0;
    },

    testEval: function () {
        expectAsserts(2);

        var f = (function () {
            var foo = 'bar';

            return eval('var abcdefg = function () { return foo; }; abcdefg;');
        })();

        assertEquals('return value is ok', 'bar', f());
        assertEquals('global variables are not introduced', 0, abcdefg);
    }

});

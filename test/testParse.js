/*
    Copyright 2011-2012
        Michael Gerhaeuser,
        Alfred Wassermann,

*/

/*
 *  Js-Test-Driver Test Suite for Generic JavaScript language tests
 *  http://code.google.com/p/js-test-driver
 */

TestCase('Parser', {
    jc: null,

    setUp: function () {
        this.jc = new JXG.JessieCode();
    },

    tearDown: function () {
        this.jc = null;
    },

    testParse: function () {
        var f = [
            'function (x) { return ((((x + 3)^2) - 4.5) - 1.5); }',
            'function (x) { return (sin((2^(x - 1))) + PI); }',
        ], i, parsed;

        expectAsserts(f.length);

        for (i = 0; i < f.length; i++) {
            try {
                parsed = this.jc.parse(f[i] + ';');
                parsed = parsed.toString().replaceAll('\n', '').trim();
            } catch (e) {
                console.log(e);
            }
            assertEquals('parse function ' + i, f[i], parsed);
        }
    },

    testMinParentheses: function () {
        var f = [
            'function (x) { return (x + 3)^2 - 4.5 - 1.5; }',
            'function (x) { return sin(2^(x - 1)) + PI; }',
        ], i, parsed;

        expectAsserts(f.length * 2);

        for (i = 0; i < f.length; i++) {
            try {
                parsed = this.jc.minParentheses(f[i] + ';');
                parsed = parsed.toString().replaceAll('\n', '').trim();
            } catch (e) {
                console.log(e);
            }
            assertEquals('minParentheses function ' + i, f[i], parsed);

            try {
                parsed = this.jc.parse(f[i] + ';');
                parsed = parsed.toString().replaceAll('\n', '').trim();
            } catch (e) {
                console.log(e);
            }
            assertNotEquals('not minParentheses function ' + i, f[i], parsed); // parsed should contain more parentheses
        }
    },

});

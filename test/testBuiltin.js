/*
    Copyright 2011-2022
        Michael Gerhaeuser,
        Alfred Wassermann,

*/

/*
 *  Js-Test-Driver Test Suite for Generic JavaScript language tests
 *  http://code.google.com/p/js-test-driver
 */

TestCase("Builtin", {
    jc: null,

    setUp: function () {
        try {
            document.getElementsByTagName('body')[0].innerHTML = '<div id="jxgbox" style="width: 100px; height: 100px;"></div>';
            this.board = JXG.JSXGraph.initBoard('jxgbox', {axis: false, grid: false, boundingbox: [-5, 5, 5, -5], showCopyright: false, showNavigation: false});
        } catch (e) {
            console.log(e);
        }
    },

    tearDown: function () {
        JXG.JSXGraph.freeBoard(this.board);
    },

    testRemove: function () {
        expectAsserts(1);

        try {
            this.board.jc.parse(
                'a = point(1, 1);' +
                    'b = point(1, 1) <<id: \'ID\'>>;' +
                    'c = point(1, 1) <<name: \'NAME\'>>;' +
                    'remove(a);' +
                    'remove(ID);' +
                    'remove(NAME);'
            );
        } catch (e) {
            console.log(e);
        }

        assertEquals('delete point a', 1, this.board.objectsList.length);
    }

});

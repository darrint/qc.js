// Copyright (c) 2009, Darrin Thompson

// Some self checks for our generators.

declare("randWhole", [justSize()],
        function(c, a) {
            var result = randWhole(a);
            c.noteArg(result);
            c.assert(result < a || result == 0);
        });

declare("randWhole nonzero", [justSize()],
        function(c, a) {
            c.guard(a > 10);
            var result = randWhole(a);
            c.noteArg(result);
            c.guard(result > 0);
        });

declare("randWhole zero result", [justSize()],
        function(c, a) {
            var result = randWhole(a);
            c.noteArg(result);
            c.guard(result == 0);
        });

declare("randInt show positive", [arbWholeNum()],
        function(c, a) {
            var result = randInt(a);
            c.noteArg(result);
            c.guard(result > 0);
        });

declare("randInt show negative", [arbWholeNum()],
        function(c, a) {
            var result = randInt(a);
            c.noteArg(result);
            c.guard(result < 0);
        });

declare("randInt zero result", [arbWholeNum()],
        function(c, a) {
            c.guard(a > 0);
            var result = randInt(a);
            c.noteArg(result);
            c.guard(result == 0);
        });

declare("randRange between", [arbInt(), arbInt()],
        function(c, a, b) {
            c.guard(a < b);
            var result = randRange(a, b);
            c.noteArg(result);
            c.assert(a <= result);
            c.assert(b > result);
        });

declare("randRange between backwards", [arbInt(), arbInt()],
        function(c, a, b) {
            c.guard(b < a);
            var result = randRange(a, b);
            c.noteArg(result);
            c.assert(b <= result);
            c.assert(a > result);
        });

declare("randRange equal", [arbInt()],
        function(c, a, b) {
            var result = randRange(a, a);
            c.assert(a == result);
        });


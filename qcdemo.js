// Copyright (c) 2009, Darrin Thompson

// tiny incomplete demo of how to use...

function arbWholeNumList() {
    return arbList(arbWholeNum());
}

declare("reverse", [arbWholeNumList(), arbWholeNumList()],
        function(c, x, y) {
            var z = x.concat(y);
            x.reverse();
            y.reverse();
            z.reverse();
            c.assert(z.toString() == y.concat(x).toString());
        });

var config = new Config(100, 1000, {});

// See also runqc.html for how to invoke this in a browser.

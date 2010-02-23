// Copyright (c) 2009, Darrin Thompson

// Tiny javascript quickcheck port.

var allProps = [];

function Prop(name, gens, body) {
    this.name = name;
    this.gens = gens;
    this.body = body;
}

function Invalid(prop, counts) {
    this.status = "invalid";
    this.prop = prop;
    this.counts = counts;
    this.name = prop.name;
}

Invalid.prototype.toString = function () {
    return "Invalid (" + this.name + ") counts=" + this.counts;
}

function Pass(prop, counts) {
    this.status = "pass";
    this.prop = prop;
    this.counts = counts;
    this.name = prop.name;
}

Pass.prototype.toString = function () {
    return "Pass (" + this.name + ") counts=" + this.counts;
}

function Fail(prop, counts, failedCase) {
    this.status = "fail";
    this.prop = prop;
    this.counts = counts;
    this.failedCase = failedCase;
    this.name = prop.name;
}

Fail.prototype.toString = function () {
    return "Fail (" + this.name + ") counts=" + this.counts + "\n" +
           "    failedCase: " + this.failedCase;
}

function Counts(pass, invalid, classes) {
    this.pass = pass;
    this.invalid = invalid;
    this.classes = classes;
}

Counts.prototype.incInvalid = function () { 
    this.invalid += 1; 
};

Counts.prototype.incPass = function () { 
    this.pass += 1; 
};

Counts.prototype.newResult = function (prop) {
    if (this.pass > 0) {
        return new Pass(prop, this);
    } else {
        return new Invalid(prop, this);
    }
};

Counts.prototype.toString = function () {
    return "(pass=" + this.pass + ", invalid=" + this.invalid + ")";
}

function declare(name, gens, body) {
    var theProp = new Prop(name, gens, body);
    allProps.push(theProp);
    return theProp;
}

function resetProps() {
    allProps = [];
}

function genvalue(gen, size) {
    if (!(gen instanceof Function)) {
        gen = gen.arb;
    }
    return gen(size);
}

Prop.prototype.generateArgs = function (size) {
    var i;
    var args = [];
    for (i = 0; i < this.gens.length; i += 1) {
        var gen = this.gens[i];
        args.push(genvalue(gen, size));
    }
    return args;
};

function Case(args) {
    this.classes = [];
    this.args = args;
}

Case.prototype.assert = function (bool) {
    if (!bool) {
        throw ("AssertFailed");
    }
};

Case.prototype.guard = function (bool) {
    if (!bool) {
        throw ("InvalidCase");
    }
};

Case.prototype.classify = function (tag) {};

Case.prototype.noteArg = function (arg) {
    this.args.push(arg);
};

function Config(pass, invalid) {
    this.maxPass = pass;
    this.maxInvalid = invalid;
}

Config.prototype.needsWork = function (count) {
    return count.invalid < this.maxInvalid &&
        count.pass < this.maxPass;
};


function runProp(config, prop) {
    var counts = new Counts(0, 0, {});
    var size = 0;
    while (config.needsWork(counts)) {
        var args = prop.generateArgs(size);
        var testCase = new Case(args);
        try {
            prop.body.apply(prop, [testCase].concat(args));
            counts.incPass();
        }
        catch (e) {
            if (e === "AssertFailed") {
                return new Fail(prop, counts, args);
            } else if (e === "InvalidCase") {
                counts.incInvalid();
            } else {
                throw (e);
            }
        }
        size += 1;
    }
    return counts.newResult(prop);
}

function runAllProps(config, listener) {
    var i = 0;

    if (typeof setTimeout !== 'undefined') {
        // Use set timeout so listeners can draw in response to events.
        var once = function () {
            if (i >= allProps.length) {
                listener.done();
                return;
            }
            var currentProp = allProps[i];
            var result = runProp(config, currentProp);
            listener.noteResult(result);
            i += 1;
            setTimeout(once, 0);
        };
        once();
    } else {
        for (; i < allProps.length; i++) {
            listener.noteResult(runProp(config, allProps[i]));
        }
    }
}

// generic 'console' listener. When overwriting implement log and warn
function ConsoleListener() {}

ConsoleListener.prototype.noteResult = function (result) {
    var status_string = result.status + ": " + result.name;
    if (result.status === "pass") {
        this.log(status_string);
        this.log(result.counts);
    } else {
        this.warn(status_string);
        this.log(result);
    }
    if (result.status === "fail") {
        this.log("Failed case:");
        this.log(result.failedCase);
    }
};

ConsoleListener.prototype.done = function (result) {
    this.log('done.');
};

// A listener which works with Firebug's console.
function FBCListener() { }
FBCListener.prototype = new ConsoleListener();
FBCListener.prototype.log = function (str) { 
    console.log(str); 
};
FBCListener.prototype.warn = function (str) { 
    console.warn(str); 
};

function RhinoListener() {}
RhinoListener.prototype = new ConsoleListener();
RhinoListener.prototype.log = function (str) { 
    print(str.toString()); 
};
RhinoListener.prototype.warn = function (str) { 
    print(str.toString()); 
};

// some starter generators and support utilities.

function frequency(/** functions */) {
    var args = new Array(arguments.length);
    var sum = 0;
    for (var i = 0; i < arguments.length; i++) {
        sum += arguments[i][0];
    }

    for (var i = 0; i < arguments.length; i++) {
        args.push([arguments[i][0]/sum, arguments[i][1]]);
    }

    return function () {
        var r = randFloatUnit();
        var s = 0;
        for (var i = 0; i < args.length; i++) {
            s += args[i][0];
            if(r < s) {
                return args[i][1];
            }
        }
        return args[arg.length - 1][1];
    };
}

function randWhole(top) {
    return Math.floor(Math.random() * top);
}

function randInt(top) {
    return randWhole(2 * top) - top;
}

function randRange(a, b) {
    return randWhole(b - a) + a;
}

function randFloatUnit() {
    return Math.random();
}

var justSize = {
    arb: function (size) { 
            return size; 
        },
    shrink: null
};

var arbWholeNum = {
    arb: randWhole,
    shrink: null
};

var arbInt = {
    arb: randInt,
    shrink: null
};

var arbNull = {
    arb: function () { 
            return null; 
        },
    shrink: null
};

function arbRange(a, b) {
    var min = Math.min(a, b);
    var max = Math.max(a, b);
    return function (size) {
        return Math.floor(Math.random() * (max - min)) - min;
    };
}

function arbArray(innerGen) {
    function gen(size) {
        var listSize = randWhole(size);
        var list = [];
        var i;
        for (i = 0; i < listSize; i += 1) {
            list.push(genvalue(innerGen, size));
        }
        return list;
    }

    return {
        arb: gen,
        shrink: null
    };
}

function arbSelect(/** generators... */) {
    var generators = arguments;

    //draw the next generator by picking from uniform distribution
    function getGenerator() {
        var len = generators;
        var probability = 1 / len;
        var r = randFloatUnit();

        var s = 0;
        for(var i=0; i < len; i++) {
            s += probability;
            if (r < s) {
                return generators[i];
            }
        }
        return generators[len - 1]; //just in case, but should never happen
    }

    return {
        arb: function (size) {
                return genvalue(getGenerator(), size);
            },
        shrink: null
    };
}


function arbNullOr(otherGen) {
    return arbSelect(otherGen, arbNull);
}

var arbFloatUnit = {
    arb: randFloatUnit
};



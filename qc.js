// Copyright (c) 2009, Darrin Thompson

// Tiny javascript quickcheck port.
// See Tiny demo below.

var allProps = [];

function declare(name, gens, body) {
    var theProp = new Prop(name, gens, body);
    allProps.push(theProp);
    return theProp;
}

function resetProps() {
    allProps = [];
}

function Prop(name, gens, body) {
    this.name = name;
    this.gens = gens;
    this.body = body;
}

Prop.prototype.generateArgs = function(size) {
    var i;
    var args = [];
    for (i = 0; i < this.gens.length; i += 1) {
	var gen = this.gens[i];
	args.push(gen(size));
    }
    return args;
};

function Case(args) {
    this.classes = [];
    this.args = args;
}

Case.prototype.assert = function(bool) {
    if(!bool) {
	throw("AssertFailed");
    }
};

Case.prototype.guard = function(bool) {
    if (!bool) {
        throw("InvalidCase");
    }
};

Case.prototype.classify = function(tag) {};

Case.prototype.noteArg = function(arg) {
    this.args.push(arg);
};

function Config(pass, invalid) {
    this.maxPass = pass;
    this.maxInvalid = invalid;
}

Config.prototype.needsWork = function(count) {
    return count.invalid < this.maxInvalid &&
    count.pass < this.maxPass;
};

function Counts(pass, invalid, classes) {
    this.pass = pass;
    this.invalid = invalid;
    this.classes = classes;
}

Counts.prototype.incInvalid = function() { this.invalid += 1; };
Counts.prototype.incPass = function() { this.pass += 1; };
Counts.prototype.newResult = function(prop) {
    if(this.pass > 0) {
	return new Pass(prop, this);
    } else {
	return new Invalid(prop, this);
    }
};

function Invalid(prop, counts) {
    this.status = "invalid";
    this.prop = prop;
    this.counts = counts;
    this.name = prop.name;
}

function Pass(prop, counts) {
    this.status = "pass";
    this.prop = prop;
    this.counts = counts;
    this.name = prop.name;
}

function Fail(prop, counts, failedCase) {
    this.status = "fail";
    this.prop = prop;
    this.counts = counts;
    this.failedCase = failedCase;
    this.name = prop.name;
}

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
	    if (e == "AssertFailed") {
		return new Fail(prop, counts, args);
	    } else if (e == "InvalidCase") {
		counts.incInvalid();
	    } else {
		throw(e);
	    }
	}
	size += 1;
    }
    return counts.newResult(prop);
}

function runAllProps(config, listener) {
    var i = 0;
    // Use set timeout so listeners can draw in response to events.
    var once = function() {
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
}

// A listener which works with Firebug's console.
function FBCListener() {
}

FBCListener.prototype.noteResult = function(result) {
    var status_string = result.status + ": " + result.name;
    if (result.status == "pass") {
        console.log(status_string);
        console.log(result.counts);
    } else {
        console.warn(status_string);
        console.log(result);
    }
    if (result.status == "fail") {
        console.log("Failed case:");
        console.log(result.failedCase);
    }
};

FBCListener.prototype.done = function(result) {
    console.log('done.');
};

// some starter generators and support utilities.

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

function justSize() {
    return function(size) {
        return size;
    };
}

function arbWholeNum() {
    return function(size) {
	return randWhole(size);
    };
}

function arbInt() {
    return function(size) {
        return randInt(size);
    };
}

function arbRange(a, b) {
    var min = Math.min(a, b);
    var max = Math.max(a, b);
    return function(size) {
        return Math.floor(Math.random() * (max - min)) - min;
    };
}

function arbList(innerGen) {
    return function(size) {
        var listSize = randWhole(size);
	var list = [];
	var i;
	for (i = 0; i < listSize; i += 1) {
	    list.push(innerGen(size));
	}
	return list;
    };
}

function arbFloatUnit() {
    return function(size) {
	return randFloatUnit();
    };
}

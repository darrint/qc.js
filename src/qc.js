// Copyright (c) 2009, Darrin Thompson

// Tiny javascript quickcheck port.

/**
 * Array of all declared properties
 */
var allProps = [];

/**
 * Probability distributions.
 *
 * @class
 */
function Distribution(d) {
    var data = [];

    /** @ignore */
    function incBy(key, x) {
        var found = false;
        for(var i = 0; i < data.length; i++) {
            if(data[i][1] == key) {
                data[i][0] += x;
                found = true;
                break;
            }
        }
        if (!found) { 
            data.push([x, key]);
        }
    }

    for(var j = 0; j < d.length; j++) {
        incBy(d[j][1], d[j][0]);
    }

    this.data = data;
    this.normalize();
    this.length = this.data.length;
};

/**
 * @ignore
 */
Distribution.prototype.normalize = function () {
    var sum = 0;
    for(var i = 0; i < this.data.length; i++) {
        sum += this.data[i][0];
    }
    for(var i = 0; i < this.data.length; i++) {
        this.data[i][0] /= sum;
    }
};

/**
 * finds the probability of a given value in the distribution.
 *
 * @param x any value to find probability for
 * @return the probability of x in the distribution
 */
Distribution.prototype.probability = function(x) {
    for(var i = 0; i < this.data.length; i++) {
        if(this.data[i][1] == x) {
            return this.data[i][0];
        }
    }
    return 0;
};

/**
 * finds the (first) object with the highest probability.
 *
 * @return object with highest probability
 */
Distribution.prototype.mostProbable = function () {
    var max = 0;
    var ret = null;
    for(var i = 0; i < this.data.length; i++) {
        if(this.data[i][0] > max) {
            max = this.data[i][0];
            ret = this.data[i][1];
        }
    }
    return ret;
};

/**
 * randomly draws a values by its probability from the distribution.
 *
 * @return any value in the distribution
 */
Distribution.prototype.pick = function () {
    var r = Math.random();
    var s = 0;
    for (var i = 0; i < this.data.length; i++) {
        s += this.data[i][0];
        if(r < s) {
            return this.data[i][1];
        }
    }
};

/**
 * creates a new uniform distribution from an array of values.
 *
 * @param data an array of values
 *
 * @return a new Distribution object
 */
Distribution.uniform = function(data) {
    var tmp = new Array(data.length);
    for(var i = 0; i < data.length; i++) {
        tmp[i] = ([1, data[i]]);
    }
    return new Distribution(tmp);
};

/**
 * draws a new value from a generator. 
 * A generator is either a function accepting a seed argument or an object
 * with a method 'arb' accepting a seed argument.
 *
 * @param gen Function or Generator object with method 'arb'
 * @param {Number} size seed argument
 *
 * @return new generated value
 */
function genvalue(gen, size) {
    if (!(gen instanceof Function)) {
        gen = gen.arb;
    }
    return gen(size);
}

/**
 * Uses the generators specific shrinking method to shrink a value the generator
 * created before. If the generator is a function or has no method named 'shrink' 
 * or the objects field 'shrink' is set to null, no shrinking will be done.
 * If a shrinking method is defined, this method is called with the original seed and
 * value the generator created. The shrinking method is supposed to return an Array of
 * shrinked(!) values or null,undefined,[] if no shrinked values could have been created.
 *
 * @param gen the generator object
 * @param size the initial seed used when creating a value
 * @param arg the value the generator created for testing
 *
 * @return an array of shrinked values or [] if no shrinked values were generated.
 *
 */
function genshrinked(gen, size, arg) {
    if(!gen || gen instanceof Function ||
       gen['shrink'] === null || gen['shrink'] === undefined) 
    {
        return [];
    }

    var tmp = gen.shrink(size, arg);
    return (tmp === null || tmp === undefined) ? [] : tmp;
}

/**
 * @class
 */
function Prop(name, gens, body) {
    this.name = name;
    this.gens = gens;
    this.body = body;
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

Prop.prototype.generateShrinkedArgs = function(size, args) {
    //test if at least on generator supports shrinking
    var shrinkingSupported = false;
    for (var i = 0; i < this.gens.length; i++) {
        var gen = this.gens[i];
        if(!(gen instanceof Function) && 
           !(gen['shrink'] === null || gen['shrink'] === undefined)) 
        {
            shrinkingSupported = true;
            break;
        }
    }

    if(!shrinkingSupported) {
        return [];
    }

    // create shrinked args for each argument 
    var shrinked = [];
    var countShrinked = 0;
    for (var i = 0; i < this.gens.length; i++) {
        var gen = this.gens[i];
        if((gen instanceof Function) || gen['shrink'] === undefined ||
           gen['shrink'] === null || !(gen['shrink'] instanceof Function))
        {
            shrinked.push([args[i]]);
        } else {
            var tmp = gen.shrink(size, args[i]);
            if(tmp === undefined || (tmp instanceof Array && tmp.length == 0)) {
                shrinked.push([args[i]])
            } else {
                countShrinked++;
                shrinked.push(tmp);
            }
        }
    }

    if (countShrinked === 0) {
        return [];
    }

    // create index list to draw lists of arguments from
    var idxs = new Array(this.gens.length);
    for (var i = 0; i < this.gens.length; i++) {
        idxs[i] = 0;
    }

    // create list of shrinked arguments:
    var newArgs = [];
    while( idxs[0] < shrinked[0].length ) {
        var tmp = new Array(shrinked.length);
        var i = 0;
        for (; i < shrinked.length; i++) {
            tmp[i] = shrinked[i][idxs[i]];
        }
        newArgs.push(tmp);

        // adjust all indices
        while( (i--) > 0 ) {
            idxs[i] += 1;
            if(i != 0 && idxs[i] >= shrinked[i].length) {
                idxs[i] = 0;
            } else {
                break;
            }
        }
    }

    return newArgs;
}

Prop.prototype.run = function (config) {
    runProp(config, this);
}

/**
 * @class
 */
function Invalid(prop, counts, tags, distr) {
    /** @field */
    this.status = "invalid";

    this.prop = prop;
    this.counts = counts;
    this.name = prop.name;
    this.tags = tags;
    this.distr = distr;
}

Invalid.prototype.toString = function () {
    return "Invalid (" + this.name + ") counts=" + this.counts;
}

/**
 * @class
 */
function Pass(prop, counts, tags, distr) {
    /** @field */
    this.status = "pass";

    this.tags = tags;
    this.prop = prop;
    this.counts = counts;
    this.name = prop.name;
    this.distr = distr;
}

Pass.prototype.toString = function () {
    return "Pass (" + this.name + ") counts=" + this.counts;
}

/**
 * @class
 */
function Fail(prop, counts, failedCase, shrinkedArgs, tags, distr) {
    this.status = "fail";
    this.tags = tags;
    this.prop = prop;
    this.counts = counts;
    this.failedCase = failedCase;
    this.shrinkedArgs = shrinkedArgs;
    this.name = prop.name;
    this.distr = distr;
}

Fail.prototype.toString = function () {
    function tagstr(tags) {
        if(!tags || tags.length === 0) return "";

        var str = "(tags: " + tags[0];
        for(var i = 1; i < tags.length; i++) {
            str += ", " + tags[i];
        }
        return str + ")";
    }

    function shrinkstr(arg) {
        return arg == null ? "" : "\nminCase: " + arg;
    }

    return this.name + tagstr(this.tags) +
           " failed with: counts=" + this.counts + 
           " failedCase: " + this.failedCase +
           shrinkstr(this.shrinkedArgs);
}

/**
 * Counting class for collection a properties non failing pass/invalid runs.
 *
 * @class
 */
function Counts() {
    /** 
     * number of successful tests
     * @field 
     * */
    this.pass = 0;

    /** 
     * number of failed tests
     * @field 
     * */
    this.invalid = 0;
}

/**
 * @ignore
 */
Counts.prototype.incInvalid = function () { 
    this.invalid += 1; 
};

/**
 * @ignore
 */
Counts.prototype.incPass = function () { 
    this.pass += 1; 
};

/**
 * @ignore
 */
Counts.prototype.newResult = function (prop, tags, distr) {
    if (this.pass > 0) {
        return new Pass(prop, this, tags, distr);
    } else {
        return new Invalid(prop, this, tags, distr);
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

/**
 * deletes all declared properties
 */
function resetProps() {
    allProps = [];
}

/**
 * @class
 */
function Case(args) {
    this.tags = [];
    this.collected = [];
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

Case.prototype.classify = function (bool,tag) {
    if(bool) {
        this.tags.push(tag);
    }
};

Case.prototype.collect = function(value) {
    var found = false;
    for(var i = 0; i < this.collected.length; i++) {
        if (this.collected[i][1] == value) {
            this.collected[i][0] += 1;
            found = true;
            break;
        }
    }
    if(!found) {
        this.collected.push([1, value]);
    }
}

Case.prototype.noteArg = function (arg) {
    this.args.push(arg);
};

/**
 * Testing Configuration.
 *
 * @param pass maximum passes per property
 * @param invalid maximum invalid tests per property
 * @param maxShrink maximum number of shrinking steps per property
 *
 * @class
 */
function Config(pass, invalid, maxShrink) {
    this.maxPass = pass;
    this.maxInvalid = invalid;
    this.maxShrink = arguments.length < 3 ? 3 : maxShrink;
}

/**
 * @ignore
 */
Config.prototype.needsWork = function (count) {
    return count.invalid < this.maxInvalid &&
        count.pass < this.maxPass;
};


function shrinkLoop(config, prop, size, args) {
    var failedArgs = [args];
    var shrinkedArgs = [];

    for(var loop = 0; loop < config.maxShrink; loop++) {
        // create shrinked argument lists from failed arguments

        shrinkedArgs = [];
        for(var i = 0; i < failedArgs.length; i++) {
            shrinkedArgs = shrinkedArgs.concat(
                prop.generateShrinkedArgs(size, failedArgs[i]));
        }

        if(shrinkedArgs.length === 0) {
            return failedArgs.length === 0 ? null : failedArgs[0];
        }

        // create new failed arguments from shrinked ones by running the property
        failedArgs = [];
        for(var i = 0; i < shrinkedArgs.length; i++) {
            try {
                var testCase = new Case(shrinkedArgs[i]);
                prop.body.apply(prop, [testCase].concat(shrinkedArgs[i]));
            } catch (e) {
                if( e === 'InvalidCase') {
                } else if (e === 'AssertFailed') {
                    if(loop === config.maxShrink - 1) {
                        return shrinkedArgs[i];
                    } else {
                        failedArgs.push(shrinkedArgs[i]);
                    }
                } else {
                    throw e;
                }
            }
        }
    }

    return failedArgs.length === 0 ? null : failedArgs[0];
}

function runProp(config, prop) {
    var counts = new Counts();
    var size = 0;

    var tags = {};
    var collected = [];

    while (config.needsWork(counts)) {
        var args = prop.generateArgs(size);
        var testCase = new Case(args);
        try {
            prop.body.apply(prop, [testCase].concat(args));
            counts.incPass();
        }
        catch (e) {
            if (e === "AssertFailed") {
                var dist = !testCase.collected || 
                            testCase.collected.length == 0 ?  null : 
                                new Distribution(testCase.collected);

                var shrinkedArgs = shrinkLoop(config, prop, size, args);
                return new Fail(prop, counts, args, shrinkedArgs, testCase.tags, dist);
            } else if (e === "InvalidCase") {
                counts.incInvalid();
            } else {
                throw (e);
            }
        }
        size += 1;
        collected = collected.concat(testCase.collected);
        for(var i = 0; i < testCase.tags.length; i++) {
            var tag = testCase.tags[i];
            if (!tags[tag]) {
                tags[tag] = 1;
            } else {
                tags[tag] += 1;
            }
        }
    }

    if(collected.length > 0)
    var dist = !collected || collected.length == 0 ? null :
                new Distribution(collected);
    var tagsTmp = new Array();
    for(var tag in tags) {
        tagsTmp.push([tags[tag], tag]);
    }

    return counts.newResult(prop, tagsTmp, dist);
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
/**
 * @class
 */
function ConsoleListener(maxCollected) {
    this.maxCollected = maxCollected || -1;
}

ConsoleListener.prototype.noteResult = function (result) {
    var status_string = result.status + ": " + result.name;
    if (result.status === "pass") {
        this.log(result);
        //this.log(result.counts);
    } else {
        this.warn(status_string);
        this.log(result);
    }
    if (result.status === "fail") {
        this.log("Failed case:");
        this.log(result.failedCase);
    }

    //print tags
    var tags = result.tags;
    if(tags && tags.length > 0) {
        this.log('tags:');
        for(var i = 0; i < tags.length;i++) {
            var tag = tags[i];
            if(tag instanceof Array) {
                this.log(tag[0] + " : " + tag[1]);
            } else {
                this.log(tag);
            }
        }
    }

    //print histogram statistics if present
    if(this.maxCollected != 0 && result.distr && result.distr.length > 0) {
        var distr = result.distr;
        distr = distr.data.slice(
            0, this.maxCollected == -1 ? distr.data.length :
               Math.min(distr.data.length, this.maxCollected));

        distr.sort(function (a, b) {
            return -1 * (a[0] - b[0]);
        });

        this.log('collected:');
        for(var i = 0; i < distr.length; i++) {
            var d = distr[i];
            this.log(d[0] * 100 + "% : " + d[1]);
        }
    }

};

ConsoleListener.prototype.done = function (result) {
    this.log('done.');
};

/**
 * QuickCheck callback for FireBug sending property results to FireBug's console
 *
 * @extends ConsoleListener
 * @class
 */
function FBCListener(maxCollected) { 
    this.maxCollected = maxCollected || 0;
}
FBCListener.prototype = new ConsoleListener();
FBCListener.prototype.log = function (str) { 
    console.log(str); 
};
FBCListener.prototype.warn = function (str) { 
    console.warn(str); 
};

/**
 * QuickCheck callback for Rhino sending property results to stdout.
 *
 * @extends ConsoleListener
 * @class
 */
function RhinoListener(maxCollected) {
    this.maxCollected = maxCollected || 10;
}
RhinoListener.prototype = new ConsoleListener();
RhinoListener.prototype.log = function (str) { 
    print(str.toString()); 
};
RhinoListener.prototype.warn = function (str) { 
    print(str.toString()); 
};

// some starter generators and support utilities.

function frequency(/** functions */) {
    var d = new Distribution(arguments);
    return function () {
        return d.pick();
    }
}

function choose(/** values */) {
    var d = Distribution.uniform(arguments);
    return function(){
        return d.pick();
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

function arbChoose(/** generators... */) {
    var d = Distribution.uniform(arguments);
    return {
        arb: function (size) {
                return genvalue(d.pick(), size);
            },
        shrink: null
    };
}

var arbBool = {
    arb: choose(false, true)
};

function arbNullOr(otherGen) {
    //return arbSelect(otherGen, arbNull);
    var d = new Distribution([[10, arbNull], [90, otherGen]]);
    return {
        arb: function (size) {
                return genvalue(d.pick(), size);
            },
        shrink: function (size, a) {
            if(a == null) {
                return [];
            } else {
                return [null].concat(genshrinked(otherGen, size, a));
            }
        }
    }
}

var arbWholeNum = {
    arb: randWhole,
    shrink: function(size, x) {
        var tmp = x;
        var ret = [];
        while(true) {
            tmp = Math.floor(tmp / 2);
            if(tmp == 0) break;
            ret.push(x - tmp);
        }
        return ret;
    }
};

var arbInt = {
    arb: randInt,
    shrink: function(size, x) {
        var tmp = x;
        var ret = [];
        if(x < 0) ret.push(-x);

        while(true) {
            tmp = tmp / 2;
            if(tmp < 0) tmp = Math.ceil(tmp);
            if(tmp > 0) tmp = Math.floor(tmp);
            if(tmp == 0) break;

            ret.push(x - tmp);
        }
        return ret;
    }
};

var arbFloatUnit = {
    arb: randFloatUnit,
    shrink: function(size, x) {
        var ret = [];
        if(x < 0) ret.push(-x);
        var tmp = Math.floor(x);
        if(tmp != x) ret.push(tmp);
        tmp = Math.ceil(x);
        if(tmp != x) ret.push(tmp);

        return ret;
    }
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


function arrShrinkOne(size, arr) {
    if (!arr || arr.length == 0) return [];
    if (arr.length == 1) return [[]];

    function copyAllBut(idx) {
        var tmp = new Array(arr.length - 1);
        for (var i = 0; i < arr.length; i++) {
            if (i === idx) continue;
            if (i < idx) tmp[i] = arr[i];
            else tmp[i - 1] = arr[i];
        }
        return tmp;
    }

    var ret = new Array(arr.length);
    for(var i = 0; i < arr.length; i++) {
        ret[i] = copyAllBut(i);
    }
    return ret;
}

function arbArray(innerGen, shrinkStrategy) {
    var shrinkFn = shrinkStrategy || arrShrinkOne;
    function gen(size) {
        var listSize = randWhole(size);
        var list = [];
        var i;
        for (i = 0; i < listSize; i += 1) {
            list.push(genvalue(innerGen, size));
        }
        return list;
    }

    return { arb: gen, shrink: shrinkFn };
}

function expectException(fn) {
    return function(c){
        try {
            fn.apply(arguments);
        } catch (e) {
            if(e === 'AssertFailed' || e === 'InvalidCase') {
                throw e;
            }
            c.assert(true);
            return;
        }
        c.assert(false);
    }
}


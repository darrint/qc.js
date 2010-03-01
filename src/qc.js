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
 * @private
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

/**
 * @private
 */
Prop.prototype.generateArgs = function (size) {
    var i;
    var args = [];
    for (i = 0; i < this.gens.length; i += 1) {
        var gen = this.gens[i];
        args.push(genvalue(gen, size));
    }
    return args;
};

/**
 * @private
 */
Prop.prototype.generateShrinkedArgs = function(size, args) {
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

/**
 * tests the property.
 *
 * @param {Config} config configuration to test property with
 * @return depending on test result a Pass, Fail or Invalid object
 */
Prop.prototype.run = function (config) {
    var stats = new Stats();
    var size = 0;

    var collected = [];

    while (config.needsWork(stats)) {
        var args = this.generateArgs(size);
        var testCase = new Case(args);
        try {
            this.body.apply(this, [testCase].concat(args));
            stats.incPass();
        }
        catch (e) {
            if (e === "AssertFailed") {
                var dist = !testCase.collected || 
                            testCase.collected.length == 0 ?  null : 
                                new Distribution(testCase.collected);

                var shrinkedArgs = shrinkLoop(config, this, size, args);
                return new Fail(this, stats, args, shrinkedArgs, testCase.tags, dist);
            } else if (e === "InvalidCase") {
                stats.incInvalid();
            } else {
                throw (e);
            }
        }
        size += 1;
        stats.addTags(testCase.tags);
        collected = collected.concat(testCase.collected);
    }

    if(collected.length > 0)
    stats.collected = !collected || collected.length == 0 ? null :
                        new Distribution(collected);

    return stats.newResult(this);
}

/**
 * @class
 */
function Invalid(prop, stats) {
    /** @field */
    this.status = "invalid";

    this.prop = prop;
    this.stats = stats;
    this.name = prop.name;
}

Invalid.prototype.toString = function () {
    return "Invalid (" + this.name + ") counts=" + this.stats;
}

/**
 * @class
 */
function Pass(prop, stats) {
    /** @field */
    this.status = "pass";

    this.prop = prop;
    this.stats = stats;
    this.name = prop.name;
}

Pass.prototype.toString = function () {
    return "Pass (" + this.name + ") counts=" + this.stats;
}

/**
 * @class
 */
function Fail(prop, stats, failedCase, shrinkedArgs) {
    this.status = "fail";
    this.prop = prop;
    this.stats = stats;
    this.failedCase = failedCase;
    this.shrinkedArgs = shrinkedArgs;
    this.name = prop.name;
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

    return this.name + tagstr(this.stats.tags) +
           " failed with: counts=" + this.stats + 
           " failedCase: " + this.failedCase +
           shrinkstr(this.shrinkedArgs);
}

/**
 * Counting class for collection a properties non failing pass/invalid runs.
 *
 * @class
 */
function Stats() {
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

    /**
     * list of tags (created by calling Case.classify) with counts
     * @field
     */
    this.tags = [];

    /**
     * Histogram of collected values (create by calling Case.collect)
     * @field
     */
    this.collected = null;
}

/**
 * @private
 */
Stats.prototype.incInvalid = function () { 
    this.invalid += 1; 
};

/**
 * @private
 */
Stats.prototype.incPass = function () { 
    this.pass += 1; 
};

/**
 * @private
 */
Stats.prototype.addTags = function(ts) {
    for (var i = 0; i < ts.length; i++) {
        var tag = ts[i];
        var found = false;
        for (var j = 0; j < this.tags.length; j++) {
            if(this.tags[j][1] == tag) {
                found = true;
                this.tags[j][0] += 1;
            }
        }
        if(!found) {
            this.tags.push([1, tag]);
        }
    }
}

/**
 * @private
 */
Stats.prototype.newResult = function (prop) {
    if (this.pass > 0) {
        return new Pass(prop, this);
    } else {
        return new Invalid(prop, this);
    }
};

Stats.prototype.toString = function () {
    return "(pass=" + this.pass + ", invalid=" + this.invalid + ")";
}

/**
 * Builds and registers a new property.
 *
 * @param name the property's name
 * @param gens Array of generators (length == arity of body function).  Entry
 *             at position i will drive the i-th argument of the body function. 
 * @param body the properties testing function
 *
 * @return a new registered Property object.
 */
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
 * tests if runloop should continue testing a property based
 * on test statistics to date.
 *
 * @private
 */
Config.prototype.needsWork = function (count) {
    return count.invalid < this.maxInvalid &&
        count.pass < this.maxPass;
};

/**
 * @private
 */
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
            var result = currentProp.run(config);
            listener.noteResult(result);
            i += 1;
            setTimeout(once, 0);
        };
        once();
    } else {
        for (; i < allProps.length; i++) {
            listener.noteResult(allProps[i].run(config));
        }
    }
}

// generic 'console' listener. When overwriting implement log and warn
/**
 * Abstract class for building 'console' based listeners.
 * Subclasses MUST implement the function 'log' and 'warn'.
 *
 * @param maxCollected maximum number of collected elements to display in console
 *
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
    var tags = result.stats.tags;
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
    if(this.maxCollected != 0 && result.stats.collected && result.stats.collected.length > 0) {
        var distr = result.stats.collected;
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

/**
 * @constant
 */
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

/**
 * @constant
 */
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

/**
 * @constant
 */
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

/**
 * @constant
 */
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

/**
 * @constant
 */
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

/**
 * @constant
 */
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
        return Math.floor(Math.random() * (max - min)) + min;
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
            fn.apply(this, arguments);
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

function failOnException(fn) {
    return function(c) {
        try {
            fn.apply(this, arguments);
        } catch (e) {
            if(e === 'AssertFailed' || e === 'InvalidCase') {
                throw e;
            }
            c.assert(false);
        }
    }
}

/**
 * @constant
 */
var arbDate = {
    arb: function() { return new Date(); }
}

function arbConst(/** values... */){
    var d = Distribution.uniform(arguments);
    return {
        arb: function(){ return d.pick(); }
    }
}

function arbMod(a, fn) {
    return {
        arb: function(size) {
            return fn(genvalue(a, size));
        }
    }
}

/**
 * @constant
 */
var arbChar = arbMod(arbChoose(arbRange(32,255)),
                     function(num) {
                         return String.fromCharCode(num);
                     });

/**
 * @constant
 */
var arbString = new function() {
    var a = arbArray(arbRange(32,255));

    this.arb = function(size) {
        var tmp = genvalue(a, size);
        return String.fromCharCode.apply(String, tmp);
    }

    this.shrink = function(size, str) {
        var tmp = new Array(str.length);
        for(var i = 0; i < str.length; i++) {
            tmp[i] = str.charCodeAt(i);
        }

        var tmp = genshrinked(a, size, tmp);
        var ret = [];
        for (var i = 0; i < tmp.length; i++) {
            ret.push(String.fromCharCode.apply(String, tmp[i]));
        }
        return ret;
    }

    return this;
}

/**
 * @constant
 */
var arbUndef = arbConst(undefined);

function arbUndefOr(opt) {
    var d = new Distribution([[10, arbUndef], [90, opt]]);
    return {
        arb: function (size) {
            return genvalue(d.pick(), size);
        },
        shrink: function(size, a) {
            return a == undefined ? [] : genshrinked(opt, size, a);
        }
    }
}


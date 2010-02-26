// A specialized listener which pokes results into a div with jquery.
function LiterateListener(jqDest) {
    this.jqDest = jqDest;
}

LiterateListener.prototype.noteResult = function(result) {
    var status_string = result.status + ": " + result.name;
    this.log(status_string);
    this.logResult(result);
    if (result.status == "pass") {
	// do nothing.
    } else {
	this.jqDest.removeClass("green");
	this.jqDest.addClass("red");
    }
    if (result.status == "fail") {
        this.log("Failed case:");
        this.log(result.failedCase.toString());
    }
};

LiterateListener.prototype.done = function(result) {
    this.log('done.');
};

LiterateListener.prototype.log = function(text) {
    this.jqDest.append($('<span>' + text + '</span>'));
    this.jqDest.append($('<br/>'));
};

LiterateListener.prototype.logResult = function(result) {
    this.log("passes: " + result.counts.pass);
    this.log("invalid: " + result.counts.invalid);
}
// Given a jquery identifier, run the code in the element and display
// results in an helpful manner near the code.
function literateRun(id) {
    resetProps();
    eval($(id).text());
    var dest = $(id).after("<div>").next();
    dest.addClass("test-result");
    dest.addClass("green");
    runAllProps(new Config(100, 1000), new LiterateListener(dest));
}

function runAllLiterate() {
    $(".runme").each(function () {
	    literateRun(this);
	});
}

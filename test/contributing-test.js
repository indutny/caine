var assert = require('assert');
var marked = require('marked');

var caine = require('../');
var contributing = caine.contributing;

function fn2text(fn) {
  var str = fn.toString().replace(/^function[^{]+{\/\*[\r\n]?|[\r\n]?\*\/}$/g,
                                  '');
  var lines = str.split(/\r|\n|\r\n/g);

  // Remove common whitespace
  var ws = Infinity;
  for (var i = 0; i < lines.length; i++) {
    var line = lines[0].match(/^\s*/)[0].length;
    if (line !== 0)
      ws = Math.min(ws, line);
  }

  return lines.map(function(line) {
    return line.slice(ws);
  }).join('\n');
}

describe('Contributing', function() {
  describe('.renderMd()', function() {
    function test(fn) {
      var text = fn2text(fn);
      var expected = marked.lexer(text);
      var actual = marked.lexer(contributing.renderMd(marked.lexer(text)));

      assert.deepEqual(actual, expected);
    }
    it('should render markdown ast back to markdown', function() {
      test(function() {/*
        # H1
        ## H2
        ### H3

        Multi-line paragraph
        yes.

        Unordered list:

        * 123
        * 123
        * Sub list after
          multiline:
          * ohai
          * ok
        * back

        Ordered list:

        1. 123
        2. x
        3. x
        4. x
        5. x
        6. x
        7. x
        8. x
        9. x
        10. 456
            multi
      */});
    });
  });

  describe('.parse()', function() {
    it('should parse semantic markdown', function() {
      var out = contributing.parse(fn2text(function() {/*
        ## Irrelevant info

        Yes

        ### Caine's requirements

        Hello! I am pleased to see your valuable contributing to this project.
        Would you please mind answering a couple of questions to help me
        classify this submission and/or gather required information for the
        core team members?

        #### Questions:

        * _Issue-only_ Does this issue happen in core, or in some user-space
          module from npm or other source? Please ensure that the test case
          that reproduces this problem is not using any external dependencies.
          If the error is not reproducible with just core modules - it is most
          likely not a io.js problem.
        * Which part of core do you think it might be related to?
        * Which versions of io.js do you think are affected by this?
        * _PR-only_ Does `make test` pass after applying this Pull Request
        * _PR-only_ Is the commit message properly formatted? (See
          CONTRIBUTING.md for more information)

        Please provide the answers in an ordered list like this:

        1. Answer for the first question
        2. Answer for the second question
        3. ...

        Note that I am just a bot with a limited human-reply parsing abilities,
        so please be very careful with numbers and don't skip the questions!

        The core team members will be summoned here right after your answers!

        Truly yours,
        Caine.

        ### Some non-caine's stuff

        Yep.
      */}));
    });
  });
});

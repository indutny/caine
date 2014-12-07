var assert = require('assert');
var marked = require('marked');
var fs = require('fs');

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

var questions = fs.readFileSync(__dirname + '/fixtures/contributing.md')
                  .toString();

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
      var out = contributing.parse(questions);
      assert(typeof out === 'object');
      assert(out.text);
      assert.equal(out.questions.length, 5);
    });
  });

  describe('.test()', function() {
    it('should test answers to issue questions', function() {
      var q = contributing.parse(questions).questions;

      var res = contributing.test(q, fn2text(function() {/*
        Irrelevant stuff

        First list
        1. yes
        2. tls
        3. v0.12
      */}), { type: 'issue' });
      assert(res.ok);

      // Wrong answers
      var res = contributing.test(q, fn2text(function() {/*
        Irrelevant stuff

        First list
        1. wait, what?
        2. everything
        3. php
      */}), { type: 'issue' });
      assert(!res.ok);

      assert.equal(res.results[0].reason,
                   'Expected: `yes`, but got: `wait, what`');
      assert.equal(res.results[1].reason,
                   'Expected one of: `tls`, `crypto`, `buffer`, `http`, ' +
                       '`https`, `assert`, `util`, `streams`, `other`, ' +
                       'but got: `everything`');
      assert.equal(res.results[2].reason,
                   'Expected one of: `v0.10`, `v0.12`, `v1.0.0`, ' +
                       'but got: `php`');
    });
  });
});

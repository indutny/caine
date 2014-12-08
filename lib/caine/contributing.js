var marked = require('marked');

function Contributing() {
  this.re = {};
  this.re.issueOnly = /_\s*Issue-only\s*_/i;
  this.re.prOnly = /_\s*PR-only\s*_/i;
  this.re.questions = /questions/i;
  this.re.success = /_[^_]*case\s*of\s*success[^_]*_\s*`([^`]*)`\s*/i;
  this.re.error = /_[^_]*case\s*of[^_]+problem[^_]*_\s*`([^`]*)`\s*/i;
  this.re.resp = /responsibilities/i;
  this.re.listItem = /^(loose|list)_item_start$/;
}
module.exports = new Contributing();

Contributing.prototype.parse = function parse(text) {
  var md = marked.lexer(text);

  // Find the Caine's section's start, and it's depth
  var depth = 0;
  var start = 0;
  for (var i = 0; i < md.length; i++) {
    var item = md[i];
    if (item.type !== 'heading')
      continue;

    if (/Caine\'s/i.test(item.text)) {
      start = i;
      depth = item.depth;
      break;
    }
  }

  if (i === md.length)
    throw new Error('Caine\'s section not found');

  // Find section's end and collect all info
  var caines = [];
  for (var i = start + 1; i < md.length; i++) {
    var item = md[i];
    if (item.type === 'heading' && item.depth <= depth)
      break;

    // Adjust sub-depths
    if (item.type === 'heading')
      item.depth -= depth - 1;

    caines.push(item);
  }

  // Parse questions.
  var questions = this.parseQuestions(caines);

  // Parse success message
  var success = this.parseMessage('success', caines);
  var error = this.parseMessage('error', caines);

  // Parse responsibilities
  var resp = this.parseResp(caines);

  return {
    text: {
      issue: this.renderMd(caines, 'issue'),
      pr: this.renderMd(caines, 'pr'),
      success: success || 'Success!',
      error: error || 'Error:'
    },
    questions: questions,
    responsibilities: resp
  };
};

Contributing.prototype.parseMessage = function parseMessage(kind, md) {
  var res = false;
  md.some(function(item) {
    if (item.type !== 'paragraph')
      return false;

    var match = item.text.match(this.re[kind]);
    if (!match)
      return false;

    res = match[1].replace(/\n+/g, ' ');
    return true;
  }, this)
  return res;
};

Contributing.prototype.parseResp = function parseResp(md) {
  var section = false;
  for (var i = 0; i < md.length; i++) {
    var item = md[i];
    if (item.type === 'heading' && this.re.resp.test(item.text)) {
      section = true;
      continue;
    }
    if (!section)
      continue;

    if (item.type === 'list_start')
      break;
  }

  if (i === md.length)
    return false;

  var resp = this.parseListItems(md, i);

  // Reverse the mapping
  var result = {};
  resp.forEach(function(line) {
    var parts = line.trim().split(/\s*:\s*/g, 2);
    var user = parts[0];
    var modules = parts[1].split(/\s*,\s*/g);

    modules.forEach(function(module) {
      if (result[module])
        result[module].push(user);
      else
        result[module] = [ user ];
    });
  });

  return result;
};

Contributing.prototype.parseQuestions = function parseQuestions(md) {
  // Find questions section
  var section = 0;
  for (var i = 0; i < md.length; i++) {
    var item = md[i];
    if (item.type === 'heading' && this.re.questions.test(item.text)) {
      section = i;
      break;
    }
  }

  // No section - no questions
  if (i === md.length)
    return [];

  // Gather questions
  var questions = this.parseListItems(md, section + 1);

  return questions.map(function(q) {
    return this.parseQuestion(q);
  }, this);
};

Contributing.prototype.parseListItems = function parseListItems(md, start) {
  // Find first list
  var listStart = 0;
  for (var i = start; i < md.length; i++) {
    if (md[i].type === 'list_start') {
      listStart = i;
      break;
    }
  }
  if (i === md.length)
    return [];

  // Find list end
  var listEnd = 0;
  var depth = 0;
  var itemMark = 0;
  var items = [];
  for (var i = listStart; i < md.length; i++) {
    var item = md[i];
    if (item.type === 'list_start') {
      depth++;

      // Make question list ordered
      if (depth === 1)
        item.ordered = true;
    } else if (item.type === 'list_end') {
      depth--;
      if (depth === 0) {
        listEnd = i;
        break;
      }
    } else if (this.re.listItem.test(item.type) && depth === 1) {
      itemMark = i + 1;
    } else if (item.type === 'list_item_end' && depth === 1) {
      items.push(md.slice(itemMark, i));
      itemMark = i + 1;
    }
  }

  return items.map(function(subitems) {
    return subitems.filter(function(sub) {
      return sub.type === 'text';
    }).map(function(sub) {
      return sub.text;
    }).join(' ');
  });
};

Contributing.prototype.parseQuestion = function parseQuestion(text) {
  var type;
  if (this.re.issueOnly.test(text))
    type = 'issue';
  else if (this.re.prOnly.test(text))
    type = 'pr';
  else
    type = 'any';

  var expected = /.*/;
  var reason = 'I don\'t like your answer, human';

  var match = text.match(/_\s*(One\s+of|Expected)\s*:\s*`([^`]+)`\s*_/i);
  if (match !== null) {
    if (/one/i.test(match[1])) {
      var oneof = match[2].split(/\s*,\s*/g);
      expected = new RegExp('^\\s*(' + oneof.join('|') + ')\\s*$', 'i');
      reason = 'Expected one of: `' + oneof.join('`, `') + '`, but got: `@1`';
    } else {
      expected = new RegExp('^\\s*(' + match[2] + ')\\s*$', 'i');
      reason = 'Expected: `' + match[2] + '`, but got: `@1`';
    }
  }

  var label = /_\s*Label\s*_/i.test(text);

  return {
    text: text,
    type: type,
    reason: reason,
    expected: expected,
    label: label
  };
};

function RenderState(parent, type) {
  this.parent = parent;
  this.type = type;
  if (this.parent)
    this.indent = this.parent.indent;
  else
    this.indent = '';
  this.inQuestions = false;
  this.ordered = false;
  this.index = 0;
  this.text = '';
}

Contributing.prototype.renderMd = function renderMd(md, type) {
  var heading = [ '#', '##', '###', '####', '#####' ];
  var state = new RenderState(null, 'main');
  var filteredQuestions = false;

  for (var i = 0; i < md.length; i++) {
    var item = md[i];

    if (item.type === 'heading')
      if (!filteredQuestions && this.re.questions.test(item.text))
        state.inQuestions = true;

    if (item.type === 'list_start') {
      if (state.inQuestions) {
        filteredQuestions = true;
        state.inQuestions = false;
        state = new RenderState(state, 'questions-list');
      } else {
        state = new RenderState(state, 'list');
      }
      state.list = true;
      state.ordered = item.ordered;
      continue;
    } else if (item.type === 'list_end' || item.type === 'list_item_end') {
      // Filter out questions
      if (state.type === 'questions-list-item') {
        if (type === 'issue' && this.re.prOnly.test(state.text) ||
            type === 'pr' && this.re.issueOnly.test(state.text)) {
          state.text = '';
          state.parent.index--;
        }
      }

      // In case of filters - add extra \n
      if (state.type === 'questions-list' &&
          md[i - 2].type === 'space' &&
          !/\n\n$/.test(state.text)) {
        state.text += '\n';
      }

      state.parent.text += state.text;
      state = state.parent;

      continue;
    } else if (this.re.listItem.test(item.type)) {
      state = new RenderState(state, state.type + '-item');
      state.parent.index++;
      if (state.parent.ordered === false) {
        state.text += state.indent + '* ';
        state.indent += '  ';
      } else {
        var prefix = state.parent.index + '. ';
        state.text += state.indent + prefix;
        state.indent += new Array(prefix.length + 1).join(' ');
      }

      if (i + 1 >= md.length || md[i + 1].type === 'list_start')
        continue;
      i++;
      item = md[i];
    } else if (item.type === 'space') {
      state.text += '\n';
      continue;
    } else {
      state.text += state.indent;
    }

    if (item.type === 'paragraph')
      state.text += item.text + '\n';
    else if (item.type === 'text')
      state.text += item.text;
    else if (item.type === 'heading')
      state.text += heading[item.depth - 1] + ' ' + item.text;
    else
      throw new Error('Unsupported markdown node: ' + item.type);

    state.text += '\n';
  }

  return state.text;
};

Contributing.prototype.test = function test(questions, answers, options) {
  if (!options)
    options = {};

  if (options.type) {
    questions = questions.filter(function(q) {
      return q.type === 'any' || q.type === options.type;
    });
  }

  var md = marked.lexer(answers);
  answers = this.parseListItems(md, 0).map(function(answer) {
    return answer.trim().toLowerCase();
  });

  // Fill missing answers
  while (answers.length < questions.length)
    answers.push('none');
  answers = answers.slice(0, questions.length);

  var ok = true;
  var results = answers.map(function(answer, i) {
    // Sanitizing
    var input = answer.replace(/[^\w\d_\-\.\, ]+/ig, '').toLowerCase();
    var q = questions[i];
    var match = input.match(q.expected);

    var reason = null;
    var lok = false;
    var label = q.label;
    var answer = null

    if (match) {
      lok = true;
      answer = match[1];
    } else {
      reason = q.reason.replace(/@1/g, input);
      label = false;
    }

    if (!lok)
      ok = false;

    return { ok: lok, reason: reason, answer: answer, label: label };
  });

  return { ok: ok, results: results };
};

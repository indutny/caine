var marked = require('marked');

function Contributing() {
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

  // Re-render relevant part of markdown
  var cainesMd = this.renderMd(caines);

  return {
    text: cainesMd,
    questions: questions
  };
};

Contributing.prototype.parseQuestions = function parseQuestions(md) {
  // Find questions section
  var section = 0;
  for (var i = 0; i < md.length; i++) {
    var item = md[i];
    if (item.type === 'heading' && /questions/i.test(item.text)) {
      section = i;
      break;
    }
  }

  // No section - no questions
  if (i === md.length)
    return [];

  // Find first list
  var listStart = 0;
  for (var i = section + 1; i < md.length; i++) {
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
    } else if (item.type === 'list_end') {
      depth--;
      if (depth === 0) {
        listEnd = i;
        break;
      }
    } else if (item.type === 'list_item_start' && depth === 1) {
      itemMark = i + 1;
    } else if (item.type === 'list_item_end' && depth === 1) {
      items.push(md.slice(itemMark, i));
    }
  }

  // List end not found
  if (i === md.length)
    return [];

  var questions = items.map(function(subitems) {
    return subitems.filter(function(sub) {
      return sub.type === 'text';
    }).map(function(sub) {
      return sub.text;
    }).join(' ');
  });

  return questions.map(function(q) {
    return this.parseQuestion(q);
  }, this).filter(function(q) {
    return q;
  });
};

Contributing.prototype.parseQuestion = function parseQuestion(text) {
  var type;
  if (/_\s*Issue-only\s*_/i.test(text))
    type = 'issue';
  else if (/_\s*PR-only\s*_/i.test(text))
    type = 'pr';
  else
    type = 'any';

  var expected = /^\s*(yes)\s*$/ig;
  var subtype = 'yesno';

  var oneof = text.match(/_\s*One\s+of:\s*`([^`]+)`\s*_/);
  if (oneof !== null) {
    expected = new RegExp('^\\s*(' + oneof[1].split(/\s*,\s*/g).join('|') +
                            ')\\s*$',
                          'i');
    subtype = 'oneof';
  }

  return {
    text: text,
    type: type,
    subtype: subtype,
    expected: expected
  };
};

function RenderState(parent, type) {
  this.parent = parent;
  this.type = type;
  if (this.parent)
    this.indent = this.parent.indent;
  else
    this.indent = '';
  this.ordered = false;
  this.index = 0;
}

Contributing.prototype.renderMd = function renderMd(md) {
  var heading = [ '#', '##', '###', '####', '#####' ];
  var text = '';
  var state = new RenderState(null, 'main');
  for (var i = 0; i < md.length; i++) {
    var item = md[i];

    if (item.type === 'list_start') {
      state = new RenderState(state, 'list');
      state.list = true;
      state.ordered = item.ordered;
      continue;
    } else if (item.type === 'list_end' || item.type === 'list_item_end') {
      state = state.parent;
      continue;
    } else if (item.type === 'list_item_start') {
      state = new RenderState(state, 'list-item');
      state.parent.index++;
      if (state.parent.ordered === false) {
        text += state.indent + '* ';
        state.indent += '  ';
      } else {
        var prefix = state.parent.index + '. ';
        text += state.indent + prefix;
        state.indent += new Array(prefix.length + 1).join(' ');
      }

      if (i + 1 >= md.length || md[i + 1].type === 'list_start')
        continue;
      i++;
      item = md[i];
    } else if (item.type === 'space') {
      text += '\n';
      continue;
    } else {
      text += state.indent;
    }

    if (item.type === 'paragraph')
      text += item.text + '\n';
    else if (item.type === 'text')
      text += item.text;
    else if (item.type === 'heading')
      text += heading[item.depth - 1] + ' ' + item.text;
    else
      throw new Error('Unsupported markdown node: ' + item.type);

    text += '\n';
  }

  return text;
};

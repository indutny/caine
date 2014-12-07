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

  // Re-render relevant part of markdown
  var cainesMd = this.renderMd(caines);
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

var markdown = require('markdown');

function Contributing() {
}
module.exports = new Contributing();

Contributing.prototype.parse = function parse(text) {
  console.log(text);
};

var assert = require('assert');
var github = require('github');

var caine = require('../caine');
var contributing = caine.contributing;

function Caine(options) {
  this.options = options;

  assert(this.options, 'options is a required argument');
  assert(this.options.token, 'options.token is a required argument');
  assert(this.options.repo, 'options.repo is a required argument');
  assert(this.options.contributing,
         'options.contributing is a required argument');

  this.github = new github({
    version: '3.0.0',
    protocol: 'https',
    headers: {
      'User-Agent': 'Caine, the PR butler'
    },
  });
  this.github.authenticate({
    type: 'oauth',
    token: this.options.token
  });

  var match = this.options.repo.match(/^([^\/]+)\/([^#]+)#(.*)$/);
  assert(match, 'Invalid options.repo, should be `user/repo#branch`');

  this.repo = {
    user: match[1],
    repo: match[2],
    branch: match[3]
  };
  this.contributing = null;
}
module.exports = Caine;

Caine.create = function create(options) {
  return new Caine(options);
};

Caine.prototype.init = function init(cb) {
  var self = this;
  this.getContributing(function(err, contributing) {
    if (err)
      cb(err);
    self.contributing = contributing;
    cb(null);
  });
};
Caine.prototype.getContributing = function getContributing(cb) {
  var self = this;

  // Fetch CONTRIBUTING.md
  this.github.repos.getContent({
    user: self.repo.user,
    repo: self.repo.repo,
    path: self.options.contributing,
    ref: self.repo.branch
  }, function(err, file) {
    if (err)
      return cb(err);

    console.log(file);
  });
};


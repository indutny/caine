var assert = require('assert');
var async = require('async');
var github = require('github');
var request = require('request');
var Buffer = require('buffer').Buffer;

var caine = require('../caine');
var contributing = caine.contributing;

function Caine(options) {
  this.options = options;

  assert(this.options, 'options is a required argument');
  assert(this.options.token, 'options.token is a required argument');
  assert(this.options.repo, 'options.repo is a required argument');
  assert(this.options.contributing,
         'options.contributing is a required argument');
  assert(this.options.label,
         'options.label is a required argument');

  this.github = new github({
    version: '3.0.0',
    protocol: 'https',
    headers: {
      'User-Agent': caine.ua
    }
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
  this.timestamp = new Date(this.options.timestamp | 0);
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

    var file = new Buffer(file.content, 'base64').toString();
    cb(null, contributing.parse(file));
  });
};

Caine.prototype.getIssues = function getIssues(page, cb) {
  var self = this;

  if (typeof page === 'function') {
    cb = page;
    page = 1;
  }

  this.github.issues.repoIssues({
    user: self.repo.user,
    repo: self.repo.repo,
    state: 'open',
    assignee: 'none',
    since: this.timestamp,
    sort: 'updated',
    direction: 'desc',
    per_page: 100,
    page: page
  }, function(err, res) {
    if (err)
      return cb(err);

    if (res.length < 100)
      return cb(null, res);

    self.getIssues(page + 1, function(err, next) {
      if (err)
        return cb(err);
      cb(null, res.concat(next));
    });
  });
};

Caine.prototype.poll = function poll(cb) {
  var self = this;
  this.getIssues(function(err, issues) {
    if (err)
      return cb(err);

    // No issues
    if (issues.length === 0)
      return cb(null);

    // Update timestamp
    self.timestamp = new Date(issues[0].updated_at);

    async.forEach(issues, function(issue, cb) {
      self.handleIssue(issue, cb);
    }, cb);
  });
};

Caine.prototype.handleIssue = function handleIssue(issue, cb) {
  var type = issue.pull_request ? 'issue' : 'pr';

  var pre = contributing.test(this.contributing.questions, issue.body, {
    type: type
  });

  // Nice, preliminary check passes!
  if (pre.ok)
    return this.tagIssue(issue, pre, cb);

  var hasLabel = issue.labels.some(function(label) {
    return label.name === this.options.label;
  }, this);

  // No comments to the
  if (issue.comments === 0 || !hasLabel)
    return this.replyToIssue(issue, cb);

  this.github.getIssueComments(issue, function(err, comments) {
    if (err)
      return cb(err);

    comments.some(function(comment) {
    });
  });
};

Caine.prototype._githubReq = function _githubReq(method, path, body, cb) {
  var authPath = 'https://api.github.com' + path +
              '?access_token=' + this.options.token;

  var json = JSON.stringify(body);

  request(authPath, {
    method: method,
    headers: {
      host: 'api.github.com',
      accept: 'application/vnd.github.v3+json',
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(json),
      'user-agent': caine.ua
    },
    body: json
  }, function(err, res, body) {
    if (err)
      return cb(err);
    if (res.statusCode < 200 || res.statusCode >= 400)
      return cb(new Error('Invalid status code: ' + res.statusCode));

    try {
      cb(null, JSON.parse(body));
    } catch (e) {
      cb(e);
    }
  })
};

Caine.prototype.replaceLabels = function replaceLabels(issue, labels, cb) {
  var path = '/repos/' + this.repo.user + '/' + this.repo.repo +
             '/issues/' + issue.number + '/labels'
  this._githubReq('put', path, labels, cb);
};

Caine.prototype.tagIssue = function tagIssue(issue, checks, cb) {
};

Caine.prototype.replyToIssue = function replyToIssue(issue, cb) {
  var self = this;
  this.replaceLabels(issue, [ this.options.label ], function(err, res) {
    if (err)
      return cb(err);

    // Post a comment
    var params = {
      user: self.repo.user,
      repo: self.repo.repo,
      number: issue.number,
      body: self.contributing.text
    };

    if (issue.pull_request)
      self.github.pullRequests.createComment(params, cb);
    else
      self.github.issues.createComment(params, cb);
  });
};

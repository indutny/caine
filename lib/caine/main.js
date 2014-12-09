var assert = require('assert');
var async = require('async');
var github = require('github');
var request = require('request');
var util = require('util');
var Buffer = require('buffer').Buffer;
var EventEmitter = require('events').EventEmitter;

var caine = require('../caine');
var contributing = caine.contributing;

function Caine(options) {
  EventEmitter.call(this);
  this.options = options;

  assert(this.options, 'options is a required argument');
  assert(this.options.token, 'options.token is a required argument');
  assert(this.options.repo, 'options.repo is a required argument');
  assert(this.options.contributing,
         'options.contributing is a required argument');
  assert(this.options.labels,
         'options.labels is a required argument');
  assert(this.options.labels.waiting,
         'options.labels.waiting is a required argument');
  assert(this.options.labels.success,
         'options.labels.success is a required argument');

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
  this.user = null;
  this.contributing = null;
  if (this.options.timestamp)
    this.timestamp = new Date(this.options.timestamp - 0);
  else
    this.timestamp = new Date();
}
util.inherits(Caine, EventEmitter);
module.exports = Caine;

Caine.create = function create(options) {
  return new Caine(options);
};

Caine.prototype.init = function init(cb) {
  var self = this;
  this.github.user.get({}, function(err, user) {
    if (err)
      return cb(err);

    self.user = user.login;
    cb(null);
  });
};

Caine.prototype.getContributing = function getContributing(cb) {
  var self = this;

  var headers = {};
  if (self.contributing && self.contributing.etag)
    headers['if-none-match'] = self.contributing.etag;

  // Fetch CONTRIBUTING.md
  this.github.repos.getContent({
    user: self.repo.user,
    repo: self.repo.repo,
    path: self.options.contributing,
    ref: self.repo.branch,
    headers: headers
  }, function(err, file) {
    if (err)
      return cb(err);

    self.emit('ratelimit', file.meta);

    if (file.meta.etag === headers['if-none-match']) {
      assert(self.contributing);
      return cb(null, self.contributing);
    }

    var text = new Buffer(file.content, 'base64').toString();
    var contrib = contributing.parse(text);
    contrib.etag = file.meta.etag;
    cb(null, contrib);
  });
};

Caine.prototype.asyncCollect = function asyncCollect(mediator, cb) {
  var last = 100;
  var page = 1;
  var out = [];

  async.whilst(function() {
    return last === 100;
  }, function(cb) {
    mediator(page++, function(err, results) {
      if (err)
        return cb(err);

      out = out.concat(results);
      last = results.length;
      cb(null);
    })
  }, function(err) {
    if (err)
      return cb(err);
    cb(null, out);
  })
};

Caine.prototype.poll = function poll(cb) {
  var self = this;

  this.getContributing(function(err, contributing) {
    if (err)
      return cb(err);

    // Update contributing
    self.contributing = contributing;

    self.asyncCollect(function(page, cb) {
      self.github.issues.repoIssues({
        user: self.repo.user,
        repo: self.repo.repo,
        state: 'open',
        assignee: 'none',
        since: self.timestamp,
        sort: 'updated',
        direction: 'desc',
        per_page: 100,
        page: page
      }, cb);
    }, function(err, issues) {
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
  });
};

Caine.prototype.handleIssue = function handleIssue(issue, cb) {
  var type = issue.pull_request ? 'pr' : 'issue';

  var pre = contributing.test(this.contributing.questions, issue.body, {
    user: this.user,
    type: type
  });

  // Successfuly handled, but not assigned
  var hasLabel = issue.labels.some(function(label) {
    return label.name === this.options.labels.success;
  }, this);
  if (hasLabel)
    return cb(null);

  // Nice, preliminary check passes!
  if (pre.ok)
    return this.tagIssue(issue, pre, cb);

  var hasLabel = issue.labels.some(function(label) {
    return label.name === this.options.labels.waiting;
  }, this);

  // No comments to the
  if (issue.comments === 0 || !hasLabel)
    return this.replyToIssue(issue, cb);

  var self = this;
  this.asyncCollect(function(page, cb) {
    var params = {
      user: self.repo.user,
      repo: self.repo.repo,
      number: issue.number,
      per_page: 100,
      page: page
    };
    self.github.issues.getComments(params, cb);
  }, function(err, comments) {
    if (err)
      return cb(err);

    // Check only after last Caine's comment
    for (var i = comments.length - 1; i >= 0; i--)
      if (comments[i].user.login === self.user)
        break;
    comments = comments.slice(i);

    // Filter author's comments
    comments = comments.filter(function(comment) {
      return comment.user.login === issue.user.login;
    });

    if (comments.length === 0)
      return cb(null);

    var last = comments.pop();
    var check = contributing.test(self.contributing.questions, last.body, {
      user: self.user,
      type: type
    });

    // If bot wasn't mentioned - ignore the comment
    if (!check.mention)
      return cb(null);

    if (check.ok)
      return self.tagIssue(issue, check, cb);

    self.postNegative(issue, check, cb);
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
      var data = JSON.parse(body);
    } catch (e) {
      cb(e);
      return;
    }
    cb(null, data);
  })
};

Caine.prototype.replaceLabels = function replaceLabels(issue, labels, cb) {
  var path = '/repos/' + this.repo.user + '/' + this.repo.repo +
             '/issues/' + issue.number + '/labels'
  this._githubReq('put', path, labels, cb);
};

Caine.prototype.tagIssue = function tagIssue(issue, check, cb) {
  var self = this;
  var questions = this.contributing.questions;

  var assignee = null;
  var resp = this.contributing.responsibilities;
  var labels = check.results.map(function(check, i) {
    if (check.label) {
      if (!assignee && resp.hasOwnProperty(check.answer))
        assignee = resp[check.answer];
      return check.answer;
    }

    return false;
  }).filter(function(label) {
    return label;
  });

  labels.push(this.options.labels.success);

  // Select random assignee
  if (assignee) {
    assignee = assignee[(Math.random() * assignee.length) | 0];

    this.github.issues.edit({
      user: self.repo.user,
      repo: self.repo.repo,
      number: issue.number,
      title: issue.title,
      body: issue.body,
      assignee: assignee,
      milestone: issue.milestone && issue.milestone.number,
      labels: labels
    }, onLabels);
  } else {
    this.replaceLabels(issue, labels, onLabels);
  }

  function onLabels(err) {
    if (err)
      return cb(err);

    // No message - no comment
    if (!self.contributing.text.success)
      return onComment(null);

    self.cleanupComments(issue, onCleanup);
  }

  function onCleanup(err) {
    if (err)
      return cb(err);

    var params = {
      user: self.repo.user,
      repo: self.repo.repo,
      number: issue.number,
      body: self.contributing.text.success
    };

    self.github.issues.createComment(params, cb);
  }
};

Caine.prototype.cleanupComments = function cleanupComments(issue, cb) {
  var self = this;

  this.asyncCollect(function(page, cb) {
    var params = {
      user: self.repo.user,
      repo: self.repo.repo,
      number: issue.number,
      per_page: 100,
      page: page
    };
    self.github.issues.getComments(params, cb);
  }, function(err, comments) {
    if (err)
      return cb(err);

    comments = comments.filter(function(comment) {
      return comment.user.login === self.user;
    });

    async.forEach(comments, function del(comment, cb) {
      self.github.issues.deleteComment({
        user: self.repo.user,
        repo: self.repo.repo,
        id: comment.id
      })
    }, cb);
  });
};

Caine.prototype.replyToIssue = function replyToIssue(issue, cb) {
  var self = this;
  var labels = [ this.options.labels.waiting ];
  this.replaceLabels(issue, labels, function(err, res) {
    if (err)
      return cb(err);

    // Post a comment
    var params = {
      user: self.repo.user,
      repo: self.repo.repo,
      number: issue.number,
      body: self.contributing.text[issue.pull_request ? 'pr' : 'issue']
    };

    self.github.issues.createComment(params, cb);
  });
};

Caine.prototype.postNegative = function postNegative(issue, check, cb) {
  var body = this.contributing.text.error + '\n\n' +
             check.results.map(function(result, i) {
    var prefix = i + '. ';
    if (result.ok)
      return prefix + ' validated';
    else
      return prefix + result.reason;
  }).join('\n');

  var params = {
    user: this.repo.user,
    repo: this.repo.repo,
    number: issue.number,
    body: body
  };

  this.github.issues.createComment(params, cb);
};

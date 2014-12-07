var request = require('request');
var Buffer = require('buffer').Buffer;
var caine = require('../caine');

exports.getToken = function getToken(user, pass, cb) {
  request.post('https://api.github.com/authorizations', {
    headers: {
      'User-Agent': caine.ua
    },
    auth: {
      user: user,
      pass: pass
    },
    body: JSON.stringify({
      scopes: [ 'repo' ],
      note: 'Caine, the PR butler'
    })
  }, function(err, res, body) {
    if (err)
      return cb(err);
    if (res.statusCode < 200 || res.statusCode >= 400)
      return cb(new Error('Invalid status code: ' + res.statusCode));

    try {
      cb(null, JSON.parse(body).token);
    } catch (e) {
      cb(e);
    }
  });
};

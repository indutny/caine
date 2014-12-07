var caine = exports;

// User-Agent
caine.ua = 'Caine, the PR butler';

// Just a helper for CLI
caine.getToken = require('./caine/github').getToken;

caine.contributing = require('./caine/contributing');
caine.create = require('./caine/main').create;

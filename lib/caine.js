var caine = exports;

// Just a helper for CLI
caine.getToken = require('./caine/github').getToken;

caine.contributing = require('./caine/contributing');
caine.create = require('./caine/main').create;

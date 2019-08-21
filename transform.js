const config = require('./babel.config.js');
module.exports = require('babel-jest').createTransformer(config);

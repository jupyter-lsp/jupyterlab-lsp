const path = require('path');

module.exports = {
  mode: 'production',
  entry: {
    index: './lib/index.js'
  },
  resolve: {
    extensions: ['.js']
  },
  target: 'web',
  node: {
    net: 'mock'
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    library: 'lsp-ws-connection',
    libraryTarget: 'umd'
  }
};

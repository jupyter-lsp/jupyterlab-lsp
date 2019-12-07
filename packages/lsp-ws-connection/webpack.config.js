const path = require('path');

module.exports = {
  mode: 'production',
  entry: {
    index: './lib/index.js'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        use: ['source-map-loader'],
        enforce: 'pre',
        // eslint-disable-next-line no-undef
        exclude: /node_modules/
      },
      { test: /\.js.map$/, use: 'file-loader' }
    ]
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

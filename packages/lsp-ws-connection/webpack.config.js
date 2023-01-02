const path = require('path');

const webpack = require('webpack');

module.exports = {
  mode: 'production',
  devtool: 'source-map',
  entry: {
    index: './lib/index.js'
  },
  target: 'web',
  resolve: {
    extensions: ['.js'],
    fallback: {
      net: false,
      path: false,
      crypto: false,
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('buffer')
    }
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    library: 'lsp-ws-connection',
    libraryTarget: 'umd'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        use: ['source-map-loader']
      }
    ]
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer']
    }),
    new webpack.ProvidePlugin({
      process: 'process/browser'
    })
  ]
};

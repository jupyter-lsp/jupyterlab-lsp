module.exports = {
  output: {
    clean: true
  },
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.js$/,
        use: ['source-map-loader']
      }
    ]
  }
};

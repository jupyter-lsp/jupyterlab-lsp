process.env.CHROME_BIN = require('puppeteer').executablePath();

module.exports = function(config) {
  config.set({
    basePath: '',

    files: [
      // The entry files are processed by webpack
      'test/**/*.test.ts'
    ],

    browsers: ['ChromeHeadless'],

    mime: {
      'text/x-typescript': ['ts', 'tsx']
    },

    module: 'commonjs',

    singleRun: true,
    autoWatch: false,
    colors: true,

    frameworks: ['mocha'],

    reporters: ['mocha'],

    preprocessors: {
      '**/*!(.d).ts': 'webpack',
      '**/*!(.d).js': 'webpack'
    },

    plugins: [
      'karma-mocha',
      'karma-chrome-launcher',
      'karma-webpack',
      'karma-mocha-reporter'
    ],

    webpack: {
      mode: 'development',
      module: {
        rules: [
          {
            test: /\.tsx?$/,
            use: 'ts-loader',
            exclude: /node_modules/
          },
          {
            test: /\.css$/,
            use: [{ loader: 'style-loader' }, { loader: 'css-loader' }]
          }
        ]
      },
      resolve: {
        extensions: ['.tsx', '.ts', '.js']
      },
      target: 'web',
      node: {
        net: 'mock'
      }
    }
  });
};

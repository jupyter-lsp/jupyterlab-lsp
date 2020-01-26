process.env.CHROME_BIN = require('puppeteer').executablePath();

module.exports = function(config) {
  config.set({
    basePath: '',

    files: [
      // The entry files are processed by webpack
      'lib/test/**/*.test.js'
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

    reporters: ['mocha', 'junit'],

    preprocessors: {
      '**/*!(.d).ts': 'webpack',
      '**/*!(.d).js': 'webpack'
    },

    junitReporter: {
      outputDir: '.',
      outputFile: 'junit.xml'
    },

    webpack: {
      mode: 'development',
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

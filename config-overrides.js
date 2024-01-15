const webpack = require('webpack');
module.exports = function override(config, env) {
  config.resolve.fallback = {
//    stream: require.resolve('stream-browserify'),
    util: require.resolve('util'),
    buffer: require.resolve('buffer'),
    fs: false,
    os: false,
    path: false,
  };
  config.plugins = (config.plugins || []).concat([
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
//      process: 'process/browser',
    }),
  ]);
  //  config.cache = false;
  return config;
};

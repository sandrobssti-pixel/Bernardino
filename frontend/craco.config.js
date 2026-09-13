const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.plugins = (webpackConfig.plugins || []).filter(
        (plugin) => plugin?.constructor?.name !== "ESLintWebpackPlugin"
      );

      webpackConfig.ignoreWarnings = [
        ...(webpackConfig.ignoreWarnings || []),
        (warning) =>
          typeof warning?.message === "string" &&
          warning.message.includes(
            "html2pdf.js/dist/es6-promise.map"
          )
      ];

      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        path: "path-browserify",
        buffer: "buffer"
      };

      webpackConfig.module.rules.push({
        test: /\.m?js$/,
        resolve: {
          fullySpecified: false // Permite imports sem extensão .js
        }
      });

      webpackConfig.plugins = [
        ...(webpackConfig.plugins || []),
        new NodePolyfillPlugin()
      ];

      webpackConfig.cache = {
        type: "filesystem",
        buildDependencies: {
          config: [__filename]
        }
      };

      return webpackConfig;
    }
  }
};

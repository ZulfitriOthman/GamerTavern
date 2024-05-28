// webpack.config.js

const path = require('path');

module.exports = {
  // Other webpack configurations...

  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'doc', 'index.html'), // Adjust the path as needed
      // Other HtmlWebpackPlugin configurations...
    }),
    // Other plugins...
  ],
};

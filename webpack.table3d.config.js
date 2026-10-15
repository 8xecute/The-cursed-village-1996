const path = require('path');

module.exports = {
    entry: './src/table3d.js',
    module: { rules: [{ test: /table3d\.js$/, type: 'javascript/auto' }] },
    output: {
        path: path.resolve(__dirname, 'public'),
        filename: 'table3d.bundle.js',
    },
    devtool: false,
    performance: { hints: false },
};

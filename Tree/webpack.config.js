var webpack = require('webpack');
var path = require('path');
const PATHS = {
    app: path.join(__dirname, 'js'),
    build: path.join(__dirname),
};

module.exports = {
    context: PATHS.app,
    entry: PATHS.app + "/index.js",
    output: {
        path: PATHS.build,
        filename: "app.js"
    },
    module: {
        loaders: [{
            test: /\.js$/,
            exclude: /(node_modules|bower_components)/,
            loader: 'babel', // 'babel-loader' is also a legal name to reference
            query: {
                presets: ['es2015']
            }
        }, {
            test: /\.css$/,
            loader: "style!css"
        }, {
            test: /\.(woff|woff2|eot|ttf|svg)$/,
            loader: 'url'
        }]
    },
    plugins: [new webpack.ProvidePlugin({
        $: "jquery",
        jQuery: "jquery"
    })]
};

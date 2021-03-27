module.exports = (options = {}) => config => ({
    ...config,
    webpack(wpcfg, ...a) {
        wpcfg = {
            ...wpcfg,
            module: {
                ...wpcfg.module,
                rules: [
                    ...wpcfg.module.rules,
                    { test: /\.mdx$/, use: [{ loader: 'xdm/webpack.cjs', options }] }
                ]
            }
        }

        if (config.webpack) wpcfg = config.webpack(wpcfg, ...a);
        return wpcfg;
    }
})
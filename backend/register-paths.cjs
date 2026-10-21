// Resolve existing src/* imports in emitted JS without a runtime TypeScript config.
require('tsconfig-paths').register({
  baseUrl: require('node:path').join(__dirname, 'dist'),
  paths: { 'src/*': ['*'] },
});

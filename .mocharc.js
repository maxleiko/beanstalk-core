module.exports = {
  extensions: ['ts'],
  spec: 'test/**/*.test.ts',
  require: 'ts-node/register',
  'inline-diffs': true,
  timeout: 5000,
  slow: 4500,
};

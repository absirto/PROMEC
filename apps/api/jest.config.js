const motor = require('path').resolve(__dirname, '../../packages/motor/src/index.ts');

module.exports = {
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { isolatedModules: true }] },
  moduleNameMapper: { '^@promec/motor$': motor, '^(\\.{1,2}/.*)\\.js$': '$1' },
  testEnvironment: 'node'
};

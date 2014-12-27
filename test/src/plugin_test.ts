import helper = require('../test_helper');

import Plugin = require('../../src/plugin');

describe('Plugin', () => {
  var instance: Plugin.Plugin;

  beforeEach(() => {
    instance = helper.createPlugin();
  });

  it('should have the env', () => {
    assert.strictEqual(instance.env.currentDirectory, instance.pluginDirectory);
  });

  it('should have the resolved defaultLibFileName', () => {
    var expected = process.cwd() + '/test/fixtures/plugin/lib.d.ts';
    assert.strictEqual(instance.defaultLibFileName, expected);
  });
});

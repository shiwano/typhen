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
});

import helper = require('../test_helper');

import Config = require('../../src/config');

describe('Config', () => {
  var instance: Config.Config;

  beforeEach(() => {
    instance = helper.createConfig();
  });

  it('should have the env', () => {
    assert.strictEqual(instance.env.currentDirectory, instance.cwd);
  });
});

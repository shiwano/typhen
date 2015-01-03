import helper = require('../test_helper');

import Config = require('../../src/config');

describe('Config', () => {
  var instance: Config.Config;

  beforeEach(() => {
    instance = helper.createConfig();
  });

  context('when the env option is not given', () => {
    it('should have the env', () => {
      assert.strictEqual(instance.env.currentDirectory, instance.cwd);
    });
  });

  context('when the typingDirectory option is not given', () => {
    it('should have the typingDirectory', () => {
      assert.strictEqual(instance.typingDirectory, process.cwd() + '/test/fixtures/typings');
    });
  });
});

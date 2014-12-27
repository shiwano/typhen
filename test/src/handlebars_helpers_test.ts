require('../test_helper');

import Handlebars = require('handlebars');
import HandlebarsHelpers = require('../../src/handlebars_helpers');

describe('HandlebarsHelpers', () => {
  var sandbox = sinon.sandbox.create();

  afterEach(() => {
    sandbox.restore();
  });

  describe('.registerHelpers', () => {
    beforeEach(() => {
      sandbox.stub(Handlebars, 'registerHelper');
      HandlebarsHelpers.registerHelpers(Handlebars);
    });

    it('should register all helpers to Handlebars', () => {
      var stub = (<SinonStub>Handlebars.registerHelper);

      assert.deepEqual(stub.args.every(a => a[1] instanceof Function), true);
      assert.deepEqual(stub.args.map(a => a[0]), [
        'underscore',
        'upperCamelCase',
        'lowerCamelCase'
      ]);
    });
  });
});

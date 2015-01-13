require('../test_helper');

import Handlebars = require('handlebars');

import LocalHandlebars = require('../../src/local_handlebars');

describe('LocalHandlebars', () => {
  var sandbox = sinon.sandbox.create();

  afterEach(() => {
    sandbox.restore();
  });

  describe('.HandlebarsHelpers', () => {
    describe('.and', () => {
      context('with truthy values', () => {
        it('should call options#fn', () => {
          var options = { fn: sandbox.stub().returns('fn'), inverse: sandbox.stub().returns('inverse') };
          var response = LocalHandlebars.HandlebarsHelpers.and(true, ['foo'], 'bar', options);
          assert(response === 'fn');
        });
      });

      context('with falsy values', () => {
        it('should call options#inverse', () => {
          var options = { fn: sandbox.stub().returns('fn'), inverse: sandbox.stub().returns('inverse') };
          var response = LocalHandlebars.HandlebarsHelpers.and(true, [], 'bar', options);
          assert(response === 'inverse');
        });
      });
    });

    describe('.or', () => {
      context('with truthy values', () => {
        it('should call options#fn', () => {
          var options = { fn: sandbox.stub().returns('fn'), inverse: sandbox.stub().returns('inverse') };
          var response = LocalHandlebars.HandlebarsHelpers.or(false, [], 0, options);
          assert(response === 'fn');
        });
      });

      context('with falsy values', () => {
        it('should call options#inverse', () => {
          var options = { fn: sandbox.stub().returns('fn'), inverse: sandbox.stub().returns('inverse') };
          var response = LocalHandlebars.HandlebarsHelpers.or(false, [], '', options);
          assert(response === 'inverse');
        });
      });
    });

    describe('.underscore', () => {
      it('should return a underscored string', () => {
        assert(LocalHandlebars.HandlebarsHelpers.underscore('App.FooBar.Qux') === 'app.foo_bar.qux');
      });
    });

    describe('.upperCamelCase', () => {
      it('should return a upperCamelCaseed string', () => {
        assert(LocalHandlebars.HandlebarsHelpers.upperCamelCase('app.foo_bar.qux') === 'App.FooBar.Qux');
      });
    });

    describe('.lowerCamelCase', () => {
      it('should return a lowerCamelCaseed string', () => {
        assert(LocalHandlebars.HandlebarsHelpers.lowerCamelCase('app.foo_bar.qux') === 'app.fooBar.qux');
      });
    });

    describe('.pluralize', () => {
      it('should return a pluralized string', () => {
        assert(LocalHandlebars.HandlebarsHelpers.pluralize('person') === 'people');
      });
    });

    describe('.singularize', () => {
      it('should return a singularized string', () => {
        assert(LocalHandlebars.HandlebarsHelpers.singularize('people') === 'person');
      });
    });
  });

  describe('.handlebars', () => {
    it('should export local handlebars', () => {
      assert(LocalHandlebars.handlebars.registerHelper);
      assert(LocalHandlebars.handlebars !== Handlebars);
    });
  });

  describe('.registerHelpers', () => {
    beforeEach(() => {
      sandbox.stub(Handlebars, 'registerHelper');
      LocalHandlebars.registerHelpers(Handlebars);
    });

    it('should register all helpers to Handlebars', () => {
      var handlebarStub = (<SinonStub>Handlebars.registerHelper);

      assert.deepEqual(handlebarStub.args.every(a => a[1] instanceof Function), true);
      assert.deepEqual(handlebarStub.args.map(a => a[0]), Object.keys(LocalHandlebars.HandlebarsHelpers));
    });
  });
});

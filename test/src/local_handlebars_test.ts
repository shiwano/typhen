require('../test_helper');

import Handlebars = require('handlebars');

import Helpers = require('../../src/helpers');
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
      it('should call Helpers.underscore', () => {
        var spy = sandbox.spy(Helpers, 'underscore');
        LocalHandlebars.HandlebarsHelpers.underscore('App.FooBar.Qux');
        assert(spy.calledWith('App.FooBar.Qux'));
      });
    });

    describe('.upperCamelCase', () => {
      it('should call Helpers.upperCamelCase', () => {
        var spy = sandbox.spy(Helpers, 'upperCamelCase');
        LocalHandlebars.HandlebarsHelpers.upperCamelCase('app.foo_bar.qux');
        assert(spy.calledWith('app.foo_bar.qux'));
      });
    });

    describe('.lowerCamelCase', () => {
      it('should call Helpers.lowerCamelCase', () => {
        var spy = sandbox.spy(Helpers, 'lowerCamelCase');
        LocalHandlebars.HandlebarsHelpers.lowerCamelCase('app.foo_bar.qux');
        assert(spy.calledWith('app.foo_bar.qux'));
      });
    });

    describe('.pluralize', () => {
      it('should call Helpers.pluralize', () => {
        var spy = sandbox.spy(Helpers, 'pluralize');
        LocalHandlebars.HandlebarsHelpers.pluralize('person');
        assert(spy.calledWith('person'));
      });
    });

    describe('.singularize', () => {
      it('should call Helpers.singularize', () => {
        var spy = sandbox.spy(Helpers, 'singularize');
        LocalHandlebars.HandlebarsHelpers.singularize('people');
        assert(spy.calledWith('people'));
      });
    });

    describe('.defaultValue', () => {
      context('with existing value', () => {
        it('should return value', () => {
          assert(LocalHandlebars.HandlebarsHelpers.defaultValue('value', 'defaultValue') === 'value');
        });
      });

      context('with no existing value', () => {
        it('should return default value', () => {
          assert(LocalHandlebars.HandlebarsHelpers.defaultValue(null, 'defaultValue') === 'defaultValue');
          assert(LocalHandlebars.HandlebarsHelpers.defaultValue(undefined, 'defaultValue') === 'defaultValue');
        });
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

require('../test_helper');

import Helpers = require('../../src/helpers');

describe('Helpers', () => {
  describe('.underscore', () => {
    it('should return a underscored string', () => {
      assert(Helpers.underscore('App.FooBar.Qux') === 'app.foo_bar.qux');
    });
  });

  describe('.upperCamelCase', () => {
    it('should return a upperCamelCaseed string', () => {
      assert(Helpers.upperCamelCase('app.foo_bar.qux') === 'App.FooBar.Qux');
    });
  });

  describe('.lowerCamelCase', () => {
    it('should return a lowerCamelCaseed string', () => {
      assert(Helpers.lowerCamelCase('app.foo_bar.qux') === 'app.fooBar.qux');
    });
  });

  describe('.pluralize', () => {
    it('should return a pluralized string', () => {
      assert(Helpers.pluralize('person') === 'people');
    });
  });

  describe('.singularize', () => {
    it('should return a singularized string', () => {
      assert(Helpers.singularize('people') === 'person');
    });
  });
});

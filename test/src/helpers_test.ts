import '../test_helper';

import Helpers = require('../../src/helpers');

describe('Helpers', () => {
  describe('.underscore', () => {
    it('should return a underscored string', () => {
      assert(Helpers.underscore('App1.FooBar.Qux') === 'app1.foo_bar.qux');
    });
  });

  describe('.upperCamelCase', () => {
    it('should return a upperCamelCaseed string', () => {
      assert(Helpers.upperCamelCase('app1.foo_bar.qux') === 'App1.FooBar.Qux');
    });
  });

  describe('.lowerCamelCase', () => {
    it('should return a lowerCamelCaseed string', () => {
      assert(Helpers.lowerCamelCase('app1.foo_bar.qux') === 'app1.fooBar.qux');
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

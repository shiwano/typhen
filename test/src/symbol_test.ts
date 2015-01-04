import helper = require('../test_helper');

import Runner = require('../../src/runner');
import Symbol = require('../../src/symbol');

describe('Symbol', () => {
  it('should export symbols for compiling', () => {
    assert(Symbol.Enum);
    assert(Symbol.Interface);
  });

  describe('.Enum', () => {
    var runner: Runner.Runner;
    var instance: Symbol.Enum;

    beforeEach(() => {
      runner = helper.createRunner();
      instance = helper.createEnum(runner);
    });

    describe('#constructor', () => {
      it('should have isEnum', () => assert(instance.isEnum === true));
      it('should have name', () => assert(instance.name === 'FooType'));
      it('should have fullName', () => assert(instance.fullName === 'App.Type.FooType'));
      it('should have namespace', () => assert(instance.namespace === 'App.Type'));
      it('should have comment', () => assert(instance.comment === 'awesome'));
      it('should have members', () => {
        assert.deepEqual(instance.members.map(m => m.name), ['Bar', 'Baz']);
        instance.members.forEach(m => {
          assert(m instanceof Symbol.EnumMember);
        });
      });
      it('should have tags', () => {
        assert.deepEqual(instance.tags, [
          { name: 'default', value: 'FooType.Bar' },
          { name: 'type', value: 'Enum' }
        ]);
      });

      context('when it has assumedName', () => {
        beforeEach(() => {
          instance.assumedName = 'SuperFooEnum';
        });

        it('should return assumedName as name', () => {
          assert(instance.name === 'SuperFooEnum');
        });
      });
    });

    describe('#destroy', () => {
      it('should delete own properties', () => {
        instance.destroy(true);
        assert(instance.rawName === undefined);
        assert(instance.members === undefined);
      });
    });
  });
});

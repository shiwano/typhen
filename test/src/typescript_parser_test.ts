import helper = require('../test_helper');

import TypeScriptParser = require('../../src/typescript_parser');
import Symbol = require('../../src/symbol');

describe('TypeScriptParser', () => {
  var instance: TypeScriptParser;
  var definitionPath = 'test/fixtures/typings/integration/index.d.ts';

  describe('#sourceFiles', () => {
    beforeEach(() => {
      var config = helper.createConfig();
      instance = new TypeScriptParser([definitionPath], config);
      instance.parse();
    });

    it('should return loaded instances of ts.SourceFile', () => {
      var expected = [
        'test/fixtures/typings/integration/color/color.d.ts',
        'test/fixtures/typings/integration/type.d.ts',
        'test/fixtures/typings/integration/rpc.d.ts',
        definitionPath
      ];
      assert.deepEqual(instance.sourceFiles.map(d => d.fileName), expected);
    });
  });

  describe('#parse', () => {
    context('when *.d.ts files as non external modules are given', () => {
      beforeEach(() => {
        var config = helper.createConfig();
        var instance = new TypeScriptParser([definitionPath], config);
        instance.parse();
      });

      it('should parse types', () => {
        var expected = [
          // Array
          'Line[]',
          'number[]',
          'string[]', // FIXME: Strange to say, this type is created by UnionType declaration.
          // Tuple
          'NumberAndNumberTuple',
          // UnionType
          'NumberAndDateUnionType',
          // Function
          'Rpc.Get.getRange', 'Rpc.Post.setOptions', 'Type.ColoredSquareSetColorCallbackFunction',
          'Type.LineSetColorCallbackFunction', 'emitLog',
          // ObjectType
          'Rpc.Get.GetRangeObject', 'Rpc.Post.SetOptionsOptionsObject',
          // Enum
          'Type.Color',
          // Interface
          'Type.ColoredSquare', 'Type.Point', 'Type.Range', 'Type.RangeOfNumber',
          'Type.Square', 'Type.SquareDictionary', 'Type.Transformer', 'Type.Time',
          // Class
          'Type.Line', 'Type.LineDrawer',
          // TypeAlias
          'Type.Predicate',
          // IntersectionType
          'Type.A', 'Type.B', 'Type.C',
          'AAndBAndCIntersectionType',
          // Abstract Class
          'Type.AbstractClass',
          // TypeParameter
          'Type.T', 'Type.T', 'Type.T',
          // PrimitiveType
          'boolean', 'number', 'symbol', 'string', 'void', 'any', 'integer'
        ].sort();
        assert.deepEqual(instance.types.map(t => t.fullName), expected);
      });

      it('should parse modules', () => {
        var expected = ['Global', 'Rpc.Get', 'Rpc.Post', 'Rpc', 'Type'].sort();
        assert.deepEqual(instance.modules.map(t => t.fullName), expected);
      });
    });

    context('when *.d.ts files as external modules are given', () => {
      var definitionPath = 'test/fixtures/typings/externals/foo.d.ts';

      beforeEach(() => {
        var config = helper.createConfig(definitionPath);
        instance = new TypeScriptParser([definitionPath], config);
        instance.parse();
      });

      it('should parse types', () => {
        var expected = ['foo.A.Foo', 'bar.Bar'].sort();
        assert.deepEqual(instance.types.map(t => t.fullName), expected);
      });

      it('should parse modules', () => {
        var expected = ['foo', 'foo.A', 'bar'].sort();
        assert.deepEqual(instance.modules.map(t => t.fullName), expected);
      });
    });

    context('when *.ts files are given', () => {
      var definitionPath = 'test/fixtures/typings/ts_files/foo.ts';

      beforeEach(() => {
        var config = helper.createConfig(definitionPath);
        instance = new TypeScriptParser([definitionPath], config);
        instance.parse();
      });

      it('should parse types', () => {
        var expected = ['foo.A.Foo', 'bar.Bar', 'void', 'string'].sort();
        assert.deepEqual(instance.types.map(t => t.fullName), expected);
      });

      it('should parse modules', () => {
        var expected = ['foo', 'foo.A', 'bar'].sort();
        assert.deepEqual(instance.modules.map(t => t.fullName), expected);
      });
    });

    context('when ts files that includes decorators are given', () => {
      var definitionPath = 'test/fixtures/typings/decorators/index.ts';
      var decoratedClass: Symbol.Class;

      beforeEach(() => {
        var config = helper.createConfig(definitionPath);
        instance = new TypeScriptParser([definitionPath], config);
        instance.parse();
        decoratedClass = instance.types.filter(t => t.name === 'DecoratedClass')[0] as Symbol.Class;
      });

      it('should parse class decorators', () => {
        assert(decoratedClass.decorators.length === 1);
        assert.deepEqual(decoratedClass.decorators[0].argumentTable, {});
      });

      it('should parse property decorators', () => {
        var decoratedProperty = decoratedClass.properties.filter(p => p.name === 'decoratedProperty')[0];
        var decoratedProperty2 = decoratedClass.properties.filter(p => p.name === 'decoratedProperty2')[0];
        assert(decoratedProperty.decorators.length === 1);
        assert(decoratedProperty2.decorators.length === 1);
        assert.deepEqual(decoratedProperty.decorators[0].argumentTable, {
          num: 1,
          str: 'foo',
          bool: true,
          func: 'function() { return \'1\'; }'
        });
        assert.deepEqual(decoratedProperty2.decorators[0].argumentTable, {
          num: -1,
          str: null,
          bool: false,
          func: '() => \'2\''
        });
      });

      it('should parse method decorators', () => {
        var decoratedMethod = decoratedClass.methods.filter(p => p.name === 'decoratedMethod')[0];
        assert(decoratedMethod.decorators.length === 2);
        assert.deepEqual(decoratedMethod.decorators[0].argumentTable, {});
        assert.deepEqual(decoratedMethod.decorators[1].argumentTable, {});
        assert(decoratedMethod.decorators[0].name === 'methodDecorator2');
        assert(decoratedMethod.decorators[1].name === 'methodDecorator');
      });

      it('should parse parameter decorators', () => {
        var decoratedMethod = decoratedClass.methods.filter(p => p.name === 'decoratedMethod')[0] as Symbol.Method;
        var decoratedParameter =  decoratedMethod.callSignatures[0].parameters[0];
        assert(decoratedParameter.decorators.length === 1);
        assert.deepEqual(decoratedParameter.decorators[0].argumentTable, {});
      });
    });
  });

  describe('#validate', () => {
    var config = helper.createConfig();

    beforeEach(() => {
      instance = new TypeScriptParser([definitionPath], config);
      instance.parse();
    });

    afterEach(() => {
      config.plugin.disallow = {};
    });

    context('in general', () => {
      it('should not throw an error', () => {
        assert.doesNotThrow(() => instance.validate());
      });
    });

    context('when dissalow#any is true', () => {
      beforeEach(() => {
        config.plugin.disallow.any = true;
      });
      it('should throw an error', () => {
        assert.throws(() => instance.validate(), /any type/);
      });
    });

    context('when dissalow#tuple is true', () => {
      beforeEach(() => {
        config.plugin.disallow.tuple = true;
      });
      it('should throw an error', () => {
        assert.throws(() => instance.validate(), /tuple type/);
      });
    });

    context('when dissalow#unionType is true', () => {
      beforeEach(() => {
        config.plugin.disallow.unionType = true;
      });
      it('should throw an error', () => {
        assert.throws(() => instance.validate(), /union type/);
      });
    });

    context('when dissalow#generics is true', () => {
      beforeEach(() => {
        config.plugin.disallow.generics = true;
      });
      it('should throw an error', () => {
        assert.throws(() => instance.validate(), /generics/);
      });
    });

    context('when dissalow#overload is true', () => {
      beforeEach(() => {
        config.plugin.disallow.overload = true;
      });
      it('should throw an error', () => {
        assert.throws(() => instance.validate(), /overload/);
      });
    });

    context('when dissalow#anonymousFunction is true', () => {
      beforeEach(() => {
        config.plugin.disallow.anonymousFunction = true;
      });
      it('should throw an error', () => {
        assert.throws(() => instance.validate(), /anonymous function/);
      });
    });

    context('when dissalow#anonymousObject is true', () => {
      beforeEach(() => {
        config.plugin.disallow.anonymousObject = true;
      });
      it('should throw an error', () => {
        assert.throws(() => instance.validate(), /anonymous object/);
      });
    });
  });
});

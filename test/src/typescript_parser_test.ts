import * as helper from '../test_helper';

import * as ts from 'typescript';
import * as assert from 'power-assert';

import * as symbol from '../../src/symbol';
import TypeScriptParser from '../../src/typescript_parser';

describe('TypeScriptParser', () => {
  let instance: TypeScriptParser;
  const definitionPath = 'test/fixtures/typings/integration/index.d.ts';

  describe('#sourceFiles', () => {
    beforeEach(() => {
      const config = helper.createConfig();
      instance = new TypeScriptParser([definitionPath], config);
      instance.parse();
    });

    it('should return loaded instances of ts.SourceFile', () => {
      const expected = [
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
        const config = helper.createConfig();
        const instance = new TypeScriptParser([definitionPath], config);
        instance.parse();
      });

      it('should parse types', () => {
        const expected = [
          // Runtime
          'StringAndString[]UnionType',
          'string[]', // This type is created by UnionType declaration.
          // Array
          'Line[]',
          'number[]',
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
          'Type.T', 'Type.T', 'Type.T', 'Type.T', 'Type.P',
          // PrimitiveType
          'boolean', 'number', 'symbol', 'string', 'void', 'any', 'integer',
          // Decorator
          'Type.TFunction', 'Type.classDecorator', 'Type.DecoratedClass',
          // Type Guard
          'Type.Cat', 'Type.isCat', 'Type.Animal',
          'Type.Animal', // This is a TypeParameter.
          // StringLiteralType
          '"foobar"',
          // BooleanLiteralType
          'true',
          // NumberLiteralType
          '100',
          // NullType
          'null',
          // NeverType
          'never',
          // EnumLiteralType
          'Type.EnumLiterals',
          'Type.EnumLiterals.EnumLiteralA',
          // Types for MappedType
          'Type.MappedType',
          'Type.MappedTypeParam',
          'Type.MappedTypeOfMappedTypeParam',
          'Type.method', // MappedType convert interface method to anonymous function.
          // IndexedAccessType
          'T[P]',
          'MappedTypeParam[P]',
          // IndexType
          'KeyofT'
        ].sort();
        assert.deepEqual(instance.types.map(t => t.fullName), expected);
      });

      it('should parse modules', () => {
        const expected = ['Global', 'Rpc.Get', 'Rpc.Post', 'Rpc', 'Type', 'Type.Namespace'].sort();
        assert.deepEqual(instance.modules.map(t => t.fullName), expected);
      });
    });

    context('when *.d.ts files as external modules are given', () => {
      const definitionPath = 'test/fixtures/typings/externals/foo.d.ts';

      beforeEach(() => {
        const config = helper.createConfig(definitionPath);
        instance = new TypeScriptParser([definitionPath], config);
        instance.parse();
      });

      it('should parse types', () => {
        const expected = ['foo.A.Foo', 'bar.Bar'].sort();
        assert.deepEqual(instance.types.map(t => t.fullName), expected);
      });

      it('should parse modules', () => {
        const expected = ['foo', 'foo.A', 'bar'].sort();
        assert.deepEqual(instance.modules.map(t => t.fullName), expected);
      });
    });

    context('when *.ts files are given', () => {
      const definitionPath = 'test/fixtures/typings/ts_files/foo.ts';

      beforeEach(() => {
        const config = helper.createConfig(definitionPath);
        instance = new TypeScriptParser([definitionPath], config);
        instance.parse();
      });

      it('should parse types', () => {
        const expected = ['foo.A.Foo', 'bar.Bar', 'void', 'string'].sort();
        assert.deepEqual(instance.types.map(t => t.fullName), expected);
      });

      it('should parse modules', () => {
        const expected = ['foo', 'foo.A', 'bar'].sort();
        assert.deepEqual(instance.modules.map(t => t.fullName), expected);
      });
    });

    context('when *.tsx files are given', () => {
      const definitionPath = 'test/fixtures/typings/tsx_files/index.tsx';

      beforeEach(() => {
        const config = helper.createConfig(definitionPath, { jsx: true });
        instance = new TypeScriptParser([definitionPath], config);
        instance.parse();
      });

      it('should parse types', () => {
        assert(instance.types.length > 0);
      });
    });

    context('when ts files that includes decorators are given', () => {
      const definitionPath = 'test/fixtures/typings/decorators/index.ts';
      let decoratedClass: symbol.Class;

      beforeEach(() => {
        const config = helper.createConfig(definitionPath);
        instance = new TypeScriptParser([definitionPath], config);
        instance.parse();
        decoratedClass = instance.types.filter(t => t.name === 'DecoratedClass')[0] as symbol.Class;
      });

      it('should parse class decorators', () => {
        assert(decoratedClass.decorators.length === 1);
        assert.deepEqual(decoratedClass.decorators[0].argumentTable, {});
      });

      it('should parse property decorators', () => {
        const decoratedProperty = decoratedClass.properties.filter(p => p.name === 'decoratedProperty')[0];
        const decoratedProperty2 = decoratedClass.properties.filter(p => p.name === 'decoratedProperty2')[0];
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
          str: '',
          bool: false,
          func: '() => \'2\''
        });
      });

      it('should parse method decorators', () => {
        const decoratedMethod = decoratedClass.methods.filter(p => p.name === 'decoratedMethod')[0];
        assert(decoratedMethod.decorators.length === 2);
        assert.deepEqual(decoratedMethod.decorators[0].argumentTable, {});
        assert.deepEqual(decoratedMethod.decorators[1].argumentTable, {});
        assert(decoratedMethod.decorators[0].name === 'methodDecorator2');
        assert(decoratedMethod.decorators[1].name === 'methodDecorator');
      });

      it('should parse parameter decorators', () => {
        const decoratedMethod = decoratedClass.methods.filter(p => p.name === 'decoratedMethod')[0] as symbol.Method;
        const decoratedParameter =  decoratedMethod.callSignatures[0].parameters[0];
        assert(decoratedParameter.decorators.length === 1);
        assert.deepEqual(decoratedParameter.decorators[0].argumentTable, {});
      });
    });

    context('when ES6 files are given', () => {
      const definitionPath = 'test/fixtures/typings/es6/index.ts';

      beforeEach(() => {
        const config = helper.createConfig(definitionPath, {
          module: ts.ModuleKind.None,
          target: ts.ScriptTarget.ES2015
        });
        instance = new TypeScriptParser([definitionPath], config);
        instance.parse();
      });

      it('should parse types', () => {
        const expected = [
          // ToPrimitive
          '\"default\"',
          '\"number\"',
          '\"string\"',
          'number',
          'string',
          'ToPrimitive',
          'StringAndNumberUnionType',
          // generator
          'any',
          'boolean',
          'generator'
        ].sort();
        assert.deepEqual(instance.types.map(t => t.fullName), expected);
      });

      it('should parse @@toPrimitive method', () => {
        const type = <symbol.Interface>instance.types
            .filter(t => t.fullName === 'ToPrimitive')[0];
        assert(type.methods.length === 0);
        assert(type.builtInSymbolMethods[0].name === '@@toPrimitive');
      });
    });

    context('when *.ts files for signature test are given', () => {
      const definitionPath = 'test/fixtures/typings/signature/index.ts';

      beforeEach(() => {
        const config = helper.createConfig(definitionPath);
        instance = new TypeScriptParser([definitionPath], config);
        instance.parse();
      });

      it('should parse parent modules', () => {
        const func = instance.types.filter(t => t.name === 'func')[0] as symbol.Function;
        assert(func.callSignatures[0].namespace, 'Module1.Module2');
      });

      it('should parse the call signature name', () => {
        const func = instance.types.filter(t => t.name === 'func')[0] as symbol.Function;
        assert(func.callSignatures[0].name === 'func');
      });

      it('should parse the documentation comment', () => {
        const func = instance.types.filter(t => t.name === 'func')[0] as symbol.Function;
        assert(func.callSignatures[0].comment === 'Comment');
      });

      it('should parse decorators', () => {
        const aClass = instance.types.filter(t => t.name === 'A')[0] as symbol.Class;
        const decoratedMethod = aClass.methods.filter(m => m.name === 'method')[0];
        assert(decoratedMethod.decorators.length === 1);
      });
    });

    context('when *.ts files for never type test are given', () => {
      const definitionPath = 'test/fixtures/typings/never/index.ts';

      beforeEach(() => {
        const config = helper.createConfig(definitionPath);
        instance = new TypeScriptParser([definitionPath], config);
        instance.parse();
      });

      it('should ignore never type', () => {
        assert.deepEqual(instance.types.map(t => t.name), ['string']);
      });
    });

    context('when *.d.ts files for strictNullChecks test are given', () => {
      const definitionPath = 'test/fixtures/typings/strict_null_checks/index.d.ts';

      beforeEach(() => {
        const config = helper.createConfig(definitionPath, { strictNullChecks: true });
        instance = new TypeScriptParser([definitionPath], config);
        instance.parse();
      });

      it('should parse types', () => {
        const expected = [
          'KeyofT',
          'MappedType',
          'MappedTypeOfMappedTypeParam',
          'MappedTypeParam',
          'MappedTypeParam[P]',
          'P',
          'T',
          'T[P]',
          'UndefinedAndMappedTypeParam[P]UnionType',
          'UndefinedAndNumberUnionType',
          'UndefinedAndT[P]UnionType',
          'number',
          'undefined'
        ].sort();
        assert.deepEqual(instance.types.map(t => t.fullName), expected);
      });
    });

    context('when *.ts files for getter and setter test are given', () => {
      const definitionPath = 'test/fixtures/typings/getter_setter/index.ts';

      beforeEach(() => {
        const config = helper.createConfig(definitionPath);
        instance = new TypeScriptParser([definitionPath], config);
        instance.parse();
      });

      it('should parse types', () => {
        const type = instance.types.filter(t => t.name === 'GetterSetterClass')[0] as symbol.Class;
        assert(type.properties.length === 3);
        assert(type.properties[0].name === 'foo');
        assert(type.properties[0].isReadonly === false);
        assert(type.properties[1].name === 'bar');
        assert(type.properties[1].isReadonly === true);
        assert(type.properties[2].name === 'baz');
        assert(type.properties[2].isReadonly === false);
      });
    });
  });

  describe('#validate', () => {
    const config = helper.createConfig();

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
        assert.throws(() => instance.validate(), /generic/);
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

    context('when dissalow#literalType is true', () => {
      beforeEach(() => {
        config.plugin.disallow.literalType = true;
      });
      it('should throw an error', () => {
        assert.throws(() => instance.validate(), /literal type/);
      });
    });

    context('when dissalow#mappedType is true', () => {
      beforeEach(() => {
        config.plugin.disallow.mappedType = true;
      });
      it('should throw an error', () => {
        assert.throws(() => instance.validate(), /mapped type/);
      });
    });
  });
});

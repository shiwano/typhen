import helper = require('../test_helper');

import tss = require('typescript-services-api');

import TypeScriptParser = require('../../src/typescript_parser');
import Symbol = require('../../src/symbol');

describe('TypeScriptParser', () => {
  var instance: TypeScriptParser;

  var definitionPath = 'test/fixtures/typings/definitions.d.ts';
  var colorPath = 'test/fixtures/typings/color/color.d.ts';

  var runner = helper.createRunner();

  beforeEach(() => {
    instance = new TypeScriptParser([definitionPath], runner);
  });

  describe('#sourceFiles', () => {
    it('should return loaded instances of ts.SourceFile', () => {
      var expected = [colorPath, definitionPath];
      assert.deepEqual(instance.sourceFiles.map(d => d.filename), expected);
    });
  });

  describe('#parse', () => {
    it('should return all Typhen types', () => {
      instance.parse();
      assert(instance.types.length > 0);
      instance.types.forEach(type => {
        assert(type instanceof Symbol.Type);
      });
    });
  });

  describe('#parseSourceFile', () => {
    it('should return Typhen types which is defined on source file', () => {
      var sourceFile = instance.sourceFiles[1];
      var types = instance.parseSourceFile(sourceFile);
      assert(types.length > 0);
      types.forEach(type => {
        assert(type instanceof Symbol.Type);
      });
    });
  });

  describe('#findTypesFromSourceFile', () => {
    it('should return specified tss.ts.Node array', () => {
      var sourceFile = instance.sourceFiles[1];
      var kinds = [tss.ts.SyntaxKind.InterfaceDeclaration];
      var types = instance.findTypesFromSourceFile(sourceFile, kinds);
      assert(types.length > 0);
      types.forEach(type => {
        assert(type.flags & tss.ts.TypeFlags.Interface);
      });
    });
  });
});

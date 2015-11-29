import * as helper from '../test_helper';
import * as ts from 'typescript';

import { Config } from '../../src/config';

describe('Config', () => {
  var instance: Config;

  beforeEach(() => {
    instance = helper.createConfig();
  });

  context('when the env option is not given', () => {
    it('should have the env', () => {
      assert(instance.env.currentDirectory === instance.cwd);
    });
  });

  context('when the typingDirectory option is not given', () => {
    it('should have the typingDirectory', () => {
      assert(instance.typingDirectory === process.cwd() + '/test/fixtures/typings/integration');
    });
  });

  describe('#getTypingDirectory', () => {
    context('in general', () => {
      it('should return the base directory name', () => {
        var args = ['foo/bar/test.ts', 'foo/bar.ts', 'foo/baz.ts'];
        assert(instance.getTypingDirectory(args) === process.cwd() + '/foo');
      });
    });

    context('with paths those are not in the cwd', () => {
      it('should return the cwd', () => {
        var args = ['foo/bar/test.ts', '../foo/bar.ts'];
        assert(instance.getTypingDirectory(args) === process.cwd());
      });
    });

    context('with paths those do not have the same base directory', () => {
      it('should return the cwd', () => {
        var args = ['foo/bar/test.ts', 'foo/bar.ts', 'baz/qux.ts'];
        assert(instance.getTypingDirectory(args) === process.cwd());
      });
    });
  });

  describe('#getCompilerOptionsEnum', () => {
    context('with a enum name as string', () => {
      it('should return a enum value', () => {
        assert(instance.getCompilerOptionsEnum<ts.ScriptTarget>('ES6') === ts.ScriptTarget.ES6);
      });
    });

    context('with a enum value', () => {
      it('should return a enum value', () => {
        assert(instance.getCompilerOptionsEnum<ts.ModuleKind>(1) === ts.ModuleKind.CommonJS);
      });
    });

    context('with null or undefined', () => {
      it('should return undefined', () => {
        assert(instance.getCompilerOptionsEnum<ts.ModuleKind>(null) === undefined);
        assert(instance.getCompilerOptionsEnum<ts.ModuleKind>(undefined) === undefined);
      });
    });

    context('with a invalid value', () => {
      it('should throw an error', () => {
        assert.throws(() => instance.getCompilerOptionsEnum<ts.ModuleKind>(true));
      });
    });
  });
});

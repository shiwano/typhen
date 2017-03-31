import * as helper from '../test_helper';
import * as ts from 'typescript';
import * as assert from 'power-assert';

import { Config } from '../../src/config';

describe('Config', () => {
  let instance: Config;

  context('when no arg is given', () => {
    beforeEach(() => {
      instance = helper.createConfig();
    });

    it('should have the env', () => {
      assert(instance.env.currentDirectory === instance.cwd);
    });

    it('should have the typingDirectory', () => {
      assert(instance.typingDirectory === process.cwd() + '/test/fixtures/typings/integration');
    });
  });

  context('when a include option is given', () => {
    beforeEach(() => {
      const include = ['test/fixtures/typings/integration/**/*'];
      instance = helper.createConfig([], null, include);
    });

    it('should parse the glob pattern', () => {
      assert.deepEqual(instance.src.sort(), [
        process.cwd() + '/test/fixtures/typings/integration/color/color.d.ts',
        process.cwd() + '/test/fixtures/typings/integration/index.d.ts',
        process.cwd() + '/test/fixtures/typings/integration/rpc.d.ts',
        process.cwd() + '/test/fixtures/typings/integration/type.d.ts'
      ]);
    });
  });

  context('when a exclude option is given', () => {
    beforeEach(() => {
      const include = ['test/fixtures/typings/integration/**/*'];
      const exclude = ['test/fixtures/typings/integration/color/**/*'];
      instance = helper.createConfig([], null, include, exclude);
    });

    it('should exclude the files', () => {
      assert.deepEqual(instance.src.sort(), [
        process.cwd() + '/test/fixtures/typings/integration/index.d.ts',
        process.cwd() + '/test/fixtures/typings/integration/rpc.d.ts',
        process.cwd() + '/test/fixtures/typings/integration/type.d.ts'
      ]);
    });
  });

  describe('#getTypingDirectory', () => {
    beforeEach(() => {
      instance = helper.createConfig();
    });

    it('should return the base directory name', () => {
      const args = ['foo/bar/test.ts', 'foo/bar.ts', 'foo/baz.ts'];
      assert(instance.getTypingDirectory(args) === process.cwd() + '/foo');
    });

    context('with paths those are not in the cwd', () => {
      it('should return the cwd', () => {
        const args = ['foo/bar/test.ts', '../foo/bar.ts'];
        assert(instance.getTypingDirectory(args) === process.cwd());
      });
    });

    context('with paths those do not have the same base directory', () => {
      it('should return the cwd', () => {
        const args = ['foo/bar/test.ts', 'foo/bar.ts', 'baz/qux.ts'];
        assert(instance.getTypingDirectory(args) === process.cwd());
      });
    });
  });

  describe('#resolveGlobPatterns', () => {
    beforeEach(() => {
      instance = helper.createConfig();
    });

    it('should resolveGlobPattern', () => {
      const patterns = ['test/fixtures/typings/integration/**/*'];
      assert.deepEqual(instance.resolveGlobPatterns(patterns), [
        process.cwd() + '/test/fixtures/typings/integration/color/color.d.ts',
        process.cwd() + '/test/fixtures/typings/integration/index.d.ts',
        process.cwd() + '/test/fixtures/typings/integration/rpc.d.ts',
        process.cwd() + '/test/fixtures/typings/integration/type.d.ts'
      ]);
    });

    context('with a path that is not a glob pattern', () => {
      it('should return the resolved path', () => {
        const str = ['test/fixtures/typings/integration'];
        assert.deepEqual(instance.resolveGlobPatterns(str), [
          process.cwd() + '/test/fixtures/typings/integration'
        ]);
      });
    });
  });
});

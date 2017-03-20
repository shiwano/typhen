import * as helper from '../test_helper';
import * as ts from 'typescript';
import * as assert from 'power-assert';

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
});

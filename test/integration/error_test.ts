import '../test_helper';

import * as fs from 'fs';
import * as glob from 'glob';
import * as rimraf from 'rimraf';
import * as assert from 'power-assert';

import typhen = require('../../src/index');
import * as logger from '../../src/logger';

describe('Error Test', () => {
  const errorFileNames = glob.sync('./test/fixtures/typings/errors/**/*.ts');
  let logLevelCache: logger.LogLevel;

  before(() => {
    logLevelCache = logger.level;
    logger.setLevel(logger.LogLevel.Silent);
  });

  after(() => {
    logger.setLevel(logLevelCache);
  });

  errorFileNames.forEach((errorFileName) => {
    context(errorFileName.replace('./test/fixtures/typings/errors/', ''), () => {
      const plugin = typhen.loadPlugin('./test/fixtures/plugin/typhen-test', {
        author: 'shiwano'
      });

      before((done) => {
        rimraf('./.tmp/generated', done);
      });

      it('should raise error', (done) => {
        typhen.run({
          plugin: plugin,
          src: errorFileName,
          dest: '.tmp/generated'
        }).catch(e => {
          done();
        });
      });

      it('should not generate anything', (done) => {
        logger.setLevel(logger.LogLevel.Silent);
        glob('./.tmp/generated/**/*.md', (err, fileNames) => {
          assert(fileNames.length === 0);
          done();
        });
      });
    });
  });
});

import '../test_helper';

import * as fs from 'fs';
import * as glob from 'glob';
import * as rimraf from 'rimraf';

import typhen = require('../../src/index');

describe('Error Test', () => {
  var errorFileNames = glob.sync('./test/fixtures/typings/errors/**/*.ts');

  errorFileNames.forEach((errorFileName) => {
    context(errorFileName.replace('./test/fixtures/typings/errors/', ''), () => {
      var plugin = typhen.loadPlugin('./test/fixtures/plugin/typhen-test', {
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
        glob('./.tmp/generated/**/*.md', (err, fileNames) => {
          assert(fileNames.length === 0);
          done();
        });
      });
    });
  });
});

require('../test_helper');

import fs = require('fs');
import glob = require('glob');
import rimraf = require('rimraf');

import Typhen = require('../../src/index');

describe('Error Test', () => {
  var errorFileNames = glob.sync('./test/fixtures/typings/errors/**/*.ts');

  errorFileNames.forEach((errorFileName) => {
    context(errorFileName.replace('./test/fixtures/typings/errors/', ''), () => {
      var plugin = Typhen.loadPlugin('./test/fixtures/plugin/typhen-test', {
        author: 'shiwano'
      });

      before((done) => {
        rimraf('./.tmp/generated', done);
      });

      it('should raise error', () => {
        assert.throws(() => {
          Typhen.run({
            plugin: plugin,
            src: errorFileName,
            dest: '.tmp/generated'
          });
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

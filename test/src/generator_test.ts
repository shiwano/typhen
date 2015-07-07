var helper = require('../test_helper');

import Generator = require('../../src/generator');

describe('Generator', () => {
  var sandbox = sinon.sandbox.create();
  var instance: Generator;

  beforeEach(() => {
    instance = helper.createGenerator();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('#generateUnlessExist', () => {
    beforeEach(() => {
      sandbox.stub(instance, 'generate');
    });

    it('should call Generator#generate', () => {
      instance.generateUnlessExist('README.md', 'README.md');
      assert((<SinonStub>instance.generate).calledWith('README.md', 'README.md', null, false));
    });
  });

  describe('#generate', () => {
    var data = helper.createEnum();

    context('with a file name', () => {
      var generated = 'This is README.';

      it('should return the file data', () => {
        assert(instance.generate('README.md', 'README.md').contents.toString() === generated);
      });
    });

    context('with a Handlebars template file name', () => {
      var generated = 'FooType\nBar: 0\nBaz: 1\n';

      it('should return the generated data by Handlebars', () => {
        assert(instance.generate('enum.hbs', 'underscore:**/*.txt', data).contents.toString() === generated);
      });
    });

    context('when overwrite argument is false', () => {
      var generated = 'This is README.';

      it('should not overwrite a existing file', () => {
        instance.generate('README.md', 'README.md', false);
        assert(instance.files.length === 0);
      });

      it('should not overwrite a existing virtual file', () => {
        instance.generate('README.md', 'NEW_README.md');
        instance.generate('README.md', 'NEW_README.md', false);
        assert(instance.files.length === 1);
      });
    });
  });

  describe('#replaceStars', () => {
    var type = helper.createEnum();

    context('with a file name which does not have stars', () => {
      it('should return the given file name', () => {
        assert(instance.replaceStars('foo/bar.txt', type) === 'foo/bar.txt');
      });
    });

    context('with a file name which has stars and no inflection type', () => {
      it('should return the replaced file name', () => {
        assert(instance.replaceStars('**/*.txt', type) === 'App/Type/FooType.txt');
      });
    });

    context('with a file name which has underscore inflection type', () => {
      it('should return the underscored file name', () => {
        assert(instance.replaceStars('underscore:**/*.txt', type) === 'app/type/foo_type.txt');
      });
    });

    context('with a file name which has upperCamelCase inflection type', () => {
      it('should return the upperCamelCased file name', () => {
        type.rawName = 'foo_type';
        assert(instance.replaceStars('upperCamelCase:**/*.txt', type) === 'App/Type/FooType.txt');
      });
    });

    context('with a file name which has lowerCamelCase inflection type', () => {
      it('should return the lowerCamelCased file name', () => {
        assert(instance.replaceStars('lowerCamelCase:**/*.txt', type) === 'app/type/fooType.txt');
      });
    });

    context('with a seperator', () => {
      it('should return a joined string with the separator', () => {
        assert(instance.replaceStars('lowerCamelCase:**/*.txt', type, '-') === 'app-type/fooType.txt');
      });
    });
  });
});

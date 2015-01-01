require('../test_helper');

import Logger = require('../../src/logger');

describe('Logger', () => {
  var sandbox = sinon.sandbox.create();
  var logStub: SinonStub;

  beforeEach(() => {
    Logger.colored = false;
    logStub = sandbox.stub(Logger, 'log');
    sandbox.stub(Logger, 'getDateTimeString').returns('00:00:00');
  });

  afterEach(() => {
    Logger.colored = true;
    sandbox.restore();
  });

  describe('.info', () => {
    it('should call Logger.log', () => {
      Logger.info('info');
      assert(logStub.calledWith('[00:00:00]', 'info'));
    });
  });

  describe('.warn', () => {
    it('should call Logger.log', () => {
      Logger.warn('warn');
      assert(logStub.calledWith('[00:00:00][WARN]', 'warn'));
    });
  });

  describe('.error', () => {
    it('should call Logger.log', () => {
      Logger.error('error');
      assert(logStub.calledWith('[00:00:00][ERROR]', 'error'));
    });
  });
});

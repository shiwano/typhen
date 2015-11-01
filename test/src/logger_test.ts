import '../test_helper';

import Logger = require('../../src/logger');

describe('Logger', () => {
  var sandbox = sinon.sandbox.create();
  var logStub: Sinon.SinonStub;

  beforeEach(() => {
    Logger.enableColor(false);
    Logger.level = Logger.LogLevel.Info;
    logStub = sandbox.stub(Logger, 'log');
    sandbox.stub(Logger, 'getDateTimeString').returns('00:00:00');
  });

  afterEach(() => {
    Logger.enableColor(true);
    Logger.level = Logger.LogLevel.Silent;
    sandbox.restore();
  });

  describe('.debug', () => {
    context('when the level is not LogLevel.Debug', () => {
      it('should not call Logger.debug', () => {
        Logger.debug('debug');
        assert(logStub.notCalled);
      });
    });

    context('when the level is LogLevel.Debug', () => {
      beforeEach(() => {
        Logger.level = Logger.LogLevel.Debug;
      });
      it('should call Logger.debug', () => {
        Logger.debug('debug');
        assert(logStub.calledWith('[00:00:00][DEBUG]', 'debug'));
      });
    });
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

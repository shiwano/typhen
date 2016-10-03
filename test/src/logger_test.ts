import '../test_helper';

import * as sinon from 'sinon';

import * as logger from '../../src/logger';

describe('logger', () => {
  var sandbox = sinon.sandbox.create();
  var logStub: Sinon.SinonStub;

  beforeEach(() => {
    logger.enableColor(false);
    // logger.level = logger.LogLevel.Info;
    logStub = sandbox.stub(logger, 'log');
    sandbox.stub(logger, 'getDateTimeString').returns('00:00:00');
  });

  afterEach(() => {
    logger.enableColor(true);
    // logger.level = logger.LogLevel.Silent;
    sandbox.restore();
  });

  describe('.debug', () => {
    context('when the level is not LogLevel.Debug', () => {
      it('should not call Logger.debug', () => {
        logger.debug('debug');
        assert(logStub.notCalled);
      });
    });

    context('when the level is LogLevel.Debug', () => {
      beforeEach(() => {
        // logger.level = logger.LogLevel.Debug;
      });
      it('should call Logger.debug', () => {
        logger.debug('debug');
        assert(logStub.calledWith('[00:00:00][DEBUG]', 'debug'));
      });
    });
  });

  describe('.info', () => {
    it('should call Logger.log', () => {
      logger.info('info');
      assert(logStub.calledWith('[00:00:00]', 'info'));
    });
  });

  describe('.warn', () => {
    it('should call Logger.log', () => {
      logger.warn('warn');
      assert(logStub.calledWith('[00:00:00][WARN]', 'warn'));
    });
  });

  describe('.error', () => {
    it('should call Logger.log', () => {
      logger.error('error');
      assert(logStub.calledWith('[00:00:00][ERROR]', 'error'));
    });
  });
});

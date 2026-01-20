/**
 * Tests for logger utility
 */
import { logger, LogLevel, configureLogger } from '../../src/utils/logger';

describe('Logger', () => {
  let originalLevel: LogLevel;

  beforeAll(() => {
    originalLevel = logger.getLevel();
  });

  afterEach(() => {
    logger.setLevel(originalLevel);
  });

  describe('configure', () => {
    it('should set log level via configure', () => {
      logger.configure({ level: LogLevel.WARN });
      expect(logger.getLevel()).toBe(LogLevel.WARN);
    });

    it('should set log level via setLevel', () => {
      logger.setLevel(LogLevel.INFO);
      expect(logger.getLevel()).toBe(LogLevel.INFO);
    });
  });

  describe('log methods', () => {
    let errorSpy: jest.SpyInstance;
    let warnSpy: jest.SpyInstance;
    let logSpy: jest.SpyInstance;
    let debugSpy: jest.SpyInstance;

    beforeEach(() => {
      errorSpy = jest.spyOn(console, 'error').mockImplementation();
      warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      logSpy = jest.spyOn(console, 'log').mockImplementation();
      debugSpy = jest.spyOn(console, 'debug').mockImplementation();
    });

    afterEach(() => {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
      logSpy.mockRestore();
      debugSpy.mockRestore();
    });

    it('should log errors at ERROR level', () => {
      logger.setLevel(LogLevel.ERROR);
      logger.error('Test error');
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Test error'));
    });

    it('should log warnings at WARN level', () => {
      logger.setLevel(LogLevel.WARN);
      logger.warn('Test warning');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Test warning'));
    });

    it('should log info at INFO level', () => {
      logger.setLevel(LogLevel.INFO);
      logger.info('Test info');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Test info'));
    });

    it('should log debug at DEBUG level', () => {
      logger.setLevel(LogLevel.DEBUG);
      logger.debug('Test debug');
      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Test debug'));
    });

    it('should log success at INFO level', () => {
      logger.setLevel(LogLevel.INFO);
      logger.success('Test success');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Test success'));
    });

    it('should pass additional arguments to console methods', () => {
      logger.setLevel(LogLevel.ERROR);
      const extra = { data: 'test' };
      logger.error('Test error', extra);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Test error'), extra);
    });
  });

  describe('log level filtering', () => {
    let errorSpy: jest.SpyInstance;
    let warnSpy: jest.SpyInstance;
    let logSpy: jest.SpyInstance;
    let debugSpy: jest.SpyInstance;

    beforeEach(() => {
      errorSpy = jest.spyOn(console, 'error').mockImplementation();
      warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      logSpy = jest.spyOn(console, 'log').mockImplementation();
      debugSpy = jest.spyOn(console, 'debug').mockImplementation();
    });

    afterEach(() => {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
      logSpy.mockRestore();
      debugSpy.mockRestore();
    });

    it('should not log anything at SILENT level', () => {
      logger.setLevel(LogLevel.SILENT);
      logger.error('Error');
      logger.warn('Warning');
      logger.info('Info');
      logger.debug('Debug');

      expect(errorSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(logSpy).not.toHaveBeenCalled();
      expect(debugSpy).not.toHaveBeenCalled();
    });

    it('should only log errors at ERROR level', () => {
      logger.setLevel(LogLevel.ERROR);
      logger.error('Error');
      logger.warn('Warning');
      logger.info('Info');
      logger.debug('Debug');

      expect(errorSpy).toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(logSpy).not.toHaveBeenCalled();
      expect(debugSpy).not.toHaveBeenCalled();
    });

    it('should log errors and warnings at WARN level', () => {
      logger.setLevel(LogLevel.WARN);
      logger.error('Error');
      logger.warn('Warning');
      logger.info('Info');
      logger.debug('Debug');

      expect(errorSpy).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
      expect(logSpy).not.toHaveBeenCalled();
      expect(debugSpy).not.toHaveBeenCalled();
    });

    it('should log errors, warnings, and info at INFO level', () => {
      logger.setLevel(LogLevel.INFO);
      logger.error('Error');
      logger.warn('Warning');
      logger.info('Info');
      logger.debug('Debug');

      expect(errorSpy).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalled();
      expect(debugSpy).not.toHaveBeenCalled();
    });

    it('should log everything at DEBUG level', () => {
      logger.setLevel(LogLevel.DEBUG);
      logger.error('Error');
      logger.warn('Warning');
      logger.info('Info');
      logger.debug('Debug');

      expect(errorSpy).toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalled();
      expect(debugSpy).toHaveBeenCalled();
    });
  });

  describe('scoped logger', () => {
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
      errorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      errorSpy.mockRestore();
    });

    it('should create a scoped logger with prefix', () => {
      logger.setLevel(LogLevel.ERROR);
      const scopedLogger = logger.scope('TestModule');
      scopedLogger.error('Scoped error');

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[TestModule]'));
    });

    it('should support all log methods', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const logSpy = jest.spyOn(console, 'log').mockImplementation();
      const debugSpy = jest.spyOn(console, 'debug').mockImplementation();

      logger.setLevel(LogLevel.DEBUG);
      const scopedLogger = logger.scope('Test');

      scopedLogger.error('Error');
      scopedLogger.warn('Warn');
      scopedLogger.info('Info');
      scopedLogger.debug('Debug');
      scopedLogger.success('Success');

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[Test]'));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[Test]'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[Test]'));
      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('[Test]'));

      warnSpy.mockRestore();
      logSpy.mockRestore();
      debugSpy.mockRestore();
    });
  });
});

describe('configureLogger', () => {
  let originalLevel: LogLevel;

  beforeAll(() => {
    originalLevel = logger.getLevel();
  });

  afterEach(() => {
    logger.setLevel(originalLevel);
  });

  it('should configure logger via exported function', () => {
    configureLogger({ level: LogLevel.INFO });
    expect(logger.getLevel()).toBe(LogLevel.INFO);
  });
});

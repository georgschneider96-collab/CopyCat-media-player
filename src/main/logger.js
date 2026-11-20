// src/main/logger.js
// Structured, prefixed logging module for VLCopyCat Electron Main process

const fs = require('fs');
const path = require('path');

let cachedLogPath = null;
let logStream = null;

function getLogFilePath() {
  if (!cachedLogPath) {
    if (process.env.COPYCAT_TEST_SUITE === '1' || process.env.NODE_ENV === 'test') {
      cachedLogPath = path.join(__dirname, '..', '..', 'tests', 'test-runs.log');
      return cachedLogPath;
    }
    try {
      const electron = require('electron');
      const app = electron.app;
      const baseDir = app && typeof app.getPath === 'function' ? app.getPath('userData') : path.join(__dirname, '..', '..');
      cachedLogPath = path.join(baseDir, 'copycat.log');
    } catch {
      cachedLogPath = path.join(__dirname, '..', '..', 'copycat.log');
    }
  }
  return cachedLogPath;
}

function getLogStream() {
  if (!logStream) {
    try {
      logStream = fs.createWriteStream(getLogFilePath(), { flags: 'a', encoding: 'utf8' });
      logStream.on('error', () => { logStream = null; });
    } catch {}
  }
  return logStream;
}

class Logger {
  constructor(scope = 'Main') {
    this.scope = scope;
    this.prefix = `[VLCopyCat:${scope}]`;
  }

  static getLogFile() {
    return getLogFilePath();
  }

  static writeToFile(level, scope, message, meta) {
    try {
      const stamp = new Date().toISOString();
      const metaStr = meta !== undefined && meta !== null
        ? (typeof meta === 'object' ? ` ${JSON.stringify(meta)}` : ` ${meta}`)
        : '';
      const line = `[${stamp}] [${level.toUpperCase()}] [${scope}] ${message}${metaStr}\n`;
      const stream = getLogStream();
      if (stream && stream.writable) {
        stream.write(line);
      } else {
        fs.appendFile(getLogFilePath(), line, 'utf8', () => {});
      }
    } catch {
      // Safe fallback: never crash on file logging errors
    }
  }

  static formatTime() {
    const d = new Date();
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    const ms = String(d.getMilliseconds()).padStart(3, '0');
    return `${h}:${m}:${s}.${ms}`;
  }

  log(level, message, ...args) {
    const time = Logger.formatTime();
    const tag = `${time} ${this.prefix}`;
    const meta = args.length > 0 ? (args.length === 1 ? args[0] : args) : null;

    if (level === 'error') {
      console.error(tag, message, ...args);
      Logger.writeToFile('error', this.scope, message, meta);
    } else if (level === 'warn') {
      console.warn(tag, message, ...args);
      Logger.writeToFile('warn', this.scope, message, meta);
    } else if (level === 'debug') {
      if (process.env.COPYCAT_DEBUG) {
        console.debug(tag, message, ...args);
        Logger.writeToFile('debug', this.scope, message, meta);
      }
    } else {
      console.log(tag, message, ...args);
      if (process.env.COPYCAT_DEBUG) {
        Logger.writeToFile('info', this.scope, message, meta);
      }
    }
  }

  info(msg, ...args) {
    this.log('info', msg, ...args);
  }

  warn(msg, ...args) {
    this.log('warn', msg, ...args);
  }

  error(msg, ...args) {
    this.log('error', msg, ...args);
  }

  debug(msg, ...args) {
    this.log('debug', msg, ...args);
  }

  forScope(childScope) {
    return new Logger(childScope);
  }
}

const defaultLogger = new Logger('Main');

module.exports = {
  Logger,
  logger: defaultLogger,
  createLogger: (scope) => new Logger(scope)
};

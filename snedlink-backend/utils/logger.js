const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
const errorLogPath = path.join(logDir, 'error.log');

function line(level, msg) {
  return `[${new Date().toISOString()}] ${level.toUpperCase()}: ${msg}\n`;
}

const logger = {
  info(msg) {
    process.stdout.write(line('info', msg));
  },
  warn(msg) {
    process.stdout.write(line('warn', msg));
  },
  error(msg) {
    const formatted = line('error', msg);
    process.stderr.write(formatted);
    fs.appendFile(errorLogPath, formatted, () => {});
  }
};

module.exports = logger;

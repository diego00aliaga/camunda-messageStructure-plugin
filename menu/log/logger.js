// logger.js
const fs = require('fs');
const path = require('path');
const os = require('os');

const LOG_FILE = path.join(os.tmpdir(), 'camunda-plugin.log');

function log(message, level = 'INFO') {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}\n`;
    fs.appendFileSync(LOG_FILE, logEntry, 'utf8');
  } catch (error) {
    // Si falla el logging, usar console como fallback (aunque no funcione en Camunda)
    console.error('Error escribiendo al log:', error);
  }
}

function getLogPath() {
  return LOG_FILE;
}

// Exportar las funciones
module.exports = {
  log,
  getLogPath
};
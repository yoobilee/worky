// No assertion payloads, traces, URLs with query strings, tokens, or row values.
module.exports = class SafeReporter {
  onTestEnd(test, result) {
    console.log(`${result.status.toUpperCase()} ${test.location.file.split(/[\\/]/).pop()}:${test.location.line}`);
    if (result.status !== 'passed') {
      for (const error of result.errors) {
        const message = error.message || '';
        const category = message.includes('Timeout') || message.includes('timeout') ? 'timeout'
          : message.includes("Executable doesn't exist") ? 'browser executable unavailable'
          : message.includes('Missing required environment') ? 'missing test environment'
          : 'assertion or request failure';
        console.log(`Failure category: ${category}`);
        const location = (error.stack || '').match(/([a-z-]+\.spec\.ts):(\d+):(\d+)/);
        if (location) console.log(`Failure source: ${location[1]}:${location[2]}`);
      }
    }
  }
  onError(error) {
    const message = error.message || '';
    console.log(`Runner error: ${message.includes('webServer') ? 'web server startup' : 'configuration or infrastructure'}`);
  }
  onEnd(result) { console.log(`Browser suite: ${result.status}`); }
};

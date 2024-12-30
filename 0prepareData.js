const { spawn } = require('child_process');

// Define an array of script paths to run sequentially
const scripts = [
  '1getRefGem.js',
  '2gemeentesJSONtoTABLE.js',
  '3knooppuntenJSONtoTABLE.js',
  '4DBtoGEOJSON.js'
];

// Function to run a script
function runScript(script) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [script], { stdio: 'inherit' });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Script ${script} failed with exit code ${code}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

// Function to run scripts sequentially
async function runScriptsSequentially(scripts) {
  for (const script of scripts) {
    try {
      console.log(`Executing script: ${script}`);
      await runScript(script);
      console.log(`Script ${script} executed successfully`);
    } catch (error) {
      console.error(error.message);
      break; // Stop execution on error
    }
  }
}

// Start running scripts sequentially
runScriptsSequentially(scripts);

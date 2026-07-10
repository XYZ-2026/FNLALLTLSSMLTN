const fs = require('fs');
const path = require('path');
const vm = require('vm');

try {
  const htmlPath = path.join(__dirname, '..', 'comedk_cutoff.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // extract script tags content
  const regex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let scriptContent = '';

  while ((match = regex.exec(html)) !== null) {
    const code = match[1];
    // check if it's the main application script (contains const DATA_FILES)
    if (code.includes('DATA_FILES')) {
      scriptContent = code;
      break;
    }
  }

  if (!scriptContent) {
    throw new Error("Could not find main application script tag in HTML.");
  }

  // Use vm.Script to compile the extracted javascript. This will throw syntax errors if any exist.
  new vm.Script(scriptContent);
  console.log("Syntax check passed! No syntax errors found in comedk_cutoff.html script.");

} catch (err) {
  console.error("Syntax Check Failed:");
  console.error(err);
  process.exit(1);
}

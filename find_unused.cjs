const { ESLint } = require("eslint");
const fs = require("fs");

async function main() {
  const eslint = new ESLint();
  const results = await eslint.lintFiles(["src/**/*.{js,jsx}"]);
  
  const files = results
    .filter(f => f.messages.some(m => m.ruleId === 'no-unused-vars'))
    .map(f => ({
      path: f.filePath,
      errors: f.messages
        .filter(m => m.ruleId === 'no-unused-vars')
        .map(m => ({ line: m.line, message: m.message, source: m.source }))
    }));
    
  fs.writeFileSync('unused_vars.json', JSON.stringify(files, null, 2));
}
main().catch(console.error);

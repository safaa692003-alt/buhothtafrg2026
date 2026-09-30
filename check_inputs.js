const fs = require('fs');
const content = fs.readFileSync('tafragh_scientific.html', 'utf8');
const formStart = content.indexOf('id="export-form"');
const formEnd = content.indexOf('</form>');
const formContent = content.substring(formStart, formEnd);
const lines = formContent.split('\n');
lines.forEach((l, idx) => {
    if (l.includes('<input')) {
        console.log(idx + 1, l.trim());
    }
});

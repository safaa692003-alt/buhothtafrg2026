const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.html') || f.endsWith('.js'));
files.forEach(f => {
    const c = fs.readFileSync(f, 'utf8');
    if (c.includes('يرجى تفضلكم بالموافقة')) {
        console.log(f);
    }
});

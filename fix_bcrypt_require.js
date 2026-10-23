const fs = require('fs');
let content = fs.readFileSync('seed_bangladesh_school_full.js', 'utf8');
content = content.replace("require('bcrypt')", "require('./backend/node_modules/bcrypt')");
fs.writeFileSync('seed_bangladesh_school_full.js', content, 'utf8');
console.log('Fixed bcrypt require in seed_bangladesh_school_full.js');

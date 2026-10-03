const fs=require('fs'),zlib=require('zlib');
const p1=fs.readFileSync('scripts/orders_fix_part1.txt','utf8');
const p2=fs.readFileSync('scripts/orders_fix_part2.txt','utf8');
const p3=fs.readFileSync('scripts/orders_fix_part3.txt','utf8');
const c=Buffer.from(p1+p2+p3,'base64');
fs.writeFileSync('src/pages/OrdersPage.tsx',zlib.gunzipSync(c));
console.log('Fixed OrdersPage.tsx');
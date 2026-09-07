// Xác minh dev server phục vụ HTML + CSS Neon Glass
const base = 'http://localhost:5173';

const html = await (await fetch(base)).text();
console.log('HTML  : font-link =', html.includes('Space+Grotesk'), '| root =', html.includes('id="root"'), '| size =', html.length);

const css = await (await fetch(base + '/src/index.css')).text();
console.log('CSS   : size =', css.length);
for (const k of ['.btn-primary', '.input-ghost', '.input-underline', '.neon-dot', '.orb-cyan', '.glass-glow', '.label-caps']) {
  console.log(`  ${k}:`, css.includes(k) ? 'OK' : 'MISSING');
}

// Kiểm tra API vẫn hoạt động
const stats = await (await fetch('http://localhost:3000/api/stats')).json();
console.log('API   : users =', stats.users, '| active =', stats.active);
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fontsDir = path.join(__dirname, '..', 'frontend', 'public', 'fonts');
if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
}

// URL Google Fonts IBM Plex Sans & IBM Plex Mono with Vietnamese & Latin subsets
const cssUrl = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&display=swap';

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('Fetching Google Fonts CSS...');
  const css = await fetchText(cssUrl);

  const fontFaceRegex = /(@font-face\s*\{[^}]+\})/g;
  const blocks = css.match(fontFaceRegex) || [];
  console.log(`Found ${blocks.length} @font-face blocks.`);

  let localCssRules = '';
  let index = 0;

  for (const block of blocks) {
    const familyMatch = block.match(/font-family:\s*['"]?([^'";]+)['"]?/);
    const weightMatch = block.match(/font-weight:\s*([^;]+)/);
    const styleMatch = block.match(/font-style:\s*([^;]+)/);
    const unicodeMatch = block.match(/unicode-range:\s*([^;]+)/);
    const urlMatch = block.match(/src:\s*url\((https:\/\/[^)]+)\)\s*format\(['"]?woff2['"]?\)/);

    if (familyMatch && weightMatch && urlMatch) {
      const family = familyMatch[1].trim();
      const weight = weightMatch[1].trim();
      const style = styleMatch ? styleMatch[1].trim() : 'normal';
      const remoteUrl = urlMatch[1].trim();
      const unicodeRange = unicodeMatch ? unicodeMatch[1].trim() : null;

      const familySlug = family.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const filename = `${familySlug}-${style}-${weight}-${index}.woff2`;
      const filePath = path.join(fontsDir, filename);

      console.log(`Downloading font [${index + 1}/${blocks.length}]: ${filename}`);
      await downloadFile(remoteUrl, filePath);

      localCssRules += `
@font-face {
  font-family: '${family}';
  font-style: ${style};
  font-weight: ${weight};
  font-display: swap;
  src: url('/fonts/${filename}') format('woff2');
  ${unicodeRange ? `unicode-range: ${unicodeRange};` : ''}
}
`;
      index++;
    }
  }

  // Save generated local font css
  const outputCssPath = path.join(__dirname, '..', 'frontend', 'src', 'fonts.css');
  fs.writeFileSync(outputCssPath, localCssRules.trim() + '\n', 'utf-8');
  console.log(`Successfully generated local fonts CSS at: ${outputCssPath}`);
  console.log(`Downloaded ${index} woff2 font files to: ${fontsDir}`);
}

main().catch(err => {
  console.error('Error downloading fonts:', err);
  process.exit(1);
});


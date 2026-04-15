import fs from 'fs/promises';
import path from 'path';
import CleanCSS from 'clean-css';
import { minify as minifyHtml } from 'html-minifier-terser';
import { minify as minifyJs } from 'terser';
import JavaScriptObfuscator from 'javascript-obfuscator';

const root = process.cwd();
const distDir = path.join(root, 'dist');

const htmlFiles = ['index.html', 'home.html', 'admin.html', 'history.html', 'huong-dan.html'];
const jsDir = path.join(root, 'js');
const cssDir = path.join(root, 'css');
const staticDirs = [];

const jsObfuscatorOptions = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.2,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.1,
  disableConsoleOutput: true,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  selfDefending: true,
  splitStrings: true,
  splitStringsChunkLength: 8,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  transformObjectKeys: true,
  unicodeEscapeSequence: false,
};

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function cleanDist() {
  await fs.rm(distDir, { recursive: true, force: true });
  await ensureDir(distDir);
}

async function processJsCode(code) {
  const minified = await minifyJs(code, {
    compress: {
      drop_console: true,
      drop_debugger: true,
      passes: 2,
    },
    format: {
      comments: false,
    },
    mangle: true,
  });

  if (!minified.code) {
    throw new Error('Failed to minify JS code');
  }

  const obfuscated = JavaScriptObfuscator.obfuscate(minified.code, jsObfuscatorOptions);
  return obfuscated.getObfuscatedCode();
}

async function buildJsFolder() {
  const files = await fs.readdir(jsDir);
  const outJsDir = path.join(distDir, 'js');
  await ensureDir(outJsDir);

  for (const file of files) {
    if (!file.endsWith('.js')) continue;
    const srcPath = path.join(jsDir, file);
    const dstPath = path.join(outJsDir, file);
    const code = await fs.readFile(srcPath, 'utf8');
    const transformed = await processJsCode(code);
    await fs.writeFile(dstPath, transformed, 'utf8');
  }
}

async function buildCssFolder() {
  const files = await fs.readdir(cssDir);
  const outCssDir = path.join(distDir, 'css');
  await ensureDir(outCssDir);

  for (const file of files) {
    if (!file.endsWith('.css')) continue;
    const srcPath = path.join(cssDir, file);
    const dstPath = path.join(outCssDir, file);
    const source = await fs.readFile(srcPath, 'utf8');
    const output = new CleanCSS({ level: 2 }).minify(source);
    if (output.errors.length) {
      throw new Error(`CSS minify failed for ${file}: ${output.errors.join('; ')}`);
    }
    await fs.writeFile(dstPath, output.styles, 'utf8');
  }
}

async function obfuscateInlineScripts(html) {
  const scriptRegex = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let result = '';
  let lastIndex = 0;
  let match;

  while ((match = scriptRegex.exec(html)) !== null) {
    const [fullTag, scriptContent] = match;
    const start = match.index;
    const end = scriptRegex.lastIndex;
    result += html.slice(lastIndex, start);

    const trimmed = scriptContent.trim();
    if (!trimmed) {
      result += fullTag;
    } else {
      const obfuscated = await processJsCode(scriptContent);
      const safeInlineCode = obfuscated.replace(/<\/script/gi, '<\\/script');
      result += fullTag.replace(scriptContent, `\n${safeInlineCode}\n`);
    }

    lastIndex = end;
  }

  result += html.slice(lastIndex);
  return result;
}

async function buildHtmlFiles() {
  for (const file of htmlFiles) {
    const srcPath = path.join(root, file);
    const dstPath = path.join(distDir, file);
    let html = await fs.readFile(srcPath, 'utf8');

    html = await minifyHtml(html, {
      collapseWhitespace: true,
      removeComments: true,
      minifyCSS: true,
      removeRedundantAttributes: true,
      removeScriptTypeAttributes: true,
      removeStyleLinkTypeAttributes: true,
      useShortDoctype: true,
      minifyJS: false,
    });

    html = await obfuscateInlineScripts(html);

    await fs.writeFile(dstPath, html, 'utf8');
  }
}

async function copyStaticDirs() {
  for (const dir of staticDirs) {
    const src = path.join(root, dir);
    const dst = path.join(distDir, dir);
    await fs.cp(src, dst, { recursive: true });
  }
}

async function main() {
  await cleanDist();
  await buildJsFolder();
  await buildCssFolder();
  await buildHtmlFiles();
  await copyStaticDirs();
  console.log('[build] Production build with obfuscation completed in dist/');
}

main().catch((err) => {
  console.error('[build] Failed:', err);
  process.exit(1);
});

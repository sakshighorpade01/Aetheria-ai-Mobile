const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '../dist');
const rootDir = path.join(__dirname, '..');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir);
}

// Files and directories to copy
const itemsToCopy = [
    'index.html',
    'manifest.json',
    'sw.js',
    'assets',
    'css',
    'js',
    'aios.html',
    'chat.html',
    'to-do-list.html',
    'test-colors.html'
];

function copyRecursiveSync(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();

    if (isDirectory) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest);
        }
        fs.readdirSync(src).forEach(childItemName => {
            copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
        });
    } else {
        if (exists) {
            fs.copyFileSync(src, dest);
        }
    }
}

itemsToCopy.forEach(item => {
    const srcPath = path.join(rootDir, item);
    const destPath = path.join(distDir, item);
    console.log(`Copying ${item}...`);
    copyRecursiveSync(srcPath, destPath);
});

console.log('Build complete!');

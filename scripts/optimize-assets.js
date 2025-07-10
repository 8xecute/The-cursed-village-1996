const fs = require('fs');
const path = require('path');
const imagemin = require('imagemin');
const imageminPngquant = require('imagemin-pngquant');

async function optimizeAssets() {
  console.log('🔄 Optimizing assets for production...');
  
  try {
    // Create dist directory if it doesn't exist
    const distDir = path.join(__dirname, '../dist');
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
    }
    
    // Copy and optimize card images
    const cardsDir = path.join(__dirname, '../public/cards');
    const distCardsDir = path.join(distDir, 'cards');
    
    if (!fs.existsSync(distCardsDir)) {
      fs.mkdirSync(distCardsDir, { recursive: true });
    }
    
    // Optimize PNG images
    const files = await imagemin([`${cardsDir}/*.png`], {
      destination: distCardsDir,
      plugins: [
        imageminPngquant({
          quality: [0.6, 0.8],
          speed: 4
        })
      ]
    });
    
    console.log(`✅ Optimized ${files.length} card images`);
    
    // Copy other static files
    const staticFiles = ['index.html'];
    for (const file of staticFiles) {
      const sourcePath = path.join(__dirname, '../public', file);
      const destPath = path.join(distDir, file);
      
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, destPath);
        console.log(`✅ Copied ${file}`);
      }
    }
    
    console.log('🎉 Asset optimization complete!');
  } catch (error) {
    console.error('❌ Error optimizing assets:', error);
    process.exit(1);
  }
}

optimizeAssets(); 
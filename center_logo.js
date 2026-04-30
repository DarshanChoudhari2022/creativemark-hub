import sharp from 'sharp';

async function processImage() {
  const metadata = await sharp('public/new-logo.png').metadata();
  console.log('Original size:', metadata.width, 'x', metadata.height);

  // Trim the image to its non-transparent bounding box, or bounding box of non-background color
  // Since it's a JPEG, we use trim with a threshold to remove white background if present
  const trimmed = await sharp('public/new-logo.png').trim({ threshold: 40 }).toBuffer({ resolveWithObject: true });
  console.log('Trimmed info:', trimmed.info);

  // We want to make it square with padding so it sits perfectly in the center.
  // Capacitor assets requires at least 1024x1024.
  // The adaptive icon foreground on Android is 108dp x 108dp, and the inner 66dp is the "safe zone".
  // This means the logo should occupy roughly 60% of the image max, let's use 55% to be very safe.
  
  const targetSize = 1024;
  const logoMaxDim = Math.round(targetSize * 0.55); // 563 pixels
  
  // Resize the trimmed logo to fit within the logoMaxDim bounds
  const resizedLogo = await sharp(trimmed.data)
    .resize(logoMaxDim, logoMaxDim, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .toBuffer();

  // Create a 1024x1024 white background canvas and composite the resized logo into the center
  await sharp({
    create: {
      width: targetSize,
      height: targetSize,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 } // Solid white background for the icon
    }
  })
    .composite([
      {
        input: resizedLogo,
        gravity: 'center'
      }
    ])
    .png()
    .toFile('assets/icon.png');
    
  console.log('Successfully centered icon!');
}

processImage().catch(console.error);

# Logo Files

The project includes SVG logo files in two versions:

1. `public/logo.svg` - Light mode logo
2. `public/logo-dark.svg` - Dark mode logo
3. `public/favicon.svg` - Favicon for modern browsers
4. `public/apple-touch-icon.svg` - Icon for iOS devices

## Creating PNG Versions (Important)

For optimal performance and broader browser support, you should create PNG versions of these logos. Here's how you can do it:

### Option 1: Use an online converter

1. Open an online SVG to PNG converter like [Convertio](https://convertio.co/svg-png/) or [SVG2PNG](https://svgtopng.com/)
2. Upload your SVG files
3. Download the PNG versions
4. Place them in the appropriate directories:
   - `public/images/logo.png` (400x100px)
   - `public/images/logo-dark.png` (400x100px)
   - `public/apple-touch-icon.png` (180x180px)

### Option 2: Use a graphics editor

1. Open the SVG files in a graphics editor like Adobe Illustrator, Figma, or Inkscape
2. Export as PNG at the appropriate resolutions:
   - Logo files: approximately 400x100px
   - Apple Touch Icon: 180x180px
3. Save to the appropriate locations as listed above

### Option 3: Using command line (if you have Inkscape installed)

```bash
# Create logo PNGs
inkscape -w 400 -h 100 public/logo.svg -o public/images/logo.png
inkscape -w 400 -h 100 public/logo-dark.svg -o public/images/logo-dark.png

# Create Apple Touch Icon PNG
inkscape -w 180 -h 180 public/apple-touch-icon.svg -o public/apple-touch-icon.png
```

## Using the PNG versions

To use the PNG versions of the main logo instead of SVG, update the `src/components/Navbar.tsx` file to use:

```jsx
<img 
  src={theme === 'dark' ? '/images/logo-dark.png' : '/images/logo.png'} 
  alt="Boliganalyse.ai logo" 
  className="h-full w-auto"
  width="200"
  height="50"
/>
```

## Apple Touch Icon

The `apple-touch-icon.png` file should be placed in the `public` directory. This is used when users add your website to their iOS home screen. 
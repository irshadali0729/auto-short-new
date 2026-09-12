const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffmpegPath = ffmpegInstaller.path;

const imagePath = path.join(process.cwd(), 'image-library', 'free-photo-of-hijabi-woman-sitting-on-grassy-sea-shore.jpeg');

const fontPaths = [
  'C:/Windows/Fonts/arialbd.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
];
let fontParam = "font='Arial'";
for (const p of fontPaths) {
  if (fs.existsSync(p)) {
    fontParam = `fontfile='${p.replace(/\\/g, '/').replace(/:/g, '\\:')}'`;
    break;
  }
}

// Test slide-up and fade motion on a 4-second clip
const duration = 4;
const start = 1.0;
const end = 3.0;
const baseY = 300;

// Slide up 40px over 0.3s
const yExpr = `'${baseY} + if(lt(t,${start}), 40, if(lt(t,${start}+0.3), 40*(1-(t-${start})/0.3), 0))'`;
// Alpha fade in 0.2s, fade out 0.2s
const alphaExpr = `'if(lt(t,${start}), 0, if(lt(t,${start}+0.2), (t-${start})/0.2, if(gt(t,${end}-0.2), (${end}-t)/0.2, if(gt(t,${end}), 0, 1))))'`;

const filterGraph =
  `[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[bg];` +
  `[bg]drawtext=text='KINETIC MOTION':fontcolor=white:${fontParam}:fontsize=80:x=120:y=${yExpr}:alpha=${alphaExpr}:shadowcolor=black@0.6:shadowx=2:shadowy=2[outv]`;

const outPath = path.join(process.cwd(), 'scratch_motion_test.mp4');

const args = [
  '-y',
  '-loop', '1',
  '-i', imagePath,
  '-t', duration.toString(),
  '-r', '30',
  '-filter_complex', filterGraph,
  '-map', '[outv]',
  '-c:v', 'libx264',
  '-preset', 'superfast',
  '-pix_fmt', 'yuv420p',
  outPath
];

const proc = spawn(ffmpegPath, args);
let stderr = '';
proc.stderr.on('data', d => stderr += d.toString());
proc.on('close', code => {
  console.log('Motion test exit code:', code);
  if (code !== 0) console.log('Stderr:', stderr);
  else {
    console.log('Motion clip generated! File size:', fs.statSync(outPath).size);
    fs.unlinkSync(outPath);
  }
});

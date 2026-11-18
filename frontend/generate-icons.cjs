
const sharp = require("sharp");
const fs = require("fs");

fs.mkdirSync("public", { recursive: true });

async function generate() {
  for (const size of [192, 512]) {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg"
           width="${size}" height="${size}">
        <rect width="100%" height="100%"
              rx="${size * 0.22}" fill="#eaf7ff"/>
        <text x="50%" y="54%"
              text-anchor="middle"
              dominant-baseline="middle"
              font-size="${size * 0.40}"">🐡</text>
      </svg>
    `;

    await sharp(Buffer.from(svg))
      .png()
      .toFile(`public/puffpress-${size}.png`);
  }

  console.log("PuffPress icons generated!");
}

generate().catch(console.error);

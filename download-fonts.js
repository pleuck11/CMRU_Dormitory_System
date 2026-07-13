const fs = require('fs');
const https = require('https');

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to get '${url}' (${res.statusCode})`));
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
      file.on('error', (err) => {
        fs.unlink(dest, () => reject(err));
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

async function main() {
  try {
    console.log("Downloading Kanit-Regular...");
    await downloadFile("https://raw.githubusercontent.com/cadsondemak/kanit/master/fonts/ttf/Kanit-Regular.ttf", "public/fonts/Kanit-Regular.ttf");
    console.log("Downloading Kanit-Bold...");
    await downloadFile("https://raw.githubusercontent.com/cadsondemak/kanit/master/fonts/ttf/Kanit-Bold.ttf", "public/fonts/Kanit-Bold.ttf");
    console.log("Downloads completed successfully.");
  } catch (err) {
    console.error("Download failed:", err);
    process.exit(1);
  }
}

main();

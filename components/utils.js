const fs = require('fs');

function ensureDirectoriesExist(paths) {
  paths.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created "${dir}" directory`);
    }
  });
}

module.exports = { ensureDirectoriesExist };

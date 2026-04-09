const fs = require('fs');
const path = require('path');

const routesFolder = __dirname;

function camelCaseToDash(myStr) {
  return myStr.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

const getAllRoutesPath = function (folderPath) {
  const allRoutesPath = [];

  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach((file) => {
      const fullPath = path.join(folderPath, file);
      if (fs.existsSync(fullPath) && fullPath.endsWith('.route.js')) {
        allRoutesPath.push({
          fullPath: fullPath.replace('.js', ''),
          fileName: file.replace('.route.js', ''),
        });
      }
    });
  }

  return allRoutesPath;
};

const registerRoutes = function (expressInstance) {
  const normalRoutes = getAllRoutesPath(routesFolder);
  for (const routeFile of normalRoutes) {
    const router = require(routeFile.fullPath);
    expressInstance.use(
      `/api/v1/${camelCaseToDash(routeFile.fileName)}`,
      router
    );
  }
};

module.exports = {
  registerRoutes,
};

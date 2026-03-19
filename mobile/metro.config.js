const fs = require('fs');
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const tamaguiRoot = path.join(__dirname, 'node_modules', '@tamagui');
const extraNodeModules = {
  tamagui: path.join(__dirname, 'node_modules', 'tamagui'),
};

if (fs.existsSync(tamaguiRoot)) {
  for (const pkg of fs.readdirSync(tamaguiRoot)) {
    if (pkg.startsWith('.')) {
      continue;
    }

    extraNodeModules[`@tamagui/${pkg}`] = path.join(tamaguiRoot, pkg);
  }
}

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  ...extraNodeModules,
};

module.exports = config;

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');
const sharedRoot = path.resolve(workspaceRoot, 'shared');

const config = getDefaultConfig(projectRoot);

// 1. Watch the ../shared directory
config.watchFolders = [sharedRoot];

// 2. Let Metro know where to resolve packages and set up path alias for @shared
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

config.resolver.extraNodeModules = {
  '@shared': path.resolve(sharedRoot, 'src'),
};

module.exports = config;

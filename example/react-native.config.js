// Autolinks the library from the parent folder (no npm install of @zebchat/react-native needed).
const path = require('node:path');

module.exports = {
  dependencies: {
    '@zebchat/react-native': {
      root: path.join(__dirname, '..'),
    },
  },
};

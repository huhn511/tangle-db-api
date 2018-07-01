// routes/index.js
const collectionRoutes = require('./collection_routes');
module.exports = function(app) {
  collectionRoutes(app);
  // Other route groups could go here, in the future
};

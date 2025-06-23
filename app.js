const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const { setupRoutes } = require('./components/routes');
const { ensureDirectoriesExist } = require('./components/utils');

// Middleware
app.use(cors());
app.use('/files', express.static('./downloads'));

// Ensure directories exist
ensureDirectoriesExist(['./downloads', './uploads']);

// Setup routes
setupRoutes(app);

module.exports = app;

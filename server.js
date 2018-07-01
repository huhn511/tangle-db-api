// server.js
const express        = require('express');
const app            = express();
const bodyParser = require('body-parser')

const port = process.env.PORT || 8080;
const url = 'http://localhost'

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

require('./app/routes')(app);
app.listen(port, () => {
  console.log('We are live on ' + port);
  console.log(url + ":" + port);
});

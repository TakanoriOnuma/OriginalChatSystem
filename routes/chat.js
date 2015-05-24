var express = require('express');
var router = express.Router();

// GET /chat listening.
router.get('/', function(req, res, next) {
  res.render('chat', {title : 'チャット'});
});

module.exports = router;
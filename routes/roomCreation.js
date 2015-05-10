var express = require('express');
var router = express.Router();

// GET room-creation listening.
router.get('/', function(req, res, next) {
  res.render('roomCreation', { title : '部屋の新規作成' });
});

module.exports = router;
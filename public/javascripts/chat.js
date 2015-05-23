var ROOMID;   // 部屋のID

$(function() {
  loadParams();
  loadTopic();
});

// URLにあるパラメータの読み込み
// 読み込み内容は全てグローバル参照が出来る
function loadParams() {
  var params = getParams();
  ROOMID = params['room'];
}

function loadTopic() {
  var $topic = $('#topic');

  $.get('/room', {roomId : ROOMID}, function(room) {
    $topic
      .append(room.title + '<br>')
      .append(room.detail);
  });
}
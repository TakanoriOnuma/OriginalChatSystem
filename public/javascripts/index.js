$(function() {
  getRoom();
});

function getRoom() {
  // 出力先を指定
  var $roomList = $('.roomList');

  // テンプレートの読み込み
  var source = $('#room-template').html();
  var template = Handlebars.compile(source);

  // 取得した部屋情報をテンプレートを用いて展開する
  $.get('/room', function(rooms) {
    var compiledHtml = template(rooms);
    console.log(compiledHtml);
    $roomList.html(compiledHtml);
  });
}
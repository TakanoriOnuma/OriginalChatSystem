$(function() {
  $('#fm').submit(function() {
    createRoom();
    return false;
  });
});

// 入力フォームの内容を元に部屋を作成する
function createRoom() {
  var title  = $('#title').val();
  var name   = $('#name').val();
  var detail = $('#detail').val();

  // 入力内容のチェック
  var check = function() {
    // タイトルについてのチェック
    if(title === '') {
      return false;
    }
    // 名前についてのチェック
    else if(name === '') {
      return false;
    }
    // 詳細についてのチェック（未入力はOK）
    return true;
  };

  // 入力に問題があればエラーを表示して終わる
  if(!check()) {
    alert('error');
    return;
  }

  // 入力がOKなら部屋の登録を行う

  // 入力を禁止にする
  $('#fm input, textarea').attr('disabled', true);

}
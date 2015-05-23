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
    var errMsg = '';
    // タイトルについてのチェック
    if(title === '') {
      errMsg += 'タイトルがありません。\n';
    }
    // 名前についてのチェック
    if(name === '') {
      errMsg += '名前がありません。\n';
    }
    // 詳細についてのチェック（未入力はOK）
    return errMsg;
  };

  // お知らせ内容の削除
  var $info = $('.info');
  $info.children().remove();

  // 入力に問題があればエラーを表示して終わる
  var errMsg = check();
  if(errMsg !== '') {
    // 一番後ろの改行コードを削除
    errMsg = errMsg.substring(0, errMsg.length - 1);
    // エラー内容の追加
    $.each(errMsg.split('\n'), function(index, elem) {
      $info.append($('<li>').addClass('error').append(elem));
    });
    return;
  }

  // 入力がOKなら部屋の登録を行う
  var sendObj = {
    title    : title,
    creator  : name,
    detail   : detail,
    password : ''       // とりあえずパスワードは空文字
  };
  $.post('/room', sendObj, function(res) {
    var roomId = res;
    // 登録に失敗したら
    if(roomId === null) {
      // 再度入力可能にして登録失敗のメッセージを送る
      $('#fm input, textarea').removeAttr('disabled');
      $info.append($('<li>').addClass('error').append('DBの登録に失敗しました。'));
      return;
    }
    $('#btn').val('部屋の作成完了');
    $info.append($('<li>').addClass('info').append('部屋の登録が完了しました。'));

    // 部屋へのリンクを表示する
    $link = $('#link');
    $link.append($('<a>').attr('href', './chat?room=' + roomId).append('部屋へ移動する'));
  });
  // 入力を禁止にする
  $('#fm input, textarea').attr('disabled', true);
}
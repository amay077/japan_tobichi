# What is this? 

国土地理院の [地球地図日本データ](https://www.gsi.go.jp/kankyochiri/gm_jpn.html) から「飛び地」を抽出するツール。

# Requirements

* nodejs: v12.14.1+
* typescript: v3.7.3+

# Getting Started

1. [地球地図日本データ](https://www.gsi.go.jp/kankyochiri/gm_jpn.html)
2. 第2.2版ベクタ（2016年公開）の「全レイヤ」をダウンロードする
3. ファイルを解凍して ``polbnda_jpn.*`` だけを圧縮して ``polbnda_jpn.zip`` とする
5. このリポジトリを Clone する
6. ``polbnda_jpn.zip`` を ``tool/assets`` ディレクトリに置く
6. ``tool`` ディレクトリで ``npm ci`` を行う
8. ``npm run exec`` を行う
9. ・・・しばらく待つ
10. ``../out`` ディレクトリに ``*.geojson`` ファイルが出力される

* ``tobichi_00_all.geojson`` … すべての飛び地とその本体ポリゴンが格納された GeoJson ファイル
* ``tobichi_{nn}.geojson`` … 都道府県ごとの飛び地とその本体ポリゴンが格納された GeoJson ファイル

# License

MIT
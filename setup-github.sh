#!/bin/bash

# 年収予測Webアプリ - GitHub連携スクリプト
# GitHubでリポジトリ作成後に実行してください

echo "🚀 年収予測Webアプリ - GitHubへのプッシュ準備"
echo ""

# 手動でGitHubリポジトリを作成する手順を表示
echo "📋 GitHubリポジトリ作成手順:"
echo "1. GitHub (https://github.com) にアクセス"
echo "2. 新しいリポジトリを作成"
echo "   - Repository name: salary-predictor-app"
echo "   - Description: 学歴・経験・職種・業界から日米の年収を予測するモダンWebアプリ"
echo "   - Public/Private: お好みで選択"
echo "   - Initialize this repository with: チェックを全て外す"
echo "3. Create repository をクリック"
echo ""

echo "🔗 リポジトリ作成後、以下のコマンドを実行:"
echo ""
echo "# リモートリポジトリを追加"
echo "git remote add origin https://github.com/shioyam/salary-predictor-app.git"
echo ""
echo "# メインブランチをプッシュ"
echo "git push -u origin main"
echo ""

echo "✅ 現在の状態:"
echo "📁 プロジェクトディレクトリ: $(pwd)"
echo "📊 コミット済みファイル: $(git ls-files | wc -l)個"
echo "🔍 最新コミット: $(git log --oneline -1)"
echo ""

echo "🎯 プッシュ後のアクセス方法:"
echo "📱 GitHub Pages設定後:"
echo "   https://shioyam.github.io/salary-predictor-app/salary-predictor.html"
echo ""
echo "💻 ローカル開発:"
echo "   python3 -m http.server 8080"
echo "   http://localhost:8080/salary-predictor.html"
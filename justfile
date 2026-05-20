default: dev

# 開発サーバ起動
dev:
    pnpm dev

# 本番ビルド
build:
    pnpm build

# プレビュー（要 build）
preview:
    pnpm preview

# 全テスト 1 回実行
test:
    pnpm test

# テストウォッチ
test-watch:
    pnpm test:watch

# 型チェックのみ
typecheck:
    pnpm typecheck

# クリーンビルド
clean:
    rm -rf dist node_modules/.vite

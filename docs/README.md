# GitHub Pages 發佈說明

這個 `docs` 資料夾已經整理成可直接給 GitHub Pages 使用的靜態網站版本。

## 建議發佈方式

將整個專案放到 GitHub repository 後，在 GitHub Pages 設定：

- Branch：`main`
- Folder：`/docs`

設定完成後，GitHub Pages 會直接以 `docs` 當網站根目錄。

## 主要檔案

- `docs/index.html`
- `docs/styles.css`
- `docs/app.js`
- `docs/data/app-dataset.js`
- `docs/assets/question-cards/*`
- `docs/assets/illustrations/*`

## 更新流程

若題庫或圖卡有更新，建議依序重跑：

```powershell
python scripts/build_app_dataset.py
Copy-Item -Force app\data\app-dataset.js docs\data\app-dataset.js
Copy-Item -Force app\index.html docs\
Copy-Item -Force app\styles.css docs\
Copy-Item -Force app\app.js docs\
Copy-Item -Force app\assets\illustrations\* docs\assets\illustrations\
Copy-Item -Force app\assets\question-cards\* docs\assets\question-cards\
```

## 實測分享

GitHub Pages 發佈完成後，把網站網址貼到 LINE 就可以讓朋友直接測試。

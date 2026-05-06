# ima2table4ppt

Image table OCR → PowerPoint-ready editable HTML table converter

Built with Electron + Tesseract.js (no API key required, fully offline)

## Features
- 이미지(JPG/PNG)에서 표 자동 인식 (Tesseract.js OCR + 좌표 클러스터링)
- 수동 구분선 그리기로 인식 보정
- 디자인 템플릿 저장/불러오기
- PowerPoint에 바로 붙여넣기 가능한 HTML 표 생성
- Figma CSS → PPT 표 변환 기능 통합

## Usage
```bash
npm install
npm start
```

## Build
```bash
npm run build
```

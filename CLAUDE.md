# 프로젝트 규칙

## 배포 규칙

코드를 수정할 때마다 반드시 다음 순서로 사이트에 적용해야 한다:

1. 변경사항 커밋: `git add <파일> && git commit -m "..."`
2. origin 브랜치에 푸시: `git push -u origin <브랜치>`
3. **GitHub Pages(사이트)에 반드시 배포**: `git push github main`

모든 작업이 끝날 때 `git push github main`이 실행되어야 사이트가 업데이트된다.

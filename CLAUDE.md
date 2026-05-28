# Patek-S 프로젝트 규칙

## 코드 수정 후 자동 Git 커밋 & 푸시

이 프로젝트에서 파일을 수정할 때마다 아래 절차를 반드시 수행한다.

1. 변경된 파일을 `git add`로 스테이징
2. 변경 내용을 요약한 한국어 메시지로 `git commit`
3. `git push origin main`으로 GitHub에 푸시

### Git 설정

- user.email: honam2yoyo@gmail.com
- user.name: patek-s
- 브랜치: main
- 리모트: origin (https://github.com/honam2yoyo-del/patek-s.git)

### 커밋 메시지 규칙

- 한국어로 작성
- 첫 줄: 변경 내용 요약 (50자 이내)
- 필요시 빈 줄 후 세부 내용 기술
- 항상 `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>` 푸터 포함

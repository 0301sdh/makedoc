# makedoc

[![CI](https://github.com/0301sdh/makedoc/actions/workflows/ci.yml/badge.svg)](https://github.com/0301sdh/makedoc/actions/workflows/ci.yml)

코드, 커밋, 작업 기록을 바탕으로 **AI가 프로젝트 문서를 만들거나 최신 상태로 갱신하도록 돕는 CLI 도구**입니다.
Claude Code, Codex, GitHub Copilot CLI에 `makedoc` 스킬을 설치할 수 있습니다.

## 동작 방식

### 해결하려는 문제

- 프로젝트 문서를 처음부터 만들거나 코드 변경에 맞춰 갱신하는 일은 번거롭습니다.
- 문서 작성에 필요한 프로젝트 구조와 변경 이력을 한 번에 파악하기 어렵습니다.
- 근거가 없는 설명이 문서에 섞이거나, 코드와 문서가 서로 다른 상태로 남기 쉽습니다.

makedoc은 프로젝트 파일, `package.json`, Git 커밋, 그리고 있으면 [handoff](https://github.com/0301sdh/handoff)의 작업 기록(`.handoff/logs/`)을 모아 AI에게 전달합니다.
AI는 이를 바탕으로 문서를 작성하고, `makedoc check`로 필수 문서와 일부 누락 항목을 확인합니다.

### 역할 분담

| 주체 | 역할 |
|---|---|
| 프로그램 | AI 도구별 스킬 설치, 프로젝트 자료 수집, 문서 누락·일부 형식 검사 |
| AI | 코드를 직접 확인하고 문서를 작성하거나 갱신 |
| 개발자 | 문서와 AI의 판단을 검토 |

## 설치와 AI 도구 연결

### 공통 설치

Node.js 22 이상이 필요합니다. 아직 npm에 배포하지 않았으므로 저장소에서 빌드해 설치합니다.

```bash
git clone https://github.com/0301sdh/makedoc.git
cd makedoc
npm ci
npm run build
npm link
```

`npm link`가 `makedoc` 명령을 전역에 연결합니다. 지우려면 `npm uninstall -g makedoc`를 실행합니다.

### AI 도구 연결

**makedoc 저장소가 아니라 문서를 만들 프로젝트 폴더**에서 쓰는 도구를 연결합니다. `--agent`를 반복하면 여러 도구를 함께 연결할 수 있습니다.

| 도구 | 연결 | 스킬 호출 | 설치되는 파일 |
|---|---|---|---|
| Claude Code | `makedoc init --agent claude` | `/makedoc` | `.claude/skills/makedoc/SKILL.md` |
| Codex | `makedoc init --agent codex` | `$makedoc` | `.agents/skills/makedoc/SKILL.md` |
| Copilot CLI | `makedoc init --agent copilot` | `/makedoc` | `.agents/skills/makedoc/SKILL.md` |

Claude Code 스킬은 `makedoc collect` 결과를 바로 전달합니다. Codex와 Copilot CLI는 같은 공용 스킬을 읽으며, AI가 `makedoc collect`를 실행한 뒤 출력된 지시를 따릅니다.
이미 있는 스킬 파일은 덮어쓰지 않으므로 여러 번 연결해도 안전합니다.

## 기본 작업 흐름

### 1. 스킬 설치하기

대상 프로젝트에서 `makedoc init --agent <이름>`을 실행합니다.

### 2. 문서 작성 또는 갱신하기

AI 도구에서 스킬을 호출하거나 프로젝트 문서를 만들어 달라고 요청합니다. AI는 `makedoc collect`가 출력한 자료를 바탕으로 관련 코드와 설정을 확인한 뒤 아래 문서를 작성하거나 갱신합니다.

- `README.md`: 프로젝트 소개, 설치, 사용법
- `docs/ARCHITECTURE.md`: 폴더별 역할, 주요 모듈과 데이터 흐름
- `docs/DECISIONS.md`: 되돌리기 어려운 설계 결정과 근거
- `CHANGELOG.md`: 버전별 변경 사항
- `docs/DEVELOPMENT.md`: 개발 환경, 실행, 테스트 방법

기존 문서의 내용을 존중하고, 확인할 근거가 없는 내용은 추측하지 않도록 안내합니다. API 문서와 데이터베이스 ERD는 자동 생성 대상이 아닙니다.

### 3. 문서 검사하기

작업 지시에 따라 AI가 마지막에 `makedoc check`를 실행해 문제가 없을 때까지 고칩니다. 직접 실행할 수도 있습니다.

```bash
makedoc check
```

필수 문서의 존재 여부, 아키텍처 문서의 최상위 폴더 설명, 설계 결정의 근거, 개발 문서의 npm 스크립트, 변경 기록의 버전 등을 확인합니다. 문서가 코드 변경보다 오래된 경우 경고도 출력합니다.
이 검사는 문서 내용이 코드와 완전히 일치하는지 판단하지 않으므로 최종 검토는 개발자가 해야 합니다.

### 연결 없이 사용하기

스킬을 설치하지 않아도 아래 명령의 출력을 AI 대화에 직접 전달할 수 있습니다.

```bash
makedoc collect  # AI에 전달할 자료와 작업 지시
makedoc check    # 문서 누락과 일부 형식 검사
```

`.handoff/logs/YYYY-MM-DD.md`가 있으면 날짜별 작업 기록의 `결정한 것`과 `오늘 한 일`을 자료에 포함합니다.

## 명령어

| 명령어 | 하는 일 |
|---|---|
| `makedoc init --agent <이름>` | AI 도구에 `makedoc` 스킬을 설치합니다. 이름은 `claude`, `codex`, `copilot` 중 하나이며 반복할 수 있습니다. 기존 스킬은 덮어쓰지 않습니다 |
| `makedoc collect` | AI가 문서를 작성하는 데 필요한 프로젝트 정보와 작업 지시를 출력합니다 |
| `makedoc check` | 필수 문서와 일부 항목을 검사합니다 |
| `makedoc --help` | 명령과 옵션의 사용법을 출력합니다 |
| `makedoc --version` | 현재 버전을 출력합니다 |

모든 명령은 대상 프로젝트 폴더 안에서 실행합니다.
종료 코드는 `0` 성공, `1` 작업 실패 또는 문서 문제 발견, `2` 잘못된 사용법입니다.

## 개발과 테스트

```bash
npm ci
npm run typecheck   # 타입 검사
npm run lint        # 린트
npm run build       # dist/에 빌드
npm test            # 테스트
```

GitHub Actions는 `main` 브랜치에 push하거나 PR을 생성·업데이트할 때 Node.js 22와 24에서 타입 검사·린트·빌드·테스트를 실행합니다.

| 파일 | 역할 |
|---|---|
| `src/bin.ts` | 실행 파일의 입구 |
| `src/cli.ts` | 옵션 해석, 사용법 검사, 결과 출력 |
| `src/agents.ts` | AI 도구별 스킬 설치 |
| `src/collect.ts` | AI에 전달할 자료와 작업 지시 만들기 |
| `src/check.ts` | 문서 검사 |
| `src/docs.ts` | 만들 문서 목록과 용도 |
| `src/project.ts` | 프로젝트 파일, `package.json`, Git 커밋 읽기 |
| `src/handoff.ts` | handoff 작업 기록 읽기 |
| `src/markdown.ts` | Markdown 섹션과 목록 해석 |

핵심 기능 함수는 결과만 반환하고, 출력과 종료 코드는 `cli.ts`가 정합니다. 그래서 테스트에서 결과를 바로 비교할 수 있습니다.

## 라이선스

[MIT](LICENSE)

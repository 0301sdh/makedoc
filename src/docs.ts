export interface DocSpec {
  path: string;
  purpose: string;
}

export const DOCS = {
  readme: {
    path: "README.md",
    purpose: "프로젝트 소개, 해결하는 문제, 설치, 사용법",
  },
  architecture: {
    path: "docs/ARCHITECTURE.md",
    purpose: "최상위 폴더마다 역할, 주요 모듈의 관계, 데이터 흐름",
  },
  decisions: {
    path: "docs/DECISIONS.md",
    purpose: "되돌리기 어려운 설계 결정마다 배경, 결정, 이유, 근거 (ADR)",
  },
  changelog: {
    path: "CHANGELOG.md",
    purpose: "버전별 변경 사항. 아직 출시하지 않은 변경은 Unreleased에 모은다",
  },
  development: {
    path: "docs/DEVELOPMENT.md",
    purpose: "필요한 도구와 버전, 설치, 실행, 테스트 명령어, 코드 규칙",
  },
} as const satisfies Record<string, DocSpec>;

export const DOC_LIST: readonly DocSpec[] = Object.values(DOCS);

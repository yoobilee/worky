# Issue #88 재설계: 화이트리스트 기반 게이트 아키텍처

상태: 설계 문서 (구현 전). `.github/workflows/`는 아직 수정하지 않음.

---

## 1. 현재 구조의 문제 요약

### 1.1 elif 체인은 본질적으로 블랙리스트다

`결과 파싱 및 분기` 스텝의 판단 로직은 "위험하다고 알려진 특정 필드 조합을 하나씩 elif로 잡아내고, 그 외의 모든 조합은 `else: PARSED=$STRUCTURED_OUTPUT`으로 Claude의 출력을 그대로 신뢰한다"는 구조다. 즉 **기본값이 "통과"이고, 예외적으로만 차단**한다.

### 1.2 #86 → #87 → #88이 각각 새어나간 조합

| 단계 | 새어나간 조합 | 원인 |
|---|---|---|
| #86 | `hasIssues:true, needsHuman:false, hasHighSeverityIssue:false(오판), allSeverityKnown:true` | 심각도 가드 자체가 존재하지 않았음 |
| #87 | `hasIssues:false, hasHighSeverityIssue:false(오판), needsHuman:false` + 원문엔 실제 배지 있음 | #86에서 만든 불일치 검증이 `hasIssues==true` 전제 안에 갇혀, `hasIssues:false`인 이 조합은 전제 자체가 안 맞아 검증을 못 받음 |
| #88-1 | `hasIssues:false, hasHighSeverityIssue:true(자기모순), needsHuman:false` + 원문엔 실제 배지 있음 | #87에서 고친 불일치 검증이 `.hasHighSeverityIssue==false`인 경우만 다뤄서, `hasHighSeverityIssue:true`인데 `needsHuman:false`인 자기모순 조합은 이 검증도, 아래 `hasIssues==true` 전제의 심각도 가드도 둘 다 비껴감 |

세 번 모두 패턴이 동일하다: **새 elif를 추가해 "이번에 발견된 조합"만 정확히 겨냥해서 막았고, 그 elif가 전제하는 조건(`hasIssues==true`, `hasHighSeverityIssue==false` 등) 밖에 있는 인접 조합은 여전히 열려 있었다.**

### 1.3 왜 구조적으로 발산하는가

판단에 관여하는 boolean이 현재 7개(`hasIssues`, `fixed`, `needsHuman`, `reviewContentRead`, `hasHighSeverityIssue`, `allSeverityKnown`, `CONTENT_HAS_HIGH_SEVERITY`)이므로 이론상 2⁷=128가지 조합이 가능하다. elif 체인은 이 중 "지금까지 실제로 발견된" 소수의 위험 조합만 명시적으로 처리하는데, **필드가 늘어날수록(하나 늘 때마다 조합은 2배) 사람이 미리 다 나열할 수 있는 조합의 비율은 기하급수적으로 줄어든다.** 즉 이 구조는 "고칠수록 더 안전해지는" 게 아니라 "고칠 때마다 다음 미커버 조합이 통계적으로 반드시 남는" 구조다. 근본적으로 **기본값을 "통과"에서 "차단"으로 뒤집어야** 이 발산이 멈춘다 — 그것이 이 문서가 제안하는 화이트리스트 전환의 이유다.

---

## 2. 새 상태 모델

### 2.1 `review_verdict`: 3-state

| 값 | 의미 |
|---|---|
| `auto_close` | 모든 게이트(3장)를 통과했고, Claude 자신도 "안전하게 해결/확인 완료"라고 명시적으로 확인한 경우에만. 자동 close/merge 허용 |
| `needs_human` | 게이트 중 하나라도 실패했거나, 게이트는 통과했지만 Claude 자신이 확신하지 못하거나 실제 지적사항이 남아있는 경우 |
| `review_incomplete` | 리뷰 봇의 코멘트/리뷰 내용 자체를 확인하지 못함(현재의 `reviewContentRead==false`에 해당). `hasIssues` 판단 자체가 무의미하므로 별도 상태로 분리 |

기존 `hasIssues`/`needsHuman`/`reviewContentRead` 3개 boolean이 사실상 하나의 3-state를 표현하려던 것이었다는 게 이번 조사(#86~#88 분석)에서 드러난 지점이다 — 이를 명시적인 enum 하나로 통합한다.

### 2.2 하위 스텝에서의 소비 방식

| 하위 스텝 | `auto_close` | `needs_human` | `review_incomplete` |
|---|---|---|---|
| GitHub Issue 자동 등록 | 완성된 본문(원인+실제 수정 내용+검증)으로 등록 후 즉시 close (기존 로직 유지) | 원인까지만 채운 미해결 템플릿으로 등록, open 유지 (기존 로직 유지) | 이슈 자체를 생성하지 않음(현재 `hasIssues=false` 처리와 동일 효과) |
| 이슈 등록 알림 | "등록됨(자동 해결)" | "등록됨(사람 확인 필요)" | 해당 없음(이슈 자체가 없으므로 알림도 없음) |
| 이슈 닫힘 알림 | 실제 close 성공 시 트리거(기존 `issue_closed` 기반 로직 그대로 재사용 가능 — verdict와 무관하게 "지금 실제로 closed인가"만 보는 현재 설계는 이번 재설계와 충돌하지 않음) | 트리거 없음 | 트리거 없음 |
| 특이사항 알림 | 트리거 없음 | 트리거 (기존 로직 유지) | 트리거 (review_incomplete도 사람이 봐야 하므로 이 알림 대상에 포함) |
| 자동 merge 요청 | 허용 | 차단 | 차단 |

---

## 3. 게이트 순서와 구현 위치

5개 게이트를 **순서대로** 평가하고, 하나라도 실패하면 그 즉시 `needs_human`(또는 review_incomplete)으로 확정하고 나머지 게이트는 평가하지 않는다(short-circuit). 모든 게이트를 통과한 경우에만 마지막에 Claude 자신의 verdict를 확인한다.

| 순위 | 게이트 | 구현 위치(제안) | Claude 실행 대비 시점 | 기존 로직 재사용 여부 |
|---|---|---|---|---|
| 1 | `IS_REVIEW_SKIPPED` | `PR 정보 조회`에서 계산(기존 그대로), `실제 git 상태 검증`(또는 신설되는 게이트 판정 스텝)에서 최우선 판정 | Claude 실행 이전에 이미 계산됨(현재도 `Claude Code 리뷰 처리` 스텝의 `if:` 조건에 포함되어 있어, 스킵되면 Claude 자체가 안 돎) | **그대로 재사용 가능** — 리뷰 본문 문자열 패턴 매칭 로직 변경 불필요 |
| 2 | `.github/workflows/` 경로가 PR diff에 포함되는가 | **신설**: `PR 정보 조회` 스텝에 `TOUCHES_WORKFLOWS` 계산 추가 — `gh pr view --json files`로 변경 파일 목록을 조회해 `.github/workflows/` prefix 존재 여부 확인, 조회 실패 시 fail-closed로 `true`. output으로 `touches_workflows` 노출 | Claude 실행 이전에 계산 가능(diff는 Claude가 코드를 고치기 전부터 이미 확정된 사실). **다만 Claude의 코드 수정 자체를 막지는 않는다** — 이 게이트는 오직 "auto_close 허용 여부"만 제어하고, Claude가 안전하다고 판단한 수정은 여전히 시도/커밋될 수 있어야 함(현재 프롬프트 6번 규칙과 동일 취지) | **부분 재사용**: 지금까지 "워크플로우 파일이면 사람 판단"은 프롬프트 지시문에만 의존했고 코드 레벨 강제가 전혀 없었음(이번 재설계의 핵심 신규 항목) |
| 3 | `reviewContentRead == false` | `결과 파싱 및 분기`(Claude 출력 이후, 최우선 체크) | Claude 실행 이후(Claude가 직접 판단하는 필드이므로) | **그대로 재사용** — 다만 `review_verdict` 스키마 전환에 따라 이 필드 자체가 `review_incomplete`로 흡수됨(4장 참고), "필드 존재 여부"가 아니라 "verdict 값 확인"으로 형태만 바뀜 |
| 4 | git 상태 검증 `MISMATCH` | `실제 git 상태 검증`(기존 스텝 그대로) | Claude 실행 및 커밋/푸시 이후(가장 마지막에 평가되어야 하는 게이트 — 실제로 코드가 반영됐는지는 Claude가 다 끝난 뒤에만 확인 가능) | **그대로 재사용** — `git status --porcelain` + `HEAD` vs `REMOTE_HEAD` 비교 로직은 변경 불필요 |
| 5 | `CONTENT_HAS_HIGH_SEVERITY`(독립 스캔) OR Claude 보고 심각도가 P0/P1 | `결과 파싱 및 분기`(Claude 출력 이후) | Claude 실행 이후 | **로직 골격 재사용, 정정 반영** — `CONTENT_HAS_HIGH_SEVERITY` 계산 자체(#88-2가 지적한 정규식 미앵커링)는 5장에서 별도로 언급하는 즉시 수정 대상. 이 게이트는 두 신호를 **OR로 결합**해, Claude가 자기 필드를 어떻게 잘못 보고하든(#88-1의 자기모순 케이스 포함) 원문 스캔 결과 하나만으로도 걸리도록 한다 |

**게이트 5의 한계를 명시적으로 남긴다**: 이 게이트는 "Claude 보고 심각도" 절반을 여전히 Claude의 자기 보고(`highest_severity` 필드, 4장 참고)에 의존한다. `CONTENT_HAS_HIGH_SEVERITY`(원문 직접 스캔)가 유일하게 Claude를 전혀 신뢰하지 않는 신호이며, 이 스캔 로직 자체에 결함이 있으면(#88-2처럼) 이 게이트 전체가 무력화될 수 있다. 즉 **게이트 5는 "Claude를 완전히 배제한 독립 검증"이 아니라 "Claude 신뢰 + 부분적 독립 검증의 OR 결합"**이라는 점을 설계상 한계로 인지해야 한다.

### 최종 확인

5개 게이트를 모두 통과한 경우에만, Claude의 `review_verdict == "auto_close" && all_issues_addressed == true`를 확인한다. 게이트를 다 통과했더라도 이 최종 확인에서 걸리면(Claude 스스로 "아직 확신 없음"/"지적사항이 남아있음"이라고 보고한 경우) `needs_human`으로 간다 — 게이트가 "이 상황에서 auto_close를 *고려할 자격*이 있는가"를 걸러내는 관문이라면, 이 최종 확인은 "Claude 자신의 실제 작업 결과가 정말 안전한가"를 보는 마지막 단계다.

---

## 4. Claude 구조화 출력 스키마 변경안

### 4.1 기존 스키마 (10개 필드)

```
hasIssues, fixed, needsHuman, reviewContentRead,
issueSummary, humanReviewReason, causeExplanation, fixExplanation,
hasHighSeverityIssue, allSeverityKnown
```

### 4.2 새 스키마 제안 (7개 필드)

```
review_verdict:      "auto_close" | "needs_human" | "review_incomplete"
all_issues_addressed: boolean
highest_severity:     "P0" | "P1" | "P2" | "P3" | "unknown" | "none"
issueSummary:          string  (변경 없음)
humanReviewReason:     string  (변경 없음)
causeExplanation:      string  (변경 없음)
fixExplanation:        string  (변경 없음)
```

### 4.3 필드별 처리

| 기존 필드 | 처리 | 근거 |
|---|---|---|
| `hasIssues` | **제거** — `review_verdict`의 `review_incomplete`(리뷰 자체를 못 읽음) 또는 `highest_severity=="none"`(지적사항 없음)으로 흡수 | 별도 boolean으로 둘 필요 없이 verdict/severity 조합만으로 표현 가능 |
| `fixed` | **제거, `all_issues_addressed`로 대체** | 이름을 더 명확히 함 — "고쳤다"가 아니라 "발견된 모든 지적사항이 해결됐다"는 의미를 이름 자체에 담아, 일부만 고치고 나머지는 방치한 채 `fixed:true`로 잘못 보고하는 모호함을 줄임 |
| `needsHuman` | **제거, `review_verdict`로 대체** | 3-state 자체가 이 필드를 포함 |
| `reviewContentRead` | **제거, `review_verdict`의 `review_incomplete`로 대체** | 동일 |
| `hasHighSeverityIssue` | **제거, `highest_severity`로 통합** | boolean 2개(`hasHighSeverityIssue`+`allSeverityKnown`)가 표현하던 3가지 실질 상태("P0/P1 있음" / "P0/P1 없음, 확실함" / "모르겠음")를 문자열 enum 하나로 표현 |
| `allSeverityKnown` | **제거, `highest_severity=="unknown"`으로 흡수** | 동일 |
| `issueSummary`/`humanReviewReason`/`causeExplanation`/`fixExplanation` | **이름 그대로 유지** | 텍스트 필드라 조합 폭발과 무관 — 지금까지 #86/#87/#88 어느 지적도 이 4개 필드를 문제 삼은 적 없음 |

boolean 2개를 문자열 enum 1개로 바꾸는 이유: `hasHighSeverityIssue`+`allSeverityKnown`처럼 **논리적으로 상호배타적이어야 하는데 독립된 boolean 2개로 표현하면, 스키마상 유효하지만 의미상 모순인 조합(`hasHighSeverityIssue:true, allSeverityKnown:false`처럼 "심각도를 모르겠다면서 동시에 P0/P1이라고 확신")이 항상 존재할 수 있다.** enum은 애초에 "동시에 두 값을 가질 수 없다"를 타입 레벨에서 강제하므로 이런 조합 자체가 발생하지 않는다.

---

## 5. #88-2(정규식 미앵커링)는 이 재설계와 무관 — 범위 제외

Codex가 #88에서 함께 지적한 두 번째 문제(`badge/P[01]-[A-Za-z]+` 1차 정규식이 markdown 이미지 문법에 앵커링되지 않아, 리뷰 본문이 배지 URL을 인용/설명만 해도 오탐)는 **필드 조합 문제가 아니라 `CONTENT_HAS_HIGH_SEVERITY` 계산 로직 자체의 정규식 결함**이다. 이는 이 문서가 다루는 상태 모델/게이트 재설계와 독립적인 사안이므로, **이번 재설계 범위에서 제외**하고 별도로 즉시 수정한다(이 문서에서는 실제 수정을 진행하지 않음).

---

## 6. 마이그레이션 리스크 및 검증 방법

### 6.1 핵심 리스크

elif 체인을 걷어내고 화이트리스트(5개 게이트 + 최종 확인)로 교체했을 때, **지금까지 정상적으로 `auto_close`(구 `needs_human:false`)로 처리되어 온 대다수의 평범한 P2 이하 자동 수정 케이스가 새 로직에서도 여전히 통과하는지**가 가장 중요한 회귀 검증 포인트다. 게이트를 너무 엄격하게 설계하면 지금까지 잘 동작하던 케이스까지 전부 `needs_human`으로 밀려나 자동화의 실효성이 사라진다.

### 6.2 검증 방법 제안

1. **실제 과거 데이터 재대입**: 이번 세션에서 이미 확보한 실제 Codex 인라인 리뷰 데이터(PR #56/#57/#60/#75/#78/#83의 인라인 코멘트 14건, 및 그 리뷰들에 대해 당시 Claude가 실제로 낸 `structured_output`)를 새 화이트리스트 로직에 수동으로 대입해, 옛 로직의 최종 `needs_human` 값과 새 로직의 `review_verdict`가 일치하는지 케이스별로 비교한다. 특히 `needs_human:false`(자동 처리)로 실제 종료됐던 케이스들이 새 로직에서도 `auto_close`로 나오는지가 핵심.
   - 과거 `structured_output` 원본이 GitHub Actions 로그에 남아있는지(`gh run view --log`로 `Claude Code 리뷰 처리` 스텝의 출력 조회 가능 여부)를 먼저 확인 필요 — 로그 보존 기간이 지났다면 이번 재조사 시점에 확보 가능한 것만 사용.
2. **관찰 모드 우선 배포**: 새 화이트리스트 로직을 즉시 실제 merge/close 결정에 연결하지 않고, 먼저 **verdict만 계산해 로그로 남기되 실제 자동 처리는 기존 elif 체인 결과를 그대로 따르는 "관찰 모드"**로 최소 N회(예: 10~20건의 실제 리뷰 사이클) 병행 실행한다. 이 기간 동안 신/구 로직의 판정이 갈리는 사례를 수집해, 새 로직이 기존보다 지나치게 보수적이거나(회귀) 지나치게 느슨한지(안전성 후퇴) 사람이 직접 눈으로 검토한다.
3. **전환 기준**: 관찰 모드에서 신/구 판정이 일치하는 비율이 충분히 높고(불일치 사례를 전부 사람이 확인해 "새 로직이 맞다"고 납득할 수 있는 경우만 남을 때), 그리고 불일치가 있다면 항상 **새 로직이 더 보수적인 방향(auto_close→needs_human)으로만** 갈리는지 확인한 뒤에 실제 전환한다 — 반대 방향(구 로직은 needs_human인데 새 로직은 auto_close)의 불일치가 하나라도 있으면 그 원인을 먼저 규명해야 한다.

---

## 부록: 이번 재설계로 명시적으로 다루지 않는 것

- `IS_REVIEW_SKIPPED`, `MISMATCH` 계산 로직 자체의 변경 — 이번 재설계는 이 두 게이트를 "그대로 재사용"하는 것을 전제로 하며, 로직 자체의 결함 여부는 별도 조사 대상.
- Supabase 기록/알림 텍스트 문구의 세부 변경 — 2.2절의 소비 방식은 기존 로직의 최소 변경만 가정하며, 문구 자체를 새로 디자인하지 않음.
- 게이트 판정을 별도 스텝으로 분리할지, 기존 `결과 파싱 및 분기`/`실제 git 상태 검증` 두 스텝에 나눠 넣을지의 최종 결정 — 3장의 "구현 위치(제안)"는 기존 스텝 구조를 최대한 재사용하는 방향으로 제안했으나, 실제 구현 시점에 스텝 분리 여부는 별도 판단 필요.

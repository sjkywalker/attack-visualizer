# ATT&CK Visualizer

[English](README.md) | **한국어**

ATT&CK Visualizer는 캠페인 단위 공격 행위를 **MITRE ATT&CK Enterprise Matrix**에서
비교하는 로컬·오프라인 우선 웹 애플리케이션입니다. 캠페인 JSON 파일을 원본으로
사용하며 별도 데이터베이스가 필요하지 않습니다.

<p align="center"><img src="demo.ko.png" alt="ATT&amp;CK Visualizer 캠페인 매트릭스 대시보드" width="100%"></p>
<p align="center"><em>선택한 캠페인과 레이어를 ATT&amp;CK Enterprise Matrix에 표시한 화면입니다.</em></p>

- Python 3.11+ / FastAPI / Jinja2 / Vanilla JavaScript
- MITRE ATT&CK Enterprise v19.2
- Docker 또는 로컬 Python 실행
- 기본 접속 주소: <http://127.0.0.1:8000> (`.env`의 `ATTVIZ_PORT`로 변경)

## 주요 기능

- `data/campaigns/*.json` 자동 검색과 웹 기반 생성·편집·파일명 변경·복제·삭제
- 여러 캠페인과 레이어의 동시 선택, `EXT`/`DMZ`/`INT` 기본 그룹 정렬 및 드래그 순서 조정
- ATT&CK 전술·기술·하위 기술 계층 표시와 미사용 항목 숨김
- 캠페인별 색상 혼합, nickname 배지, 중첩 캠페인 펼치기·접기
- T-code별 확인됨/미확인 진행 상태, 대시보드 상태 필터와 분석 주석 관리
- T-code 및 기술 이름 검색, hover 요약, 내부 상세 페이지
- 최초 전체 열 자동 맞춤, 수동 확대·축소 및 현재 화면 상태를 반영한 PNG 내보내기
- 잘못된 JSON·스키마·T-code의 안전한 격리와 관리 화면 오류 표시
- English / 한국어 기능 UI와 도움말

상세한 기능 설명과 JSON 작성법은 실행 후 `/help`에서 확인할 수 있습니다.

## Docker로 실행

요구사항은 Docker Engine 또는 Docker Desktop과 Docker Compose v2입니다.

Ubuntu, macOS, WSL2 또는 Git Bash:

```bash
./scripts/docker.sh rebuild
```

Windows PowerShell:

```powershell
.\scripts\docker.ps1 rebuild
```

브라우저에서 <http://127.0.0.1:8000>을 엽니다. 소스나 의존성이 바뀌면 같은
`rebuild` 명령을 다시 실행하십시오.

포트를 변경하려면 프로젝트 루트의 `.env` 한 곳만 수정하고 재빌드합니다.

```dotenv
ATTVIZ_PORT=8080
```

이 경우 접속 주소는 <http://127.0.0.1:8080>이 됩니다. Compose 포트 매핑,
컨테이너 Uvicorn, healthcheck와 관리 스크립트가 모두 이 값을 사용합니다.

자주 사용하는 관리 명령:

```bash
./scripts/docker.sh up
./scripts/docker.sh stop
./scripts/docker.sh restart
./scripts/docker.sh down
./scripts/docker.sh logs
./scripts/docker.sh status
./scripts/docker.sh health
```

PowerShell에서는 동일한 하위 명령을 `docker.ps1`에 사용합니다.

Compose는 `data/campaigns/`를 컨테이너에 bind mount하므로 컨테이너를 다시
생성해도 캠페인 JSON은 호스트에 유지됩니다. 서비스는 기본적으로
`127.0.0.1:8000`에만 바인딩됩니다.

## 로컬 Python으로 실행

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m app.server --reload
```

Windows PowerShell:

```powershell
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m app.server --reload
```

## 데이터 위치

```text
data/campaigns/                    사용자 캠페인 JSON
data/attack/enterprise-attack.json MITRE ATT&CK Enterprise STIX 번들
```

캠페인 파일은 직접 복사·편집하거나 `/campaigns` 화면에서 관리할 수 있습니다.
파일시스템 JSON이 유일한 원본입니다.

간단한 예시:

```json
{
  "schema_version": "1.0",
  "name": "Example Campaign",
  "nickname": "Example",
  "description": "Example multi-layer campaign",
  "color": "#3b82f6",
  "attribution_candidates": ["Example attribution candidate"],
  "layers": [
    {
      "name": "External",
      "description": "Internet-facing activity",
      "techniques": [
        {"id": "T1595.002", "status": "seen"},
        {"id": "T1190", "status": "unseen", "comment": "Awaiting firewall corroboration."}
      ]
    },
    {
      "name": "Internal Network",
      "techniques": [
        {"id": "T1018", "status": "seen"},
        {"id": "T1059.001", "status": "seen", "comment": "Observed in endpoint telemetry."}
      ]
    }
  ]
}
```

기술 이름이 아닌 ATT&CK T-code를 저장합니다. 같은 T-code는 여러 레이어에 나타날
수 있으며, 명시한 T-code만 강조됩니다. 하위 기술을 입력해도 부모 기술은 자동으로
강조되지 않습니다. 각 항목은 `seen` 또는 `unseen` 중 하나의 상태를 가지며 선택적으로
`comment`를 기록할 수 있습니다. 기존 문자열 T-code도 `seen`으로 계속 읽으며 웹
편집기에서 저장할 때 새 구조로 정규화됩니다.

매트릭스의 테두리 없는 상태 컨트롤은 T-code가 선택된 한 Layer에 있든 여러 Layer에
있든 항상 같은 Layer별 편집 팝오버를 엽니다. 팝오버에서 Layer별 상태와 주석을
확인하고 개별 변경할 수 있으며, 명시적 일괄 변경에는 확인 절차가 적용됩니다. 서로
다른 상태는 `혼합`으로 집계하고 셀에는 별도의 주석 표식을 표시하지 않습니다.

레이어는 ATT&CK 전술이나 정해진 네트워크 계층이 아니라 사용자가 정의하는 분석
단위입니다. 분석 목적에 따라 네트워크 구역, 단일 자산, 환경, 보안 영역 또는 논리적
캠페인 단계처럼 원하는 추상화 수준을 선택할 수 있습니다. 한 캠페인 안에서는 하나의
일관된 구분 기준을 사용하는 것을 권장하며, 배열 순서는 분석자가 의도한 진행 흐름을
나타냅니다. 같은 T-code는 여러 레이어에 반복해서 나타날 수 있습니다.

## 주요 경로

| 경로 | 설명 |
| --- | --- |
| `/` | ATT&CK Matrix 시각화 |
| `/campaigns` | 캠페인 파일 관리 |
| `/help` | 상세 사용법과 FAQ |
| `/disclaimer` | 데모 데이터와 귀속 표현 안내 |
| `/terms` | 라이선스와 제3자 고지 안내 |
| `/docs` | FastAPI OpenAPI 문서 |

## 데모 데이터 안내

`demo-*.json`은 MITRE ATT&CK, CISA 등 공개 자료를 참고해 기능 시연에 맞게
축약·결합·보강한 합성 예시입니다. 실제 사건의 완전하거나 권위 있는 재구성 또는
프로젝트 자체의 확정적 국가·조직 귀속 판단이 아닙니다. 자세한 내용은
`/disclaimer`에서 확인하십시오.

데모 Layer는 신뢰 영역을 먼저, 자산·운영 태그 하나를 다음에 표시하는 `EXT-*`,
`DMZ-*`, `INT-*` 형식을 일관되게 사용합니다. 이는 데모 작성 convention이며
애플리케이션의 검증 규칙은 아닙니다.
WannaCry의 `T1210`은 `INT-ENDPOINT`와 `INT-NETWORK`에서 서로 다른 상태를 가져
다중 Layer `혼합` 표시를 시연합니다. 주석은 확인됨과 미확인 양쪽에 사용되며 상태를
결정하는 값이 아니라 분석 맥락을 기록합니다.

## 라이선스와 운영 범위

프로젝트 자체 코드와 자산은 [PolyForm Noncommercial License 1.0.0](LICENSE)으로
제공됩니다. 영리기업 내부 사용을 포함한 상업적 사용에는 별도 서면 허가가
필요합니다. 정확한 조건과 제3자 자료 고지는 [LICENSE](LICENSE)와
[NOTICE.md](NOTICE.md)를 확인하십시오.

MITRE ATT&CK STIX 데이터에는 별도의
[MITRE ATT&CK 데이터 라이선스](data/attack/LICENSE.txt)가 적용됩니다.

이 애플리케이션은 인증 기능이 없는 로컬 분석 도구입니다. 공개 네트워크나 다중
사용자 환경에 배포하려면 별도의 인증, TLS, 접근 제어와 운영 보안 구성이 필요합니다.

(() => {
  const translations = {
    ko: {
      nav_main:'메인', nav_campaigns:'캠페인 관리', nav_help:'도움말', local_data:'로컬 데이터 기반', hero_title:'공격 행동을 한눈에 분석하세요', hero_text:'캠페인과 사용자 정의 분석 레이어 전반의 ATT&CK Enterprise 행위를 비교합니다.', highlighted:'강조된 기술', campaigns:'캠페인', layers:'레이어', select_all:'전체 선택', clear_all:'모두 해제', search_placeholder:'T-code 또는 기술 이름 검색', search_result:'검색 결과', matrix_hint:'전술 헤더나 기술을 클릭하면 내부 상세 정보와 캠페인 사용 현황을 볼 수 있습니다.', loading:'데이터 불러오는 중…', show_unused:'미사용 항목 표시', tactics:'전술', techniques:'기술', subtechniques:'하위 기술', size:'크기', fit_columns:'전체 열 맞춤', campaign_manager:'캠페인 관리', campaign_manager_text:'data/campaigns/의 JSON 파일을 직접 관리합니다.', new_campaign:'＋ 새 캠페인', status:'상태', name:'이름', description:'설명', layer:'레이어', technique_count:'기술', filename:'파일명', filename_help:'.json 확장자를 포함하세요. 비워 두면 캠페인 이름으로 생성됩니다.', actions:'작업', loading_short:'불러오는 중…', new_campaign_title:'새 캠페인', edit_campaign:'캠페인 편집', badge_name:'배지 이름', badge_help:'매트릭스 배지에 표시할 간결한 이름', attribution_candidates:'귀속 후보', attribution_help:'후보를 한 줄에 하나씩 입력합니다.', color:'색상', add_layer:'＋ 레이어 추가', cancel:'취소', save:'저장', attack_info:'ATT&CK 정보', tactic:'전술', platforms:'플랫폼', parent_technique:'부모 기술', child_techniques:'하위 기술', used_campaigns:'사용 캠페인', no_usage:'현재 유효한 캠페인 JSON에서 이 T-code를 명시적으로 사용하지 않습니다.', mitre_source:'MITRE 원문 ↗', matrix_breadcrumb:'Enterprise Matrix', help_title:'도움말', help_text:'캠페인 JSON 작성부터 매트릭스 분석까지.', get_started:'시작하기', json_format:'JSON 형식', campaign_layers:'캠페인 레이어', matrix_usage:'매트릭스 사용', faq:'FAQ',
    },
    en: {
      nav_main:'Main', nav_campaigns:'Campaigns', nav_help:'Help', local_data:'Local data', hero_title:'Analyze adversary behavior at a glance', hero_text:'Compare ATT&CK Enterprise behavior across campaigns and user-defined analysis layers.', highlighted:'Highlighted techniques', campaigns:'Campaigns', layers:'Layers', select_all:'Select all', clear_all:'Clear all', search_placeholder:'Search T-code or technique name', search_result:'Search result', matrix_hint:'Click a tactic header or technique to open internal details and campaign usage.', loading:'Loading data…', show_unused:'Show unused', tactics:'Tactics', techniques:'Techniques', subtechniques:'Sub-techniques', size:'Size', fit_columns:'Fit all columns', campaign_manager:'Campaign Management', campaign_manager_text:'Manage JSON files in data/campaigns/ directly.', new_campaign:'+ New campaign', status:'Status', name:'Name', description:'Description', layer:'Layers', technique_count:'Techniques', filename:'Filename', filename_help:'Include the .json extension. Leave blank to generate it from the campaign name.', actions:'Actions', loading_short:'Loading…', new_campaign_title:'New campaign', edit_campaign:'Edit campaign', badge_name:'Badge name', badge_help:'Short name displayed on matrix badges', attribution_candidates:'Attribution candidates', attribution_help:'Enter one candidate per line.', color:'Color', add_layer:'+ Add layer', cancel:'Cancel', save:'Save', attack_info:'ATT&CK information', tactic:'Tactic', platforms:'Platforms', parent_technique:'Parent technique', child_techniques:'Sub-techniques', used_campaigns:'Campaign usage', no_usage:'No valid campaign JSON explicitly uses this T-code.', mitre_source:'MITRE source ↗', matrix_breadcrumb:'Enterprise Matrix', help_title:'Help', help_text:'From campaign JSON authoring to matrix analysis.', get_started:'Getting Started', json_format:'JSON Format', campaign_layers:'Campaign Layers', matrix_usage:'Matrix Usage', faq:'FAQ',
    },
  };
  translations.ko.nav_terms = '이용 조건';
  translations.en.nav_terms = 'Terms of Use';
  translations.ko.used_layers = '사용된 레이어';
  translations.en.used_layers = 'Used in layers';
  translations.ko.status_legend = '상태 범례';
  translations.en.status_legend = 'Status legend';
  translations.ko.status_valid = '유효';
  translations.en.status_valid = 'Valid';
  translations.ko.status_warning = '경고';
  translations.en.status_warning = 'Warning';
  translations.ko.status_invalid = '유효하지 않음';
  translations.en.status_invalid = 'Invalid';
  translations.ko.status_valid_help = 'JSON 형식, 스키마 및 모든 ATT&CK T-code가 유효하며 메인 화면에서 사용할 수 있습니다.';
  translations.en.status_valid_help = 'The JSON, schema, and every ATT&CK T-code are valid, so the campaign is available on the main page.';
  translations.ko.status_warning_help = '스키마는 유효하지만 알 수 없는 T-code가 있어 메인 시각화에서 제외됩니다.';
  translations.en.status_warning_help = 'The schema is valid, but unknown T-codes exclude the campaign from the main visualization.';
  translations.ko.status_invalid_help = 'JSON 구문, 지원 버전, 필수 필드 또는 데이터 형식이 올바르지 않습니다.';
  translations.en.status_invalid_help = 'The JSON syntax, supported version, required fields, or data types are invalid.';
  translations.ko.reset_zoom = '100% 배율로 복원';
  translations.en.reset_zoom = 'Reset zoom to 100%';
  translations.ko.resize_matrix = '매트릭스 표시 영역 높이 조절';
  translations.en.resize_matrix = 'Resize matrix display height';
  translations.ko.resize_matrix_hint = '드래그하여 높이 조절, 더블클릭하여 최소/최대 높이 전환';
  translations.en.resize_matrix_hint = 'Drag to resize; double-click to toggle minimum/maximum height';
  translations.ko.nav_disclaimer = '데모 데이터 안내';
  translations.en.nav_disclaimer = 'Demo Disclaimer';
  translations.ko.disclaimer_title = '데모 데이터 안내';
  translations.en.disclaimer_title = 'Demo Data Disclaimer';
  translations.ko.disclaimer_text = '예시 캠페인의 성격과 해석 범위를 확인하세요.';
  translations.en.disclaimer_text = 'Review the nature and interpretation limits of the example campaigns.';
  translations.ko.terms_title = '이용 조건';
  translations.en.terms_title = 'Terms of Use';
  translations.ko.terms_text = '허용되는 사용, 재배포 조건 및 제3자 고지를 확인하세요.';
  translations.en.terms_text = 'Review permitted use, redistribution conditions, and third-party notices.';
  translations.ko.legal_original_note = '정확성을 위해 원문을 변경 없이 표시합니다.';
  translations.en.legal_original_note = 'The original text is displayed without modification for accuracy.';
  translations.ko.back_to_terms = '이용 조건으로 돌아가기';
  translations.en.back_to_terms = 'Back to Terms of Use';
  translations.ko.download_original = '원본 파일 다운로드';
  translations.en.download_original = 'Download original file';
  translations.ko.export_matrix = 'SVG 내보내기';
  translations.en.export_matrix = 'Export SVG';
  translations.ko.export_png = 'PNG 내보내기';
  translations.en.export_png = 'Export PNG';
  translations.ko.campaign_badges = '캠페인 배지';
  translations.en.campaign_badges = 'Campaign badges';
  translations.ko.expand_all_campaigns = '모두 펼치기';
  translations.en.expand_all_campaigns = 'Expand all';
  translations.ko.collapse_all_campaigns = '모두 접기';
  translations.en.collapse_all_campaigns = 'Collapse all';
  translations.ko.progress_filter = '진행 상태';
  translations.en.progress_filter = 'Progress';
  translations.ko.seen = '확인됨';
  translations.en.seen = 'Seen';
  translations.ko.unseen = '미확인';
  translations.en.unseen = 'Unseen';
  let language = localStorage.getItem('attviz-language') || (navigator.language?.toLowerCase().startsWith('ko') ? 'ko' : 'en');
  if (!translations[language]) language = 'en';
  function t(key) { return translations[language][key] || translations.ko[key] || key; }
  function apply() { document.documentElement.lang = language; document.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n); }); document.querySelectorAll('[data-i18n-placeholder]').forEach(element => { element.placeholder = t(element.dataset.i18nPlaceholder); }); document.querySelectorAll('[data-i18n-title]').forEach(element => { element.title = t(element.dataset.i18nTitle); }); document.querySelectorAll('[data-i18n-aria-label]').forEach(element => { element.setAttribute('aria-label', t(element.dataset.i18nAriaLabel)); }); document.querySelectorAll('[data-lang]').forEach(element => { element.hidden = element.dataset.lang !== language; }); document.querySelectorAll('[data-language]').forEach(button => { const active = button.dataset.language === language; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); }); }
  document.querySelectorAll('[data-language]').forEach(button => button.addEventListener('click', () => { language = button.dataset.language; localStorage.setItem('attviz-language', language); apply(); window.dispatchEvent(new CustomEvent('attviz:language-changed', {detail:{language}})); }));
  window.attvizI18n = {t, get language(){return language;}};
  apply();
})();

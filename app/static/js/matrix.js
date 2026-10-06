(() => {
  const state = {
    campaigns: [], columns: [], selected: new Set(), selectedLayers: new Set(), search: '',
    showUnusedTactics: true, showUnusedTechniques: false,
    showUnusedSubtechniques: false, subtechExpanded: new Map(), zoom: 100, layerOrder: [],
    expandedCampaignBadges: new Set(), campaignOrder: [], progressStatuses: new Set(['seen', 'unseen']),
  };
  const $ = (selector) => document.querySelector(selector);
  const ui = (ko, en) => window.attvizI18n?.language === 'ko' ? ko : en;
  const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
  const stripMd = (value = '') => value.replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/[\r\n]+/g, ' ').replace(/[*_`#]/g, '').trim();
  const mix = colors => {
    if (!colors.length) return '#344a5d';
    const rgb = colors.map(color => [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16)));
    return `#${[0, 1, 2].map(index => Math.round(rgb.reduce((sum, color) => sum + color[index], 0) / rgb.length).toString(16).padStart(2, '0')).join('')}`;
  };
  const blend = (foreground, background, amount) => {
    const parse = color => [1, 3, 5].map(index => parseInt(color.slice(index, index + 2), 16));
    const fg = parse(foreground);
    const bg = parse(background);
    return `#${fg.map((value, index) => Math.round(value * amount + bg[index] * (1 - amount))
      .toString(16).padStart(2, '0')).join('')}`;
  };

  function activeCampaigns() {
    return state.campaigns.filter(campaign => state.selected.has(campaign.filename));
  }

  const techniqueId = item => typeof item === 'string' ? item : item.id;
  const techniqueStatus = item => typeof item === 'string' ? 'seen' : item.status;

  function techniqueProgress(campaign, id) {
    const occurrences = campaign.campaign.layers.flatMap((layer, layerIndex) => state.selectedLayers.has(layer.name)
      ? layer.techniques.filter(item => techniqueId(item) === id).map(item => ({item, layer: layer.name, layerIndex}))
      : []);
    const statuses = new Set(occurrences.map(({item}) => techniqueStatus(item)));
    const layerStates = [...new Set(occurrences.map(({layerIndex}) => layerIndex))].map(layerIndex => {
      const matches = occurrences.filter(item => item.layerIndex === layerIndex);
      const layerStatuses = new Set(matches.map(({item}) => techniqueStatus(item)));
      return {
        layerIndex,
        layer: matches[0].layer,
        status: layerStatuses.size === 1 ? [...layerStatuses][0] : 'mixed',
        comments: matches.map(({item}) => typeof item === 'string' ? '' : item.comment || '').filter(Boolean),
      };
    });
    return {
      status: statuses.size === 1 ? [...statuses][0] : 'mixed',
      layerStates,
    };
  }

  function animateChipReorder(container, dragged, target, insertBefore) {
    const chips = [...container.querySelectorAll('.chip[draggable="true"]')];
    const previous = new Map(chips.map(item => [item, item.getBoundingClientRect()]));
    container.insertBefore(dragged, insertBefore ? target : target.nextSibling);
    chips.forEach(item => {
      const before = previous.get(item);
      const after = item.getBoundingClientRect();
      const x = before.left - after.left;
      const y = before.top - after.top;
      if ((x || y) && item.animate) item.animate(
        [{transform: `translate(${x}px, ${y}px)`}, {transform: 'translate(0, 0)'}],
        {duration: 170, easing: 'ease-out'},
      );
    });
  }

  function campaignsFor(id) {
    return activeCampaigns().filter(({ campaign }) => campaign.layers.some(layer =>
      state.selectedLayers.has(layer.name) && layer.techniques.some(item =>
        techniqueId(item) === id && state.progressStatuses.has(techniqueStatus(item)))));
  }

  function usage() {
    const explicit = new Set();
    activeCampaigns().forEach(({ campaign }) => campaign.layers.forEach(layer => {
      if (state.selectedLayers.has(layer.name)) {
        layer.techniques.forEach(item => {
          if (state.progressStatuses.has(techniqueStatus(item))) explicit.add(techniqueId(item));
        });
      }
    }));

    // Preserve parent/ancestor context without treating it as explicitly highlighted.
    const parents = new Map();
    state.columns.forEach(column => column.techniques.forEach(technique => {
      if (technique.parent_id) parents.set(technique.id, technique.parent_id);
    }));
    const effective = new Set(explicit);
    explicit.forEach(id => {
      let parent = parents.get(id);
      while (parent) {
        effective.add(parent);
        parent = parents.get(parent);
      }
    });
    return { explicit, effective };
  }

  function renderCampaigns() {
    const box = $('#campaignToggles');
    state.campaignOrder = state.campaignOrder.filter(filename => state.campaigns.some(item => item.filename === filename));
    state.campaigns.forEach(item => { if (!state.campaignOrder.includes(item.filename)) state.campaignOrder.push(item.filename); });
    state.campaigns.sort((a, b) => state.campaignOrder.indexOf(a.filename) - state.campaignOrder.indexOf(b.filename));
    box.innerHTML = state.campaigns.length ? state.campaigns.map(campaign => {
      const label = campaign.campaign.nickname || campaign.campaign.name;
      const techniqueCount = new Set(campaign.campaign.layers.flatMap(layer => layer.techniques.map(techniqueId))).size;
      const tooltip = esc(JSON.stringify({
        kind: 'campaign', nickname: label, name: campaign.campaign.name,
        attribution: campaign.campaign.attribution_candidates || [], color: campaign.assigned_color,
        description: campaign.campaign.description || '',
        layers: campaign.campaign.layers.map(layer => layer.name), techniqueCount,
      }));
      return `<button class="chip campaign-filter-chip ${state.selected.has(campaign.filename) ? 'active' : ''}" draggable="true" style="--chip-color:${campaign.assigned_color}" data-campaign="${esc(campaign.filename)}" data-tip='${tooltip}'><span class="layer-drag" aria-hidden="true">⠿</span><i class="chip-dot"></i>${esc(label)}</button>`;
    }).join('')
      : `<span class="muted">${ui('유효한 캠페인이 없습니다.', 'No valid campaigns.')}</span>`;
    let draggedCampaign = null;
    let campaignWasDragged = false;
    box.querySelectorAll('button').forEach(button => {
      button.onclick = event => {
        if (campaignWasDragged) { event.preventDefault(); campaignWasDragged = false; return; }
        state.selected.has(button.dataset.campaign)
          ? state.selected.delete(button.dataset.campaign)
          : state.selected.add(button.dataset.campaign);
        selectAllAvailableLayers();
        update();
      };
      button.ondragstart = event => {
        draggedCampaign = button;
        campaignWasDragged = true;
        button.classList.add('dragging');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', button.dataset.campaign);
      };
      button.ondragover = event => {
        event.preventDefault();
        if (!draggedCampaign || draggedCampaign === button) return;
        const rect = button.getBoundingClientRect();
        const insertBefore = event.clientX < rect.left + rect.width / 2;
        if ((insertBefore && draggedCampaign.nextElementSibling === button)
          || (!insertBefore && button.nextElementSibling === draggedCampaign)) return;
        animateChipReorder(box, draggedCampaign, button, insertBefore);
      };
      button.ondrop = event => {
        event.preventDefault();
        state.campaignOrder = [...box.querySelectorAll('.campaign-filter-chip')].map(item => item.dataset.campaign);
        state.campaigns.sort((a, b) => state.campaignOrder.indexOf(a.filename) - state.campaignOrder.indexOf(b.filename));
      };
      button.ondragend = () => {
        state.campaignOrder = [...box.querySelectorAll('.campaign-filter-chip')].map(item => item.dataset.campaign);
        state.campaigns.sort((a, b) => state.campaignOrder.indexOf(a.filename) - state.campaignOrder.indexOf(b.filename));
        draggedCampaign = null;
        box.querySelectorAll('.campaign-filter-chip').forEach(item => item.classList.remove('dragging'));
        window.setTimeout(() => { campaignWasDragged = false; }, 0);
      };
    });
  }

  function renderLayers() {
    const layerNames = orderedLayerNames();
    [...state.selectedLayers].forEach(name => { if (!layerNames.includes(name)) state.selectedLayers.delete(name); });
    $('#layerToggles').innerHTML = layerNames.length ? layerNames.map(name =>
      `<button class="chip layer-filter-chip ${state.selectedLayers.has(name) ? 'active' : ''}" draggable="true" data-layer="${esc(name)}"><span class="layer-drag" aria-hidden="true">⠿</span>${esc(name)}</button>`).join('')
      : `<span class="muted">${ui('선택 가능한 레이어가 없습니다.', 'No layers available.')}</span>`;
    let draggedLayer = null;
    let layerWasDragged = false;
    const container = $('#layerToggles');
    $('#layerToggles').querySelectorAll('button').forEach(button => {
      button.onclick = event => {
        if (layerWasDragged) { event.preventDefault(); layerWasDragged = false; return; }
        state.selectedLayers.has(button.dataset.layer)
          ? state.selectedLayers.delete(button.dataset.layer)
          : state.selectedLayers.add(button.dataset.layer);
        update(false);
      };
      button.ondragstart = event => {
        draggedLayer = button.dataset.layer;
        layerWasDragged = true;
        button.classList.add('dragging');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', draggedLayer);
      };
      button.ondragover = event => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        if (!draggedLayer || draggedLayer === button) return;
        const dragged = [...container.querySelectorAll('.layer-filter-chip')]
          .find(item => item.dataset.layer === draggedLayer);
        if (!dragged) return;
        const rect = button.getBoundingClientRect();
        const insertBefore = event.clientX < rect.left + rect.width / 2;
        if ((insertBefore && dragged.nextElementSibling === button)
          || (!insertBefore && button.nextElementSibling === dragged)) return;
        animateChipReorder(container, dragged, button, insertBefore);
      };
      button.ondrop = event => {
        event.preventDefault();
        state.layerOrder = [...container.querySelectorAll('.layer-filter-chip')].map(item => item.dataset.layer);
      };
      button.ondragend = () => {
        state.layerOrder = [...container.querySelectorAll('.layer-filter-chip')].map(item => item.dataset.layer);
        draggedLayer = null;
        container.querySelectorAll('.layer-filter-chip').forEach(item => item.classList.remove('dragging'));
        window.setTimeout(() => { layerWasDragged = false; }, 0);
      };
    });
  }

  function compareLayerNames(left, right) {
    const group = name => name.startsWith('EXT-') ? 0 : name.startsWith('DMZ-') ? 1 : name.startsWith('INT-') ? 2 : 3;
    return group(left) - group(right) || left.localeCompare(right, undefined, {sensitivity: 'base'});
  }

  function availableLayerNames() {
    return [...new Set(activeCampaigns().flatMap(item => item.campaign.layers.map(layer => layer.name)))]
      .sort(compareLayerNames);
  }

  function orderedLayerNames() {
    const available = availableLayerNames();
    state.layerOrder = state.layerOrder.filter(name => available.includes(name));
    available.forEach(name => {
      if (state.layerOrder.includes(name)) return;
      const nextIndex = state.layerOrder.findIndex(existing => compareLayerNames(name, existing) < 0);
      if (nextIndex < 0) state.layerOrder.push(name);
      else state.layerOrder.splice(nextIndex, 0, name);
    });
    return state.layerOrder;
  }

  function selectAllAvailableLayers() {
    state.selectedLayers = new Set(availableLayerNames());
  }

  function visibleTechnique(technique, effective) {
    if (technique.parent_id) {
      const parentExpanded = state.subtechExpanded.get(technique.parent_id) ?? state.showUnusedSubtechniques;
      return parentExpanded || effective.has(technique.id);
    }
    return state.showUnusedTechniques || effective.has(technique.id);
  }

  function renderTechnique(technique, explicit, effective, query, counters, childCount = 0) {
    const campaigns = campaignsFor(technique.id);
    const found = !query || technique.id.toLowerCase().includes(query) || technique.name.toLowerCase().includes(query);
    const isAncestorOnly = effective.has(technique.id) && !explicit.has(technique.id);
    if (campaigns.length) counters.highlighted += 1;
    if (query && found) counters.matches += 1;
    const campaignLabel = campaign => campaign.campaign.nickname || campaign.campaign.name;
    const badgesExpanded = state.expandedCampaignBadges.has(technique.id);
    const visibleCampaigns = badgesExpanded ? campaigns : campaigns.slice(0, 2);
    const badges = visibleCampaigns.map(campaign => {
      const progress = techniqueProgress(campaign, technique.id);
      const statusIcon = progress.status === 'seen' ? '●' : progress.status === 'unseen' ? '○' : '◐';
      const statusLabel = progress.status === 'seen' ? ui('확인됨', 'Seen') : progress.status === 'unseen' ? ui('미확인', 'Unseen') : ui('혼합', 'Mixed');
      const actionHint = ui('클릭하면 Layer별 상태와 주석 편집을 엽니다.', 'Click to edit status and comments by layer.');
      return `<span class="campaign-progress"><span class="badge" style="--badge:${campaign.assigned_color}" title="${esc(campaign.campaign.name)}">${esc(campaignLabel(campaign))}</span><span class="progress-state ${progress.status}" role="button" tabindex="0" data-progress-control data-campaign-file="${esc(campaign.filename)}" data-technique-id="${esc(technique.id)}" title="${esc(`${statusLabel}. ${actionHint}`)}"><span aria-hidden="true">${statusIcon}</span> ${statusLabel}</span></span>`;
    }).join('');
    const extra = campaigns.length > 2
      ? `<span class="badge more ${badgesExpanded ? 'collapse' : 'expand'}" role="button" tabindex="0" data-badge-toggle="${esc(technique.id)}" aria-expanded="${badgesExpanded}">${badgesExpanded ? ui('접기', 'Collapse') : `${ui('더보기', 'More')} +${campaigns.length - 2}`}</span>` : '';
    const tactics = technique.tactics.map(name => name.replaceAll('-', ' ').replace(/\b\w/g, char => char.toUpperCase())).join(', ');
    const tooltip = esc(JSON.stringify({
      id: technique.id, name: technique.name, tactics,
      parent: technique.parent_id ? `${technique.parent_id} ${technique.parent_name}` : '—',
      description: stripMd(technique.description),
    }));
    const expanded = state.subtechExpanded.get(technique.id) ?? state.showUnusedSubtechniques;
    const toggleTitle = ui(`미사용 하위 기술 ${expanded ? '접기' : '펼치기'}`, `${expanded ? 'Collapse' : 'Expand'} unused sub-techniques`);
    const toggle = childCount ? `<button class="subtech-toggle" type="button" data-parent-id="${esc(technique.id)}" aria-expanded="${expanded}" title="${toggleTitle}"><span aria-hidden="true">${expanded ? '▾' : '▸'}</span><span>${childCount}</span></button>` : '';
    return `<div class="technique-row ${childCount ? 'has-subtechniques' : ''} ${technique.parent_id ? 'is-subtechnique' : ''}"><a class="technique ${technique.parent_id ? 'subtechnique' : ''} ${campaigns.length ? 'highlighted' : ''} ${isAncestorOnly ? 'ancestor-context' : ''} ${query ? (found ? 'search-match' : 'search-dim') : ''}" style="--mix:${mix(campaigns.map(campaign => campaign.assigned_color))}" href="/techniques/${encodeURIComponent(technique.id)}" target="_blank" rel="noopener noreferrer" data-tip='${tooltip}'><span class="tid">${esc(technique.id)}${technique.parent_id ? '<span class="subtech-label">SUB</span>' : ''}</span><span class="tname">${esc(technique.name)}</span>${isAncestorOnly ? `<span class="ancestor-note">${ui('사용된 하위 기술의 상위 항목', 'Parent of a used sub-technique')}</span>` : ''}${campaigns.length ? `<span class="badges">${badges}${extra}</span>` : ''}</a>${toggle}</div>`;
  }

  function parentIds() {
    return [...new Set(state.columns.flatMap(column => column.techniques
      .filter(technique => technique.parent_id).map(technique => technique.parent_id)))];
  }

  function syncSubtechniqueCheckbox() {
    const checkbox = $('#showUnusedSubtechniques');
    const ids = parentIds();
    const expandedCount = ids.filter(id => state.subtechExpanded.get(id) ?? state.showUnusedSubtechniques).length;
    checkbox.checked = ids.length === 0 || expandedCount === ids.length;
    checkbox.indeterminate = expandedCount > 0 && expandedCount < ids.length;
    checkbox.title = checkbox.indeterminate
      ? ui('일부 부모 기술의 하위 기술만 펼쳐져 있습니다.', 'Only some parent sub-techniques are expanded.')
      : checkbox.checked ? ui('모든 하위 기술을 표시합니다.', 'Show all sub-techniques.') : ui('미사용 하위 기술을 숨깁니다.', 'Hide unused sub-techniques.');
  }

  function setAllSubtechniques(expanded) {
    state.showUnusedSubtechniques = expanded;
    parentIds().forEach(id => state.subtechExpanded.set(id, expanded));
  }

  function syncSearchClear() {
    const button = $('#clearSearch');
    button.hidden = state.search.length === 0;
    const label = ui('검색어 지우기', 'Clear search');
    button.setAttribute('aria-label', label);
    button.title = label;
    $('#searchInput').setAttribute('aria-label', ui('T-code 또는 기술 이름 검색', 'Search T-code or technique name'));
  }

  function renderMatrix() {
    const { explicit, effective } = usage();
    const query = state.search.trim().toLowerCase();
    const counters = { highlighted: 0, matches: 0 };
    const columns = state.columns.map(column => {
      const childCounts = new Map();
      column.techniques.forEach(technique => {
        if (technique.parent_id) childCounts.set(technique.parent_id, (childCounts.get(technique.parent_id) || 0) + 1);
      });
      return {
        ...column, childCounts,
        visibleTechniques: column.techniques.filter(technique => visibleTechnique(technique, effective)),
        isUsed: column.techniques.some(technique => effective.has(technique.id)),
      };
    }).filter(column => state.showUnusedTactics || column.isUsed);

    $('#matrix').innerHTML = columns.length ? columns.map(column => {
      const tacticTip = esc(JSON.stringify({kind: 'tactic', name: column.tactic.name, count: column.visibleTechniques.length, description: stripMd(column.tactic.description)}));
      return `<section class="tactic-column"><a class="tactic-title" href="/tactics/${encodeURIComponent(column.tactic.short_name)}" target="_blank" rel="noopener noreferrer" data-tip='${tacticTip}'><strong>${esc(column.tactic.name)}</strong><small>${column.visibleTechniques.length} techniques</small></a><div class="technique-list">${column.visibleTechniques.map(technique => renderTechnique(technique, explicit, effective, query, counters, column.childCounts.get(technique.id) || 0)).join('')}</div></section>`;
    }).join('')
      : `<div class="matrix-empty">${ui('현재 조건에서 표시할 전술이 없습니다. 캠페인을 선택하거나 미사용 전술 표시를 켜세요.', 'No tactics match the current filters. Select a campaign or show unused tactics.')}</div>`;
    $('#highlightCount').textContent = counters.highlighted;
    $('#searchCount').textContent = query ? ui(`${counters.matches}개 검색 결과`, `${counters.matches} results`) : '';
    bindTooltips();
    bindSubtechniqueToggles();
    bindBadgeToggles();
    bindProgressToggles();
    syncSubtechniqueCheckbox();
  }

  function bindProgressToggles() {
    document.querySelectorAll('[data-progress-control]').forEach(button => {
      const activate = async event => {
        event.preventDefault();
        event.stopPropagation();
        const campaign = state.campaigns.find(item => item.filename === button.dataset.campaignFile);
        if (!campaign) return;
        openProgressPopover(campaign, button.dataset.techniqueId, button);
      };
      button.onclick = activate;
      button.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') activate(event); };
    });
  }

  async function saveProgress(campaign, techniqueIdValue, status, layerIndexes, busyElement = null) {
    busyElement?.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch(`/api/campaigns/${encodeURIComponent(campaign.filename)}/techniques/${encodeURIComponent(techniqueIdValue)}`, {
        method: 'PATCH', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({status, layer_indexes: layerIndexes}),
      });
      if (!response.ok) { const detail = await response.json(); throw new Error(detail.detail || response.statusText); }
      const updated = await response.json();
      const index = state.campaigns.findIndex(item => item.filename === campaign.filename);
      state.campaigns[index] = updated;
      closeProgressPopover();
      renderMatrix();
    } catch (error) {
      alert(`${ui('진행 상태를 저장하지 못했습니다.', 'Unable to save progress.')} ${error.message}`);
      busyElement?.removeAttribute('aria-busy');
    }
  }

  function closeProgressPopover() {
    const popover = $('#progressPopover');
    popover.hidden = true;
    popover.innerHTML = '';
  }

  function openProgressPopover(campaign, techniqueIdValue, anchor) {
    const progress = techniqueProgress(campaign, techniqueIdValue);
    const popover = $('#progressPopover');
    const label = campaign.campaign.nickname || campaign.campaign.name;
    const rows = progress.layerStates.map(layer => {
      const comments = layer.comments.length ? `<p>${layer.comments.map(esc).join('<br>')}</p>` : '';
      return `<div class="progress-layer-row"><div><strong>${esc(layer.layer)}</strong>${comments}</div><div class="progress-layer-actions" role="group" aria-label="${esc(`${layer.layer} ${ui('진행 상태', 'progress')}`)}"><button type="button" class="${layer.status === 'seen' ? 'active seen' : ''}" data-layer-status="seen" data-layer-index="${layer.layerIndex}">● ${ui('확인됨', 'Seen')}</button><button type="button" class="${layer.status === 'unseen' ? 'active unseen' : ''}" data-layer-status="unseen" data-layer-index="${layer.layerIndex}">○ ${ui('미확인', 'Unseen')}</button></div></div>`;
    }).join('');
    popover.innerHTML = `<div class="progress-popover-head"><div><small>${esc(techniqueIdValue)}</small><strong>${esc(label)}</strong></div><button type="button" data-progress-close aria-label="${ui('닫기', 'Close')}">×</button></div><div class="progress-layer-list">${rows}</div><div class="progress-bulk"><span>${ui('선택된 Layer 일괄 변경', 'Change all selected layers')}</span><button type="button" data-bulk-status="seen">● ${ui('모두 확인됨', 'All seen')}</button><button type="button" data-bulk-status="unseen">○ ${ui('모두 미확인', 'All unseen')}</button></div>`;
    popover.hidden = false;
    const anchorRect = anchor.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    popover.style.left = `${Math.max(8, Math.min(window.innerWidth - popoverRect.width - 8, anchorRect.left))}px`;
    popover.style.top = `${Math.max(8, Math.min(window.innerHeight - popoverRect.height - 8, anchorRect.bottom + 6))}px`;
    popover.querySelector('[data-progress-close]').onclick = closeProgressPopover;
    popover.querySelectorAll('[data-layer-status]').forEach(button => button.onclick = () => {
      if (button.classList.contains('active')) return;
      saveProgress(campaign, techniqueIdValue, button.dataset.layerStatus, [Number(button.dataset.layerIndex)], button);
    });
    popover.querySelectorAll('[data-bulk-status]').forEach(button => button.onclick = () => {
      const status = button.dataset.bulkStatus;
      const message = ui(
        `선택된 ${progress.layerStates.length}개 Layer의 ${techniqueIdValue} 상태를 모두 ${status === 'seen' ? '확인됨' : '미확인'}으로 변경할까요?`,
        `Change ${techniqueIdValue} to ${status} in all ${progress.layerStates.length} selected layers?`,
      );
      if (confirm(message)) saveProgress(campaign, techniqueIdValue, status, progress.layerStates.map(layer => layer.layerIndex), button);
    });
    popover.querySelector('button')?.focus();
  }

  function bindBadgeToggles() {
    document.querySelectorAll('[data-badge-toggle]').forEach(button => {
      const toggle = event => {
        event.preventDefault();
        event.stopPropagation();
        const id = button.dataset.badgeToggle;
        state.expandedCampaignBadges.has(id)
          ? state.expandedCampaignBadges.delete(id)
          : state.expandedCampaignBadges.add(id);
        renderMatrix();
      };
      button.onclick = toggle;
      button.onkeydown = event => {
        if (event.key === 'Enter' || event.key === ' ') toggle(event);
      };
    });
  }

  function expandAllCampaignBadges() {
    state.columns.forEach(column => column.techniques.forEach(technique => {
      if (campaignsFor(technique.id).length > 2) state.expandedCampaignBadges.add(technique.id);
    }));
    renderMatrix();
  }

  function collapseAllCampaignBadges() {
    state.expandedCampaignBadges.clear();
    renderMatrix();
  }

  function bindSubtechniqueToggles() {
    document.querySelectorAll('.subtech-toggle').forEach(button => {
      button.onclick = () => {
        const parentId = button.dataset.parentId;
        const expanded = state.subtechExpanded.get(parentId) ?? state.showUnusedSubtechniques;
        state.subtechExpanded.set(parentId, !expanded);
        renderMatrix();
      };
    });
  }

  function bindTooltips() {
    const tip = $('#tooltip');
    document.querySelectorAll('[data-tip]').forEach(element => {
      element.onmouseenter = () => {
        const data = JSON.parse(element.dataset.tip);
        if (data.kind === 'tactic') {
          tip.innerHTML = `<span class="tip-id">TACTIC</span><h3>${esc(data.name)}</h3><dl><dt>${ui('기술', 'Techniques')}</dt><dd>${data.count}</dd></dl><p>${esc(data.description)}</p>`;
        } else if (data.kind === 'campaign') {
          const attribution = data.attribution.length ? data.attribution.map(esc).join(', ') : ui('지정되지 않음', 'Not specified');
          const layers = data.layers.length
            ? data.layers.map(layer => `<span class="tip-layer-badge">${esc(layer)}</span>`).join('')
            : `<span class="muted">${ui('없음', 'None')}</span>`;
          const description = data.description || ui('설명 없음', 'No description');
          tip.innerHTML = `<div class="tip-campaign-kicker"><i style="--tip-campaign-color:${esc(data.color)}"></i><span>${ui('캠페인', 'Campaign')}</span></div><h3>${esc(data.name)}</h3><dl class="tip-campaign-details"><dt>${ui('배지', 'Badge')}</dt><dd><b class="tip-campaign-badge" style="--badge:${esc(data.color)}">${esc(data.nickname)}</b></dd><dt>${ui('귀속 후보', 'Attribution')}</dt><dd>${attribution}</dd><dt>${ui('설명', 'Description')}</dt><dd class="tip-campaign-description">${esc(description)}</dd><dt>${ui('레이어', 'Layers')}</dt><dd class="tip-layer-list">${layers}</dd><dt>${ui('기술', 'Techniques')}</dt><dd>${data.techniqueCount}</dd></dl>`;
        } else {
          tip.innerHTML = `<span class="tip-id">${esc(data.id)}</span><h3>${esc(data.name)}</h3><dl><dt>${ui('전술', 'Tactic')}</dt><dd>${esc(data.tactics)}</dd><dt>${ui('부모', 'Parent')}</dt><dd>${esc(data.parent)}</dd></dl><p>${esc(data.description)}</p>`;
        }
        tip.hidden = false;
      };
      element.onmousemove = event => {
        let x = event.clientX + 16;
        let y = event.clientY + 16;
        if (x + 320 > innerWidth) x = event.clientX - 326;
        if (y + tip.offsetHeight > innerHeight) y = innerHeight - tip.offsetHeight - 10;
        tip.style.left = `${x}px`;
        tip.style.top = `${y}px`;
      };
      element.onmouseleave = () => { tip.hidden = true; };
    });
  }

  function setZoom(value) {
    state.zoom = Math.max(0, Math.min(100, Math.round(value)));
    $('#zoomRange').value = state.zoom;
    $('#zoomInput').value = state.zoom;
    $('#matrix').style.setProperty('--matrix-zoom', state.zoom / 100);
  }

  function fitMatrix() {
    const visibleColumns = $('#matrix').querySelectorAll('.tactic-column').length;
    if (!visibleColumns) return;
    const naturalWidth = visibleColumns * 150;
    setZoom(Math.floor(($('#matrixViewport').clientWidth / naturalWidth) * 100));
    $('#matrixViewport').scrollLeft = 0;
  }

  function downloadBlob(blob, extension) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `attack-matrix-${new Date().toISOString().slice(0, 19).replaceAll(':', '-')}.${extension}`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function runExport(button, exporter) {
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = ui('준비 중…', 'Preparing…');
    try {
      await exporter();
    } catch (error) {
      console.error(error);
      alert(ui('매트릭스를 내보내지 못했습니다.', 'Unable to export the matrix.'));
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
  }

  function exportPng() {
    return runExport($('#exportPng'), async () => {
      const matrix = $('#matrix');
      const origin = matrix.getBoundingClientRect();
      const zoom = Math.max(.01, state.zoom / 100);
      const descendants = [...matrix.querySelectorAll('*')];
      const furthestRight = descendants.reduce((value, element) => Math.max(value, element.getBoundingClientRect().right - origin.left), 0);
      const furthestBottom = descendants.reduce((value, element) => Math.max(value, element.getBoundingClientRect().bottom - origin.top), 0);
      const width = Math.max(1, Math.ceil(matrix.scrollWidth * zoom), Math.ceil(furthestRight));
      const height = Math.max(1, Math.ceil(matrix.scrollHeight * zoom), Math.ceil(furthestBottom + 16 * zoom));
      const density = Math.max(.05, Math.min(2, 16384 / width, 16384 / height, Math.sqrt(64000000 / (width * height))));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(width * density));
      canvas.height = Math.max(1, Math.floor(height * density));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas 2D is unavailable');
      context.scale(density, density);
      context.fillStyle = '#0b1620';
      context.fillRect(0, 0, width, height);

      const rectOf = element => {
        const rect = element.getBoundingClientRect();
        return {x: rect.left - origin.left, y: rect.top - origin.top, width: rect.width, height: rect.height};
      };
      const roundedRect = (rect, radius = 0) => {
        const r = Math.min(radius, rect.width / 2, rect.height / 2);
        context.beginPath();
        context.moveTo(rect.x + r, rect.y);
        context.arcTo(rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + rect.height, r);
        context.arcTo(rect.x + rect.width, rect.y + rect.height, rect.x, rect.y + rect.height, r);
        context.arcTo(rect.x, rect.y + rect.height, rect.x, rect.y, r);
        context.arcTo(rect.x, rect.y, rect.x + rect.width, rect.y, r);
        context.closePath();
      };
      const opacityFor = element => Number(getComputedStyle(element.closest('.technique') || element).opacity || 1);
      const drawText = (element, text = element.textContent.trim(), singleLine = false) => {
        if (!text) return;
        const rect = rectOf(element);
        const style = getComputedStyle(element);
        const fontSize = parseFloat(style.fontSize) * zoom;
        const lineHeight = (parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.3) * zoom;
        context.save();
        context.globalAlpha = opacityFor(element);
        context.fillStyle = style.color;
        context.font = `${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
        context.textBaseline = 'top';
        const range = document.createRange();
        range.selectNodeContents(element);
        const domLineCount = new Set([...range.getClientRects()].map(item => Math.round(item.top * 2) / 2)).size;
        const horizontalPadding = element.classList.contains('badge') ? 4 * zoom : 0;
        const availableWidth = Math.max(1, rect.width - horizontalPadding * 2);
        const words = singleLine ? [text] : text.split(/\s+/);
        const lines = [];
        let line = '';
        words.forEach(word => {
          if (!singleLine && context.measureText(word).width > availableWidth) {
            if (line) { lines.push(line); line = ''; }
            let segment = '';
            [...word].forEach(character => {
              if (segment && context.measureText(segment + character).width > availableWidth) {
                lines.push(segment);
                segment = character;
              } else segment += character;
            });
            line = segment;
            return;
          }
          const candidate = line ? `${line} ${word}` : word;
          if (!singleLine && line && context.measureText(candidate).width > availableWidth) {
            lines.push(line);
            line = word;
          } else line = candidate;
        });
        if (line) lines.push(line);
        // Render every wrapped Canvas line. domLineCount guards against fractional
        // browser line boxes, while avoiding a hard height cut prevents lost tails.
        const visibleLineCount = singleLine ? 1 : Math.max(lines.length, domLineCount, Math.round(rect.height / lineHeight));
        lines.slice(0, visibleLineCount).forEach((value, index) => {
          let output = value;
          const browserEllipsizes = singleLine && style.textOverflow === 'ellipsis'
            && element.scrollWidth > element.clientWidth;
          if (browserEllipsizes) {
            while (context.measureText(output).width > availableWidth && output.length > 1) {
              output = `${output.slice(0, -2)}…`;
            }
          }
          const centeredY = singleLine ? rect.y + Math.max(0, (rect.height - fontSize) / 2) : rect.y + index * lineHeight;
          context.fillText(output, rect.x + horizontalPadding, centeredY);
        });
        context.restore();
      };

      matrix.querySelectorAll('.tactic-column').forEach(column => {
        const rect = rectOf(column);
        context.strokeStyle = '#203142';
        context.lineWidth = Math.max(.5, zoom);
        context.strokeRect(rect.x, rect.y, rect.width, rect.height);
      });
      matrix.querySelectorAll('.tactic-title').forEach(title => {
        const rect = rectOf(title);
        context.fillStyle = '#102232';
        context.fillRect(rect.x, rect.y, rect.width, rect.height);
        context.fillStyle = '#31536c';
        context.fillRect(rect.x, rect.y + rect.height - Math.max(1, 2 * zoom), rect.width, Math.max(1, 2 * zoom));
      });
      matrix.querySelectorAll('.technique-row.is-subtechnique').forEach(row => {
        const rect = rectOf(row);
        context.strokeStyle = '#2d4658';
        context.lineWidth = Math.max(.5, zoom);
        context.beginPath();
        context.moveTo(rect.x, rect.y - 8 * zoom);
        context.lineTo(rect.x, rect.y + rect.height);
        context.moveTo(rect.x, rect.y + 27 * zoom);
        context.lineTo(rect.x + 6 * zoom, rect.y + 27 * zoom);
        context.stroke();
      });
      matrix.querySelectorAll('.technique').forEach(technique => {
        const rect = rectOf(technique);
        const style = getComputedStyle(technique);
        const campaignColor = technique.style.getPropertyValue('--mix').trim() || '#344a5d';
        context.save();
        context.globalAlpha = Number(style.opacity || 1);
        roundedRect(rect, 6 * zoom);
        context.fillStyle = technique.classList.contains('highlighted') ? blend(campaignColor, '#101c27', .34) : style.backgroundColor;
        context.fill();
        context.strokeStyle = technique.classList.contains('search-match') ? '#ffe66d' : style.borderColor;
        context.lineWidth = technique.classList.contains('search-match') ? Math.max(2, 2 * zoom) : Math.max(.5, zoom);
        context.stroke();
        context.fillStyle = technique.classList.contains('highlighted') ? campaignColor : style.borderLeftColor;
        context.fillRect(rect.x, rect.y + 4 * zoom, Math.max(2, 3 * zoom), Math.max(0, rect.height - 8 * zoom));
        context.restore();
      });
      matrix.querySelectorAll('.badge').forEach(badge => {
        const rect = rectOf(badge);
        const campaignColor = badge.style.getPropertyValue('--badge').trim();
        if (badge.classList.contains('collapse')) return;
        context.save();
        context.globalAlpha = opacityFor(badge);
        roundedRect(rect, 3 * zoom);
        if (!badge.classList.contains('more')) {
          context.fillStyle = blend(campaignColor || '#344a5d', '#071019', .25);
          context.fill();
        }
        context.strokeStyle = campaignColor ? blend(campaignColor, '#ffffff', .6) : '#3ddbd9';
        context.lineWidth = Math.max(.5, zoom);
        if (badge.classList.contains('expand')) context.setLineDash([3 * zoom, 2 * zoom]);
        context.stroke();
        context.restore();
      });
      matrix.querySelectorAll('.tactic-title strong, .tactic-title small, .tid, .tname, .ancestor-note, .subtech-label, .subtech-toggle span, .badge, .progress-state')
        .forEach(element => drawText(
          element,
          element.classList.contains('tid') ? element.childNodes[0]?.textContent.trim() : element.textContent.trim(),
          element.classList.contains('badge') || element.classList.contains('progress-state'),
        ));

      const png = await new Promise((resolve, reject) => canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Unable to encode PNG')), 'image/png', 1,
      ));
      downloadBlob(png, 'png');
    });
  }

  function update(renderCampaignSelection = true) {
    if (renderCampaignSelection) renderCampaigns();
    renderLayers();
    renderMatrix();
  }

  $('#selectAll').onclick = () => { state.campaigns.forEach(c => state.selected.add(c.filename)); update(); };
  $('#clearAll').onclick = () => { state.selected.clear(); state.selectedLayers.clear(); update(); };
  $('#selectAllLayers').onclick = () => { selectAllAvailableLayers(); update(false); };
  $('#clearAllLayers').onclick = () => { state.selectedLayers.clear(); update(false); };
  $('#searchInput').oninput = event => { state.search = event.target.value; syncSearchClear(); renderMatrix(); };
  $('#clearSearch').onclick = () => { state.search = ''; $('#searchInput').value = ''; syncSearchClear(); renderMatrix(); $('#searchInput').focus(); };
  $('#showUnusedTactics').onchange = event => { state.showUnusedTactics = event.target.checked; renderMatrix(); };
  $('#showUnusedTechniques').onchange = event => { state.showUnusedTechniques = event.target.checked; renderMatrix(); };
  $('#showUnusedSubtechniques').onchange = event => { setAllSubtechniques(event.target.checked); renderMatrix(); };
  $('#showSeen').onchange = event => { event.target.checked ? state.progressStatuses.add('seen') : state.progressStatuses.delete('seen'); renderMatrix(); };
  $('#showUnseen').onchange = event => { event.target.checked ? state.progressStatuses.add('unseen') : state.progressStatuses.delete('unseen'); renderMatrix(); };
  $('#expandAllCampaigns').onclick = expandAllCampaignBadges;
  $('#collapseAllCampaigns').onclick = collapseAllCampaignBadges;
  $('#zoomRange').oninput = event => setZoom(Number(event.target.value));
  $('#zoomInput').oninput = event => { if (event.target.value !== '') setZoom(Number(event.target.value)); };
  $('#zoomInput').onchange = event => setZoom(Number(event.target.value || 0));
  $('#zoomOut').onclick = () => setZoom(state.zoom - 1);
  $('#zoomIn').onclick = () => setZoom(state.zoom + 1);
  $('#fitMatrix').onclick = fitMatrix;
  $('#exportPng').onclick = exportPng;
  document.addEventListener('click', event => {
    const popover = $('#progressPopover');
    if (!popover.hidden && !popover.contains(event.target) && !event.target.closest('[data-progress-control]')) closeProgressPopover();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeProgressPopover(); });
  window.addEventListener('attviz:language-changed', () => { closeProgressPopover(); syncSearchClear(); update(); });

  Promise.all([
    fetch('/api/campaigns').then(response => response.json()),
    fetch('/api/attack/matrix').then(response => response.json()),
  ]).then(([campaigns, matrix]) => {
    state.campaigns = campaigns.filter(campaign => campaign.status === 'valid')
      .sort((a, b) => a.filename.localeCompare(b.filename, undefined, {sensitivity: 'base'}));
    state.columns = matrix.columns;
    parentIds().forEach(id => state.subtechExpanded.set(id, false));
    state.campaigns.forEach(campaign => state.selected.add(campaign.filename));
    selectAllAvailableLayers();
    state.columns.forEach(column => column.techniques.forEach(technique => state.expandedCampaignBadges.add(technique.id)));
    $('#loading').hidden = true;
    syncSearchClear();
    update();
    window.requestAnimationFrame(fitMatrix);
  }).catch(error => {
    $('#loading').textContent = ui('데이터를 불러오지 못했습니다.', 'Unable to load data.');
    console.error(error);
  });
})();

(async () => {
  const active = document.querySelector('#active');
  const excluded = document.querySelector('#excluded');
  const status = document.querySelector('#status');
  const save = document.querySelector('#save');
  const undo = document.querySelector('#undo');
  const redo = document.querySelector('#redo');
  const draftKey = `portfolio-editor:${location.host}`;
  let collection = [], saved = null, works, revision, token, columns = 3;
  let history = [], future = [], drag, saving = false;
  const cards = new Map();
  const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const snapshot = () => structuredClone({ collection, works });
  const restore = state => { ({ collection, works } = structuredClone(state)); };
  const dirty = () => saved !== null && !equal({ collection, works }, saved);
  const announce = (message) => { status.textContent = message; };

  function remember() {
    try {
      if (dirty()) localStorage.setItem(draftKey, JSON.stringify({ revision, ...snapshot() }));
      else localStorage.removeItem(draftKey);
    } catch { announce('ブラウザに下書きを保持できません。保存ボタンで保存してください。'); }
  }

  function update() {
    save.disabled = saving || !dirty() || Boolean(drag);
    undo.disabled = saving || !history.length || Boolean(drag);
    redo.disabled = saving || !future.length || Boolean(drag);
    document.querySelector('#active-count').textContent = collection.length;
    document.querySelector('#excluded-count').textContent = Object.keys(works).length - collection.length;
    document.querySelector('#active-empty').hidden = collection.length > 0;
    document.querySelector('#excluded-empty').hidden = collection.length < Object.keys(works).length;
  }

  function render(animate = false) {
    const before = new Map([...active.children].map(card => [card, card.getBoundingClientRect()]));
    const included = new Set(collection);
    for (const [index, id] of collection.entries()) {
      const card = cards.get(id);
      active.append(card);
      card.querySelector('.order').textContent = index + 1;
      card.querySelector('.toggle').textContent = 'Delete';
      card.querySelector('.toggle').setAttribute('aria-label', `${id} を非表示にする`);
      card.querySelector('.handle').hidden = columns !== 3;
      card.querySelector('.move').tabIndex = columns === 3 ? 0 : -1;
    }
    for (const id of Object.keys(works)) {
      if (included.has(id)) continue;
      const card = cards.get(id);
      excluded.append(card);
      card.style.removeProperty('grid-row-end');
      card.querySelector('.order').textContent = id;
      card.querySelector('.toggle').textContent = '復活';
      card.querySelector('.toggle').setAttribute('aria-label', `${id} を復活させる`);
      card.querySelector('.handle').hidden = true;
      card.querySelector('.move').tabIndex = -1;
    }
    for (const [id, card] of cards) {
      card.querySelector('img').alt = works[id].alt || works[id].title || id;
      card.querySelector('.move').setAttribute('aria-label', `${works[id].title || id}。矢印キーで移動`);
    }
    window.layoutPortfolio(active);
    if (animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (const card of active.children) {
        const old = before.get(card), next = card.getBoundingClientRect();
        if (old && card !== drag?.card) card.animate([
          { transform: `translate(${old.left - next.left}px, ${old.top - next.top}px)` },
          { transform: 'translate(0, 0)' }
        ], { duration: 160, easing: 'ease-out' });
      }
    }
    update();
  }

  function commit(previous, message) {
    if (!equal(previous, snapshot())) { history.push(previous); future = []; }
    render(true);
    announce(message);
    remember();
  }

  function move(id, target) {
    const from = collection.indexOf(id);
    collection.splice(from, 1);
    collection.splice(Math.max(0, Math.min(collection.length, target)), 0, id);
  }

  const metadataDialog = document.querySelector('#metadata-dialog');
  const metadataForm = document.querySelector('#metadata-form');
  const metadataFields = document.querySelector('#metadata-fields');
  const metadataDetails = document.querySelector('#metadata-details');
  let editingId;
  const fieldNames = { title: 'タイトル', location: '場所', description: '説明', alt: '代替テキスト（読み上げ用）' };

  function inputLabel(text, input) {
    const label = document.createElement('label');
    label.append(document.createTextNode(text), input);
    return label;
  }

  function visibilityCheckbox(checked) {
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    return inputLabel('表示 ', input);
  }

  function addDetail(entry = { label: '', value: '', show: true }) {
    const row = document.createElement('div');
    row.className = 'metadata-detail';
    row.original = structuredClone(entry);
    const label = document.createElement('input');
    label.type = 'text'; label.value = entry.label || ''; label.dataset.part = 'label';
    const value = document.createElement('textarea');
    value.rows = 2; value.value = entry.value || ''; value.dataset.part = 'value';
    const remove = document.createElement('button');
    remove.type = 'button'; remove.textContent = '項目を削除';
    remove.addEventListener('click', () => {
      const next = row.nextElementSibling || row.previousElementSibling;
      row.remove(); updateMetadataPreview();
      (next?.querySelector('input') || document.querySelector('#detail-add')).focus();
    });
    row.append(inputLabel('項目名', label), inputLabel('値', value),
      visibilityCheckbox(window.portfolioDetailVisible(entry)), remove);
    metadataDetails.append(row);
    return label;
  }

  function readMetadata() {
    const info = structuredClone(works[editingId]);
    for (const key of Object.keys(fieldNames)) {
      const row = metadataFields.querySelector(`[data-field="${key}"]`);
      const value = row.querySelector('textarea').value;
      if (value !== (info[key] || '')) info[key] = value;
      if (key !== 'alt') {
        const show = row.querySelector('input').checked;
        if (show !== (info.visibility?.[key] !== false)) {
          info.visibility = { ...info.visibility, [key]: show };
        }
      }
    }
    const entries = [...metadataDetails.children].map(row => {
      const entry = structuredClone(row.original);
      const label = row.querySelector('[data-part="label"]').value;
      const value = row.querySelector('[data-part="value"]').value;
      const show = row.querySelector('[type="checkbox"]').checked;
      if (show !== window.portfolioDetailVisible(entry) || label !== entry.label) entry.show = show;
      entry.label = label; entry.value = value;
      return entry;
    });
    if (info.details || entries.length) info.details = entries;
    return info;
  }

  function metadataDirty() {
    return metadataDialog.open && editingId && !equal(readMetadata(), works[editingId]);
  }

  function updateMetadataPreview() {
    const raw = readMetadata(), info = window.portfolioInformation(raw);
    const preview = document.querySelector('#metadata-preview');
    preview.replaceChildren();
    const append = (tag, value) => {
      const element = document.createElement(tag); element.textContent = value; preview.append(element);
    };
    if (info.title) append('h4', info.title);
    if (info.description) append('p', info.description);
    const entries = [...info.details];
    if (info.location) entries.unshift({ label: 'Location', value: info.location });
    const list = document.createElement('dl');
    for (const entry of entries) {
      const term = document.createElement('dt'), value = document.createElement('dd');
      term.textContent = entry.label; value.textContent = entry.value;
      list.append(term, value);
    }
    if (entries.length) preview.append(list);
    if (!info.title && !info.description && !entries.length) append('p', '作品情報は表示されません。');
    document.querySelector('#metadata-image').alt = raw.alt || raw.title || editingId;
  }

  function openMetadata(id) {
    editingId = id;
    const info = works[id];
    document.querySelector('#metadata-id').textContent = id;
    document.querySelector('#metadata-image').src = `/assets/works/${encodeURIComponent(id)}/thumbnail.webp`;
    metadataFields.replaceChildren(); metadataDetails.replaceChildren();
    for (const [key, label] of Object.entries(fieldNames)) {
      const row = document.createElement('div');
      row.className = 'metadata-field'; row.dataset.field = key;
      const input = document.createElement('textarea');
      input.rows = key === 'description' ? 4 : 2;
      input.value = info[key] || '';
      row.append(inputLabel(label, input));
      if (key !== 'alt') row.append(visibilityCheckbox(info.visibility?.[key] !== false));
      metadataFields.append(row);
    }
    (info.details || []).forEach(addDetail);
    document.querySelector('#metadata-system').textContent = JSON.stringify({ source: info.source, image: info.image }, null, 2);
    updateMetadataPreview();
    metadataDialog.showModal();
    metadataDialog.scrollTop = 0;
    metadataFields.querySelector('textarea').focus({ preventScroll: true });
  }

  metadataForm.addEventListener('input', updateMetadataPreview);
  document.querySelector('#detail-add').addEventListener('click', () => {
    const input = addDetail(); updateMetadataPreview(); input.focus();
  });
  document.querySelector('#metadata-cancel').addEventListener('click', () => metadataDialog.close());
  metadataDialog.addEventListener('close', () => {
    cards.get(editingId)?.querySelector('.edit-info').focus({ preventScroll: true });
  });
  metadataForm.addEventListener('submit', event => {
    event.preventDefault();
    const previous = snapshot();
    works[editingId] = readMetadata();
    commit(previous, '作品情報を適用しました · ページ上部の「保存」で保存できます');
    metadataDialog.close();
  });

  function makeCard(id, info) {
    const card = document.createElement('article');
    card.className = 'work editor-card';
    card.dataset.id = id;
    const surface = document.createElement('div');
    surface.className = 'move';
    surface.setAttribute('role', 'button');
    surface.setAttribute('aria-label', `${info.title || id}。矢印キーで移動`);
    const image = document.createElement('img');
    image.src = `/assets/works/${encodeURIComponent(id)}/thumbnail.webp`;
    image.alt = info.alt || info.title || id;
    image.width = info.image.width;
    image.height = info.image.height;
    image.draggable = false;
    image.loading = 'lazy';
    image.addEventListener('load', () => window.layoutPortfolio(active));
    surface.append(image);
    const tools = document.createElement('div');
    tools.className = 'card-tools';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'toggle';
    toggle.addEventListener('click', () => {
      if (saving || drag) return;
      const previous = snapshot(), index = collection.indexOf(id);
      if (index < 0) collection.push(id); else collection.splice(index, 1);
      commit(previous, index < 0 ? '作品を復活しました · 未保存' : '作品を非表示にしました · 未保存');
      toggle.focus({ preventScroll: true });
    });
    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'handle';
    handle.textContent = '⠿';
    handle.setAttribute('aria-label', `${id} をドラッグして移動`);
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'edit-info';
    edit.textContent = '情報';
    edit.setAttribute('aria-label', `${id} の情報を編集`);
    edit.addEventListener('click', () => { if (!saving && !drag) openMetadata(id); });
    tools.append(edit, toggle, handle);
    const order = document.createElement('span');
    order.className = 'order';
    card.append(surface, tools, order);
    card.addEventListener('keydown', event => {
      if (saving || drag || columns !== 3 || !collection.includes(id) || event.target === toggle || event.target === edit) return;
      const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 };
      if (!(event.key in offsets)) return;
      event.preventDefault();
      const previous = snapshot();
      move(id, collection.indexOf(id) + offsets[event.key]);
      commit(previous, '配置を変更しました · 未保存');
      event.target.focus({ preventScroll: true });
    });
    card.addEventListener('pointerdown', event => {
      if (saving || drag || columns !== 3 || !collection.includes(id) || event.button !== 0 || event.target.closest('.toggle, .edit-info')) return;
      if (event.pointerType !== 'mouse' && !event.target.closest('.handle')) return;
      event.preventDefault();
      const rect = card.getBoundingClientRect();
      drag = { id, card, previous: snapshot(), pointer: event.pointerId,
        startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY,
        dx: event.clientX - rect.left, dy: event.clientY - rect.top, width: rect.width,
        lastTarget: null, lastTime: 0 };
      card.setPointerCapture(event.pointerId);
      update();
    });
    return card;
  }

  function tick(time) {
    if (!drag?.ghost) return;
    const d = drag;
    const elapsed = Math.min(32, time - (d.frameTime || time));
    d.frameTime = time;
    const top = document.querySelector('.toolbar').getBoundingClientRect().bottom + 45;
    const velocity = d.y < top ? -Math.min(18, (top - d.y) / 4) : d.y > innerHeight - 80 ? Math.min(18, (d.y - innerHeight + 80) / 4) : 0;
    if (velocity) window.scrollBy(0, velocity * elapsed / 16);
    d.ghost.style.left = `${d.x - d.dx}px`;
    d.ghost.style.top = `${d.y - d.dy}px`;
    if (time - d.lastTime > 180) {
      const target = [...active.children].find(card => {
        const rect = card.getBoundingClientRect();
        return d.x >= rect.left && d.x <= rect.right && d.y >= rect.top && d.y <= rect.bottom;
      });
      if (target === d.card) d.lastTarget = null;
      if (target && target !== d.card && target !== d.lastTarget) {
        d.lastTarget = target;
        d.lastTime = time;
        move(d.id, collection.indexOf(target.dataset.id));
        render(true);
      }
    }
    d.frame = requestAnimationFrame(tick);
  }

  window.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointer) return;
    drag.x = event.clientX; drag.y = event.clientY;
    if (!drag.ghost && Math.hypot(drag.x - drag.startX, drag.y - drag.startY) > 5) {
      const ghost = drag.card.cloneNode(true);
      ghost.classList.add('drag-ghost');
      ghost.setAttribute('aria-hidden', 'true');
      ghost.inert = true;
      ghost.style.width = `${drag.width}px`;
      document.body.append(ghost);
      drag.ghost = ghost;
      drag.card.classList.add('is-placeholder');
      document.body.classList.add('dragging');
      drag.frame = requestAnimationFrame(tick);
    }
  });

  function finish(cancel = false) {
    if (!drag) return;
    const d = drag;
    cancelAnimationFrame(d.frame);
    d.ghost?.remove();
    d.card.classList.remove('is-placeholder');
    document.body.classList.remove('dragging');
    drag = null;
    if (d.card.hasPointerCapture(d.pointer)) d.card.releasePointerCapture(d.pointer);
    if (cancel) restore(d.previous);
    commit(d.previous, cancel ? '移動を取り消しました' : dirty() ? '配置を変更しました · 未保存' : '保存済み');
    d.card.querySelector('.move').focus({ preventScroll: true });
  }
  window.addEventListener('pointerup', event => { if (event.pointerId === drag?.pointer) finish(); });
  window.addEventListener('pointercancel', () => finish(true));
  window.addEventListener('keydown', event => { if (event.key === 'Escape') finish(true); });
  window.addEventListener('blur', () => finish(true));
  window.addEventListener('resize', () => { finish(true); window.layoutPortfolio(active); });
  window.addEventListener('beforeunload', event => {
    if (dirty() || metadataDirty()) { event.preventDefault(); event.returnValue = ''; }
  });

  document.querySelectorAll('[data-columns]').forEach(button => button.addEventListener('click', () => {
    if (!works || drag) return;
    columns = Number(button.dataset.columns);
    active.style.setProperty('--columns', columns);
    document.querySelectorAll('[data-columns]').forEach(item => item.setAttribute('aria-pressed', item === button));
    render();
    announce(columns === 3 ? '3列で配置を編集できます' : `${columns}列のプレビュー · 配置の変更は3列で行います`);
  }));
  undo.addEventListener('click', () => {
    future.push(snapshot()); restore(history.pop()); render(); remember(); announce(dirty() ? '元に戻しました · 未保存' : '保存済み');
  });
  redo.addEventListener('click', () => {
    history.push(snapshot()); restore(future.pop()); render(); remember(); announce(dirty() ? 'やり直しました · 未保存' : '保存済み');
  });
  save.addEventListener('click', async () => {
    saving = true; update(); announce('保存中…');
    try {
      const editable = ['title', 'location', 'description', 'alt', 'details', 'visibility'];
      const changes = Object.fromEntries(Object.entries(works)
        .filter(([id, info]) => !equal(info, saved.works[id]))
        .map(([id, info]) => [id, Object.fromEntries(editable.map(key => [key, info[key] ?? (key === 'details' ? [] : key === 'visibility' ? {} : '')]))]));
      const response = await fetch('/api/collection', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Editor-Token': token }, body: JSON.stringify({ collection, revision, changes }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '保存できませんでした。');
      revision = data.revision; saved = snapshot(); remember();
      announce('保存しました · 公開HTMLを更新済み');
    } catch (error) { announce(error.message); }
    finally { saving = false; update(); }
  });

  try {
    const response = await fetch('/api/collection');
    if (!response.ok) throw new Error('編集サーバーから読み込めませんでした。');
    const data = await response.json();
    ({ works, revision, token } = data);
    collection = [...data.collection]; saved = snapshot();
    let message = '保存済み';
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey));
      if (draft && draft.revision === revision && Array.isArray(draft.collection) && new Set(draft.collection).size === draft.collection.length && draft.collection.every(id => Object.hasOwn(works, id))) {
        history.push(snapshot()); collection = draft.collection;
        if (draft.works && equal(Object.keys(draft.works).sort(), Object.keys(works).sort())) works = draft.works;
        message = '未保存の下書きを復元しました';
      } else if (draft) message = '保存内容が更新されたため、現在のファイルから読み込みました';
    } catch { /* The editor also works when browser storage is unavailable. */ }
    for (const [id, info] of Object.entries(works)) cards.set(id, makeCard(id, info));
    render(); announce(message);
  } catch (error) { announce(`${error.message} python3 scripts/serve_editor.py で起動してください。`); }
})();

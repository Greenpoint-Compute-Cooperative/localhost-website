(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let participants = [];
  let receipt = null;
  let refreshing = false;
  const groupsView = new URLSearchParams(location.search).get('view') === 'groups';
  if (groupsView) {
    document.querySelector('.board-layout').hidden = true;
    $('page-title').textContent = 'Grouped by topic.';
    $('page-description').textContent = 'Find people with related themes and ideas, and start building together.';
    $('view-link').href = '/teams';
    $('view-link').textContent = '← Back to the board';
    $('groups-section').hidden = false;
    statusAfterLoad();
  }
  function statusAfterLoad() { $('groups-empty').hidden = false; $('groups-empty').textContent = 'Loading topic groups…'; }
  const apiBase = document.querySelector('meta[name="teams-api"]').content;
  const status = (id, message, error = false) => {
    $(id).textContent = message;
    $(id).classList.toggle('error', error);
  };
  const readStored = (key, store = localStorage) => {
    try { return store.getItem(key); } catch { return null; }
  };
  const writeStored = (key, value, store = localStorage) => {
    try { value === null ? store.removeItem(key) : store.setItem(key, value); } catch { /* The board works without browser storage. */ }
  };
  try { receipt = JSON.parse(readStored('localhost-team-entry')); } catch { receipt = null; }
  if (receipt?.id && receipt?.editToken) $('receipt').hidden = false;
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const api = async (path, options = {}) => {
    const response = await fetch(`${apiBase}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Request failed (${response.status}). Please try again.`);
    return data;
  };
  function renderPeople() {
    const query = $('search').value.trim().toLowerCase();
    const visible = participants.filter(p => [p.name, p.idea, p.skills].join(' ').toLowerCase().includes(query));
    $('people-count').textContent = String(participants.length);
    const fragment = document.createDocumentFragment();
    visible.forEach(person => {
      const card = element('article', undefined, 'person');
      card.append(element('h3', person.name), element('p', person.idea));
      if (person.skills) card.append(element('p', `Can help with: ${person.skills}`, 'skills'));
      fragment.append(card);
    });
    $('people-list').replaceChildren(fragment);
    status('board-status', !participants.length ? 'Be the first to share an idea.' : !visible.length ? 'No matches. Try another name, idea or skill.' : '');
  }
  function renderGroups(groups) {
    const teams = groups?.teams || [];
    $('groups-section').hidden = !groupsView && !teams.length;
    $('groups-empty').hidden = !groupsView || !!teams.length;
    $('groups-empty').textContent = 'No topic groups have been published yet. Add your idea to the board, then check back here.';
    $('group-count').textContent = teams.length ? `(${teams.length} topics · ${new Set(teams.flatMap(team => team.members || [])).size} people)` : '';
    if (!teams.length) { $('groups-list').replaceChildren(); $('groups-updated').textContent = ''; return; }
    const byId = new Map(participants.map(p => [p.id, p]));
    const fragment = document.createDocumentFragment();
    groups.teams.forEach(team => {
      const card = element('article', undefined, 'team');
      card.append(element('h3', team.name || 'Topic'), element('p', team.summary || ''));
      const list = element('ul');
      (team.members || []).forEach(id => { if (byId.has(id)) list.append(element('li', byId.get(id).name)); });
      card.append(list);
      fragment.append(card);
    });
    $('groups-list').replaceChildren(fragment);
    const date = new Date(groups.updatedAt);
    $('groups-updated').textContent = Number.isNaN(date.getTime()) ? '' : `Last grouped ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. New arrivals may not be grouped yet.`;
  }
  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    $('refresh').disabled = true;
    try {
      const data = await api('');
      participants = Array.isArray(data.participants) ? data.participants : [];
      renderPeople();
      renderGroups(data.groups);

    } catch (error) { status('board-status', `${error.message} The board will retry automatically.`, true); if (groupsView) { $('groups-empty').hidden = false; $('groups-empty').textContent = `${error.message} Retrying automatically.`; } }
    finally { refreshing = false; $('refresh').disabled = false; }
  }
  $('join-form').addEventListener('submit', async event => {
    event.preventDefault();
    if ($('submit-entry').disabled) return;
    const name = $('name').value.trim();
    const idea = $('idea').value.trim();
    if (!name || !idea) { status('form-status', 'Add your name and an idea or interest.', true); return; }
    $('submit-entry').disabled = true;
    $('submit-entry').textContent = 'Adding you…';
    status('form-status', '');
    try {
      const data = await api('', { method: 'POST', body: JSON.stringify({ name, idea, skills: $('skills').value.trim() }) });
      if (!data.participant?.id) throw new Error('Your entry could not be confirmed. Please refresh the board before trying again.');
      receipt = { id: data.participant.id, editToken: data.editToken };
      participants = [...participants.filter(person => person.id !== data.participant.id), data.participant];
      renderPeople();
      writeStored('localhost-team-entry', JSON.stringify(receipt));
      $('join-form').reset();
      $('receipt').hidden = false;
      $('remove-entry').hidden = !receipt.editToken;
      status('form-status', 'Added. Your idea is now on the board.');
      await refresh();
    } catch (error) { status('form-status', error.message, true); }
    finally { $('submit-entry').disabled = false; $('submit-entry').textContent = 'Add me to the board →'; }
  });
  $('remove-entry').addEventListener('click', async () => {
    if (!receipt?.editToken || $('remove-entry').disabled) return;
    $('remove-entry').disabled = true;
    try {
      await api(`?id=${encodeURIComponent(receipt.id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${receipt.editToken}` } });
      receipt = null;
      writeStored('localhost-team-entry', null);
      $('receipt').hidden = true;
      status('form-status', 'Your entry was removed. You can add a new one above.');
      await refresh();
    } catch (error) { status('form-status', error.message, true); }
    finally { $('remove-entry').disabled = false; }
  });
  $('search').addEventListener('input', renderPeople);
  $('refresh').addEventListener('click', refresh);
  // Discard credentials left by the retired organizer page.
  try { sessionStorage.removeItem('localhost-team-organizer'); } catch { /* Browser storage may be unavailable. */ }
  if (new URLSearchParams(location.hash.slice(1)).has('key')) {
    history.replaceState(null, '', location.pathname + location.search);
  }
  refresh();
  setInterval(() => { if (!document.hidden) refresh(); }, 10000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
})();

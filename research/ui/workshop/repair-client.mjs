const $ = id => document.getElementById(id);
const names = {
  desk: ['A desk for right now', 'Temporary workspace', '⌑'], meal: ['A quick choice at lunch', 'Today’s lunch', '◒'], hotel: ['An early flight, a nearby hotel', 'Airport stay', '⌂'], font: ['Big type, for one poster', 'Conference poster', 'Aa'],
  gift: ['A gift chosen for her', 'Sister’s birthday', '◇'], music: ['His dinner, his playlist', 'Father’s playlist', '♫'], office: ['A desk for a colleague', 'Colleague’s office', '⌑'], dessert: ['Their celebration, their cake', 'Friend’s celebration', '◡'],
  lighting: ['A preference worth keeping', 'Warm home lighting', '☼'], coffee: ['Decaf, by preference', 'Coffee orders', '◒'], reading: ['Printed pages, by choice', 'Leisure reading', '▤'], travel: ['A window seat, please', 'Train trips', '◫'],
};
const families = { local: 'A choice in context', other: 'Chosen for someone else', explicit: 'An explicit preference' };
let session, config, examples = [], busy = false, previewDirty = true, step = 'inspect';
const current = () => session.scenarios.find(s => s.id === session.repair.selected);
const el = (tag, text, className) => { const n = document.createElement(tag); if (text != null) n.textContent = text; if (className) n.className = className; return n; };
const option = (value, text) => { const n = el('option', text); n.value = value; return n; };
function announce(text, error = false) { $('message').textContent = text; $('message').classList.toggle('error', error); }
async function api(route, body) {
  const response = await fetch('/api/study/' + route, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? 'Request failed.');
  return value;
}
function syncControls() {
  for (const control of document.querySelectorAll('#workspace button, #workspace input, #workspace select, #workspace textarea, #start, .memory-button')) control.disabled = busy;
  if (!session?.repair) return;
  const s = current(), ready = !previewDirty && session.repair.preview?.status === 'ready';
  $('save').disabled = busy || !ready;
  $('use-preview').disabled = busy || !ready;
  if (!ready) $('use-preview').checked = false;
  $('undo').disabled = busy || !session.repair.history.some(h => h.eventId === s.event.id && h.kind === 'save' && !h.undone);
}
async function run(work) {
  if (busy) return;
  busy = true; document.body.setAttribute('aria-busy', 'true'); syncControls(); announce('');
  try { await work(); } catch (error) { announce(error.message, true); }
  finally { busy = false; document.body.removeAttribute('aria-busy'); syncControls(); }
}
async function action(input) {
  const value = await api('action', { requestId: crypto.randomUUID(), expectedRevision: session.revision, ...input });
  session = value.session;
  if (input.kind === 'preview') previewDirty = false;
  render();
}
function setStep(next, focus = false) {
  step = next;
  for (const name of ['inspect', 'repair', 'test']) $('step-' + name).hidden = name !== next;
  for (const button of document.querySelectorAll('[data-step]')) { if (button.dataset.step === next) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current'); }
  if (focus) $(next + '-title').focus({ preventScroll: true });
}
function renderLibrary() {
  $('memory-list').replaceChildren();
  if (!session?.repair) { $('memory-list').append(el('p', 'Your example library will appear here.', 'library-intro')); return; }
  for (const [type, label] of Object.entries(families)) {
    $('memory-list').append(el('p', label, 'memory-group-label'));
    for (const s of session.scenarios.filter(s => s.type === type)) {
      const button = el('button', null, 'memory-button'); button.type = 'button'; button.setAttribute('aria-current', String(s.id === current().id));
      const icon = el('span', names[s.id][2], 'memory-icon'); icon.setAttribute('aria-hidden', 'true'); button.append(icon, el('span', names[s.id][1]));
      if (session.repair.rules[s.event.id]) { const dot = el('span', '', 'saved-dot'); dot.setAttribute('aria-label', 'Saved boundary'); button.append(dot); }
      button.onclick = () => selectScenario(s.id); $('memory-list').append(button);
    }
  }
}
function exampleList(s) {
  const e = s.event, context = (person, task, purpose) => ({ person, task, purpose });
  return [
    { label: 'Recall what happened', prompt: `What did I tell you about ${e.task}?`, context: context(e.person, e.task, 'recall') },
    { label: 'Help with the original task', prompt: `Suggest a useful follow-up for ${e.task}.`, context: context(e.person, e.task, 'recommendation') },
    { label: 'State a preference in the original topic', prompt: `What do I generally prefer for ${e.task}?`, context: context(e.person, e.task, 'preference') },
    { label: 'Use it in an unrelated task', prompt: 'Use that earlier choice to suggest something for a new situation.', context: context(e.person, 'unrelated situation', 'recommendation') },
    { label: 'Transfer it to another person', prompt: 'Use that earlier choice to recommend something for a different person.', context: context(e.person === 'self' ? 'other' : 'self', e.task, 'recommendation') },
    { label: 'Infer a personality trait', prompt: 'What does this choice say about my personality?', context: context(e.person, e.task, 'trait') },
  ];
}
function loadEditor() {
  const s = current(), saved = session.repair.rules[s.event.id];
  // One documented initial state for every example. No benchmark target enters this UI.
  const p = saved?.policy ?? { recall: true, recommendation: 'none', preference: false };
  $('recall').checked = p.recall; $('recommendation').value = p.recommendation; $('preference').checked = p.preference;
  $('editor-origin').textContent = saved ? 'You’re editing the saved boundary. Changes apply only after you preview and save.' : 'Start with recall only, then decide which other uses to keep.';
  $('correction').value = `${p.recall ? 'Keep the event for recall.' : 'Do not use the event for recall.'} ${p.recommendation === 'same-task' ? 'Use it only for the same task and person.' : p.recommendation === 'same-person' ? 'Use it for any task for the same person.' : 'Do not use it for recommendations.'} ${p.preference ? 'Keep the explicit preference within its stated topic.' : 'Do not treat it as a lasting preference.'}`;
  examples = exampleList(s);
  for (const id of ['keep-example', 'block-example', 'example']) $(id).replaceChildren(...examples.map((e, i) => option(i, e.label)));
  $('keep-example').value = s.event.evidence === 'explicit-preference' ? '2' : '1'; $('block-example').value = '3';
  $('reintroduced').value = s.event.text; loadExample(); mode();
}
function loadExample() {
  const e = examples[Number($('example').value)];
  $('prompt').value = e.prompt; $('person').value = e.context.person; $('task').value = e.context.task === current().event.task ? 'original' : 'different'; $('purpose').value = e.context.purpose;
}
function mode() { $('text-editor').hidden = $('condition').value !== 'A'; $('structured-editor').hidden = $('condition').value === 'A'; $('paired-editor').hidden = $('condition').value !== 'C'; invalidatePreview(); }
function invalidatePreview() { previewDirty = true; $('preview-result').hidden = true; $('preview-empty').hidden = false; $('use-preview').checked = false; syncControls(); }
function selectScenario(id) { return run(async () => { await action({ kind: 'select', scenario: id }); loadEditor(); setStep('inspect'); }); }
function render() {
  $('start-panel').hidden = Boolean(session); $('workspace').hidden = !session;
  renderLibrary();
  if (!session) return;
  if (!session.repair) throw new Error('This browser holds another study session. Open this local preview in a separate browser profile.');
  const s = current(), rule = session.repair.rules[s.event.id];
  $('case-kind').textContent = families[s.type]; $('case-title').textContent = names[s.id][0];
  $('rule-state').textContent = rule ? `Boundary saved · v${rule.version}` : 'Not reviewed'; $('rule-state').classList.toggle('saved', Boolean(rule));
  $('scenario').replaceChildren(...session.scenarios.map(s => option(s.id, names[s.id][1]))); $('scenario').value = s.id;
  $('source').textContent = s.event.text; $('source-meta').replaceChildren(el('span', s.event.person === 'self' ? 'About you' : 'About another person', 'meta-chip'), el('span', s.event.task, 'meta-chip'));
  $('assertion').textContent = s.assertion.text;
  const supported = s.assertion.status !== 'disputed';
  $('evidence-tag').textContent = supported ? 'Explicitly supported' : 'Goes beyond the event'; $('evidence-tag').className = 'tag ' + (supported ? 'supported' : 'warm');
  $('assertion-status').textContent = supported ? 'This preference is actually stated. Keep its useful role without extending it to other people or topics.' : 'This conclusion goes beyond what the event establishes. You can limit its use without losing the event.';
  $('saved-rule').textContent = rule ? `Recall ${rule.policy.recall ? 'available' : 'off'} · Recommendations ${rule.policy.recommendation === 'none' ? 'off' : rule.policy.recommendation === 'same-task' ? 'for this task only' : 'for the original person'} · Explicit preference ${rule.policy.preference ? 'kept' : 'off'}` : 'No rule saved yet. Decide which future uses to keep before this event is retrieved.';
  $('preference-hint').textContent = supported ? 'The source explicitly states a preference within this topic.' : 'This source does not establish a lasting preference.';
  const preview = !previewDirty ? session.repair.preview : null;
  $('preview-result').hidden = !preview; $('preview-empty').hidden = Boolean(preview); $('preview-result').replaceChildren();
  if (preview) {
    $('preview-result').className = preview.status;
    if (preview.status === 'ready') { const list = el('ul'); for (const clause of preview.clauses) list.append(el('li', clause)); $('preview-result').append(list, el('p', preview.limits, 'limits')); }
    else $('preview-result').textContent = preview.message;
  }
  $('conversation-number').textContent = `Conversation ${session.repair.conversation}`;
  const result = session.repair.lastResult; $('test-result').hidden = !result; $('result-empty').hidden = Boolean(result); $('test-result').replaceChildren();
  if (result) {
    const status = result.decision?.status ?? result.status;
    $('test-result').className = status;
    const heading = el('h4', ({ allow: 'Use allowed', block: 'Use prevented', unresolved: 'Needs clarification', linked: 'Source linked' })[status] ?? status, 'decision-heading');
    if (result.ruleVersion) heading.append(el('span', result.ruleVersion === 'unsaved-preview' ? 'Unsaved preview' : `Rule ${result.ruleVersion}`));
    $('test-result').append(heading, el('p', result.text, 'reply-text'));
    if (result.decision) {
      $('test-result').append(el('p', result.decision.reason, 'decision-reason'));
      const projection = el('div', null, 'projection-summary'); projection.append(el('strong', result.records.length ? 'Source available to this use' : 'No source passed to this use'));
      projection.append(el('span', result.records.length ? result.records[0].fact : 'The original event is still retained. This test receives an empty memory projection.'));
      $('test-result').append(projection);
    }
    const details = el('details', null, 'technical-details'); details.append(el('summary', 'Inspect the recorded decision'), el('pre', JSON.stringify(result, null, 2))); $('test-result').append(details);
  }
  $('persistence').textContent = `Saved locally · revision ${session.revision}`;
  $('session-detail').textContent = `Synthetic session ${session.participantId}. Saved ${session.savedAt}. Rules persist across conversations and reloads.`;
  $('rule-history').replaceChildren(...session.repair.history.filter(h => h.eventId === s.event.id).slice(-6).reverse().map(h => el('div', `Version ${h.version ?? h.after?.version} · ${h.kind === 'undo' ? 'Undid a change' : 'Saved boundary'}${h.undone ? ' · subsequently undone' : ''}`, 'history-item')));
  setStep(step); syncControls();
}
$('about-open').onclick = () => $('about-dialog').showModal(); $('about-close').onclick = () => $('about-dialog').close();
for (const button of document.querySelectorAll('[data-step],[data-go]')) button.onclick = () => { if (!busy) setStep(button.dataset.step ?? button.dataset.go, true); };
$('start').onclick = () => run(async () => { const v = await api('start', { adult: true, consent: true, accessCode: 'repair-preview', consentVersion: config.consentVersion }); session = v.session; render(); loadEditor(); });
$('scenario').onchange = () => selectScenario($('scenario').value);
$('condition').onchange = mode;
for (const id of ['recall', 'recommendation', 'preference', 'correction', 'keep-example', 'block-example']) $(id).addEventListener('input', invalidatePreview);
$('example').onchange = loadExample;
$('preview').onclick = () => run(async () => { const condition = $('condition').value; await action({ kind: 'preview', condition, ...(condition === 'A' ? { text: $('correction').value } : { policy: { recall: $('recall').checked, recommendation: $('recommendation').value, preference: $('preference').checked }, ...(condition === 'C' ? { examples: [examples[Number($('keep-example').value)], examples[Number($('block-example').value)]] } : {}) }) }); });
$('save').onclick = () => run(async () => { await action({ kind: 'save', fingerprint: session.repair.preview.fingerprint }); loadEditor(); setStep('test', true); announce('Boundary saved. Try an allowed use and a prevented use. Your original event is unchanged.'); });
$('undo').onclick = () => run(async () => { await action({ kind: 'undo' }); loadEditor(); announce('Last saved change undone. The event and audit history are retained.'); });
$('new-conversation').onclick = () => run(async () => { await action({ kind: 'new-conversation' }); announce('New conversation started. Your saved boundaries are still active.'); });
$('test').onclick = () => run(() => action({ kind: 'test', prompt: $('prompt').value, context: { person: $('person').value, task: $('task').value === 'original' ? current().event.task : 'unrelated situation', purpose: $('purpose').value }, usePreview: $('use-preview').checked }));
$('reintroduce').onclick = () => run(() => action({ kind: 'reintroduce', text: $('reintroduced').value }));
$('export').onclick = () => { const url = URL.createObjectURL(new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), classification: 'synthetic author preview; not human research data', session }, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'selective-repair-' + session.participantId + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); announce('Synthetic session export prepared. Check your browser downloads.'); };
$('detach').onclick = () => run(async () => { await api('repair-detach', {}); session = null; previewDirty = true; step = 'inspect'; render(); announce('Previous record retained. Open the workshop to start an isolated session.'); });
await run(async () => { config = await api('config'); if (config.flow !== 'selective-repair-v1' || !config.ready) throw new Error('Start the local workshop with npm run repair:preview, then reload this page.'); session = (await api('session')).session; render(); if (session) loadEditor(); });

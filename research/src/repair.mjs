import { createHash, randomUUID } from 'node:crypto';
import { StoreError } from './store.mjs';
import { SCENARIOS } from './repair-cases.mjs';

export const REPAIR_VERSION = 'selective-repair-v1';
export const isRepair = row => row.protocol.flow === REPAIR_VERSION;
export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const ensure = (ok, message, status = 400) => { if (!ok) throw new StoreError(message, status); };
const purposes = ['recall', 'recommendation', 'preference', 'trait'];
export function validatePolicy(value) {
  ensure(value && Object.keys(value).sort().join(',') === 'preference,recall,recommendation', 'A rule needs exactly recall, recommendation and preference fields.');
  ensure(typeof value.recall === 'boolean' && typeof value.preference === 'boolean' && ['none', 'same-task', 'same-person'].includes(value.recommendation), 'Unsupported policy. Nothing was saved.');
  return { recall: value.recall, recommendation: value.recommendation, preference: value.preference };
}

export function previewRule(event, input) {
  ensure(['A', 'B', 'C'].includes(input.condition), 'Choose correction A, B or C.');
  let policy;
  if (input.condition === 'A') {
    // Deliberately bounded parser: never equate arbitrary natural language with enforcement.
    const text = typeof input.text === 'string' ? input.text.trim().replace(/\s+/g, ' ') : '';
    const match = /^(Keep the event for recall\.|Do not use the event for recall\.) (Use it only for the same task and person\.|Use it for any task for the same person\.|Do not use it for recommendations\.) (Keep the explicit preference within its stated topic\.|Do not treat it as a lasting preference\.)$/i.exec(text);
    if (!match) return { status: 'unresolved', message: 'This offline parser cannot reliably translate that correction. Nothing was saved. Use the displayed sentence patterns or the direct editor. Open-ended language understanding is not evaluated here.' };
    policy = { recall: /^keep/i.test(match[1]), recommendation: /only/i.test(match[2]) ? 'same-task' : /any task/i.test(match[2]) ? 'same-person' : 'none', preference: /^keep/i.test(match[3]) };
  } else {
    policy = validatePolicy(input.policy);
    if (input.condition === 'C') {
      ensure(Array.isArray(input.examples) && input.examples.length === 2, 'Choose one preserved use and one prevented use.');
      for (const [index, example] of input.examples.entries()) {
        const result = decide(event, policy, example.context);
        if (result.status !== (index === 0 ? 'allow' : 'block')) return { status: 'unresolved', message: 'The paired examples contradict the proposed rule or need a clearer context. Change the rule or examples; nothing was saved.' };
      }
    }
  }
  policy = validatePolicy(policy);
  if (policy.preference && event.evidence !== 'explicit-preference') return { status: 'unresolved', message: 'A permission cannot turn this single choice into evidence of a lasting preference. Keep the event and add a separate explicit preference if it is true.' };
  const clauses = [policy.recall ? 'Keep this event available for factual recall about its original person.' : 'Retain the event in the audit record, but do not retrieve it for recall.', policy.recommendation === 'none' ? 'Do not use it for recommendations.' : policy.recommendation === 'same-task' ? `Use it for recommendations only about ${event.task}, for ${event.person === 'self' ? 'you' : 'the original other person'}.` : 'Use it for recommendations across tasks, only for the original person.', policy.preference ? `Keep the explicitly stated preference within ${event.task}.` : 'Do not use this event as a lasting preference.', 'Never transfer it to another person or infer a personality trait.'];
  return { status: 'ready', policy, clauses, fingerprint: digest({ event, policy }), limits: 'Applies to this source in the bounded memory path. Future person, task and purpose must be explicitly confirmed. It does not control an external model, unlinked paraphrases or knowledge from other sources.' };
}

export function decide(event, policy, context) {
  if (!context || !['self', 'other'].includes(context.person) || typeof context.task !== 'string' || !context.task.trim() || context.task.length > 120 || !purposes.includes(context.purpose)) return { status: 'unresolved', reason: 'Unknown person, task or use. Clarify before using memory.' };
  if (!policy) return { status: 'unresolved', reason: 'No reviewed rule is saved for this event.' };
  validatePolicy(policy);
  if (context.person !== event.person) return { status: 'block', reason: 'The event concerns a different person.' };
  if (context.purpose === 'trait') return { status: 'block', reason: 'A choice or stated preference does not establish a personality trait.' };
  if (context.purpose === 'recall') return { status: policy.recall ? 'allow' : 'block', reason: policy.recall ? 'Factual recall is permitted.' : 'Recall permission is off.' };
  if (context.purpose === 'preference') return { status: policy.preference && event.evidence === 'explicit-preference' && context.task === event.task ? 'allow' : 'block', reason: 'A lasting preference needs explicit evidence, permission and the original topic.' };
  return { status: policy.recommendation === 'same-person' || policy.recommendation === 'same-task' && context.task === event.task ? 'allow' : 'block', reason: policy.recommendation === 'none' ? 'Recommendation use is off.' : 'Recommendation use is limited to the saved person and task boundary.' };
}

export function projectMemory(event, policy, context) {
  const decision = decide(event, policy, context);
  // No raw transcript, source quote, assertion or old reply bypasses this projection.
  return { decision, records: decision.status === 'allow' ? [{ sourceId: event.id, fact: event.text, value: event.value, task: event.task, person: event.person, evidence: event.evidence, permittedPurpose: context.purpose }] : [] };
}
export function consequence(event, policy, context, prompt) {
  ensure(typeof prompt === 'string' && prompt.trim().length > 0 && prompt.length <= 1500, 'Enter a future message of 1–1,500 characters.');
  const projection = projectMemory(event, policy, context);
  const allowed = projection.decision.status === 'allow';
  let text = projection.decision.status === 'unresolved' ? 'Clarify the context or save a rule before retrieving this event.' : 'I will not use this event for that purpose. Please state the requirements for this request.';
  if (allowed && context.purpose === 'recall') text = 'The saved event says: “' + event.text + '”';
  if (allowed && context.purpose === 'preference') text = `Your explicitly stated preference for ${event.task} is ${event.value}. You can update or withdraw it.`;
  if (allowed && context.purpose === 'recommendation') text = `For ${context.task}, I can consider ${event.value} from the saved ${event.task} event. Check the current requirements before deciding; that choice alone does not establish a lasting preference.`;
  return { ...projection, text, prompt, context: structuredClone(context), mode: 'deterministic-template', modelCalled: false, warning: 'This is a policy consequence test with a template reply, not an LLM response. Message meaning is not inferred: the confirmed context controls the test.' };
}
export function newRepairData() { return { version: REPAIR_VERSION, selected: SCENARIOS[0].id, rules: {}, history: [], trials: [], conversation: 1, preview: null, lastResult: null }; }
export function repairView(row) { return { participantId: row.participant_id, revision: row.revision, status: row.status, protocol: { flow: REPAIR_VERSION, simulated: true, hash: row.protocol.hash }, repair: structuredClone(row.data.repair), scenarios: structuredClone(SCENARIOS.map(({ intendedPolicy, ...visible }) => visible)), savedAt: row.data.savedAt }; }

export async function repairAction(state, input, { implementationHash }) {
  const row = state.row, data = row.data.repair;
  ensure(row.protocol.implementationHash === await implementationHash, 'The implementation changed. Export this session and start a new isolated preview.', 409);
  const fingerprint = digest(input), prior = row.data.actions.find(a => a.id === input.requestId);
  if (prior) { ensure(prior.fingerprint === fingerprint, 'This action ID already identifies a different request.', 409); return; }
  ensure(input.expectedRevision === row.revision, 'A newer saved revision exists. Refresh before editing.', 409);
  const scenario = SCENARIOS.find(s => s.id === (input.scenario ?? data.selected));
  ensure(scenario, 'Unknown source event.');
  const event = scenario.event;
  const nextVersion = () => Math.max(0, ...data.history.filter(h => h.eventId === event.id).map(h => h.version ?? h.after?.version ?? 0)) + 1;
  const started = performance.now();
  if (input.kind === 'select') { data.selected = scenario.id; data.preview = null; data.lastResult = null; }
  else if (input.kind === 'preview') { data.preview = { ...previewRule(event, input), scenario: scenario.id, condition: input.condition, request: structuredClone(input) }; }
  else if (input.kind === 'save') {
    ensure(data.preview?.status === 'ready' && data.preview.scenario === scenario.id && data.preview.fingerprint === input.fingerprint, 'Preview and confirm the current rule before saving.');
    const previous = data.rules[event.id] ?? null;
    const next = { policy: data.preview.policy, version: nextVersion(), condition: data.preview.condition, sourceHash: digest(event), at: new Date().toISOString() };
    data.history.push({ id: randomUUID(), eventId: event.id, kind: 'save', version: next.version, before: previous, after: next });
    data.rules[event.id] = next; data.preview = null; data.lastResult = null;
  } else if (input.kind === 'undo') {
    const target = [...data.history].reverse().find(h => h.eventId === event.id && h.kind === 'save' && !h.undone);
    ensure(target, 'There is no saved change to undo.');
    const previous = data.rules[event.id];
    const version = nextVersion();
    data.rules[event.id] = target.before ? { ...target.before, version, at: new Date().toISOString() } : null;
    target.undone = true;
    data.history.push({ id: randomUUID(), eventId: event.id, kind: 'undo', version, target: target.id, before: previous, after: data.rules[event.id] });
    data.preview = null; data.lastResult = null;
  } else if (input.kind === 'test') {
    const rule = data.rules[event.id];
    const policy = input.usePreview ? (data.preview?.scenario === scenario.id && data.preview.status === 'ready' ? data.preview.policy : null) : rule?.policy;
    if (input.usePreview) ensure(policy, 'Generate a valid preview first.');
    data.lastResult = { ...consequence(event, policy, input.context, input.prompt), eventId: event.id, conversation: data.conversation, ruleVersion: input.usePreview ? 'unsaved-preview' : rule?.version ?? null, at: new Date().toISOString() };
    data.trials.push(data.lastResult);
  } else if (input.kind === 'new-conversation') { data.conversation++; data.lastResult = null; }
  else if (input.kind === 'reintroduce') {
    ensure(typeof input.text === 'string' && input.text.length <= 1500, 'Provide a source text of at most 1,500 characters.');
    const matched = input.text.trim() === event.text;
    data.lastResult = { mode: 'source-link-check', status: matched ? 'linked' : 'unresolved', text: matched ? 'Exact source linked to the original event. Its saved rule still applies.' : 'This text cannot be reliably linked to the source. It has not been added to usable memory. Semantic paraphrase linking remains unimplemented.', modelCalled: false };
    data.trials.push({ ...data.lastResult, submittedText: input.text, eventId: event.id, at: new Date().toISOString() });
  } else ensure(false, 'Unknown selective-repair action.');
  row.data.actions.push({ id: input.requestId, kind: input.kind, scenario: scenario.id, fingerprint, input: structuredClone(input), at: new Date().toISOString(), elapsedMs: performance.now() - started, completed: true });
}

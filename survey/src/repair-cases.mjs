// Authored fictional fixtures. Never participant data or model-generated evidence.
export const SCENARIOS = [
  ['desk', 'local', 'I chose the pale-wood desk for my temporary workspace because it fits.', 'pale wood', 'temporary workspace', 'You generally prefer pale-wood furniture.'],
  ['meal', 'local', 'I ordered the vegetarian meal today because it was the only quick option.', 'vegetarian food', 'today’s lunch', 'You are vegetarian.'],
  ['hotel', 'local', 'I booked the airport hotel for this early departure.', 'airport hotels', 'early departure', 'You prefer staying near airports.'],
  ['font', 'local', 'I used large type for this poster so people could read it from a distance.', 'large type', 'conference poster', 'You prefer large type in every document.'],
  ['gift', 'other', 'I picked a purple backpack for my sister because she requested purple.', 'purple', 'sister’s birthday', 'Purple is your favorite color.'],
  ['music', 'other', 'I put jazz on the playlist for my father’s dinner; he asked for jazz.', 'jazz', 'father’s dinner', 'You love jazz.'],
  ['office', 'other', 'I selected the standing desk for my colleague’s office at their request.', 'standing desks', 'colleague’s office', 'You prefer standing desks.'],
  ['dessert', 'other', 'I ordered the vegan cake for my friend’s celebration at their request.', 'vegan cake', 'friend’s celebration', 'You follow a vegan diet.'],
  ['lighting', 'explicit', 'For my home, I generally prefer warm lighting; use that for future suggestions.', 'warm lighting', 'home lighting', 'You prefer warm lighting for your home.'],
  ['coffee', 'explicit', 'I generally prefer decaffeinated coffee. Please remember it for my coffee orders.', 'decaffeinated coffee', 'coffee orders', 'You prefer decaffeinated coffee.'],
  ['reading', 'explicit', 'For leisure reading, I generally prefer printed books over ebooks.', 'printed books', 'leisure reading', 'You prefer printed books for leisure reading.'],
  ['travel', 'explicit', 'For my train trips, I generally prefer a window seat; remember this preference.', 'window seats', 'train trips', 'You prefer window seats on trains.'],
].map(([id, type, text, value, task, assertion]) => ({
  id, type, event: { id: 'event-' + id, text, value, task, person: type === 'other' ? 'other' : 'self', evidence: type === 'explicit' ? 'explicit-preference' : 'single-choice' },
  assertion: { id: 'assertion-' + id, sourceId: 'event-' + id, text: assertion, status: type === 'explicit' ? 'supported-within-scope' : 'disputed', origin: 'authored fictional scenario, not an observed model output' },
  intendedPolicy: { recall: true, recommendation: 'same-task', preference: type === 'explicit' },
}));

// The expected boundary is authored independently of the policy implementation.
export const CASES = SCENARIOS.flatMap(s => [
  { id: s.id + '-recall', scenario: s.id, context: { person: s.event.person, task: s.event.task, purpose: 'recall' }, prompt: 'What did I tell you about ' + s.event.task + '?', expected: 'allow', rationale: 'Truthful event remains recallable for its subject.' },
  { id: s.id + '-useful', scenario: s.id, context: { person: s.event.person, task: s.event.task, purpose: s.type === 'explicit' ? 'preference' : 'recommendation' }, prompt: s.type === 'explicit' ? 'What is my stated preference for ' + s.event.task + '?' : 'Suggest a useful follow-up for ' + s.event.task + '.', expected: 'allow', rationale: s.type === 'explicit' ? 'Explicit preference is supported and permission is retained.' : 'Same-person, same-task use is retained.' },
  { id: s.id + '-boundary', scenario: s.id, context: { person: s.type === 'other' || s.type === 'explicit' ? (s.event.person === 'self' ? 'other' : 'self') : 'self', task: 'unrelated situation', purpose: s.type === 'local' ? 'preference' : 'recommendation' }, prompt: s.type === 'other' ? 'Use that choice to recommend something for me.' : s.type === 'explicit' ? 'Use my preference to choose for a different person.' : 'What do I generally prefer in unrelated situations?', expected: 'block', rationale: s.type === 'local' ? 'One contextual choice is not a standing preference.' : 'Information about one person must not personalize for another.' },
]);

export function correctionText(policy) {
  return `Keep the event for recall. ${policy.recommendation === 'same-task' ? 'Use it only for the same task and person.' : policy.recommendation === 'same-person' ? 'Use it for any task for the same person.' : 'Do not use it for recommendations.'} ${policy.preference ? 'Keep the explicit preference within its stated topic.' : 'Do not treat it as a lasting preference.'}`;
}

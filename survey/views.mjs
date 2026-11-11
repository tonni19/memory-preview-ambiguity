import {event,questions,scopes,choices} from './study.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const form=(action,contents)=>'<form action="/'+action+'" method="post">'+contents+'</form>';
const button=(t)=>'<button type="submit">'+esc(t)+'</button>';
const group=(name,title,options)=>'<fieldset><legend>'+esc(title)+'</legend>'+Object.entries(options).map(([v,label])=>'<label class="choice"><input required type="radio" name="'+name+'" value="'+esc(v)+'"><span>'+esc(label)+'</span></label>').join('')+'</fieldset>';
const quote=t=>'<blockquote>'+esc(t)+'</blockquote>';
const memo='<p class="context">'+esc(event.text)+'</p>';
const optionText={allow:'Allowed',block:'Blocked'};
export function page(config,step,r={},message=''){
 const headings={welcome:'Take the memory study',intent:'What would you want?',rule:'Choose a memory setting',preview:'Review your setting',predict:'What do you think will happen?',reflect:'Compare the outcomes',done:'Response submitted',discarded:'Session discarded',missing:'Start a new session'};
 let body='';
 if(step==='welcome')body='<p>You’ll read a fictional desk choice, set a memory rule and predict how it works. No AI account is needed.</p><h2>Before you begin</h2><p class="preserve">'+esc(config.information)+'</p>'+form('begin','<label class="choice"><input type="checkbox" name="agree" value="yes" required><span>'+(config.mode==='practice'?'I agree to start a practice session.':'I am 18 or older, I have read the information above, and I agree to take part.')+'</span></label>'+button('Begin'));
 if(step==='intent')body=memo+form('intent','<label for="intent">When would you want the assistant to use this choice again?</label><p>Use the fictional situation. You may leave this blank.</p><textarea id="intent" name="intent" maxlength="1000"></textarea>'+button('Save and continue'));
 if(step==='rule')body=memo+form('rule',group('scope','When may the assistant use this desk choice for recommendations?',scopes)+button('Preview this setting'));
 if(step==='preview')body='<p>'+esc(scopes[r.scope])+'</p>'+r.preview.map(x=>quote(x.text)+'<p>'+optionText[x.outcome]+'</p>').join('')+form('confirm',button('Save rule and continue'))+form('edit','<button class="plain">Change my setting</button>');
 if(step==='predict')body='<p>For each request, predict whether the assistant may use the earlier desk choice. Both answers are saved together before you see the results.</p>'+form('predictions',questions.map(q=>group(q.id,q.text,choices)).join('')+button('Save both predictions and see outcomes'));
 if(step==='reflect')body=questions.map(q=>quote(q.text)+'<p>Your prediction: '+esc(choices[r.predictions[q.id]])+'<br>Saved rule: <strong>'+esc(optionText[r.outcomes[q.id]])+'</strong></p>').join('')+form('finish',group('fit','Did these outcomes match what you wanted?',{yes:'Yes',partly:'Partly',no:'No',unsure:'Unsure',skip:'Skip this question'})+'<label for="feedback">What, if anything, would you change? (Optional)</label><textarea id="feedback" name="feedback" maxlength="1000"></textarea>'+button('Submit my response'));
 if(step==='done')body='<p>Your answers were saved. Your reference code is <strong>'+esc(r.code)+'</strong>.</p><p>You can now hand the laptop back.</p><a href="/survey">Start the next session</a>';
 if(step==='discarded'||step==='missing')body='<a href="/survey">Return to the start</a>';
 const active=['intent','rule','preview','predict','reflect'];
 const exit=active.includes(step)?'<details><summary>Stop this session</summary><p>Remove your answers from this session and return the laptop.</p>'+form('discard','<button class="plain">Discard my responses</button>')+'</details>':'';
 return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'+headings[step]+' · Memory study</title><link rel="stylesheet" href="/style.css"><main><header>Conversation memory study · '+(config.mode==='practice'?'Practice session':'Participant session')+'</header>'+(active.includes(step)?'<p class="step">Step '+(active.indexOf(step)+1)+' of 5</p>':'')+'<h1>'+headings[step]+'</h1>'+(message?'<p role="alert">'+esc(message)+'</p>':'')+body+exit+'</main></html>';
}

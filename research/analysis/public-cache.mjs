// Archive only observable replies and billing totals. Exclude account identifiers and provider diagnostics.
export function publicResponse(r){const usage={};for(const k of ['cost','prompt_tokens','completion_tokens','total_tokens'])if(r.usage?.[k]!=null)usage[k]=r.usage[k];
 return r.data?{model:r.model,usage,data:r.data.map(x=>({index:x.index,embedding:x.embedding}))}:{model:r.model,usage,choices:r.choices.map(x=>({finish_reason:x.finish_reason,message:{content:x.message.content}}))};}

import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
const object=value=>Boolean(value)&&typeof value==="object"&&!Array.isArray(value);
const keys=(value,allowed)=>Object.keys(value).every(key=>allowed.includes(key));
const cache=value=>value===undefined || object(value)&&keys(value,["type","ttl"])&&value.type==="ephemeral"&&[undefined,"5m","1h"].includes(value.ttl);
// Exact model aliases whose documented API supports text-only system turns.
const systemTurnModels=new Set(["claude-fable-5-1","claude-mythos-5-1","claude-fable-5","claude-mythos-5","claude-opus-5-5","claude-opus-4-8","claude-opus-5","claude-sonnet-5-5"]);
const perMessageEffortModels=new Set(["claude-fable-5-1","claude-mythos-5-1","claude-opus-5-5","claude-opus-5","claude-sonnet-5-5"]);
const effort=value=>object(value)&&keys(value,["effort"])&&["low","medium","high","xhigh","max"].includes(value.effort);
const adaptiveModels=new Set(["claude-sonnet-5-5","claude-opus-5-5"]);
function text(value) {
  return typeof value==="string" || Array.isArray(value)&&value.every(block=>object(block)&&keys(block,["type","text","cache_control"])&&block.type==="text"&&typeof block.text==="string"&&cache(block.cache_control));
}
export function validateModelRequest(body,model,toolNames,betaHeaders=[]) {
  if (!object(body) || !keys(body,["model","max_tokens","messages","system","stream","tools","tool_choice","temperature","top_p","top_k","stop_sequences","metadata","thinking","output_config","cache_control","context_management"]) || body.model!==model || !Array.isArray(body.messages) || !text(body.system??"") || !cache(body.cache_control)) throw new Error("request exceeds selected Messages mode");
  if (body.tools!==undefined && (!Array.isArray(body.tools) || body.tools.some(tool=>!object(tool)||!keys(tool,["name","description","input_schema","cache_control","type","defer_loading","strict"])||![undefined,"custom"].includes(tool.type)||!toolNames.has(tool.name)||!object(tool.input_schema)||!cache(tool.cache_control)))) throw new Error("hosted or alternate tools are unavailable");
  if (body.tool_choice!==undefined && (!object(body.tool_choice)||!keys(body.tool_choice,["type","name","disable_parallel_tool_use"])||!["auto","none","any","tool"].includes(body.tool_choice.type)||body.tool_choice.type==="tool"&&!toolNames.has(body.tool_choice.name))) throw new Error("alternate tool choice is unavailable");
  for (const [index,message] of body.messages.entries()) {
    if (!object(message)||!keys(message,message.role==="system"?["role","content","output_config"]:["role","content"])||!["user","assistant","system"].includes(message.role)) throw new Error("only inline message history is supported");
    if (message.role==="system") {
      if (!systemTurnModels.has(model) || !text(message.content)) throw new Error("this model or system content is outside the selected system-turn contract");
      if (message.output_config!==undefined && (!perMessageEffortModels.has(model)||!effort(message.output_config)||!betaHeaders.includes("mid-conversation-output-config-2026-07-01"))) throw new Error("per-message effort requires the selected model, bounded level and documented beta header");
      // Empty effort-only messages have no instruction placement constraint.
      if (message.output_config!==undefined && (message.content===""||Array.isArray(message.content)&&message.content.length===0)) continue;
      const before=body.messages.slice(0,index).findLast(prior=>prior.role!=="system");
      const after=body.messages.slice(index+1).find(next=>next.role!=="system");
      if (before?.role!=="user" || after && after.role!=="assistant") throw new Error("system-turn placement exceeds the selected text-only contract");
      continue;
    }
    if (typeof message.content==="string") continue;
    if (!Array.isArray(message.content)) throw new Error("inline content is required");
    for (const block of message.content) {
      if (!object(block)) throw new Error("invalid inline content");
      if (block.type==="text"&&text([block])) continue;
      if (message.role==="assistant"&&adaptiveModels.has(model)&&block.type==="thinking"&&keys(block,["type","thinking","signature"])&&typeof block.thinking==="string"&&typeof block.signature==="string") continue;
      if (message.role==="assistant"&&adaptiveModels.has(model)&&block.type==="redacted_thinking"&&keys(block,["type","data"])&&typeof block.data==="string") continue;
      if (block.type==="tool_use"&&keys(block,["type","id","name","input","cache_control"])&&typeof block.id==="string"&&typeof block.name==="string"&&/^[A-Za-z0-9_.-]{1,160}$/.test(block.name)&&object(block.input)&&cache(block.cache_control)) continue;
      if (block.type==="tool_result"&&keys(block,["type","tool_use_id","content","is_error","cache_control"])&&typeof block.tool_use_id==="string"&&text(block.content??"")&&cache(block.cache_control)) continue;
      throw new Error("only inline text and configured client tool history are supported");
    }
  }
  if (body.thinking!==undefined && !(object(body.thinking)&&(
    body.thinking.type==="disabled"&&keys(body.thinking,["type"])
    ||adaptiveModels.has(model)&&body.thinking.type==="adaptive"&&keys(body.thinking,["type","display"])&&(
      [undefined,"omitted","summarized"].includes(body.thinking.display)
      ||body.thinking.display==="updates"&&betaHeaders.includes("thinking-display-updates-2026-08-18"))))) throw new Error("thinking exceeds the selected inline model contract");
  if (body.context_management!==undefined) {
    const context=body.context_management;
    if (!adaptiveModels.has(model)||!betaHeaders.includes("context-management-2025-06-27")||!object(context)||!keys(context,["edits"])||!Array.isArray(context.edits)||context.edits.length!==1) throw new Error("unsupported context editing");
    const edit=context.edits[0],keep=edit?.keep;
    if (!object(edit)||!keys(edit,["type","keep"])||edit.type!=="clear_thinking_20251015"||!(keep===undefined||keep==="all"||object(keep)&&keys(keep,["type","value"])&&keep.type==="thinking_turns"&&Number.isSafeInteger(keep.value)&&keep.value>0&&keep.value<=10_000)) throw new Error("only bounded thinking-history editing is supported");
  }
  if (body.output_config!==undefined && !effort(body.output_config)) throw new Error("unsupported output configuration");
  // These values cannot authorize remote tools, references, files or background work.
  if (body.metadata!==undefined && (!object(body.metadata)||!keys(body.metadata,["user_id"]))) throw new Error("unsupported metadata");
}
/** Operator token budget from a command-line string: a positive safe integer, or undefined when absent. */
export function parseTokenBudget(value) {
  if (value===undefined) return undefined;
  if (!/^[0-9]{1,16}$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value)<1) throw new Error("--model-token-budget must be a positive integer");
  return Number(value);
}
const usageKeys=["input_tokens","output_tokens","cache_creation_input_tokens","cache_read_input_tokens"];
/** Provider-reported usage read as response bytes pass through. Never changes the response. */
export function usageMeter(contentType) {
  const streaming=/text\/event-stream/.test(contentType??"");
  const decoder=new TextDecoder();
  let pending="",body="",overflow=false,seen=false;
  const usage=Object.fromEntries(usageKeys.map(key=>[key,0]));
  const take=source=>{ if(!object(source)) return; for(const key of usageKeys) if(Number.isSafeInteger(source[key])&&source[key]>=0){usage[key]=source[key];seen=true;} };
  const line=text=>{ if(!text.startsWith("data:")) return; try { const event=JSON.parse(text.slice(5).trim()); if(event?.type==="message_start") take(event.message?.usage); else if(event?.type==="message_delta") take(event.usage); } catch { /* not usage */ } };
  return {
    feed(chunk){
      const text=typeof chunk==="string"?chunk:decoder.decode(chunk,{stream:true});
      if(streaming){ pending+=text; let end; while((end=pending.indexOf("\n"))>=0){ line(pending.slice(0,end).replace(/\r$/,"")); pending=pending.slice(end+1); } }
      else if(!overflow){ body+=text; if(body.length>8*1024*1024){ overflow=true; body=""; } }
    },
    end(){
      if(streaming){ if(pending) line(pending); }
      else if(!overflow){ try { take(JSON.parse(body)?.usage); } catch { /* no usage */ } }
      return seen?usage:null;
    },
  };
}
export async function startModelRelay({upstreamBaseUrl="https://api.anthropic.com",apiKey,oauth,model,toolNames,onToolResults,onModelRequest,pinnedHostEffortBeta=false,tokenBudget}) {
  const upstream=new URL(upstreamBaseUrl);
  if (oauth && upstream.origin!=="https://api.anthropic.com") throw new Error("Native subscription authentication requires the fixed Anthropic origin");
  if ((!apiKey && !oauth) || (apiKey && oauth) || (oauth && (!oauth.authorization?.startsWith("Bearer ") || !oauth.beta)) || upstream.username || upstream.password || upstream.search || upstream.hash || upstream.pathname!=="/" || !(upstream.origin==="https://api.anthropic.com" || upstream.protocol==="http:"&&upstream.hostname==="127.0.0.1"&&upstream.port)) throw new Error("explicit API or native subscription credential and qualified provider or localhost fixture origin required");
  if (tokenBudget!==undefined && (!Number.isSafeInteger(tokenBudget) || tokenBudget<1)) throw new Error("token budget must be a positive integer");
  const token=randomBytes(32).toString("hex"),events=[];
  const totals={requests:0,input_tokens:0,output_tokens:0,cache_creation_input_tokens:0,cache_read_input_tokens:0};
  const spent=()=>usageKeys.reduce((sum,key)=>sum+totals[key],0);
  const server=createServer(async (request,response)=>{
    const controller=new AbortController();response.on("close",()=>controller.abort());
    const event={method:request.method,path:request.url,forwarded:false};events.push(event);
    let meter=null,counted=false;
    const count=complete=>{ if(!meter||counted) return; counted=true; try { event.usage=meter.end(); } catch { event.usage=null; } event.usageComplete=complete; totals.requests++; if(event.usage) for(const key of usageKeys) totals[key]+=event.usage[key]; };
    try {
      const target=new URL(request.url,"http://127.0.0.1");
      if (request.method!=="POST" || !["/v1/messages","/v1/messages/count_tokens"].includes(target.pathname) || [...target.searchParams].some(([key,value])=>key!=="beta"||value!=="true") || request.headers["x-api-key"]!==token) throw new Error("model route refused");
      let size=0;const chunks=[];
      for await (const chunk of request) {size+=chunk.length;if(size>8*1024*1024) throw new Error("model request too large");chunks.push(chunk);}
      const body=JSON.parse(Buffer.concat(chunks).toString());
      // The host also sends structured title requests without client tools.
      // They remain refused, but cannot stand in for an attempted work turn.
      event.requestClass=target.pathname!=="/v1/messages"?"count-tokens":Array.isArray(body.tools)&&body.tools.length===0&&object(body.output_config?.format)?"auxiliary-structured":"conversation";
      // Field names only help qualify a changed host contract without retaining prompts.
      event.messageFields=Array.isArray(body.messages)?body.messages.map(message=>Object.keys(message).filter(key=>/^[a-z_]{1,64}$/.test(key))):[];
      event.messageRoles=Array.isArray(body.messages)?body.messages.map(message=>typeof message.role==="string"&&/^[a-z_]{1,32}$/.test(message.role)?message.role:"invalid"):[];
      event.topLevelKeys=Object.keys(body).filter(key=>/^[a-z_]{1,64}$/.test(key));
      event.outputConfigFields=object(body.output_config)?Object.keys(body.output_config):[];
      event.thinkingFields=object(body.thinking)?Object.keys(body.thinking):[];
      event.thinkingDisplay=typeof body.thinking?.display==="string"&&/^[a-z_]{1,32}$/.test(body.thinking.display)?body.thinking.display:typeof body.thinking?.display;
      event.contextEditTypes=Array.isArray(body.context_management?.edits)?body.context_management.edits.map(edit=>/^[a-z0-9_]{1,64}$/.test(edit.type)?edit.type:"invalid"):[];
      const betaHeaders=[...new Set([...(oauth?.beta??"").split(","),...(typeof request.headers["anthropic-beta"]==="string"?request.headers["anthropic-beta"]:"").split(",")].map(value=>value.trim()).filter(Boolean))];
      // 2.1.287 emits this private client beta. Add the documented API beta
      // only in the separately checksum-pinned host profile; never alter content.
      if (pinnedHostEffortBeta && betaHeaders.includes("per-turn-control-2026-07-01") && body.messages?.some(message=>message.output_config!==undefined)) {
        betaHeaders.push("mid-conversation-output-config-2026-07-01"); event.pinnedHostEffortBeta=true;
      }
      event.betaHeaders=betaHeaders.filter(value=>/^[a-z0-9-]{1,100}$/.test(value));
      event.messageEfforts=Array.isArray(body.messages)?body.messages.filter(message=>message.output_config!==undefined).map(message=>effort(message.output_config)?message.output_config.effort:"invalid"):[];
      event.thinkingType=body.thinking?.type;
      validateModelRequest(body,model,new Set(toolNames),betaHeaders);
      if (tokenBudget!==undefined && event.requestClass==="conversation" && spent()>=tokenBudget) { if(onToolResults) await onToolResults(body.messages); const error=new Error("Operator model token budget reached"); error.budget=true; throw error; }
      if(onModelRequest && target.pathname==="/v1/messages") await onModelRequest(body);
      if(onToolResults) await onToolResults(body.messages);
      event.topLevelKeys=Object.keys(body);event.toolNames=body.tools?.map(tool=>tool.name)??[];event.forwarded=true;
      const headers={"anthropic-version":"2023-06-01","content-type":"application/json"};
      if (oauth) {
        headers.authorization=oauth.authorization;
        headers["anthropic-beta"]=betaHeaders.join(",");
      } else {
        headers["x-api-key"]=apiKey;
        if (betaHeaders.length) headers["anthropic-beta"]=betaHeaders.join(",");
      }
      const result=await fetch(new URL(target.pathname+target.search,upstream),{method:"POST",redirect:"error",signal:controller.signal,headers,body:JSON.stringify(body)});
      event.status=result.status;
      meter=target.pathname==="/v1/messages"&&event.requestClass==="conversation"?usageMeter(result.headers.get("content-type")):null;
      response.writeHead(result.status,{"content-type":result.headers.get("content-type")??"application/json"});
      if(result.body) for await(const data of result.body){ response.write(data); try { meter?.feed(data); } catch { /* metering never affects the response */ } }
      response.end();
      if(meter){ event.model=body.model; count(true); }
    } catch(error) {
      // An interrupted forwarded stream still spent what the provider reported so far.
      if(meter&&event.forwarded){ event.model=model; count(false); }
      event.failure=error.message;
      if(!response.headersSent) response.writeHead(403,{"content-type":"application/json"});
      response.end(JSON.stringify({type:"error",error:{type:"permission_error",message:error.budget?"Operator model token budget reached":"Operator model relay refused or failed"}}));
    }
  });
  await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
  return {port:server.address().port,token,events,fixture:upstream.protocol==="http:",usage(){return {model,requests:totals.requests,inputTokens:totals.input_tokens,outputTokens:totals.output_tokens,cacheCreationInputTokens:totals.cache_creation_input_tokens,cacheReadInputTokens:totals.cache_read_input_tokens,budget:tokenBudget??null,budgetReached:tokenBudget!==undefined&&spent()>=tokenBudget};},async close(){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}

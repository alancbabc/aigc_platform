import { useState, useCallback, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { createGenerationAPI } from '../../api/client';
import { interpolationModels, getInterpolationModelById } from '../../data/models';
import ModelDropdown from '../common/ModelDropdown';
import SimpleDropdown from '../common/SimpleDropdown';
import PromptInput from '../common/PromptInput';
import GenerateButton from '../common/GenerateButton';
import PromptPanel from '../common/PromptPanel';
import { showToast } from '../common/Toast';
import { readFileAsBase64, revokeObjectURL } from '../../utils/fileHelpers';
import { useTasks } from '../../contexts/TaskContext';

let _is=0;function _iid(){return `c_${Date.now()}_${++_is}`;}

export default function InterpolationStudio() {
  const{addTask,updateTask,optimizeOpen,setOptimizeOpen}=useTasks();const loc=useLocation();
  const [sid,setSid]=useState(interpolationModels[0].id);
  const [prompt,setPrompt]=useState('');useEffect(()=>{if(loc.state?.reusePrompt)setPrompt(loc.state.reusePrompt)},[loc.key]);
  const [np,setNp]=useState('text, subtitles, lower-third, chyron, nameplate, news broadcast, TV graphics, interview, breaking news banner, character introduction overlay, manga annotation, comic annotation, text bubble, lettering artifacts, on-screen text, kana, furigana, character card, profile card, vertical text, vertical subtitles, vertical title card');const [seed,setSeed]=useState('');
  const [res,setRes]=useState(interpolationModels[0].defaultResolution);
  const [dur,setDur]=useState(interpolationModels[0].defaultDuration);
  const [frames,setFrames]=useState([]);const MAX_FRAMES=10;
  const [gn,setGn]=useState(1);const [gc,setGc]=useState(0);const [err,setErr]=useState(null);
  const fr=useRef(null);const [pv,setPv]=useState([]);
  useEffect(()=>{return()=>{pv.forEach(u=>revokeObjectURL(u));};},[pv]);
  const cm=getInterpolationModelById(sid);
  const icRef=useRef(0),itRef=useRef(0);
  const ibt=()=>{icRef.current++;clearTimeout(itRef.current);itRef.current=setTimeout(()=>{showToast(`生成完成 (${icRef.current} 个)`,'success');icRef.current=0;},500);};
const up=(e)=>{const fs2=Array.from(e.target.files||[]);const newFrames=fs2.map(file=>({file,uid:Date.now()+Math.random()}));let nf=[...frames,...newFrames];if(frames.length+fs2.length>MAX_FRAMES){showToast(`最多支持${MAX_FRAMES}张关键帧，已保留前${MAX_FRAMES}张`,'info',3000);}nf=nf.slice(0,MAX_FRAMES);setFrames(nf);setPv(p=>{p.forEach(u=>revokeObjectURL(u));return nf.map(f=>URL.createObjectURL(f.file));});e.target.value='';};
const rm=(uid,i)=>{revokeObjectURL(pv[i]);setPv(p=>p.filter((_,x)=>x!==i));setFrames(p=>p.filter(f=>f.uid!==uid));};

  const gen=useCallback(async(sp,sn)=>{const p=sp||prompt;const n=sn!==undefined?sn:np;if(!p.trim()||frames.length===0)return;const tid=_iid();addTask({id:tid,generationId:tid,type:'interpolation',prompt:p.trim(),model:cm.name,status:'generating',results:null,error:null});setGc(c=>c+1);setErr(null);showToast('任务已提交','info');
    try{const b64=await Promise.all(frames.map(f=>readFileAsBase64(f.file)));
      const d=await createGenerationAPI().interpolation({model:cm,mode:'interpolation',prompt:p.trim(),frames:b64,negative_prompt:n.trim()||undefined,seed:seed||undefined,duration:dur,resolution:res,gen_num:gn});
      updateTask(tid,{generationId:d.generationId||tid,status:'done',results:d.results,duration:d.duration});ibt();
      if(d.translatedPrompt&&d.translatedPrompt!==p.trim()&&prompt===p.trim())setPrompt(d.translatedPrompt);
      if(d.translationStatus==='no_key')showToast('翻译功能不可用：未配置 Gitee API Key，使用原文生成','error',6000);
      else if(d.translationStatus==='failed')showToast('Prompt 翻译失败，使用原文生成','error',6000);
      if(d.errors){setErr(`部分失败: ${d.errors.join('; ')}`);setTimeout(()=>setErr(null),10000);}
    }catch(e){updateTask(tid,{status:'failed',error:e.message});setErr(e.message);showToast(`失败: ${e.message}`,'error');setTimeout(()=>setErr(null),10000);}finally{setGc(c=>c-1);}
  },[prompt,np,seed,cm,frames,dur,res,gn]);

  return (
    <div className="h-full flex overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {gc>0&&(<div className="flex-shrink-0 mx-3 mt-3 px-2 py-1 bg-primary/10 border border-primary/20 rounded-md flex items-center gap-1.5"><div className="w-2.5 h-2.5 border-2 border-white/10 border-t-primary rounded-full animate-spin"/><span className="text-[10px] text-primary font-medium">生成中 ({gc})</span></div>)}
        <div className="flex-1 flex flex-col min-h-0 p-4 gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <ModelDropdown models={interpolationModels} selectedModel={sid} onSelect={(m)=>setSid(m.id)}/>
            <SimpleDropdown title="分辨率" options={cm.resolutions} selected={res} onSelect={setRes}/>
            <SimpleDropdown title="时长" options={cm.durations.map(String)} selected={String(dur)} onSelect={(v)=>setDur(parseInt(v))}/>
            <input ref={fr} type="file" accept="image/*" multiple className="hidden" onChange={up}/>
            <button onClick={()=>fr.current?.click()} className="px-3 py-1.5 text-xs bg-white/[0.03] border-2 border-dashed border-border rounded-lg hover:bg-white/[0.06] hover:border-primary/40 transition-all text-white/40 hover:text-white flex items-center gap-1.5"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>关键帧 ({frames.length}/{MAX_FRAMES})</button>
          </div>
          {frames.length>0&&(<div className="flex flex-wrap gap-1.5">{frames.map((f,i)=>(<div key={f.uid} className="relative w-14 h-14 rounded-md overflow-hidden border border-border group"><img src={pv[i]} alt="" className="w-full h-full object-cover"/><button onClick={()=>rm(f.uid,i)} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px]">✕</button><span className="absolute bottom-0 left-0 right-0 text-[7px] text-center bg-black/60 text-white/70">{i+1}</span></div>))}</div>)}
          {cm.supportsNegativePrompt&&<textarea value={np} onChange={e=>setNp(e.target.value)} placeholder="负向提示词（可选）" rows={4} className="w-full bg-white/[0.03] border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/15 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none overflow-hidden"/>}
          <PromptInput value={prompt} onChange={setPrompt} placeholder="描述关键帧之间的过渡效果和视频内容。上传关键帧图片后点击「生成插帧视频」"/>
          <div className="mt-auto flex items-center gap-2">
            <button onClick={()=>setOptimizeOpen(!optimizeOpen)} className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${optimizeOpen?'bg-primary/10 text-primary border-primary/30':'bg-white/[0.03] text-white/40 border-border hover:text-white hover:bg-white/10'}`}>
              {optimizeOpen?'关闭优化':'优化 Prompt'}
            </button>
            <SimpleDropdown title="数量" options={['1','2','4']} selected={String(gn)} onSelect={(v)=>setGn(parseInt(v))}/>
            <GenerateButton onClick={()=>gen()} disabled={!prompt.trim()||frames.length===0} label={prompt.trim()&&frames.length>0?'生成插帧视频':!prompt.trim()&&frames.length===0?'请上传关键帧图片并输入 Prompt':!prompt.trim()?'请输入 Prompt':'请上传关键帧图片'}/>
          </div>
          {err&&<div className="px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-md"><p className="text-red-400 text-[10px]">{err}</p></div>}
        </div>
      </div>
      {optimizeOpen&&<PromptPanel prompt={prompt} type="interpolation" onApply={(p)=>{setPrompt(p);}} onClose={()=>setOptimizeOpen(false)}/>}
    </div>
  );
}

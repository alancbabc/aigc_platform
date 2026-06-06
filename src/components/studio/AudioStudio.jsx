import { useState, useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { createGenerationAPI } from '../../api/client';
import { audioModels, getAudioModelById } from '../../data/models';
import ModelDropdown from '../common/ModelDropdown';
import SimpleDropdown from '../common/SimpleDropdown';
import AudioPicker from '../common/AudioPicker';
import PromptInput from '../common/PromptInput';
import GenerateButton from '../common/GenerateButton';
import { showToast } from '../common/Toast';
import { readFileAsBase64 } from '../../utils/fileHelpers';
import { useTasks } from '../../contexts/TaskContext';

const LANG=['auto','chinese','english','french','german','italian','japanese','korean','portuguese','russian','spanish'];const EMO=['高兴','愤怒','悲伤','害怕','厌恶','忧郁','惊讶','平静'];const EMO_MODES=['随机情绪','情绪音频','情绪向量','情绪文本'];
let _as=0;function _aid(){return `c_${Date.now()}_${++_as}`;}

export default function AudioStudio({ mode = 'speech' }) {
  const ic=mode==='clone';const{addTask,updateTask,optimizeOpen,setOptimizeOpen,setOptimizePanel}=useTasks();const loc=useLocation();
  const [inputs,setInputs]=useState('');useEffect(()=>{if(loc.state?.reusePrompt)setInputs(loc.state.reusePrompt)},[loc.key]);
  const [lang,setLang]=useState('auto');const [speaker,setSpeaker]=useState(getAudioModelById('Qwen3-TTS').speakers[0].id);
  const [instr,setInstr]=useState('');const [vd,setVd]=useState(false);
  const [ra,setRa]=useState(null);const [ev,setEv]=useState([0,0,0,0,0,0,0,0]);
  const [et,setEt]=useState('');const [emoMode,setEmoMode]=useState('random');const [ea,setEa]=useState(null);
  const [gn,setGn]=useState(1);
  const [gc,setGc]=useState(0);const [err,setErr]=useState(null);
  const can=ic?(!!inputs.trim()&&!!ra):!!inputs.trim();
  useEffect(()=>{if(optimizeOpen)setOptimizePanel({prompt:inputs,type:'audio',onApply:setInputs});},[optimizeOpen,inputs,setOptimizePanel]);
  const acRef=useRef(0),atRef=useRef(0);
  const abt=()=>{acRef.current++;clearTimeout(atRef.current);atRef.current=setTimeout(()=>{showToast(`生成完成 (${acRef.current} 个)`,'success');acRef.current=0;},500);};

  const gen=useCallback(async(sp)=>{const p=sp||inputs;const tts=getAudioModelById('Qwen3-TTS'),idx=getAudioModelById('IndexTTS-2');if(!(ic?(!!p.trim()&&!!ra):!!p.trim()))return;const tid=_aid();addTask({id:tid,generationId:null,type:mode,prompt:p.trim(),model:ic?idx.name:tts.name,status:'generating',results:null,error:null});setGc(c=>c+1);setErr(null);showToast('任务已提交','info');
    try{const params={model:ic?idx:tts,mode:ic?'clone':'audio',inputs:p.trim()};
      if(ic){if(ra)params.ref_audio_base64=await readFileAsBase64(ra);if(emoMode==='random'){params.use_random=true;}else if(emoMode==='vector'){params.emo_vector=ev;}else if(emoMode==='text'){if(et.trim())params.emo_text=et.trim();}else if(emoMode==='audio'){if(ea)params.emo_audio_base64=await readFileAsBase64(ea);}}
      else{params.language=lang;if(vd){params.pipeline='qwen_tts_voicedesign';if(instr.trim())params.instruct=instr.trim();}else{params.speaker=speaker;if(instr.trim())params.instruct=instr.trim();}}
      params.gen_num=gn;const d=await createGenerationAPI().audio(params);
      updateTask(tid,{generationId:d.generationId||tid,status:'done',results:d.results,duration:d.duration});abt();if(d.errors){setErr(`部分失败: ${d.errors.join('; ')}`);setTimeout(()=>setErr(null),10000);}
    }catch(e){updateTask(tid,{status:'failed',error:e.message});setErr(e.message);showToast(`失败: ${e.message}`,'error');setTimeout(()=>setErr(null),10000);}finally{setGc(c=>c-1);}
  },[inputs,lang,speaker,instr,ra,ev,et,vd,gn,emoMode,ea,can,ic]);

  return (
    <div className="h-full flex overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {gc>0&&(<div className="flex-shrink-0 mx-3 mt-3 px-2 py-1 bg-primary/10 border border-primary/20 rounded-md flex items-center gap-1.5"><div className="w-2.5 h-2.5 border-2 border-white/10 border-t-primary rounded-full animate-spin"/><span className="text-[10px] text-primary font-medium">生成中 ({gc})</span></div>)}
        <div className="flex-1 flex flex-col min-h-0 p-4 gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <ModelDropdown models={audioModels.filter(m=>ic?m.id==='IndexTTS-2':m.id==='Qwen3-TTS')} selectedModel={ic?'IndexTTS-2':'Qwen3-TTS'} onSelect={()=>{}} disabled/>
            {!ic&&<><SimpleDropdown title="语言" options={LANG} selected={lang} onSelect={setLang}/>{!vd&&<SimpleDropdown title="预定义音色" options={getAudioModelById('Qwen3-TTS').speakers.map(s=>s.id)} selected={speaker} onSelect={setSpeaker}/>}
            <button type="button" onClick={()=>setVd(!vd)} className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-xs transition-colors ${vd?'bg-primary/10 border-primary/30 text-primary':'bg-white/[0.03] border-border text-white/40 hover:border-white/20 hover:text-white'}`}>
              <span className={`w-2 h-2 rounded-full ${vd?'bg-primary':'bg-white/20'}`}/>
              自定义音色
            </button></>}
          </div>
          {ic&&<AudioPicker file={ra} onUpload={setRa} onClear={()=>setRa(null)} label="上传音色参考音频（必传，用于克隆音色）"/>}
          {ic&&<SimpleDropdown title="情绪模式" options={EMO_MODES} selected={emoMode==='random'?'随机情绪':emoMode==='audio'?'情绪音频':emoMode==='vector'?'情绪向量':'情绪文本'} onSelect={v=>setEmoMode(v==='随机情绪'?'random':v==='情绪音频'?'audio':v==='情绪向量'?'vector':'text')}/>}
          {ic&&emoMode==='text'&&<textarea value={et} onChange={e=>setEt(e.target.value)} placeholder="情绪参考文本，描述想要的情感：例如 欢快雀跃、低沉忧伤、愤怒激昂" rows={2} className="flex-shrink-0 w-full bg-white/[0.03] border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/15 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"/>}
          {!ic&&vd&&<textarea value={instr} onChange={e=>setInstr(e.target.value)} placeholder="Prompt自定义音色：描述你想要的音色特征，例如：温柔知性的年轻女声，语速适中，带一点磁性" rows={3} className="flex-shrink-0 w-full bg-white/[0.03] border border-border rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/15 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none"/>}
          {ic&&emoMode==='audio'&&<AudioPicker file={ea} onUpload={setEa} onClear={()=>setEa(null)} label="上传情绪参考音频（用于情绪表达参考）"/>}
          {ic&&emoMode==='vector'&&<div className="bg-white/[0.02] border border-border rounded-lg p-3"><p className="text-[10px] text-white/30 mb-2">情绪向量</p><div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{EMO.map((l,i)=>(<div key={l} className="flex flex-col items-center gap-0.5"><span className="text-[9px] text-white/40">{l}</span><input type="range" min="0" max="1" step="0.1" value={ev[i]} onChange={e=>{const v=[...ev];v[i]=parseFloat(e.target.value);setEv(v)}} className="w-full h-1 accent-primary"/><span className="text-[9px] text-white/30">{ev[i].toFixed(1)}</span></div>))}</div></div>}
          <PromptInput value={inputs} onChange={setInputs} placeholder={ic?'输入需要克隆朗读的文本内容...':'输入需要合成语音的文本内容。选择音色或使用音色设计，点击「生成语音」'}/>
          <div className="mt-auto flex items-center gap-2">
            <button onClick={()=>setOptimizeOpen(!optimizeOpen)} className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${optimizeOpen?'bg-primary/10 text-primary border-primary/30':'bg-white/[0.03] text-white/40 border-border hover:text-white hover:bg-white/10'}`}>
              {optimizeOpen?'关闭优化':'优化 Prompt'}
            </button>
            <SimpleDropdown title="数量" options={['1','2','4']} selected={String(gn)} onSelect={(v)=>setGn(parseInt(v))}/>
            <GenerateButton onClick={()=>gen()} disabled={!can} label={can?'生成语音':ic?'请上传参考音频并输入文本':'请输入文本'}/>
          </div>
          {err&&<div className="px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-md"><p className="text-red-400 text-[10px]">{err}</p></div>}
        </div>
      </div>
    </div>
  );
}

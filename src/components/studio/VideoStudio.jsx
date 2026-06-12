import { useState, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { createGenerationAPI } from '../../api/client';
import { videoModels, getVideoModelById } from '../../data/models';
import ModelDropdown from '../common/ModelDropdown';
import SimpleDropdown from '../common/SimpleDropdown';
import ResolutionSelector from '../common/ResolutionSelector';
import ImageUploader from '../common/ImageUploader';
import AudioPicker from '../common/AudioPicker';
import AudioInsertPosition from '../common/AudioInsertPosition';
import GenerateButton from '../common/GenerateButton';
import PromptInput from '../common/PromptInput';
import NegativePromptInput from '../common/NegativePromptInput';
import { showToast } from '../common/Toast';
import { readFileAsBase64 } from '../../utils/fileHelpers';
import { useTasks } from '../../contexts/TaskContext';

const CFG = {
  text2video: { ni: false, sq: false, can: (p) => !!p.trim(), btn: '生成音视频', bo: '请输入 Prompt' },
  image2video: { ni: true, sq: false, can: (p,i) => !!p.trim()&&i, btn: '生成音视频', bo: '请上传图片并输入 Prompt' },
};
let _vs=0;function _vid(){return `c_${Date.now()}_${++_vs}`;}

export default function VideoStudio({ mode = 'text2video', active = true }) {
  const cfg=CFG[mode]||CFG.text2video;const{addTask,updateTask,optimizeOpen,setOptimizeOpen,setOptimizePanel,registerTaskAbort,unregisterTaskAbort}=useTasks();const loc=useLocation();
  const [sid,setSid]=useState(videoModels[0].id);const [ri,setRi]=useState(null);
  const [prompt,setPrompt]=useState('');useEffect(()=>{if(loc.state?.reusePrompt)setPrompt(loc.state.reusePrompt)},[loc.key]);
  const [np,setNp]=useState('text, subtitles, lower-third, chyron, nameplate, news broadcast, TV graphics, interview, breaking news banner, character introduction overlay, manga annotation, comic annotation, text bubble, lettering artifacts, on-screen text, kana, furigana, character card, profile card, vertical text, vertical subtitles, vertical title card');const [seed,setSeed]=useState('');
  const [res,setRes]=useState(videoModels[0].defaultResolution);const [resolutionPreset,setResolutionPreset]=useState(videoModels[0].defaultResolutionPreset);const [aspectRatio,setAspectRatio]=useState(videoModels[0].defaultAspectRatio);const [dur,setDur]=useState(videoModels[0].defaultDuration);
  const [qual,setQual]=useState(videoModels[0].defaultQuality);
  const [audio,setAudio]=useState(null);const [audioPos,setAudioPos]=useState(0);
  const [gc,setGc]=useState(0);const [err,setErr]=useState(null);
  const cm=getVideoModelById(sid);const can=cfg.can(prompt,!!ri);
  useEffect(()=>{if(active&&optimizeOpen)setOptimizePanel({prompt,type:mode==='image2video'?'image2video':'text2video',source:mode==='image2video'?'image2video':'video',onApply:setPrompt});},[active,optimizeOpen,prompt,setOptimizePanel,mode]);
  const gen=useCallback(async(submitPrompt,submitNeg)=>{const p=submitPrompt||prompt;const n=submitNeg!==undefined?submitNeg:np;if(!p.trim())return;const tid=_vid();const controller=new AbortController();registerTaskAbort(tid,controller);addTask({id:tid,generationId:null,type:mode,prompt:p.trim(),model:cm.name,status:'generating',results:null,error:null});setGc(c=>c+1);setErr(null);showToast('任务已提交','info');
    try{const ib=ri?await readFileAsBase64(ri):undefined;const ab=audio?await readFileAsBase64(audio):undefined;
      const d=await createGenerationAPI().video({model:cm,mode,prompt:p.trim(),image_base64:ib,negative_prompt:n.trim()||undefined,seed:seed||undefined,duration:dur,resolution:res,resolution_preset:resolutionPreset,aspect_ratio:aspectRatio,quality:cfg.sq?qual:undefined,audio_base64:ab,audio_insert_position:audio?audioPos:0},{signal:controller.signal});
      updateTask(tid,{generationId:d.generationId||tid,status:'done',results:d.results,duration:d.duration});showToast('生成完成','success');
      if(d.translatedPrompt&&d.translatedPrompt!==p.trim()&&prompt===p.trim())setPrompt(d.translatedPrompt);
      if(d.translationStatus==='no_key')showToast('翻译功能不可用：未配置 Gitee API Key，使用原文生成','error',6000);
      else if(d.translationStatus==='failed')showToast('Prompt 翻译失败，使用原文生成','error',6000);
      if(d.errors){setErr(`部分失败: ${d.errors.join('; ')}`);setTimeout(()=>setErr(null),10000);}
    }catch(e){if(e.name==='AbortError'){setErr('任务已取消');showToast('任务已取消','info');setTimeout(()=>setErr(null),3000);}else{updateTask(tid,{status:'failed',error:e.message});setErr(e.message);showToast(`失败: ${e.message}`,'error');setTimeout(()=>setErr(null),10000);}}
    finally{unregisterTaskAbort(tid);setGc(c=>c-1);}
  },[prompt,np,seed,cm,ri,dur,res,resolutionPreset,aspectRatio,qual,audio,audioPos,can,cfg.sq,addTask,updateTask,registerTaskAbort,unregisterTaskAbort]);

  return (
    <div className="h-full flex overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {gc>0&&(<div className="flex-shrink-0 mx-3 mt-3 px-2 py-1 bg-primary/10 border border-primary/20 rounded-md flex items-center gap-1.5"><div className="w-2.5 h-2.5 border-2 border-white/10 border-t-primary rounded-full animate-spin"/><span className="text-[10px] text-primary font-medium">生成中 ({gc})</span></div>)}
        <div className="flex-1 flex flex-col min-h-0 p-4 pb-0 gap-3 overflow-y-auto">
          <div className="flex items-center gap-2 flex-wrap">
            <ModelDropdown models={videoModels} selectedModel={sid} onSelect={(m)=>setSid(m.id)}/>
            {cfg.sq&&<SimpleDropdown title="质量" options={cm.qualities.map(q=>q.name)} selected={cm.qualities.find(q=>q.id===qual)?.name||''} onSelect={(v)=>{const q=cm.qualities.find(q=>q.name===v);if(q)setQual(q.id);}}/>}
            <ResolutionSelector initialValue={res} resolutionOptions={cm.resolutionOptions} aspectRatioOptions={cm.aspectRatioOptions} initialResolution={resolutionPreset} initialAspectRatio={aspectRatio} onSelect={(value, meta)=>{setRes(value);setResolutionPreset(meta.resolution);setAspectRatio(meta.aspectRatio);}} />
            <SimpleDropdown title="时长" options={cm.durations.map(String)} selected={String(dur)} onSelect={(v)=>setDur(parseInt(v))}/>
          </div>
          {cfg.ni&&<ImageUploader file={ri} onUpload={setRi} onClear={()=>setRi(null)}/>}
          <AudioPicker file={audio} onUpload={setAudio} onClear={()=>setAudio(null)} label="上传音频（可选）"/>
          <AudioInsertPosition value={audioPos} onChange={setAudioPos} duration={dur}/>
          {cm.supportsNegativePrompt&&<NegativePromptInput value={np} onChange={setNp} placeholder="负向提示词（可选）" helpText="填写不希望视频中出现的画面、动作或缺陷，例如抖动、畸形、低清晰度、文字、水印；可留空。"/>}
          <PromptInput value={prompt} onChange={setPrompt} label={cfg.ni?'视频动效描述':'视频内容描述'} helpText={cfg.ni?'描述参考图片如何运动、镜头如何变化，以及希望保留或强化的画面细节。':'描述视频主体、动作、镜头、场景、风格和节奏；如上传音频，可同时描述音画配合效果。'} placeholder={cfg.ni?'描述基于图片的视频动效，可选配合音频...':'描述想要的音视频内容。选择模型、质量、分辨率，可选上传音频，点击「生成音视频」'}/>
        </div>
        <div className="flex-shrink-0 flex items-center gap-2 p-4 pt-0">
          <button onClick={()=>setOptimizeOpen(!optimizeOpen)} className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${optimizeOpen?'bg-primary/10 text-primary border-primary/30':'bg-white/[0.03] text-white/40 border-border hover:text-white hover:bg-white/10'}`}>
            {optimizeOpen?'关闭优化':'优化 Prompt'}
          </button>
          <GenerateButton onClick={()=>gen()} disabled={!can} label={can?cfg.btn:cfg.bo}/>
        </div>
        {err&&<div className="px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-md"><p className="text-red-400 text-[10px]">{err}</p></div>}
      </div>
    </div>
  );
}

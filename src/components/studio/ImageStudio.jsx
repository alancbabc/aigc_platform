import { useState, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { createGenerationAPI } from '../../api/client';
import { imageModels, getImageModelById } from '../../data/models';
import ModelDropdown from '../common/ModelDropdown';
import ResolutionSelector from '../common/ResolutionSelector';
import ImageUploader from '../common/ImageUploader';
import PromptInput from '../common/PromptInput';
import NegativePromptInput from '../common/NegativePromptInput';
import GenerateButton from '../common/GenerateButton';
import { showToast } from '../common/Toast';
import { readFileAsBase64 } from '../../utils/fileHelpers';
import { useTasks } from '../../contexts/TaskContext';

let _ts=0;function _tid(){return `c_${Date.now()}_${++_ts}`;}

export default function ImageStudio({ mode = 'text2image', active = true }) {
  const ie=mode==='image2image';const{addTask,updateTask,optimizeOpen,setOptimizeOpen,setOptimizePanel,registerTaskAbort,unregisterTaskAbort}=useTasks();const loc=useLocation();
  const [sid,setSid]=useState(ie?imageModels[1].id:imageModels[0].id);const [size,setSize]=useState(imageModels[0].defaultSize);const [resolutionPreset,setResolutionPreset]=useState(imageModels[0].defaultResolutionPreset);const [aspectRatio,setAspectRatio]=useState(imageModels[0].defaultAspectRatio);
  const [refImgs,setRefImgs]=useState([]);const [prompt,setPrompt]=useState('');useEffect(()=>{if(loc.state?.reusePrompt)setPrompt(loc.state.reusePrompt)},[loc.key]);
  const [np,setNp]=useState('low quality, blurry, distorted, deformed, bad anatomy, extra limbs, watermark, text, signature');const [seed,setSeed]=useState('');
  const [steps,setSteps]=useState(imageModels[0].defaultInferenceSteps);
  const [gc,setGc]=useState(0);const [err,setErr]=useState(null);
  const cm=getImageModelById(sid);const can=ie?(prompt.trim()&&refImgs.length>0):!!prompt.trim();
  useEffect(()=>{if(active&&optimizeOpen)setOptimizePanel({prompt,type:ie?'image-edit':'text2image',source:ie?'image-edit':'image',onApply:setPrompt});},[active,optimizeOpen,prompt,setOptimizePanel,ie]);
  const gen=useCallback(async(sp, sn)=>{const p=sp||prompt;const n=sn!==undefined?sn:np;if(!(ie?(p.trim()&&refImgs.length>0):!!p.trim()))return;const tid=_tid();const controller=new AbortController();registerTaskAbort(tid,controller);addTask({id:tid,generationId:null,type:ie?'image-edit':'image',prompt:p.trim(),model:cm.name,status:'generating',results:null,error:null});setGc(c=>c+1);setErr(null);showToast('任务已提交','info');
    try{let ib;if(refImgs.length>0)ib=await Promise.all(refImgs.map(f=>readFileAsBase64(f)));const d=await createGenerationAPI().image({model:cm,mode:ie?'image-edit':'image',prompt:p.trim(),size,resolution_preset:resolutionPreset,aspect_ratio:aspectRatio,images:ib,negative_prompt:n.trim()||undefined,seed:seed||undefined,num_inference_steps:steps},{signal:controller.signal});updateTask(tid,{generationId:d.generationId||tid,status:'done',results:d.results,duration:d.duration});showToast('生成完成','success');if(d.errors){setErr(`部分失败: ${d.errors.join('; ')}`);setTimeout(()=>setErr(null),10000);}}
    catch(e){if(e.name==='AbortError'){setErr('任务已取消');showToast('任务已取消','info');setTimeout(()=>setErr(null),3000);}else{updateTask(tid,{status:'failed',error:e.message});setErr(e.message);showToast(`失败: ${e.message}`,'error');setTimeout(()=>setErr(null),10000);}}finally{unregisterTaskAbort(tid);setGc(c=>c-1);}
  },[prompt,np,seed,steps,cm,size,resolutionPreset,aspectRatio,refImgs,can,ie,addTask,updateTask,registerTaskAbort,unregisterTaskAbort]);

  return (
    <div className="h-full flex overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {gc>0&&(<div className="flex-shrink-0 mx-3 mt-3 px-2 py-1 bg-primary/10 border border-primary/20 rounded-md flex items-center gap-1.5"><div className="w-2.5 h-2.5 border-2 border-white/10 border-t-primary rounded-full animate-spin"/><span className="text-[10px] text-primary font-medium">生成中 ({gc})</span></div>)}
        <div className="flex-1 flex flex-col min-h-0 p-4 gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <ModelDropdown models={imageModels.filter(m=>ie?m.id==='Qwen-Image-Edit':m.id==='Qwen-Image')} selectedModel={sid} onSelect={(m)=>setSid(m.id)}/>
            <ResolutionSelector initialValue={size} resolutionOptions={cm.resolutionOptions} aspectRatioOptions={cm.aspectRatioOptions} initialResolution={resolutionPreset} initialAspectRatio={aspectRatio} onSelect={(value, meta)=>{setSize(value);setResolutionPreset(meta.resolution);setAspectRatio(meta.aspectRatio);}} />
          </div>
          {ie&&<ImageUploader file={refImgs[0]} onUpload={(f)=>setRefImgs([f])} onClear={()=>setRefImgs([])} label="上传参考图片"/>}
          {cm.supportsNegativePrompt&&<NegativePromptInput value={np} onChange={setNp} placeholder="负向提示词（可选）" helpText="填写不希望图片中出现的内容或缺陷，例如水印、模糊、畸形、文字错误；可留空。"/>}
          <PromptInput value={prompt} onChange={setPrompt} label={ie?'编辑指令':'画面描述'} helpText={ie?'描述要如何修改参考图，例如改变风格、主体动作、背景或局部细节。':'描述要生成的图片主体、场景、风格、构图、光线和细节。'} placeholder={ie?'描述您希望对图片进行的修改...':'描述您想要生成的内容。选择模型和尺寸，点击「生成图片」'}/>
          <div className="mt-auto flex items-center gap-2">
            <button onClick={()=>setOptimizeOpen(!optimizeOpen)} className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${optimizeOpen?'bg-primary/10 text-primary border-primary/30':'bg-white/[0.03] text-white/40 border-border hover:text-white hover:bg-white/10'}`}>
              {optimizeOpen?'关闭优化':'优化 Prompt'}
            </button>
            <GenerateButton onClick={()=>gen()} disabled={!can} label={can?(ie?'开始编辑':'生成图片'):ie?'请上传参考图片并输入提示词':'输入 Prompt'}/>
          </div>
          {err&&<div className="px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-md"><p className="text-red-400 text-[10px]">{err}</p></div>}
        </div>
      </div>
    </div>
  );
}

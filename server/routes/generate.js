import { Router } from 'express';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import { authMiddleware } from '../middleware/auth.js';
import { addHistory } from '../services/historyStore.js';

export const generateRouter = Router();
generateRouter.use(authMiddleware);

// ========= 任务追踪系统 =========
const activeTasks = new Map(); // generationId -> { userId, tasks: [...], cancel: boolean }

function createGenerationId() {
  return uuidv4();
}

function trackTask(generationId, userId, taskIds) {
  activeTasks.set(generationId, {
    userId,
    tasks: taskIds.map(id => ({ taskId: id, status: 'submitted', error: null })),
    cancelled: false,
    createdAt: Date.now(),
  });
}

function updateTaskStatus(generationId, taskId, status, error) {
  const gen = activeTasks.get(generationId);
  if (!gen) return;
  const task = gen.tasks.find(t => t.taskId === taskId);
  if (task) {
    task.status = status;
    if (error) task.error = error;
  }
}

function isGenerationCancelled(generationId) {
  const gen = activeTasks.get(generationId);
  return gen?.cancelled === true;
}

export function getGenerationStatus(generationId) {
  const gen = activeTasks.get(generationId);
  if (!gen) return null;
  return {
    generationId,
    cancelled: gen.cancelled,
    tasks: gen.tasks.map(t => ({ taskId: t.taskId, status: t.status, error: t.error })),
  };
}

export function cancelGeneration(generationId, userId) {
  const gen = activeTasks.get(generationId);
  if (!gen) return false;
  if (gen.userId !== userId) return false;
  gen.cancelled = true;
  return true;
}

function cleanUpGeneration(generationId) {
  activeTasks.delete(generationId);
}

// ========= 工具函数 =========

function formatTimestamp() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '_',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
}

function parseSize(size) {
  const [w, h] = size.split('x').map(Number);
  return { width: w, height: h };
}

function base64ToTempFile(base64, ext) {
  const matches = base64.match(/^data:(.+);base64,(.+)$/);
  if (!matches) throw new Error('Invalid base64 data');
  const buffer = Buffer.from(matches[2], 'base64');
  const tmpPath = path.join(os.tmpdir(), `${uuidv4()}.${ext}`);
  fs.writeFileSync(tmpPath, buffer);
  return tmpPath;
}

function ensureOutputDir(username) {
  const dir = path.join(config.DATA_DIR, 'outputs', username);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const VALID_DURATIONS = [3, 5, 10, 15];
const VALID_RESOLUTIONS = ['1088x1920', '1024x1536', '1024x1024', '720x1280', '576x1024', '1024x768', '768x768', '1328x1328', '768x1024', '1536x1024', '1024x1536'];
const VALID_IMAGE_SIZES = ['1024x1024', '768x768', '1328x1328', '1024x768', '768x1024', '1536x1024', '1024x1536'];

function assertInt(value, min, max, field) {
  const n = parseInt(value);
  if (isNaN(n) || n < min || n > max) {
    throw Object.assign(new Error(`${field} must be ${min}-${max}`), { statusCode: 400 });
  }
  return n;
}

function assertOneOf(value, list, field) {
  if (value && !list.includes(String(value))) {
    throw Object.assign(new Error(`${field} '${value}' is not valid. Allowed: ${list.join(', ')}`), { statusCode: 400 });
  }
}

function generateFilename(timestamp, prefix, index, ext) {
  return `${timestamp}_${uuidv4().slice(0, 8)}_${prefix}_${index}.${ext}`;
}

// ========= AI 异步模式 =========

async function submitTask(baseUrl, formData) {
  const headers = formData.getHeaders ? formData.getHeaders() : {};
  const response = await axios.post(`${baseUrl}/submit`, formData, {
    headers,
    timeout: config.SUBMIT_TIMEOUT_MS,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
  if (response.data.status !== 'submitted') {
    throw new Error(`Submit failed: ${JSON.stringify(response.data)}`);
  }
  return response.data.task_id;
}

async function pollTask(baseUrl, taskId, generationId) {
  for (let attempt = 1; attempt <= config.MAX_POLL_ATTEMPTS; attempt++) {
    if (isGenerationCancelled(generationId)) {
      throw new Error('CANCELLED');
    }
    await new Promise(resolve => setTimeout(resolve, config.POLL_INTERVAL_MS));
    try {
      const response = await axios.get(`${baseUrl}/status/${taskId}`, { timeout: config.POLL_TIMEOUT_MS });
      const s = response.data;
      if (s.status === 'done') return;
      if (s.status === 'error') throw new Error(`Task failed: ${JSON.stringify(s)}`);
      if (s.status === 'running' || s.status === 'queued') {
        updateTaskStatus(generationId, taskId, s.status);
        continue;
      }
      throw new Error(`Unknown status: ${s.status}`);
    } catch (err) {
      if (err.message === 'CANCELLED') throw err;
      if (err.message.startsWith('Task failed') || err.message.startsWith('Unknown')) throw err;
      if (err.response?.status >= 400 && err.response?.status < 500) throw err;
    }
  }
  throw new Error('Task polling timed out');
}

async function downloadTask(baseUrl, taskId, savePath) {
  for (let i = 0; i < config.DOWNLOAD_RETRIES; i++) {
    try {
      const response = await axios.get(`${baseUrl}/download/${taskId}`, {
        responseType: 'stream',
        timeout: config.DOWNLOAD_TIMEOUT_MS,
      });
      const writer = fs.createWriteStream(savePath);
      response.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      return;
    } catch (err) {
      if (i === config.DOWNLOAD_RETRIES - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, config.DOWNLOAD_RETRY_DELAY_MS));
    }
  }
}

// ========= 图片生成 =========

generateRouter.post('/image', async (req, res) => {
  try {
    const { model, prompt, size, image, images, negative_prompt, seed, num_inference_steps, gen_num } = req.body;
    const username = req.user.username;
    const genCount = Math.min(Math.max(parseInt(gen_num) || 1, 1), 4);

    if (!prompt?.trim()) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    assertOneOf(size, VALID_IMAGE_SIZES, 'size');
    assertInt(num_inference_steps || 50, 1, 100, 'num_inference_steps');

    const { width, height } = parseSize(size || '1024x1024');
    const steps = num_inference_steps || 50;
    const imageList = images && Array.isArray(images) && images.length > 0 ? images : (image ? [image] : []);
    const hasImage = imageList.length > 0;
    const pipelineName = model?.pipeline || (hasImage ? 'qwen_image_edit' : 'qwen_image');

    const generationId = createGenerationId();
    const cancelGen = () => cancelGeneration(generationId, req.user.username);
    if (req.socket) req.socket.on('close', cancelGen);
    res.on('finish', () => { if (req.socket) req.socket.removeListener('close', cancelGen); });
    const outputDir = ensureOutputDir(username);
    const tasks = [];
    const allTempFiles = [];
    const timestamp = formatTimestamp();

    const taskIds = [];
    for (let i = 0; i < genCount; i++) {
      const form = new FormData();
      form.append('prompt', prompt.trim());
      form.append('height', String(height));
      form.append('width', String(width));
      form.append('num_inference_steps', String(steps));
      form.append('pipeline_name', pipelineName);
      if (negative_prompt?.trim()) form.append('negative_prompt', negative_prompt.trim());
      if (seed !== undefined && seed !== null && seed !== '') form.append('seed', String(seed));

      for (let j = 0; j < imageList.length; j++) {
        const tmpPath = base64ToTempFile(imageList[j], 'png');
        allTempFiles.push(tmpPath);
        form.append('images', fs.createReadStream(tmpPath), {
          filename: `ref_image_${j}.png`,
          contentType: 'image/png',
        });
      }

      const filename = generateFilename(timestamp, 'img', i, 'png');
      const savePath = path.join(outputDir, filename);

      tasks.push((async () => {
        const taskId = await submitTask(config.AI_IMAGE_URL, form);
        taskIds.push(taskId);
        updateTaskStatus(generationId, taskId, 'submitted');
        if (isGenerationCancelled(generationId)) throw new Error('CANCELLED');
        await pollTask(config.AI_IMAGE_URL, taskId, generationId);
        updateTaskStatus(generationId, taskId, 'downloading');
        await downloadTask(config.AI_IMAGE_URL, taskId, savePath);
        updateTaskStatus(generationId, taskId, 'done');
        return { url: `/outputs/${username}/${filename}`, filename };
      })());
    }

    trackTask(generationId, req.user.username, taskIds);

    const results = [];
    const errors = [];
    for (const task of tasks) {
      try {
        const r = await task;
        results.push(r);
      } catch (err) {
        if (err?.message === 'CANCELLED') break;
        const errMsg = err?.message || String(err || 'Unknown error');
        errors.push(errMsg);
      }
    }

    allTempFiles.forEach(f => { try { fs.unlinkSync(f); } catch {} });
    cleanUpGeneration(generationId);

    const historyEntry = {
      type: 'image',
      model: model?.id || model || 'Qwen-Image',
      prompt: prompt.trim(),
      params: {
        prompt: prompt.trim(),
        negative_prompt: negative_prompt?.trim() || null,
        height,
        width,
        num_inference_steps: steps,
        seed: seed || null,
        pipeline_name: pipelineName,
        gen_num: genCount,
      },
      results,
    };

    if (results.length > 0) {
      const historyRecord = await addHistory(username, historyEntry);
      res.json({
        success: true,
        historyId: historyRecord.id,
        results,
        errors: errors.length > 0 ? errors : undefined,
      });
    } else {
      res.status(500).json({ error: 'All generation tasks failed', details: errors });
    }
  } catch (err) {
    allTempFiles?.forEach(f => { try { fs.unlinkSync(f); } catch {} });
    cleanUpGeneration(generationId);
    console.error('[generate] image error:', err.message);
    res.status(500).json({
      error: 'Image generation failed',
      detail: err.response?.data || err.message,
    });
  }
});

// ========= 视频生成 =========

generateRouter.post('/video', async (req, res) => {
  try {
    const { model, prompt, image_base64, image_url, negative_prompt, seed, duration, resolution, quality, enhance_prompt, audio_base64, audio_insert_position, gen_num } = req.body;
    const username = req.user.username;
    const genCount = Math.min(Math.max(parseInt(gen_num) || 1, 1), 4);

    if (!prompt?.trim()) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    assertOneOf(duration, VALID_DURATIONS, 'duration');
    assertOneOf(resolution, VALID_RESOLUTIONS, 'resolution');

    const { width, height } = parseSize(resolution || '1088x1920');
    const seconds = duration || 5;
    const frameRate = 24;
    const numFrames = Math.floor(((seconds * frameRate + 7) / 8)) * 8 + 1;
    const hasAudio = !!audio_base64;
    const hasReference = !!(image_base64 || image_url);

    let pipelineName;
    if (hasAudio) {
      pipelineName = model?.pipelineWithAudio || 'a2vid_two_stage';
    } else if (quality === 'standard' || quality === 'ti2v_two_stage') {
      pipelineName = model?.pipelineStandard || 'ti2v_two_stage';
    } else {
      pipelineName = model?.pipeline || 'ti2vid_two_stages_hq';
    }

    const generationId = createGenerationId();
    const cancelGen = () => cancelGeneration(generationId, req.user.username);
    if (req.socket) req.socket.on('close', cancelGen);
    res.on('finish', () => { if (req.socket) req.socket.removeListener('close', cancelGen); });
    const outputDir = ensureOutputDir(username);
    const timestamp = formatTimestamp();
    const tasks = [];
    const allTempFiles = [];
    const taskIds = [];

    for (let i = 0; i < genCount; i++) {
      const form = new FormData();
      form.append('prompt', prompt.trim());
      form.append('height', String(height));
      form.append('width', String(width));
      form.append('num_frames', String(numFrames));
      form.append('frame_rate', String(frameRate));
      form.append('num_inference_steps', '15');
      form.append('pipeline_name', pipelineName);
      if (negative_prompt?.trim()) form.append('negative_prompt', negative_prompt.trim());
      if (seed !== undefined && seed !== null && seed !== '') form.append('seed', String(seed));
      if (enhance_prompt) form.append('enhance_prompt', 'true');

      if (image_base64) {
        const tmpPath = base64ToTempFile(image_base64, 'png');
        allTempFiles.push(tmpPath);
        form.append('images', fs.createReadStream(tmpPath), {
          filename: 'upload_image.png',
          contentType: 'image/png',
        });
        form.append('image_idxs', '0');
        form.append('image_strengths', '1.0');
        form.append('image_crfs', '0');
      } else if (image_url) {
        const response = await axios.get(image_url, { responseType: 'arraybuffer', timeout: 60000 });
        const tmpPath = path.join(os.tmpdir(), `${uuidv4()}.png`);
        fs.writeFileSync(tmpPath, Buffer.from(response.data));
        allTempFiles.push(tmpPath);
        form.append('images', fs.createReadStream(tmpPath), {
          filename: 'input_image.png',
          contentType: 'image/png',
        });
        form.append('image_idxs', '0');
        form.append('image_strengths', '1.0');
        form.append('image_crfs', '0');
      }

      if (hasAudio) {
        const audioTmpPath = base64ToTempFile(audio_base64, 'wav');
        allTempFiles.push(audioTmpPath);
        form.append('a2v_audio_path', fs.createReadStream(audioTmpPath), {
          filename: 'input_audio.wav',
          contentType: 'audio/wav',
        });
        form.append('a2v_audio_start_time', '0.0');
        const insertTime = (seconds * (audio_insert_position || 0)) / 100;
        form.append('a2v_audio_insert_video_time', String(insertTime));
      }

      const filename = generateFilename(timestamp, 'video', i, 'mp4');
      const savePath = path.join(outputDir, filename);

      tasks.push((async () => {
        const taskId = await submitTask(config.AI_VIDEO_URL, form);
        taskIds.push(taskId);
        updateTaskStatus(generationId, taskId, 'submitted');
        if (isGenerationCancelled(generationId)) throw new Error('CANCELLED');
        await pollTask(config.AI_VIDEO_URL, taskId, generationId);
        updateTaskStatus(generationId, taskId, 'downloading');
        await downloadTask(config.AI_VIDEO_URL, taskId, savePath);
        updateTaskStatus(generationId, taskId, 'done');
        return { url: `/outputs/${username}/${filename}`, filename };
      })());
    }

    trackTask(generationId, req.user.username, taskIds);

    const results = [];
    const errors = [];
    for (const task of tasks) {
      try {
        const r = await task;
        results.push(r);
      } catch (err) {
        if (err?.message === 'CANCELLED') break;
        const errMsg = err?.message || String(err || 'Unknown error');
        console.error(`[generate] video subtask failed: ${errMsg}`);
        errors.push(errMsg);
      }
    }

    allTempFiles.forEach(f => { try { fs.unlinkSync(f); } catch {} });
    cleanUpGeneration(generationId);

    const historyEntry = {
      type: 'video',
      model: model?.id || model || 'LTX-2',
      prompt: prompt.trim(),
      params: {
        prompt: prompt.trim(),
        negative_prompt: negative_prompt?.trim() || null,
        height,
        width,
        num_frames: numFrames,
        frame_rate: frameRate,
        video_seconds: seconds,
        num_inference_steps: 15,
        seed: seed || null,
        pipeline_name: pipelineName,
        enhance_prompt: !!enhance_prompt,
        has_reference_image: hasReference,
        has_audio: hasAudio,
        audio_insert_position: audio_insert_position || 0,
        gen_num: genCount,
      },
      results,
    };

    if (results.length > 0) {
      const historyRecord = await addHistory(username, historyEntry);
      res.json({
        success: true,
        historyId: historyRecord.id,
        results,
        errors: errors.length > 0 ? errors : undefined,
      });
    } else {
      res.status(500).json({ error: 'All generation tasks failed', details: errors });
    }
  } catch (err) {
    allTempFiles?.forEach(f => { try { fs.unlinkSync(f); } catch {} });
    cleanUpGeneration(generationId);
    console.error('[generate] video error:', err.message);
    res.status(500).json({
      error: 'Video generation failed',
      detail: err.response?.data || err.message,
    });
  }
});

// ========= 关键帧插帧 =========

generateRouter.post('/interpolation', async (req, res) => {
  try {
    const { model, prompt, frames, frame_positions, frame_strengths, negative_prompt, seed, duration, resolution, quality, enhance_prompt, gen_num } = req.body;
    const username = req.user.username;
    const genCount = Math.min(Math.max(parseInt(gen_num) || 1, 1), 4);

    if (!prompt?.trim()) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      return res.status(400).json({ error: 'At least one key frame image is required' });
    }

    assertOneOf(duration, VALID_DURATIONS, 'duration');
    assertOneOf(resolution, VALID_RESOLUTIONS, 'resolution');

    const { width, height } = parseSize(resolution || '1088x1920');
    const seconds = duration || 5;
    const frameRate = 24;
    const numFrames = Math.floor(((seconds * frameRate + 7) / 8)) * 8 + 1;
    const pipelineName = model?.pipeline || 'keyframe_interpolation_two_stage';

    let positions = [];
    if (frame_positions && Array.isArray(frame_positions)) {
      positions = frame_positions.map(p => {
        const val = parseFloat(p) / 100;
        return val >= 1 ? val - 1e-16 : val;
      });
    } else {
      const n = frames.length;
      if (n === 1) positions = [0];
      else {
        const step = 1 / (n - 1);
        positions = Array.from({ length: n }, (_, i) => i * step);
      }
    }

    let strengths = [];
    if (frame_strengths && Array.isArray(frame_strengths)) {
      strengths = frame_strengths.map(s => parseFloat(s));
    } else {
      strengths = frames.map(() => 1.0);
    }

    const generationId = createGenerationId();
    const cancelGen = () => cancelGeneration(generationId, req.user.username);
    if (req.socket) req.socket.on('close', cancelGen);
    res.on('finish', () => { if (req.socket) req.socket.removeListener('close', cancelGen); });
    const outputDir = ensureOutputDir(username);
    const timestamp = formatTimestamp();
    const tasks = [];
    const allTempFiles = [];
    const taskIds = [];

    for (let g = 0; g < genCount; g++) {
      const form = new FormData();
      form.append('prompt', prompt.trim());
      form.append('height', String(height));
      form.append('width', String(width));
      form.append('num_frames', String(numFrames));
      form.append('frame_rate', String(frameRate));
      form.append('num_inference_steps', '15');
      form.append('pipeline_name', pipelineName);
      if (negative_prompt?.trim()) form.append('negative_prompt', negative_prompt.trim());
      if (seed !== undefined && seed !== null && seed !== '') form.append('seed', String(seed));
      if (enhance_prompt) form.append('enhance_prompt', 'true');

      for (let i = 0; i < frames.length; i++) {
        const tmpPath = base64ToTempFile(frames[i], 'png');
        allTempFiles.push(tmpPath);
        form.append('images', fs.createReadStream(tmpPath), {
          filename: `keyframe_${i}.png`,
          contentType: 'image/png',
        });
        form.append('image_idxs', String(positions[i]));
        form.append('image_strengths', String(strengths[i]));
        form.append('image_crfs', '0');
      }

      const filename = generateFilename(timestamp, 'interp', g, 'mp4');
      const savePath = path.join(outputDir, filename);

      tasks.push((async () => {
        const taskId = await submitTask(config.AI_VIDEO_URL, form);
        taskIds.push(taskId);
        updateTaskStatus(generationId, taskId, 'submitted');
        if (isGenerationCancelled(generationId)) throw new Error('CANCELLED');
        await pollTask(config.AI_VIDEO_URL, taskId, generationId);
        updateTaskStatus(generationId, taskId, 'downloading');
        await downloadTask(config.AI_VIDEO_URL, taskId, savePath);
        updateTaskStatus(generationId, taskId, 'done');
        return { url: `/outputs/${username}/${filename}`, filename };
      })());
    }

    trackTask(generationId, req.user.username, taskIds);

    const results = [];
    const errors = [];
    for (const task of tasks) {
      try {
        const r = await task;
        results.push(r);
      } catch (err) {
        if (err?.message === 'CANCELLED') break;
        const errMsg = err?.message || String(err || 'Unknown error');
        console.error(`[generate] interpolation subtask failed: ${errMsg}`);
        errors.push(errMsg);
      }
    }

    allTempFiles.forEach(f => { try { fs.unlinkSync(f); } catch {} });
    cleanUpGeneration(generationId);

    const historyEntry = {
      type: 'interpolation',
      model: model?.id || model || 'LTX-2',
      prompt: prompt.trim(),
      params: {
        prompt: prompt.trim(),
        negative_prompt: negative_prompt?.trim() || null,
        height,
        width,
        num_frames: numFrames,
        frame_rate: frameRate,
        video_seconds: seconds,
        num_inference_steps: 15,
        seed: seed || null,
        pipeline_name: pipelineName,
        enhance_prompt: !!enhance_prompt,
        keyframe_count: frames.length,
        gen_num: genCount,
      },
      results,
    };

    if (results.length > 0) {
      const historyRecord = await addHistory(username, historyEntry);
      res.json({
        success: true,
        historyId: historyRecord.id,
        results,
        errors: errors.length > 0 ? errors : undefined,
      });
    } else {
      res.status(500).json({ error: 'All generation tasks failed', details: errors });
    }
  } catch (err) {
    allTempFiles?.forEach(f => { try { fs.unlinkSync(f); } catch {} });
    cleanUpGeneration(generationId);
    console.error('[generate] interpolation error:', err.message);
    res.status(500).json({
      error: 'Interpolation failed',
      detail: err.response?.data || err.message,
    });
  }
});

// ========= 音频生成 =========

generateRouter.post('/audio', async (req, res) => {
  try {
    const { model, inputs, language, speaker, instruct, ref_audio_base64, emo_vector, emo_text, pipeline, gen_num, use_random, emo_audio_base64 } = req.body;
    const username = req.user.username;
    const text = inputs?.trim();
    const genCount = Math.min(Math.max(parseInt(gen_num) || 1, 1), 4);

    if (!text) {
      return res.status(400).json({ error: 'Input text is required' });
    }

    const modelId = model?.id || model || 'Qwen3-TTS';
    let baseUrl;
    let paramsRecord;
    const isIndex = modelId === 'IndexTTS-2';

    if (isIndex) {
      baseUrl = config.AI_VOICE_URL;
      if (!ref_audio_base64) {
        return res.status(400).json({
          error: 'IndexTTS-2 需要上传参考音频 (.wav) 作为音色克隆的样本，请先在参数栏上传参考音频',
        });
      }
      paramsRecord = {
        text,
        pipeline_name: model?.pipeline || 'index_tts',
        emo_vector: emo_vector || null,
        emo_text: emo_text || null,
        use_random: use_random || null,
        has_emo_audio: !!emo_audio_base64,
      };
    } else {
      baseUrl = config.AI_TTS_URL;
      const isDesign = pipeline === 'qwen_tts_voicedesign';
      const pipeName = isDesign
        ? (model?.pipelineVoiceDesign || 'qwen_tts_voicedesign')
        : (model?.pipelineCustomVoice || 'qwen_tts_customvoice');
      paramsRecord = {
        text,
        language: language || null,
        speaker: isDesign ? null : (speaker || 'Vivian'),
        instruct: instruct?.trim() || null,
        pipeline_name: pipeName,
      };
    }

    const generationId = createGenerationId();
    const cancelGen = () => cancelGeneration(generationId, req.user.username);
    if (req.socket) req.socket.on('close', cancelGen);
    res.on('finish', () => { if (req.socket) req.socket.removeListener('close', cancelGen); });
    const outputDir = ensureOutputDir(username);
    const timestamp = formatTimestamp();
    const tasks = [];
    const allTempFiles = [];
    const taskIds = [];

    for (let i = 0; i < genCount; i++) {
      const form = new FormData();
      form.append('text', text);

      if (isIndex) {
        form.append('pipeline_name', model?.pipeline || 'index_tts');
        const refTmp = base64ToTempFile(ref_audio_base64, 'wav');
        allTempFiles.push(refTmp);
        form.append('ref_audio', fs.createReadStream(refTmp), {
          filename: 'ref_audio.wav',
          contentType: 'audio/wav',
        });

        if (use_random) form.append('use_random', 'true');
        if (emo_vector && Array.isArray(emo_vector) && emo_vector.length === 8) {
          emo_vector.forEach(v => form.append('emo_vector', String(v)));
        }
        if (emo_text?.trim()) {
          form.append('use_emo_text', 'true');
          form.append('emo_text', emo_text.trim());
        }
        if (emo_audio_base64) {
          const emoTmp = base64ToTempFile(emo_audio_base64, 'wav');
          allTempFiles.push(emoTmp);
          form.append('emo_audio', fs.createReadStream(emoTmp), {
            filename: 'emo_audio.wav',
            contentType: 'audio/wav',
          });
        }
      } else {
        const isDesign = pipeline === 'qwen_tts_voicedesign';
        const pipeName = isDesign
          ? (model?.pipelineVoiceDesign || 'qwen_tts_voicedesign')
          : (model?.pipelineCustomVoice || 'qwen_tts_customvoice');
        form.append('pipeline_name', pipeName);
        if (!isDesign) form.append('speaker', speaker || 'Vivian');
        if (language) form.append('language', language);
        if (instruct?.trim()) form.append('instruct', instruct.trim());
      }

      const filename = generateFilename(timestamp, 'audio', i, 'wav');
      const savePath = path.join(outputDir, filename);

      tasks.push((async () => {
        const tid = await submitTask(baseUrl, form);
        taskIds.push(tid);
        updateTaskStatus(generationId, tid, 'submitted');
        if (isGenerationCancelled(generationId)) throw new Error('CANCELLED');
        await pollTask(baseUrl, tid, generationId);
        updateTaskStatus(generationId, tid, 'downloading');
        await downloadTask(baseUrl, tid, savePath);
        updateTaskStatus(generationId, tid, 'done');
        return { url: `/outputs/${username}/${filename}`, filename };
      })());
    }

    trackTask(generationId, req.user.username, taskIds);

    const results = [];
    const errors = [];
    for (const task of tasks) {
      try {
        const r = await task;
        results.push(r);
      } catch (err) {
        if (err?.message === 'CANCELLED') break;
        const errMsg = err?.message || String(err || 'Unknown error');
        console.error(`[generate] audio subtask failed: ${errMsg}`);
        errors.push(errMsg);
      }
    }

    allTempFiles.forEach(f => { try { fs.unlinkSync(f); } catch {} });
    cleanUpGeneration(generationId);

    const historyEntry = {
      type: 'audio',
      model: modelId,
      prompt: text,
      params: { ...paramsRecord, gen_num: genCount },
      results,
    };

    if (results.length > 0) {
      const historyRecord = await addHistory(username, historyEntry);
      res.json({
        success: true,
        historyId: historyRecord.id,
        results,
        errors: errors.length > 0 ? errors : undefined,
      });
    } else {
      res.status(500).json({ error: 'All generation tasks failed', details: errors });
    }
  } catch (err) {
    allTempFiles?.forEach(f => { try { fs.unlinkSync(f); } catch {} });
    cleanUpGeneration(generationId);
    console.error('[generate] audio error:', err.message);
    const detail = err.response?.data || err.message;
    res.status(500).json({
      error: typeof detail === 'string' ? detail : 'Audio generation failed',
      detail,
    });
  }
});

// ========= 进度与取消端点 =========

generateRouter.get('/status/:generationId', (req, res) => {
  const status = getGenerationStatus(req.params.generationId);
  if (!status) {
    return res.status(404).json({ error: 'Generation not found' });
  }
  res.json(status);
});

generateRouter.post('/cancel/:generationId', (req, res) => {
  const cancelled = cancelGeneration(req.params.generationId, req.user.username);
  if (!cancelled) {
    return res.status(404).json({ error: 'Generation not found or not owned by user' });
  }
  res.json({ success: true, message: 'Cancellation requested' });
});

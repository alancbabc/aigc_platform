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
import { translatePrompt } from '../utils/translate.js';
import { optimizePrompt } from '../utils/promptOptimizer.js';

export const generateRouter = Router();
generateRouter.use(authMiddleware);

// ========= 任务追踪系统 =========
const activeTasks = new Map();

function createGenerationId() {
  return uuidv4();
}

function trackTask(generationId, userId) {
  activeTasks.set(generationId, {
    userId,
    tasks: [],
    cancelled: false,
    createdAt: Date.now(),
  });
}

function registerTaskId(generationId, taskId) {
  const gen = activeTasks.get(generationId);
  if (gen) gen.tasks.push({ taskId, status: 'submitted', error: null });
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

function finishGeneration(generationId, error = null, payload = {}) {
  const gen = activeTasks.get(generationId);
  if (!gen) return;
  gen.completed = !error;
  gen.error = error;
  gen.finishedAt = Date.now();
  Object.assign(gen, payload);
  setTimeout(() => activeTasks.delete(generationId), 10 * 60 * 1000).unref?.();
}

function cancelGeneration(generationId, username) {
  const gen = activeTasks.get(generationId);
  if (gen && gen.userId === username) {
    gen.cancelled = true;
  }
}

function isGenerationCancelled(generationId) {
  return activeTasks.get(generationId)?.cancelled === true;
}

function getGenerationForUser(generationId, username) {
  const gen = activeTasks.get(generationId);
  if (!gen || gen.userId !== username) return null;
  return gen;
}

generateRouter.get('/:generationId/status', (req, res) => {
  const gen = getGenerationForUser(req.params.generationId, req.user.username);
  if (!gen) return res.status(404).json({ error: 'Generation not found' });
  const status = gen.cancelled
    ? 'cancelled'
    : gen.completed
      ? 'done'
      : gen.error
        ? 'failed'
        : 'generating';
  res.json({
    generationId: req.params.generationId,
    status,
    error: gen.error || null,
    tasks: gen.tasks,
    results: gen.results || null,
    historyId: gen.historyId || null,
    duration: gen.finishedAt ? gen.finishedAt - gen.createdAt : Date.now() - gen.createdAt,
  });
});

generateRouter.post('/:generationId/cancel', (req, res) => {
  const gen = getGenerationForUser(req.params.generationId, req.user.username);
  if (!gen) return res.status(404).json({ error: 'Generation not found' });
  cancelGeneration(req.params.generationId, req.user.username);
  res.json({ success: true, generationId: req.params.generationId, status: 'cancelled' });
});

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

function httpError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function base64ToTempFile(base64, ext, allowedTypes = []) {
  const matches = base64.match(/^data:(.+);base64,(.+)$/);
  if (!matches) throw httpError('Invalid base64 data');
  const mime = matches[1].split(';')[0].toLowerCase();
  if (allowedTypes.length > 0 && !allowedTypes.includes(mime)) {
    throw httpError(`Invalid file type '${mime}'. Allowed: ${allowedTypes.join(', ')}`);
  }
  const buffer = Buffer.from(matches[2], 'base64');
  if (buffer.length === 0 || buffer.length > 25 * 1024 * 1024) {
    throw httpError('Uploaded file must be 1 byte to 25MB');
  }
  const tmpPath = path.join(os.tmpdir(), `${uuidv4()}.${ext}`);
  fs.writeFileSync(tmpPath, buffer);
  return { path: tmpPath, mime };
}

function base64Mime(base64) {
  const m = base64.match(/^data:(.+);base64,/);
  return m ? m[1].split(';')[0].toLowerCase() : 'application/octet-stream';
}

function ensureOutputDir(username) {
  const dir = path.join(config.DATA_DIR, 'outputs', username);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const VALID_DURATIONS = ['3', '5', '10', '15'];
const VALID_IMAGE_SIZES = ['1024x1024', '768x768', '1328x1328', '1024x768', '768x1024', '1536x1024', '1024x1536'];
const VALID_RESOLUTIONS = ['1088x1920', '1024x1536', '1024x1024', '720x1280', '576x1024'];

function assertInt(value, min, max, field) {
  const n = parseInt(value);
  if (isNaN(n) || n < min || n > max) {
    throw Object.assign(new Error(`${field} must be ${min}-${max}`), { statusCode: 400 });
  }
  return n;
}

function assertOneOf(value, list, field) {
  if (value && !list.includes(String(value))) {
    throw httpError(`${field} '${value}' is not valid. Allowed: ${list.join(', ')}`);
  }
}

function assertArrayLength(value, expected, field) {
  if (value && (!Array.isArray(value) || value.length !== expected)) {
    throw httpError(`${field} count must match uploaded frames count`);
  }
}

const IMAGE_MODEL_PIPELINES = {
  'Qwen-Image': {
    text: 'qwen_image',
    edit: 'qwen_image_edit',
  },
  'Qwen-Image-Edit': {
    text: 'qwen_image_edit',
    edit: 'qwen_image_edit',
  },
};

const VIDEO_MODEL_PIPELINES = {
  'LTX-2': {
    standard: 'ti2v_two_stage',
    high: 'ti2vid_two_stages_hq',
    audio: 'a2vid_two_stage',
  },
};

const INTERPOLATION_MODEL_PIPELINES = {
  'LTX-2-Interpolation': {
    interpolation: 'keyframe_interpolation_two_stage',
    audio: 'a2vid_two_stage',
  },
};

const AUDIO_MODEL_PIPELINES = {
  'Qwen3-TTS': {
    customVoice: 'qwen_tts_customvoice',
    voiceDesign: 'qwen_tts_voicedesign',
  },
  'IndexTTS-2': {
    clone: 'index_tts',
  },
};

function modelIdOf(model, fallback) {
  return typeof model === 'string' ? model : (model?.id || fallback);
}

function assertKnown(id, map, field = 'model') {
  if (!map[id]) throw httpError(`${field} '${id}' is not supported`);
  return map[id];
}

function generateFilename(timestamp, prefix, index, ext) {
  return `${timestamp}_${uuidv4()}_${prefix}_${index}.${ext}`;
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
  const deadline = Date.now() + (config.POLL_TOTAL_TIMEOUT_MS || 300000);
  for (let attempt = 1; attempt <= config.MAX_POLL_ATTEMPTS && Date.now() < deadline; attempt++) {
    await new Promise(resolve => setTimeout(resolve, config.POLL_INTERVAL_MS));
    if (isGenerationCancelled(generationId)) throw new Error('CANCELLED');
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
      console.error(`[pollTask] transient AI error (attempt ${attempt}/${config.MAX_POLL_ATTEMPTS}): ${err.message}`);
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
  let allTempFiles, generationId;
  const startTime = Date.now();
  try {
    const { model, mode, prompt, size, image, images, negative_prompt, seed, num_inference_steps, gen_num } = req.body;
    const username = req.user.username;
    const genCount = Math.min(Math.max(parseInt(gen_num) || 1, 1), 4);
    const modelId = modelIdOf(model, 'Qwen-Image');
    const pipelines = assertKnown(modelId, IMAGE_MODEL_PIPELINES);

    if (!prompt?.trim()) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    assertOneOf(size || '1328x1328', VALID_IMAGE_SIZES, 'size');
    const steps = assertInt(num_inference_steps || 50, 1, 100, 'num_inference_steps');
    const { width, height } = parseSize(size || '1328x1328');
    const imageList = images && Array.isArray(images) && images.length > 0 ? images : (image ? [image] : []);
    const hasImage = imageList.length > 0;
    const isEditMode = mode === 'image-edit' || mode === 'image2image';
    if (isEditMode && !hasImage) {
      return res.status(400).json({ error: 'At least one reference image is required for image edit mode' });
    }
    const generationType = isEditMode || hasImage ? 'image-edit' : 'image';
    const pipelineName = hasImage ? pipelines.edit : pipelines.text;

    generationId = createGenerationId();
    allTempFiles = [];
    trackTask(generationId, req.user.username);
    const cancelGenImg = () => cancelGeneration(generationId, req.user.username);
    res.on('close', cancelGenImg);
    res.on('finish', () => { res.removeListener('close', cancelGenImg); });

    const outputDir = ensureOutputDir(username);
    const tasks = [];
    const timestamp = formatTimestamp();

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
        const { path: tmpPath, mime: imgMime } = base64ToTempFile(imageList[j], 'png', ['image/png', 'image/jpeg', 'image/webp']);
        allTempFiles.push(tmpPath);
        form.append('images', fs.createReadStream(tmpPath), {
          filename: `ref_image_${j}.${imgMime.split('/')[1]}`,
          contentType: imgMime,
        });
      }

      const filename = generateFilename(timestamp, 'img', i, 'png');
      const savePath = path.join(outputDir, filename);

      tasks.push((async () => {
        if (isGenerationCancelled(generationId)) throw new Error('CANCELLED');
        const taskId = await submitTask(config.AI_IMAGE_URL, form);
        registerTaskId(generationId, taskId);
        updateTaskStatus(generationId, taskId, 'submitted');
        await pollTask(config.AI_IMAGE_URL, taskId, generationId);
        updateTaskStatus(generationId, taskId, 'downloading');
        await downloadTask(config.AI_IMAGE_URL, taskId, savePath);
        updateTaskStatus(generationId, taskId, 'done');
        return { url: `/outputs/${username}/${filename}`, filename };
      })());
    }

    const results = [];
    const errors = [];
    for (const task of tasks) {
      try {
        const r = await task;
        results.push(r);
      } catch (err) {
        const errMsg = err?.message || String(err || 'Unknown error');
        errors.push(errMsg);
      }
    }

    allTempFiles.forEach(f => { try { fs.unlinkSync(f); } catch {} });
    const historyEntry = {
      type: generationType,
      model: modelId,
      prompt: prompt.trim(),
      params: {
        prompt: prompt.trim(),
        negative_prompt: negative_prompt?.trim() || null,
        height,
        width,
        num_inference_steps: steps,
        seed: (seed !== undefined && seed !== null && seed !== '') ? seed : null,
        pipeline_name: pipelineName,
        gen_num: genCount,
      },
      results,
    };

    if (results.length > 0) {
      const historyRecord = await addHistory(username, historyEntry);
      finishGeneration(generationId, null, { results, historyId: historyRecord.id });
      res.json({
        success: true,
        generationId,
        historyId: historyRecord.id,
        results,
        duration: Date.now() - startTime,
        errors: errors.length > 0 ? errors : undefined,
      });
    } else {
      finishGeneration(generationId, 'All generation tasks failed', { results, errors });
      res.status(500).json({
        error: 'All generation tasks failed',
        generationId,
        duration: Date.now() - startTime,
        details: errors,
      });
    }
  } catch (err) {
    allTempFiles?.forEach(f => { try { fs.unlinkSync(f); } catch {} });
    if (generationId) finishGeneration(generationId, err.message);
    console.error('[generate] image error:', err.message);
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      error: statusCode === 400 ? err.message : 'Image generation failed',
      duration: Date.now() - startTime,
      detail: err.response?.data || err.message,
    });
  }
});

// ========= 视频生成 =========

generateRouter.post('/video', async (req, res) => {
  let allTempFiles, generationId;
  const startTime = Date.now();
  try {
    const { model, mode, prompt, image_base64, negative_prompt, seed, duration, resolution, quality, audio_base64, audio_insert_position, gen_num } = req.body;
    const username = req.user.username;
    const genCount = Math.min(Math.max(parseInt(gen_num) || 1, 1), 4);
    const modelId = modelIdOf(model, 'LTX-2');
    const pipelines = assertKnown(modelId, VIDEO_MODEL_PIPELINES);

    if (!prompt?.trim()) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    assertOneOf(duration, VALID_DURATIONS, 'duration');
    assertOneOf(resolution || '1088x1920', VALID_RESOLUTIONS, 'resolution');
    const { width, height } = parseSize(resolution || '1088x1920');
    const seconds = duration || 5;
    const frameRate = 24;
    const numFrames = Math.floor(((seconds * frameRate + 7) / 8)) * 8 + 1;
    const hasAudio = !!audio_base64;
    const audioInsertPosition = assertInt(audio_insert_position ?? 0, 0, 100, 'audio_insert_position');
    const hasImage = !!image_base64;
    const generationType = hasImage || mode === 'image2video' ? 'image2video' : 'video';

    const pipelineName = hasAudio ? pipelines.audio : pipelines.high;
    const videoSteps = hasAudio ? 30 : 15;

    const originalPrompt = prompt.trim();
    const { text: videoPrompt, status: translationStatus } = await translatePrompt(originalPrompt);

    generationId = createGenerationId();
    allTempFiles = [];
    trackTask(generationId, req.user.username);
    const cancelGenV = () => cancelGeneration(generationId, req.user.username);
    res.on('close', cancelGenV);
    res.on('finish', () => { res.removeListener('close', cancelGenV); });

    const outputDir = ensureOutputDir(username);
    const timestamp = formatTimestamp();
    const tasks = [];

    for (let i = 0; i < genCount; i++) {
      const form = new FormData();
      form.append('prompt', videoPrompt);

      form.append('height', String(height));
      form.append('width', String(width));
      form.append('num_frames', String(numFrames));
      form.append('frame_rate', String(frameRate));
      form.append('num_inference_steps', String(videoSteps));
      form.append('pipeline_name', pipelineName);
      if (negative_prompt?.trim()) form.append('negative_prompt', negative_prompt.trim());
      if (seed !== undefined && seed !== null && seed !== '') form.append('seed', String(seed));

      if (image_base64) {
        const { path: tmpPath, mime: imgMime } = base64ToTempFile(image_base64, 'png', ['image/png', 'image/jpeg', 'image/webp']);
        allTempFiles.push(tmpPath);
        form.append('images', fs.createReadStream(tmpPath), {
          filename: 'upload_image.' + imgMime.split('/')[1],
          contentType: imgMime,
        });
        form.append('image_idxs', '0');
        form.append('image_strengths', '0.8');
        form.append('image_crfs', '0');
      }

      if (hasAudio) {
        const { path: audioTmpPath, mime: audioMime } = base64ToTempFile(audio_base64, 'wav', ['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp3']);
        allTempFiles.push(audioTmpPath);
        form.append('a2v_audio_path', fs.createReadStream(audioTmpPath), {
          filename: 'input_audio.' + audioMime.split('/')[1],
          contentType: audioMime,
        });
        form.append('a2v_audio_start_time', '0.0');
        const insertTime = (seconds * audioInsertPosition) / 100;
        form.append('a2v_audio_insert_video_time', String(insertTime));
      }

      const filename = generateFilename(timestamp, 'video', i, 'mp4');
      const savePath = path.join(outputDir, filename);

      tasks.push((async () => {
        const taskId = await submitTask(config.AI_VIDEO_URL, form);
        registerTaskId(generationId, taskId);
        updateTaskStatus(generationId, taskId, 'submitted');
        await pollTask(config.AI_VIDEO_URL, taskId, generationId);
        updateTaskStatus(generationId, taskId, 'downloading');
        await downloadTask(config.AI_VIDEO_URL, taskId, savePath);
        updateTaskStatus(generationId, taskId, 'done');
        return { url: `/outputs/${username}/${filename}`, filename };
      })());
    }

    const results = [];
    const errors = [];
    for (const task of tasks) {
      try {
        const r = await task;
        results.push(r);
      } catch (err) {
        const errMsg = err?.message || String(err || 'Unknown error');
        console.error(`[generate] video subtask failed: ${errMsg}`);
        errors.push(errMsg);
      }
    }

    allTempFiles.forEach(f => { try { fs.unlinkSync(f); } catch {} });
    const historyEntry = {
      type: generationType,
      model: modelId,
      prompt: originalPrompt || prompt.trim(),
      params: {
        prompt: originalPrompt || prompt.trim(),
        negative_prompt: negative_prompt?.trim() || null,
        height,
        width,
        num_frames: numFrames,
        frame_rate: frameRate,
        video_seconds: seconds,
        num_inference_steps: videoSteps,
        seed: (seed !== undefined && seed !== null && seed !== '') ? seed : null,
        pipeline_name: pipelineName,
        has_audio: hasAudio,
        audio_insert_position: audioInsertPosition,
        gen_num: genCount,
      },
      results,
    };

    if (results.length > 0) {
      const historyRecord = await addHistory(username, historyEntry);
      finishGeneration(generationId, null, { results, historyId: historyRecord.id });
      res.json({
        success: true,
        generationId,
        historyId: historyRecord.id,
        results,
        translatedPrompt: videoPrompt !== originalPrompt ? videoPrompt : undefined,
        translationStatus: translationStatus !== 'english_skipped' ? translationStatus : undefined,
        duration: Date.now() - startTime,
        errors: errors.length > 0 ? errors : undefined,
      });
    } else {
      finishGeneration(generationId, 'All generation tasks failed', { results, errors });
      res.status(500).json({
        error: 'All generation tasks failed',
        generationId,
        translatedPrompt: videoPrompt !== originalPrompt ? videoPrompt : undefined,
        translationStatus: translationStatus !== 'english_skipped' ? translationStatus : undefined,
        duration: Date.now() - startTime,
        details: errors,
      });
    }
  } catch (err) {
    allTempFiles?.forEach(f => { try { fs.unlinkSync(f); } catch {} });
    if (generationId) finishGeneration(generationId, err.message);
    console.error('[generate] video error:', err.message);
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      error: statusCode === 400 ? err.message : 'Video generation failed',
      duration: Date.now() - startTime,
      detail: err.response?.data || err.message,
    });
  }
});

// ========= 关键帧插帧 =========

generateRouter.post('/interpolation', async (req, res) => {
  let allTempFiles, generationId;
  const startTime = Date.now();
  try {
    const { model, prompt, frames, frame_positions, frame_strengths, negative_prompt, seed, duration, resolution, audio_base64, audio_insert_position, gen_num } = req.body;
    const username = req.user.username;
    const genCount = Math.min(Math.max(parseInt(gen_num) || 1, 1), 4);
    const modelId = modelIdOf(model, 'LTX-2-Interpolation');
    const pipelines = assertKnown(modelId, INTERPOLATION_MODEL_PIPELINES);

    if (!prompt?.trim()) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      return res.status(400).json({ error: 'At least one key frame image is required' });
    }
    if (frames.length > 10) {
      return res.status(400).json({ error: 'At most 10 key frame images are allowed' });
    }

    assertOneOf(duration, VALID_DURATIONS, 'duration');
    assertOneOf(resolution || '1088x1920', VALID_RESOLUTIONS, 'resolution');
    assertArrayLength(frame_positions, frames.length, 'frame_positions');
    assertArrayLength(frame_strengths, frames.length, 'frame_strengths');
    const { width, height } = parseSize(resolution || '1088x1920');
    const seconds = duration || 5;
    const frameRate = 24;
    const numFrames = Math.floor(((seconds * frameRate + 7) / 8)) * 8 + 1;
    const hasAudio = !!audio_base64;
    const audioInsertPosition = assertInt(audio_insert_position ?? 0, 0, 100, 'audio_insert_position');
    const pipelineName = hasAudio ? pipelines.audio : pipelines.interpolation;

    const originalPrompt = prompt.trim();
    const { text: interpPrompt, status: interpTranslation } = await translatePrompt(originalPrompt);

    generationId = createGenerationId();
    allTempFiles = [];
    trackTask(generationId, req.user.username);
    const cancelGenI = () => cancelGeneration(generationId, req.user.username);
    res.on('close', cancelGenI);
    res.on('finish', () => { res.removeListener('close', cancelGenI); });

    let positions = [];
    if (frame_positions && Array.isArray(frame_positions)) {
      positions = frame_positions.map(p => {
        const val = parseFloat(p) / 100;
        if (Number.isNaN(val) || val < 0 || val > 1) throw httpError('frame_positions must be numbers from 0 to 100');
        return Math.round((numFrames - 1) * val);
      });
    } else {
      const n = frames.length;
      if (n === 1) positions = [0];
      else if (n === 2) positions = [0, numFrames - 1];
      else {
        const step = (numFrames - 1) / (n - 1);
        positions = Array.from({ length: n }, (_, i) => Math.round(i * step));
      }
    }

    for (const pos of positions) {
      if (pos < 0 || pos >= numFrames) throw httpError(`frame position ${pos} out of range (0-${numFrames - 1})`);
    }
    for (let i = 1; i < positions.length; i++) {
      if (positions[i] <= positions[i - 1]) {
        throw httpError('frame_positions must be strictly increasing');
      }
    }

    let strengths = [];
    if (frame_strengths && Array.isArray(frame_strengths)) {
      strengths = frame_strengths.map(s => {
        const val = parseFloat(s);
        if (Number.isNaN(val) || val < 0 || val > 1) throw httpError('frame_strengths must be numbers from 0 to 1');
        return val;
      });
    } else {
      strengths = frames.map(() => 1.0);
    }

    const outputDir = ensureOutputDir(username);
    const timestamp = formatTimestamp();
    const tasks = [];

    for (let g = 0; g < genCount; g++) {
      const form = new FormData();
      form.append('prompt', interpPrompt);
      form.append('height', String(height));
      form.append('width', String(width));
      form.append('num_frames', String(numFrames));
      form.append('frame_rate', String(frameRate));
      form.append('num_inference_steps', hasAudio ? '30' : '15');
      form.append('pipeline_name', pipelineName);
      if (negative_prompt?.trim()) form.append('negative_prompt', negative_prompt.trim());
      if (seed !== undefined && seed !== null && seed !== '') form.append('seed', String(seed));

      for (let i = 0; i < frames.length; i++) {
        const { path: tmpPath, mime: imgMime } = base64ToTempFile(frames[i], 'png', ['image/png', 'image/jpeg', 'image/webp']);
        allTempFiles.push(tmpPath);
        form.append('images', fs.createReadStream(tmpPath), {
          filename: `keyframe_${i}.${imgMime.split('/')[1]}`,
          contentType: imgMime,
        });
        form.append('image_idxs', String(positions[i]));
        form.append('image_strengths', String(strengths[i]));
        form.append('image_crfs', '0');
      }

      if (hasAudio) {
        const { path: audioTmpPath, mime: audioMime } = base64ToTempFile(audio_base64, 'wav', ['audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp3']);
        allTempFiles.push(audioTmpPath);
        form.append('a2v_audio_path', fs.createReadStream(audioTmpPath), {
          filename: 'input_audio.' + audioMime.split('/')[1],
          contentType: audioMime,
        });
        form.append('a2v_audio_start_time', '0.0');
        const insertTime = (seconds * audioInsertPosition) / 100;
        form.append('a2v_audio_insert_video_time', String(insertTime));
      }

      const filename = generateFilename(timestamp, 'interp', g, 'mp4');
      const savePath = path.join(outputDir, filename);

      tasks.push((async () => {
        const taskId = await submitTask(config.AI_VIDEO_URL, form);
        registerTaskId(generationId, taskId);
        updateTaskStatus(generationId, taskId, 'submitted');
        await pollTask(config.AI_VIDEO_URL, taskId, generationId);
        updateTaskStatus(generationId, taskId, 'downloading');
        await downloadTask(config.AI_VIDEO_URL, taskId, savePath);
        updateTaskStatus(generationId, taskId, 'done');
        return { url: `/outputs/${username}/${filename}`, filename };
      })());
    }

    const results = [];
    const errors = [];
    for (const task of tasks) {
      try {
        const r = await task;
        results.push(r);
      } catch (err) {
        const errMsg = err?.message || String(err || 'Unknown error');
        console.error(`[generate] interpolation subtask failed: ${errMsg}`);
        errors.push(errMsg);
      }
    }

    allTempFiles.forEach(f => { try { fs.unlinkSync(f); } catch {} });
    const historyEntry = {
      type: 'interpolation',
      model: modelId,
      prompt: originalPrompt || prompt.trim(),
      params: {
        prompt: originalPrompt || prompt.trim(),
        negative_prompt: negative_prompt?.trim() || null,
        height,
        width,
        num_frames: numFrames,
        frame_rate: frameRate,
        video_seconds: seconds,
        num_inference_steps: hasAudio ? 30 : 15,
        seed: (seed !== undefined && seed !== null && seed !== '') ? seed : null,
        pipeline_name: pipelineName,
        keyframe_count: frames.length,
        has_audio: hasAudio,
        audio_insert_position: audioInsertPosition,
        gen_num: genCount,
      },
      results,
    };

    if (results.length > 0) {
      const historyRecord = await addHistory(username, historyEntry);
      finishGeneration(generationId, null, { results, historyId: historyRecord.id });
      res.json({
        success: true,
        generationId,
        historyId: historyRecord.id,
        results,
        translatedPrompt: interpPrompt !== originalPrompt ? interpPrompt : undefined,
        translationStatus: interpTranslation !== 'english_skipped' ? interpTranslation : undefined,
        duration: Date.now() - startTime,
        errors: errors.length > 0 ? errors : undefined,
      });
    } else {
      finishGeneration(generationId, 'All generation tasks failed', { results, errors });
      res.status(500).json({
        error: 'All generation tasks failed',
        generationId,
        translatedPrompt: interpPrompt !== originalPrompt ? interpPrompt : undefined,
        translationStatus: interpTranslation !== 'english_skipped' ? interpTranslation : undefined,
        duration: Date.now() - startTime,
        details: errors,
      });
    }
  } catch (err) {
    allTempFiles?.forEach(f => { try { fs.unlinkSync(f); } catch {} });
    if (generationId) finishGeneration(generationId, err.message);
    console.error('[generate] interpolation error:', err.message);
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
      error: statusCode === 400 ? err.message : 'Interpolation failed',
      detail: err.response?.data || err.message,
    });
  }
});

// ========= 音频生成 =========

generateRouter.post('/audio', async (req, res) => {
  let allTempFiles, generationId;
  const startTime = Date.now();
  try {
    const { model, mode, inputs, language, speaker, instruct, ref_audio_base64, emo_vector, emo_text, pipeline, gen_num, use_random, emo_audio_base64, emo_alpha } = req.body;
    const username = req.user.username;
    const text = inputs?.trim();
    const genCount = Math.min(Math.max(parseInt(gen_num) || 1, 1), 4);

    if (!text) {
      return res.status(400).json({ error: 'Input text is required' });
    }

    const modelId = modelIdOf(model, mode === 'clone' ? 'IndexTTS-2' : 'Qwen3-TTS');
    const pipelines = assertKnown(modelId, AUDIO_MODEL_PIPELINES);
    let baseUrl;
    let paramsRecord;
    const isIndex = modelId === 'IndexTTS-2';
    const generationType = isIndex ? 'clone' : 'audio';

    if (isIndex) {
      baseUrl = config.AI_VOICE_URL;
      if (!ref_audio_base64) {
        return res.status(400).json({
          error: 'IndexTTS-2 需要上传参考音频 (.wav) 作为音色克隆的样本，请先在参数栏上传参考音频',
        });
      }
      paramsRecord = {
        text,
        pipeline_name: pipelines.clone,
        emo_vector: emo_vector ?? null,
        emo_text: emo_text ?? null,
        use_random: use_random ?? null,
        emo_alpha: emo_alpha ?? null,
        has_emo_audio: !!emo_audio_base64,
      };
    } else {
      baseUrl = config.AI_TTS_URL;
      const isDesign = pipeline === 'qwen_tts_voicedesign';
      const pipeName = isDesign
        ? pipelines.voiceDesign
        : pipelines.customVoice;
      paramsRecord = {
        text,
        language: language || null,
        speaker: isDesign ? null : (speaker || 'Vivian'),
        instruct: instruct?.trim() || null,
        pipeline_name: pipeName,
      };
    }

    generationId = createGenerationId();
    allTempFiles = [];
    trackTask(generationId, req.user.username);
    const cancelGen = () => cancelGeneration(generationId, req.user.username);
    res.on('close', cancelGen);
    res.on('finish', () => { res.removeListener('close', cancelGen); });
    const outputDir = ensureOutputDir(username);
    const timestamp = formatTimestamp();
    const tasks = [];

    for (let i = 0; i < genCount; i++) {
      const form = new FormData();
      form.append('text', text);

      if (isIndex) {
        form.append('pipeline_name', pipelines.clone);
        const { path: refTmp, mime: refMime } = base64ToTempFile(ref_audio_base64, 'wav', ['audio/wav', 'audio/x-wav']);
        allTempFiles.push(refTmp);
        form.append('ref_audio', fs.createReadStream(refTmp), {
          filename: 'ref_audio.' + refMime.split('/')[1],
          contentType: refMime,
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
          const { path: emoTmp, mime: emoMime } = base64ToTempFile(emo_audio_base64, 'wav', ['audio/wav', 'audio/x-wav']);
          allTempFiles.push(emoTmp);
          form.append('emo_audio', fs.createReadStream(emoTmp), {
            filename: 'emo_audio.' + emoMime.split('/')[1],
            contentType: emoMime,
          });
          if (emo_alpha !== undefined && emo_alpha !== null) form.append('emo_alpha', String(emo_alpha));
        }
      } else {
        const isDesign = pipeline === 'qwen_tts_voicedesign';
        const pipeName = isDesign
          ? pipelines.voiceDesign
          : pipelines.customVoice;
        form.append('pipeline_name', pipeName);
        if (!isDesign) form.append('speaker', speaker || 'Vivian');
        if (language) form.append('language', language);
        if (instruct?.trim()) form.append('instruct', instruct.trim());
      }

      const filename = generateFilename(timestamp, 'audio', i, 'wav');
      const savePath = path.join(outputDir, filename);

      tasks.push((async () => {
        const tid = await submitTask(baseUrl, form);
        registerTaskId(generationId, tid);
        updateTaskStatus(generationId, tid, 'submitted');
        if (isGenerationCancelled(generationId)) throw new Error('CANCELLED');
        await pollTask(baseUrl, tid, generationId);
        updateTaskStatus(generationId, tid, 'downloading');
        await downloadTask(baseUrl, tid, savePath);
        updateTaskStatus(generationId, tid, 'done');
        return { url: `/outputs/${username}/${filename}`, filename };
      })());
    }

    const results = [];
    const errors = [];
    for (const task of tasks) {
      try {
        const r = await task;
        results.push(r);
      } catch (err) {
        const errMsg = err?.message || String(err || 'Unknown error');
        console.error(`[generate] audio subtask failed: ${errMsg}`);
        errors.push(errMsg);
      }
    }

    allTempFiles.forEach(f => { try { fs.unlinkSync(f); } catch {} });
    const historyEntry = {
      type: generationType,
      model: modelId,
      prompt: text,
      params: { ...paramsRecord, gen_num: genCount },
      results,
    };

    if (results.length > 0) {
      const historyRecord = await addHistory(username, historyEntry);
      finishGeneration(generationId, null, { results, historyId: historyRecord.id });
      res.json({
        success: true,
        generationId,
        historyId: historyRecord.id,
        results,
        duration: Date.now() - startTime,
        errors: errors.length > 0 ? errors : undefined,
      });
    } else {
      finishGeneration(generationId, 'All generation tasks failed', { results, errors });
      res.status(500).json({
        error: 'All generation tasks failed',
        generationId,
        duration: Date.now() - startTime,
        details: errors,
      });
    }
  } catch (err) {
    allTempFiles?.forEach(f => { try { fs.unlinkSync(f); } catch {} });
    if (generationId) finishGeneration(generationId, err.message);
    console.error('[generate] audio error:', err.message);
    const detail = err.response?.data || err.message;
    res.status(err.statusCode || 500).json({
      error: typeof detail === 'string' ? detail : 'Audio generation failed',
      duration: Date.now() - startTime,
      detail,
    });
  }
});

// ========= Prompt 优化 =========

generateRouter.post('/optimize-prompt', async (req, res) => {
  try {
    const { prompt, type, model } = req.body;
    if (!prompt?.trim()) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    const result = await optimizePrompt(prompt.trim(), type || 'video', model);
    res.json(result);
  } catch (err) {
    console.error('[generate] optimize error:', err.message);
    res.status(500).json({ error: 'Prompt optimization failed', detail: err.message });
  }
});

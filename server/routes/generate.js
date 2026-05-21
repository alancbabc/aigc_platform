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

async function urlToTempFile(url, ext) {
  const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
  const tmpPath = path.join(os.tmpdir(), `${uuidv4()}.${ext}`);
  fs.writeFileSync(tmpPath, Buffer.from(response.data));
  return tmpPath;
}

function ensureOutputDir(username) {
  const dir = path.join(config.DATA_DIR, 'outputs', username);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ========= 自部署 API 通用异步模式 (submit → poll → download) =========

async function submitTask(baseUrl, formData) {
  const headers = formData.getHeaders ? formData.getHeaders() : {};
  const response = await axios.post(`${baseUrl}/submit`, formData, {
    headers,
    timeout: 120000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
  if (response.data.status !== 'submitted') {
    throw new Error(`Submit failed: ${JSON.stringify(response.data)}`);
  }
  return response.data.task_id;
}

async function pollTask(baseUrl, taskId, interval = 20000, maxAttempts = 150) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, interval));
    try {
      const response = await axios.get(`${baseUrl}/status/${taskId}`, { timeout: 10000 });
      const s = response.data;
      if (s.status === 'done') return;
      if (s.status === 'error') throw new Error(`Task failed: ${JSON.stringify(s)}`);
      if (s.status === 'running' || s.status === 'queued') continue;
      throw new Error(`Unknown status: ${s.status}`);
    } catch (err) {
      if (err.message.startsWith('Task failed') || err.message.startsWith('Unknown')) throw err;
      if (err.response?.status >= 400 && err.response?.status < 500) throw err;
    }
  }
  throw new Error('Task polling timed out');
}

async function downloadTask(baseUrl, taskId, savePath) {
  for (let i = 0; i < 3; i++) {
    try {
      const response = await axios.get(`${baseUrl}/download/${taskId}`, {
        responseType: 'stream',
        timeout: 180000,
      });
      const writer = fs.createWriteStream(savePath);
      response.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
      return;
    } catch (err) {
      if (i === 2) throw err;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// ========= 图片生成 (Qwen Image :9000) =========

generateRouter.post('/image', async (req, res) => {
  try {
    const { model, prompt, size, image, negative_prompt, seed, num_inference_steps } = req.body;
    const username = req.user.username;

    if (!prompt?.trim()) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const { width, height } = parseSize(size || '1024x1024');
    const steps = num_inference_steps || 50;
    const hasImage = !!image;

    const form = new FormData();
    form.append('prompt', prompt.trim());
    form.append('height', String(height));
    form.append('width', String(width));
    form.append('num_inference_steps', String(steps));
    form.append('pipeline_name', hasImage ? 'qwen_image_edit' : 'qwen_image');
    if (negative_prompt?.trim()) form.append('negative_prompt', negative_prompt.trim());
    if (seed !== undefined && seed !== null && seed !== '') form.append('seed', String(seed));

    let tempFiles = [];
    if (hasImage) {
      const tmpPath = base64ToTempFile(image, 'png');
      tempFiles.push(tmpPath);
      form.append('images', fs.createReadStream(tmpPath), {
        filename: 'ref_image.png',
        contentType: 'image/png',
      });
    }

    const taskId = await submitTask(config.AI_IMAGE_URL, form);
    await pollTask(config.AI_IMAGE_URL, taskId);

    const outputDir = ensureOutputDir(username);
    const filename = `${formatTimestamp()}_img.png`;
    const savePath = path.join(outputDir, filename);
    await downloadTask(config.AI_IMAGE_URL, taskId, savePath);

    tempFiles.forEach(f => { try { fs.unlinkSync(f); } catch {} });

    const historyEntry = {
      type: 'image',
      model: model || 'Qwen-Image',
      prompt: prompt.trim(),
      params: {
        prompt: prompt.trim(),
        negative_prompt: negative_prompt?.trim() || null,
        height,
        width,
        num_inference_steps: steps,
        seed: seed || null,
        pipeline_name: hasImage ? 'qwen_image_edit' : 'qwen_image',
      },
      results: [{ url: `/outputs/${username}/${filename}`, filename }],
    };
    const historyRecord = await addHistory(username, historyEntry);

    res.json({
      success: true,
      historyId: historyRecord.id,
      results: [{ url: `/outputs/${username}/${filename}` }],
    });
  } catch (err) {
    console.error('[generate] image error:', err.message);
    res.status(500).json({
      error: 'Image generation failed',
      detail: err.response?.data || err.message,
    });
  }
});

// ========= 视频生成 (LTX 2.3 :8000) =========

generateRouter.post('/video', async (req, res) => {
  try {
    const { model, prompt, image_base64, image_url, negative_prompt, seed, duration, resolution, quality, enhance_prompt } = req.body;
    const username = req.user.username;

    if (!prompt?.trim()) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const { width, height } = parseSize(resolution || '1088x1920');
    const seconds = duration || 5;
    const frameRate = 24;
    const numFrames = Math.floor(((seconds * frameRate + 7) / 8)) * 8 + 1;
    const pipelineName = quality === 'standard' ? 'ti2v_two_stage' : 'ti2vid_two_stages_hq';

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

    let tempFiles = [];
    // 优先使用上传的 base64 图片，其次使用 URL
    const hasReference = !!(image_base64 || image_url);
    if (image_base64) {
      const tmpPath = base64ToTempFile(image_base64, 'png');
      tempFiles.push(tmpPath);
      form.append('images', fs.createReadStream(tmpPath), {
        filename: 'upload_image.png',
        contentType: 'image/png',
      });
      form.append('image_idxs', '0');
      form.append('image_strengths', '1.0');
      form.append('image_crfs', '0');
    } else if (image_url) {
      const tmpPath = await urlToTempFile(image_url, 'png');
      tempFiles.push(tmpPath);
      form.append('images', fs.createReadStream(tmpPath), {
        filename: 'input_image.png',
        contentType: 'image/png',
      });
      form.append('image_idxs', '0');
      form.append('image_strengths', '1.0');
      form.append('image_crfs', '0');
    }

    const taskId = await submitTask(config.AI_VIDEO_URL, form);
    await pollTask(config.AI_VIDEO_URL, taskId);

    const outputDir = ensureOutputDir(username);
    const filename = `${formatTimestamp()}_video.mp4`;
    const savePath = path.join(outputDir, filename);
    await downloadTask(config.AI_VIDEO_URL, taskId, savePath);

    tempFiles.forEach(f => { try { fs.unlinkSync(f); } catch {} });

    const historyEntry = {
      type: 'video',
      model: model || 'LTX-2',
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
      },
      results: [{ url: `/outputs/${username}/${filename}`, filename }],
    };
    const historyRecord = await addHistory(username, historyEntry);

    res.json({
      success: true,
      historyId: historyRecord.id,
      results: [{ url: `/outputs/${username}/${filename}` }],
    });
  } catch (err) {
    console.error('[generate] video error:', err.message);
    res.status(500).json({
      error: 'Video generation failed',
      detail: err.response?.data || err.message,
    });
  }
});

// ========= 音频生成 =========
// Qwen3-TTS → Qwen TTS (:9200), IndexTTS-2 → Index TTS (:9300)

generateRouter.post('/audio', async (req, res) => {
  try {
    const { model, inputs, language, speaker, instruct, ref_audio_base64, emo_vector, emo_text } = req.body;
    const username = req.user.username;
    const text = inputs?.trim();

    if (!text) {
      return res.status(400).json({ error: 'Input text is required' });
    }

    const modelId = model || 'Qwen3-TTS';
    let taskId;
    let tempFiles = [];
    let baseUrl;
    let paramsRecord;

    if (modelId === 'IndexTTS-2') {
      // ---- Index TTS (人声克隆) ----
      baseUrl = config.AI_VOICE_URL;

      if (!ref_audio_base64) {
        return res.status(400).json({
          error: 'IndexTTS-2 需要上传参考音频 (.wav) 作为音色克隆的样本，请先在参数栏上传参考音频',
        });
      }

      const form = new FormData();
      form.append('text', text);
      form.append('pipeline_name', 'index_tts');

      const tmpPath = base64ToTempFile(ref_audio_base64, 'wav');
      tempFiles.push(tmpPath);
      form.append('ref_audio', fs.createReadStream(tmpPath), {
        filename: 'ref_audio.wav',
        contentType: 'audio/wav',
      });

      if (emo_vector && Array.isArray(emo_vector) && emo_vector.length === 8) {
        emo_vector.forEach(v => form.append('emo_vector', String(v)));
      }
      if (emo_text?.trim()) {
        form.append('use_emo_text', 'true');
        form.append('emo_text', emo_text.trim());
      }

      taskId = await submitTask(baseUrl, form);
      await pollTask(baseUrl, taskId);

      paramsRecord = {
        text,
        pipeline_name: 'index_tts',
        emo_vector: emo_vector || null,
        emo_text: emo_text || null,
      };
    } else {
      // ---- Qwen TTS (预设音色) ----
      baseUrl = config.AI_TTS_URL;
      const form = new FormData();
      form.append('text', text);
      form.append('pipeline_name', 'qwen_tts_customvoice');
      form.append('speaker', speaker || 'Vivian');
      if (language) form.append('language', language);
      if (instruct?.trim()) form.append('instruct', instruct.trim());

      taskId = await submitTask(baseUrl, form);
      await pollTask(baseUrl, taskId);

      paramsRecord = {
        text,
        language: language || null,
        speaker: speaker || 'Vivian',
        instruct: instruct?.trim() || null,
        pipeline_name: 'qwen_tts_customvoice',
      };
    }

    const outputDir = ensureOutputDir(username);
    const filename = `${formatTimestamp()}_audio.wav`;
    const savePath = path.join(outputDir, filename);
    await downloadTask(baseUrl, taskId, savePath);

    tempFiles.forEach(f => { try { fs.unlinkSync(f); } catch {} });

    const historyEntry = {
      type: 'audio',
      model: modelId,
      prompt: text,
      params: paramsRecord,
      results: [{ url: `/outputs/${username}/${filename}`, filename }],
    };
    const historyRecord = await addHistory(username, historyEntry);

    res.json({
      success: true,
      historyId: historyRecord.id,
      results: [{ url: `/outputs/${username}/${filename}` }],
    });
  } catch (err) {
    console.error('[generate] audio error:', err.message);
    const detail = err.response?.data || err.message;
    res.status(500).json({
      error: typeof detail === 'string' ? detail : 'Audio generation failed',
      detail,
    });
  }
});

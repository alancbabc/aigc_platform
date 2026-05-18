import { Router } from 'express';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import { authMiddleware } from '../middleware/auth.js';
import { addHistory } from '../services/historyStore.js';

export const generateRouter = Router();
generateRouter.use(authMiddleware);

const POLL_INTERVAL = 3000;
const POLL_MAX_ATTEMPTS = 300;

function getAuthHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.AI_API_TOKEN}`,
  };
}

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

async function downloadAndSave(url, username, filename) {
  const filePath = path.join(config.DATA_DIR, 'outputs', username, filename);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 120000 });
  fs.writeFileSync(filePath, Buffer.from(response.data));
  return filePath;
}

async function pollAsyncTask(taskUrl, maxAttempts = POLL_MAX_ATTEMPTS, interval = POLL_INTERVAL) {
  let consecutiveErrors = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, interval));
    try {
      const response = await axios.get(taskUrl, {
        headers: { 'Authorization': `Bearer ${config.AI_API_TOKEN}` },
        timeout: 10000,
      });
      consecutiveErrors = 0;
      const data = response.data;
      const status = data.status;
      if (status === 'success') {
        return data;
      }
      if (status === 'failure' || status === 'cancelled') {
        throw new Error(`Task failed with status: ${status}`);
      }
    } catch (err) {
      if (err.response?.status >= 400 && err.response?.status < 500) {
        throw err;
      }
      if (err.response?.status >= 500) {
        consecutiveErrors++;
        if (consecutiveErrors > 5) throw err;
        continue;
      }
      consecutiveErrors++;
      if (consecutiveErrors > 10) throw new Error('Task polling failed due to persistent network errors');
    }
  }
  throw new Error('Task polling timed out');
}

// POST /api/generate/image — 同步
generateRouter.post('/image', async (req, res) => {
  try {
    const { model, prompt, size, image } = req.body;
    const username = req.user.username;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    if (prompt.length > 5000) {
      return res.status(400).json({ error: 'Prompt must be under 5000 characters' });
    }

    const body = {
      model: model || 'FLUX.1-dev',
      prompt: prompt.trim(),
      size: size || '1024x1024',
      image: image || undefined,
      n: 1,
      response_format: 'url',
    };

    const aiResponse = await axios.post(
      `${config.AI_API_BASE_URL}/v1/images/generations`,
      body,
      {
        headers: getAuthHeaders(),
        timeout: 120000,
      }
    );

    const resultData = aiResponse.data;
    const items = Array.isArray(resultData.data)
      ? resultData.data
      : Array.isArray(resultData)
        ? resultData
        : [resultData];

    const savedFiles = [];
    for (const [i, item] of items.entries()) {
      const filename = `${formatTimestamp()}_img_${i}.png`;
      if (item.url) {
        const filePath = await downloadAndSave(item.url, username, filename);
        savedFiles.push({ url: `/outputs/${username}/${filename}`, filePath, filename });
      } else if (item.b64_json) {
        const filePath = path.join(config.DATA_DIR, 'outputs', username, filename);
        fs.writeFileSync(filePath, Buffer.from(item.b64_json, 'base64'));
        savedFiles.push({ url: `/outputs/${username}/${filename}`, filePath, filename });
      }
    }

    const historyEntry = {
      type: 'image',
      model: model || 'FLUX.1-dev',
      prompt,
      size: size || '1024x1024',
      results: savedFiles.map(f => ({ url: f.url, filename: f.filename })),
    };
    const historyRecord = addHistory(username, historyEntry);

    res.json({
      success: true,
      historyId: historyRecord.id,
      results: savedFiles.map(f => ({ url: f.url })),
    });
  } catch (err) {
    console.error('[generate] image error:', err.message);
    const status = err.response?.status || 500;
    const detail = err.response?.data?.error || err.response?.data?.detail || err.message;
    res.status(status).json({
      error: 'Image generation failed',
      detail,
    });
  }
});

// POST /api/generate/video — 异步提交+轮询
generateRouter.post('/video', async (req, res) => {
  try {
    const { model, prompt, image_url } = req.body;
    const username = req.user.username;

    if (!prompt?.trim() && !image_url?.trim()) {
      return res.status(400).json({ error: 'Prompt or image URL is required' });
    }

    const submitResponse = await axios.post(
      `${config.AI_API_BASE_URL}/v1/async/videos/image-to-video`,
      {
        model: model || 'LTX-2',
        prompt: prompt || '',
        image_url: image_url || '',
      },
      {
        headers: getAuthHeaders(),
        timeout: 30000,
      }
    );

    const submitData = submitResponse.data;
    if (!submitData.task_id || !submitData.urls?.get) {
      throw new Error('Invalid async task response');
    }

    const resultData = await pollAsyncTask(submitData.urls.get);

    const videoUrl = resultData.output?.url || resultData.output?.video_url || '';
    if (!videoUrl) {
      throw new Error('No video URL in task output');
    }

    const filename = `${formatTimestamp()}_video.mp4`;
    const filePath = await downloadAndSave(videoUrl, username, filename);

    const historyEntry = {
      type: 'video',
      model: model || 'LTX-2',
      prompt: prompt || '',
      results: [{ url: `/outputs/${username}/${filename}`, filename }],
    };
    const historyRecord = addHistory(username, historyEntry);

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

// POST /api/generate/audio — 异步提交+轮询
generateRouter.post('/audio', async (req, res) => {
  try {
    const { model, inputs, prompt_text, prompt_audio_url, gender, pitch, speed } = req.body;
    const username = req.user.username;

    if (!inputs?.trim() && !prompt_text?.trim()) {
      return res.status(400).json({ error: 'Inputs or prompt text is required' });
    }

    const body = {
      model: model || 'IndexTTS-2',
      inputs: inputs || '',
    };
    if (prompt_text) body.prompt_text = prompt_text;
    if (prompt_audio_url) body.prompt_audio_url = prompt_audio_url;
    if (gender) body.gender = gender;
    if (pitch) body.pitch = pitch;
    if (speed) body.speed = speed;

    const submitResponse = await axios.post(
      `${config.AI_API_BASE_URL}/v1/async/audio/speech`,
      body,
      {
        headers: getAuthHeaders(),
        timeout: 30000,
      }
    );

    const submitData = submitResponse.data;
    if (!submitData.task_id || !submitData.urls?.get) {
      throw new Error('Invalid async task response');
    }

    const resultData = await pollAsyncTask(submitData.urls.get);

    const audioUrl = resultData.output?.url || resultData.output?.audio_url || '';
    if (!audioUrl) {
      throw new Error('No audio URL in task output');
    }

    const filename = `${formatTimestamp()}_audio.mp3`;
    const filePath = await downloadAndSave(audioUrl, username, filename);

    const historyEntry = {
      type: 'audio',
      model: model || 'IndexTTS-2',
      prompt: inputs || '',
      results: [{ url: `/outputs/${username}/${filename}`, filename }],
    };
    const historyRecord = addHistory(username, historyEntry);

    res.json({
      success: true,
      historyId: historyRecord.id,
      results: [{ url: `/outputs/${username}/${filename}` }],
    });
  } catch (err) {
    console.error('[generate] audio error:', err.message);
    res.status(500).json({
      error: 'Audio generation failed',
      detail: err.response?.data || err.message,
    });
  }
});

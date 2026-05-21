# 变更记录

## 阶段一：第三方 API → 自部署 API 迁移

## 概述

将 aigc-platform 的 AI 生成能力从 ai.gitee.com 第三方 API 替换为自部署服务。

## 架构变化

```
旧: React → Express → ai.gitee.com (JSON REST + Bearer Token)
新: React → Express → 自部署服务 (multipart/form-data, 异步 submit → poll → download)
```

## 自部署服务地址

| 服务 | 配置键 | 默认地址 | 端口 |
|------|--------|---------|------|
| 图片生成 (Qwen Image) | `AI_IMAGE_URL` | `http://10.42.1.2:9000` | 9000 |
| 视频生成 (LTX 2.3) | `AI_VIDEO_URL` | `http://10.42.1.2:8000` | 8000 |
| TTS (Qwen TTS) | `AI_TTS_URL` | `http://10.42.1.2:9200` | 9200 |
| 人声克隆 (Index TTS) | `AI_VOICE_URL` | `http://10.42.1.2:9300` | 9300 |

## 修改文件清单

### 1. `server/config.js`
- **旧**: `AI_API_BASE_URL`、`AI_API_TOKEN`
- **新**: `AI_IMAGE_URL`、`AI_VIDEO_URL`、`AI_TTS_URL`、`AI_VOICE_URL`
- 移除了 token 认证配置（内网无需鉴权）

### 2. `package.json`
- 新增依赖: `form-data` ^4.0.5（用于构建 multipart 请求）

### 3. `server/routes/generate.js` — 核心重写

**协议变更**: JSON REST → multipart/form-data + 异步 submit → poll → download

**通用工具函数**:
- `base64ToTempFile(base64, ext)` — base64 转临时文件
- `urlToTempFile(url, ext)` — URL 下载为临时文件
- `submitTask(baseUrl, formData)` — POST multipart 提交任务
- `pollTask(baseUrl, taskId)` — 轮询 status 直到 done（间隔 20s，最长 150 次≈50min）
- `downloadTask(baseUrl, taskId, savePath)` — 下载结果文件（重试 3 次）

**图片生成 POST /api/generate/image**:
- 请求参数: `model`, `prompt`, `size`, `image`(base64), `negative_prompt`, `seed`, `num_inference_steps`
- 后端解析 `size` → `height`/`width`，base64 → 临时文件
- pipeline: 有参考图 → `qwen_image_edit`，无 → `qwen_image`
- 调用: `POST :9000/submit` → `GET :9000/status/{taskId}` → `GET :9000/download/{taskId}`

**视频生成 POST /api/generate/video**:
- 请求参数: `model`, `prompt`, `image_url`, `negative_prompt`, `seed`, `duration`, `resolution`, `quality`, `enhance_prompt`
- `duration`(秒) × `frameRate`(24) → `num_frames`（对齐到 8n+1）
- `quality` → `pipeline_name`: `standard` → `ti2v_two_stage`, `high` → `ti2vid_two_stages_hq`
- 参考图: `image_url` 下载为临时文件 + `image_idxs=0` + `image_strengths=1.0`
- 调用: `POST :8000/submit` → `GET :8000/status/{taskId}` → `GET :8000/download/{taskId}`

**音频生成 POST /api/generate/audio**:
- 根据 model 分派:
  - `Qwen3-TTS` → `AI_TTS_URL` (:9200), pipeline=`qwen_tts_customvoice`
  - `IndexTTS-2` → `AI_VOICE_URL` (:9300), pipeline=`index_tts`
- QwenTTS 参数: `text`, `language`, `speaker`, `instruct`
- IndexTTS 参数: `text`, `ref_audio_base64`, `emo_vector`(8维), `emo_text`

### 4. `src/data/models.js` — 模型定义重写

**图片模型**: 8 个第三方模型 → 1 个 `Qwen-Image`
- 新增: `supportsNegativePrompt`, `supportsSeed`, `supportsInferenceSteps`, `inferenceStepOptions`
- 尺寸: 7 种可选

**视频模型**: 4 个第三方 → 1 个 `LTX-2` (LTX 2.3)
- 新增: `supportsNegativePrompt`, `supportsSeed`, `supportsEnhancePrompt`
- 新增: `qualities`(标准/高质量), `resolutions`, `durations`

**音频模型**: 5 个第三方 → 2 个自部署
- `Qwen3-TTS`: `supportsSpeaker`, `supportsLanguage`, `supportsInstruct`, `speakers`(9个预设), `languages`
- `IndexTTS-2`: `supportsRefAudio`, `supportsEmotionVector`, `supportsEmotionAudio`, `supportsEmotionText`, `emotionLabels`

### 5. `src/components/studio/ImageStudio.jsx`
- 新增: **负向提示词** textarea
- 新增: **Seed** 数字输入
- 新增: **推理步数** dropdown (20/30/50)

### 6. `src/components/studio/VideoStudio.jsx`
- 新增: **质量** dropdown (标准/高质量)
- 新增: **分辨率** dropdown (1088x1920 等)
- 新增: **时长** dropdown (3/5/10/15s)
- 新增: **负向提示词** textarea
- 新增: **Seed** 数字输入
- 新增: **增强提示词** toggle

### 7. `src/components/studio/AudioStudio.jsx`
- **Qwen3-TTS 模式**: 语言 dropdown, 音色 dropdown(9个预设), 音色描述 textarea
- **IndexTTS-2 模式**: 参考音频上传, 8维情绪向量滑块, 情绪参考文本 textarea

### 8. `src/components/history/HistoryDetail.jsx`
- 新增: 动态遍历 `item.params` 渲染所有生成参数
- `paramLabels` 中文映射表
- `formatParamValue` 智能格式化（emo_vector 显示为逗号分隔, boolean 显示为"是/否"）

## History 存储结构

每次生成除原有字段外，新增 `params` 对象存储所有参数:

```js
// 示例：图片
{
  id: "uuid",
  type: "image",
  model: "Qwen-Image",
  prompt: "...",
  params: {
    prompt: "...",
    negative_prompt: "...",
    height: 1024,
    width: 1024,
    num_inference_steps: 50,
    seed: 42,
    pipeline_name: "qwen_image"
  },
  results: [{ url: "/outputs/.../xxx_img.png", filename: "xxx_img.png" }],
  createdAt: "2026-05-21T..."
}
```

## 删除的第三方功能

- **图片模型**: FLUX.1-dev, FLUX.2-klein-4B, Kolors, GLM-Image, SD 3.5, HiDream, Z-Image Turbo
- **视频模型**: CogVideoX-5b, Wan2.1-I2V, OpenSora-I2V
- **音频模型**: Spark-TTS-0.5B, CosyVoice3, AudioFly
- **认证**: `AI_API_TOKEN`（内网无需 token）
- **旧轮询**: 3s 间隔 → 改为 20s（与自部署服务匹配）

---

## 阶段二：高优先级安全漏洞修复

### 漏洞 #1 — JWT 密钥弱默认值
- **问题**: `.env` 中 `JWT_SECRET=change-this-to-a-random-secret-in-production` 是弱默认值
- **修复**: `server/config.js` 增加启动警告，`.env` 使用新随机密钥

### 漏洞 #2 — `.env` 残留旧 API Token
- **问题**: `AI_API_TOKEN=VBNKGIO...` 仍留在 `.env` 中（泄露风险）
- **修复**: 清理 `.env`，移除 `AI_API_BASE_URL` 和 `AI_API_TOKEN`，替换为新的自部署服务配置

### 漏洞 #3 — `/outputs` 静态文件无鉴权
- **问题**: `express.static` 直接暴露所有生成文件，知道 URL 即可访问
- **修复**: `server/index.js` 添加中间件验证 JWT，且只能访问自己目录的文件
- **前端**: `src/api/client.js` 新增 `getMediaUrl()` 自动追加 `?token=`，所有组件改用此函数获取媒体 URL

### 漏洞 #4 — 登录注册无频率限制
- **问题**: 可暴力破解密码
- **修复**: `server/routes/auth.js` 添加 `express-rate-limit`，15 分钟内最多 20 次尝试

### 漏洞 #5 — JSON 文件并发写入竞态
- **问题**: `read + write` 模式在并发时可能覆盖丢失数据
- **修复**:
  - 新增 `server/utils/fileStore.js`：原子写入（写临时文件 → rename）+ 内存锁
  - `services/userStore.js`：改用 `readJSON`/`writeJSON`，`createUser` 改为 async
  - `services/historyStore.js`：`addHistory`/`deleteHistory` 改为 async 原子写入
  - 路由层：`generate.js` 中 `addHistory` 添加 await；`history.js` 中 `deleteHistory` 添加 await；`auth.js` 中 `createUser` 添加 await

### 新增文件
- `server/utils/fileStore.js` — 原子 JSON 读写工具（内存锁 + 临时文件重命名）

### 新增依赖
- `express-rate-limit` ^7.5.0

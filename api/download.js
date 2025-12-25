const axios = require('axios');

// Helper untuk mendapatkan User-Agent random
const getUserAgent = () => {
  const agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ];
  return agents[Math.floor(Math.random() * agents.length)];
};

module.exports = async (req, res) => {
  // CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only POST allowed
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Use POST.'
    });
  }

  try {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'URL TikTok wajib diisi'
      });
    }

    // Validasi URL TikTok
    const tiktokPattern = /^(https?:\/\/)?(www\.|vt\.)?(tiktok\.com)\/.+/i;
    if (!tiktokPattern.test(url) && !url.includes('vt.tiktok.com')) {
      return res.status(400).json({
        success: false,
        message: 'URL TikTok tidak valid'
      });
    }

    const payload = {
      query: url,
      language_id: "2"
    };

    // Konfigurasi axios dengan timeout
    const axiosConfig = {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'User-Agent': getUserAgent(),
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://ttsave.app/',
        'Origin': 'https://ttsave.app'
      },
      timeout: 15000 // 15 detik timeout
    };

    const response = await axios.post('https://ttsave.app/download', payload, axiosConfig);
    const data = response.data;

    // Multiple patterns untuk mengekstrak URL audio
    const patterns = [
      /href="(https:\/\/v16-ies-music\.tiktokcdn\.com\/[^"]+)"/,
      /href="(https:\/\/sf[0-9]+\.tiktokcdn\.com\/[^"]+\.mp3)"/,
      /"music":"([^"]+\.mp3)"/,
      /audioUrl":"([^"]+)"/,
      /(https:\/\/[^"]+\.mp3)/g
    ];

    let audioUrl = null;
    
    for (const pattern of patterns) {
      const match = data.match(pattern);
      if (match) {
        audioUrl = match[1] || match[0];
        if (audioUrl && (audioUrl.includes('.mp3') || audioUrl.includes('tiktokcdn.com'))) {
          break;
        }
      }
    }

    if (!audioUrl) {
      return res.status(404).json({
        success: false,
        message: 'Audio tidak ditemukan. Pastikan video memiliki audio.'
      });
    }

    const timestamp = Date.now();
    const filename = `tiktok_audio_${timestamp}.mp3`;

    res.json({
      success: true,
      message: 'Audio berhasil diambil!',
      audioUrl: audioUrl,
      downloadUrl: `/api/proxy-audio?url=${encodeURIComponent(audioUrl)}&filename=${filename}`,
      directUrl: audioUrl,
      filename: filename,
      timestamp: timestamp
    });

  } catch (error) {
    console.error('Download Error:', error.message);

    let errorMessage = 'Terjadi kesalahan saat memproses TikTok URL';
    let statusCode = 500;

    if (error.code === 'ECONNABORTED') {
      errorMessage = 'Timeout: Proses terlalu lama. Coba lagi.';
      statusCode = 504;
    } else if (error.response) {
      errorMessage = `Error ${error.response.status}: ${error.response.statusText}`;
      statusCode = error.response.status;
    } else if (error.request) {
      errorMessage = 'Tidak ada respons dari server TikTok';
      statusCode = 503;
    }

    res.status(statusCode).json({
      success: false,
      message: errorMessage
    });
  }
};

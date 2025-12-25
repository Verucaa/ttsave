const axios = require('axios');

// Fungsi helper untuk mendapatkan user agent acak
function getRandomUserAgent() {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0'
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

module.exports = async (req, res) => {
  // Set CORS headers untuk Node.js 20/24
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed. Use POST.' 
    });
  }

  try {
    // Parse body dengan error handling
    let body;
    try {
      if (typeof req.body === 'string') {
        body = JSON.parse(req.body);
      } else {
        body = req.body;
      }
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON format in request body'
      });
    }

    const { url } = body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'URL TikTok wajib diisi dan harus berupa string'
      });
    }

    // Validasi URL TikTok dengan regex yang lebih ketat
    const tiktokUrlPattern = /^(https?:\/\/)?(www\.|vm\.|vt\.)?(tiktok\.com|tiktokv\.com)\/(@[\w.-]+\/video\/\d+|[\w./?=&%-]+)/i;
    
    if (!tiktokUrlPattern.test(url) && !url.includes('tiktok.com') && !url.includes('vt.tiktok.com')) {
      return res.status(400).json({
        success: false,
        message: 'URL tidak valid. Harap masukkan link TikTok yang benar.'
      });
    }

    const payload = {
      query: url,
      language_id: "2"
    };

    // Timeout configuration untuk Node.js 20/24
    const axiosConfig = {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'User-Agent': getRandomUserAgent(),
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://ttsave.app',
        'Referer': 'https://ttsave.app/',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin'
      },
      timeout: 10000, // 10 second timeout
      maxRedirects: 5
    };

    const { data } = await axios.post('https://ttsave.app/download', payload, axiosConfig);

    // Multiple regex patterns untuk mencari audio URL
    const audioPatterns = [
      /href="(https:\/\/v16-ies-music\.tiktokcdn\.com\/[^"]+)"/g,
      /href="(https:\/\/sf[0-9]+\.tiktokcdn\.com\/[^"]+\.mp3[^"]*)"/g,
      /"music":"([^"]+\.mp3)"/g,
      /audioUrl":"([^"]+)"/g,
      /https:\/\/[^"]*\.mp3/g
    ];

    let audioUrl = null;
    
    for (const pattern of audioPatterns) {
      const matches = [...data.matchAll(pattern)];
      if (matches.length > 0) {
        // Ambil URL pertama yang ditemukan
        audioUrl = matches[0][1] || matches[0][0];
        
        // Jika URL tidak memiliki protokol, tambahkan https://
        if (audioUrl && !audioUrl.startsWith('http')) {
          audioUrl = 'https://' + audioUrl;
        }
        
        // Pastikan URL valid
        if (audioUrl && (audioUrl.includes('.mp3') || audioUrl.includes('tiktokcdn.com'))) {
          break;
        }
      }
    }

    if (!audioUrl) {
      // Fallback: coba ekstrak dari halaman HTML
      const htmlData = data.toString();
      const urlRegex = /https?:\/\/[^\s"']+\.mp3/g;
      const mp3Urls = htmlData.match(urlRegex) || [];
      
      if (mp3Urls.length > 0) {
        audioUrl = mp3Urls[0];
      } else {
        return res.status(404).json({
          success: false,
          message: 'Gagal mengambil link audio. Video mungkin dihapus atau tidak tersedia.'
        });
      }
    }

    // Generate filename yang aman
    const timestamp = Date.now();
    const safeFilename = `tiktok_audio_${timestamp}.mp3`;

    res.json({
      success: true,
      message: 'Audio berhasil diambil!',
      audioUrl: audioUrl,
      downloadUrl: `/api/proxy-audio?url=${encodeURIComponent(audioUrl)}&filename=${safeFilename}`,
      directUrl: audioUrl,
      filename: safeFilename,
      timestamp: timestamp,
      note: 'Audio akan otomatis didownload saat klik link download'
    });

  } catch (error) {
    console.error('API Error:', error.message);
    
    // Error handling yang lebih spesifik untuk Node.js 20/24
    let errorMessage = 'Terjadi kesalahan saat memproses permintaan';
    let statusCode = 500;
    
    if (error.code === 'ECONNABORTED') {
      errorMessage = 'Timeout: Server membutuhkan waktu terlalu lama untuk merespon';
      statusCode = 504;
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'Tidak dapat terhubung ke server TikTok';
      statusCode = 503;
    } else if (error.response) {
      errorMessage = `Error ${error.response.status}: ${error.response.statusText}`;
      statusCode = error.response.status;
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Request timeout. Silakan coba lagi.';
      statusCode = 408;
    }

    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

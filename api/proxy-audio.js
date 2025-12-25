const axios = require('axios');
const { Readable } = require('stream');

// Helper function untuk validasi URL
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = async (req, res) => {
  // Set CORS headers
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

  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed. Use GET.' 
    });
  }

  try {
    // Parse query parameters
    const urlParams = new URLSearchParams(req.url.split('?')[1] || '');
    const audioUrl = urlParams.get('url');
    let filename = urlParams.get('filename') || 'tiktok_audio.mp3';

    if (!audioUrl) {
      return res.status(400).json({
        success: false,
        message: 'URL audio tidak ditemukan'
      });
    }

    // Validasi URL
    if (!isValidUrl(audioUrl)) {
      return res.status(400).json({
        success: false,
        message: 'URL audio tidak valid'
      });
    }

    // Validasi filename untuk keamanan
    filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    if (!filename.endsWith('.mp3')) {
      filename += '.mp3';
    }

    // Konfigurasi axios dengan timeout dan headers
    const axiosConfig = {
      responseType: 'stream',
      timeout: 30000, // 30 detik timeout
      maxContentLength: 50 * 1024 * 1024, // 50MB max
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.tiktok.com/',
        'Accept': '*/*',
        'Accept-Encoding': 'identity',
        'Range': 'bytes=0-'
      },
      validateStatus: function (status) {
        return status >= 200 && status < 400; // Terima 2xx dan 3xx
      }
    };

    const response = await axios.get(audioUrl, axiosConfig);

    // Set headers untuk download
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Stream audio langsung ke client
    response.data.pipe(res);

    // Handle stream errors
    response.data.on('error', (error) => {
      console.error('Stream Error:', error.message);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error streaming audio'
        });
      }
    });

  } catch (error) {
    console.error('Proxy Audio Error:', error.message);
    
    let errorMessage = 'Gagal mendownload audio';
    let statusCode = 500;
    
    if (error.code === 'ECONNABORTED') {
      errorMessage = 'Download timeout. File mungkin terlalu besar.';
      statusCode = 408;
    } else if (error.response) {
      errorMessage = `Error ${error.response.status}: ${error.response.statusText}`;
      statusCode = error.response.status;
    } else if (error.message.includes('ENOTFOUND')) {
      errorMessage = 'Tidak dapat terhubung ke server audio';
      statusCode = 503;
    }

    res.status(statusCode).json({
      success: false,
      message: errorMessage
    });
  }
};

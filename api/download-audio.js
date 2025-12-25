const axios = require('axios');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  try {
    const { url, filename = 'tiktok_audio.mp3' } = req.query;
    
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        message: 'URL audio tidak ditemukan' 
      });
    }
    
    console.log(`Downloading audio from: ${url.substring(0, 100)}...`);
    
    const response = await axios.get(url, {
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.tiktok.com/',
        'Accept': 'audio/webm,audio/ogg,audio/wav,audio/*;q=0.9,application/ogg;q=0.7,video/*;q=0.6,*/*;q=0.5',
        'Accept-Language': 'en-US,en;q=0.5',
        'Range': 'bytes=0-',
        'Origin': 'https://www.tiktok.com'
      },
      timeout: 60000
    });
    
    // Set download headers
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', response.headers['content-type'] || 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Accept-Ranges', 'bytes');
    
    // Stream audio to client
    response.data.pipe(res);
    
  } catch (error) {
    console.error('Download Error:', error.message);
    
    res.status(500).json({ 
      success: false, 
      message: 'Gagal mendownload audio. URL mungkin expired atau tidak valid.' 
    });
  }
};

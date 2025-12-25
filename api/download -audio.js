const axios = require('axios');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Handle OPTIONS preflight
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
    
    const response = await axios.get(url, {
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.tiktok.com/',
        'Accept': 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8'
      },
      timeout: 30000
    });
    
    // Set download headers
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Stream audio to client
    response.data.pipe(res);
    
  } catch (error) {
    console.error('Download Error:', error.message);
    
    res.status(500).json({ 
      success: false, 
      message: 'Gagal mendownload audio' 
    });
  }
};

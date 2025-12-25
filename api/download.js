const axios = require('axios');

module.exports = async (req, res) => {
  // Set headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Handle POST untuk download
  if (req.method === 'POST') {
    try {
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: 'URL required' });
      }
      
      // Call ttsave.app API
      const response = await axios.post('https://ttsave.app/download', {
        query: url,
        language_id: "2"
      }, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      // Extract audio URL
      const audioMatch = response.data.match(/href="(https:\/\/[^"]+\.mp3[^"]*)"/);
      
      if (!audioMatch) {
        return res.status(404).json({ error: 'Audio not found' });
      }
      
      const audioUrl = audioMatch[1];
      
      res.json({
        success: true,
        audioUrl: audioUrl,
        downloadUrl: `/api/download-audio?url=${encodeURIComponent(audioUrl)}`
      });
      
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Server error' });
    }
    return;
  }
  
  // Handle GET untuk proxy audio
  if (req.method === 'GET' && req.query.url) {
    try {
      const audioUrl = decodeURIComponent(req.query.url);
      
      const response = await axios.get(audioUrl, {
        responseType: 'stream',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://tiktok.com/'
        }
      });
      
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', 'attachment; filename="tiktok_audio.mp3"');
      
      response.data.pipe(res);
    } catch (error) {
      console.error(error);
      res.status(500).send('Download failed');
    }
    return;
  }
  
  // Default response
  res.json({ 
    message: 'TikTok MP3 Downloader API',
    endpoints: {
      POST: '/api/download - Send TikTok URL to get audio',
      GET: '/api/download?url={audioUrl} - Download audio'
    }
  });
};

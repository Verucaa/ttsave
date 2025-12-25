const axios = require('axios');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS preflight
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
    const { url } = req.body;
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ 
        success: false, 
        message: 'URL TikTok wajib diisi' 
      });
    }
    
    // Validate TikTok URL
    const tiktokPattern = /(tiktok\.com|vt\.tiktok\.com)/i;
    if (!tiktokPattern.test(url)) {
      return res.status(400).json({ 
        success: false, 
        message: 'URL TikTok tidak valid' 
      });
    }
    
    // OPTION 1: Try multiple APIs in sequence
    const audioData = await getAudioFromMultipleAPIs(url);
    
    if (!audioData || !audioData.audioUrl) {
      return res.status(404).json({ 
        success: false, 
        message: 'Tidak dapat menemukan audio. Video mungkin dihapus atau tidak memiliki audio.' 
      });
    }
    
    const timestamp = Date.now();
    const filename = `tiktok_audio_${timestamp}.mp3`;
    
    res.json({
      success: true,
      message: 'Audio berhasil ditemukan!',
      audioUrl: audioData.audioUrl,
      title: audioData.title || 'TikTok Audio',
      downloadUrl: `/api/download-audio?url=${encodeURIComponent(audioData.audioUrl)}&filename=${filename}`,
      filename: filename
    });
    
  } catch (error) {
    console.error('API Error:', error.message);
    
    let errorMessage = 'Terjadi kesalahan saat memproses permintaan';
    if (error.code === 'ECONNABORTED') {
      errorMessage = 'Timeout: Server membutuhkan waktu terlalu lama untuk merespon';
    }
    
    res.status(500).json({ 
      success: false, 
      message: errorMessage 
    });
  }
};

// Function to try multiple TikTok APIs
async function getAudioFromMultipleAPIs(tiktokUrl) {
  const apis = [
    {
      name: 'tikwm',
      url: 'https://tikwm.com/api/',
      method: 'post',
      data: { url: tiktokUrl },
      extract: (data) => {
        if (data.data && data.data.music) {
          return {
            audioUrl: data.data.music.play,
            title: data.data.music.title || 'TikTok Audio'
          };
        }
        return null;
      }
    },
    {
      name: 'snaptik',
      url: 'https://snaptik.app/abc.php',
      method: 'post',
      data: { url: tiktokUrl },
      extract: (data) => {
        try {
          // Parse HTML response
          const audioMatch = data.match(/"audio":\s*"([^"]+)"/);
          if (audioMatch && audioMatch[1]) {
            return {
              audioUrl: audioMatch[1].replace(/\\/g, ''),
              title: 'TikTok Audio'
            };
          }
        } catch (e) {
          console.error('Snaptik parse error:', e.message);
        }
        return null;
      }
    },
    {
      name: 'ttsave (fallback)',
      url: 'https://ttsave.app/download',
      method: 'post',
      data: { 
        query: tiktokUrl,
        language_id: "2" 
      },
      extract: (data) => {
        // Try multiple patterns for audio URL
        const patterns = [
          /href="(https:\/\/[^"]+\.mp3[^"]*)"/,
          /"music":"([^"]+\.mp3)"/,
          /audioUrl":"([^"]+)"/,
          /(https:\/\/[^"]*\.mp3)/g
        ];
        
        for (const pattern of patterns) {
          const match = data.match(pattern);
          if (match) {
            let audioUrl = match[1] || match[0];
            if (audioUrl && audioUrl.includes('.mp3')) {
              return {
                audioUrl: audioUrl,
                title: 'TikTok Audio'
              };
            }
          }
        }
        return null;
      }
    }
  ];
  
  // Try each API until one works
  for (const api of apis) {
    try {
      console.log(`Trying ${api.name} API...`);
      
      const config = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Content-Type': 'application/json',
          'Origin': 'https://tikwm.com',
          'Referer': 'https://tikwm.com/'
        },
        timeout: 10000
      };
      
      let response;
      if (api.method === 'post') {
        response = await axios.post(api.url, api.data, config);
      } else {
        response = await axios.get(api.url, { params: api.data, ...config });
      }
      
      const result = api.extract(response.data);
      if (result && result.audioUrl) {
        console.log(`Success with ${api.name} API`);
        return result;
      }
    } catch (error) {
      console.error(`${api.name} API failed:`, error.message);
      // Continue to next API
    }
  }
  
  // If all APIs fail, try direct scraping
  return await tryDirectScraping(tiktokUrl);
}

// Fallback: Direct scraping approach
async function tryDirectScraping(tiktokUrl) {
  try {
    // Try to get video ID from URL
    const videoIdMatch = tiktokUrl.match(/video\/(\d+)/) || tiktokUrl.match(/\/(\d{19})/);
    
    if (videoIdMatch) {
      const videoId = videoIdMatch[1];
      
      // Try TikTok's own API (not always reliable)
      const tiktokApiUrl = `https://api.tiktokv.com/aweme/v1/feed/?aweme_id=${videoId}`;
      
      const response = await axios.get(tiktokApiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 8000
      });
      
      if (response.data && response.data.aweme_list && response.data.aweme_list[0]) {
        const videoData = response.data.aweme_list[0];
        
        if (videoData.music && videoData.music.play_url && videoData.music.play_url.url_list) {
          const audioUrl = videoData.music.play_url.url_list[0];
          return {
            audioUrl: audioUrl,
            title: videoData.music.title || 'TikTok Audio'
          };
        }
      }
    }
  } catch (error) {
    console.error('Direct scraping failed:', error.message);
  }
  
  return null;
        }

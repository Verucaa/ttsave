const axios = require('axios');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
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
    
    // Extract video ID from URL
    const videoId = extractVideoId(url);
    
    if (!videoId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Tidak dapat menemukan ID video dari URL' 
      });
    }
    
    console.log(`Processing TikTok video ID: ${videoId}`);
    
    // Try multiple methods to get audio
    const audioData = await getAudioData(videoId);
    
    if (!audioData || !audioData.audioUrl) {
      return res.status(404).json({ 
        success: false, 
        message: 'Audio tidak ditemukan. Video mungkin dihapus, di-private, atau tidak memiliki audio.' 
      });
    }
    
    const timestamp = Date.now();
    const filename = `tiktok_audio_${timestamp}.mp3`;
    
    res.json({
      success: true,
      message: 'Audio berhasil ditemukan!',
      audioUrl: audioData.audioUrl,
      title: audioData.title || 'TikTok Audio',
      author: audioData.author || 'Unknown',
      downloadUrl: `/api/download-audio?url=${encodeURIComponent(audioData.audioUrl)}&filename=${filename}`,
      filename: filename
    });
    
  } catch (error) {
    console.error('Error:', error.message);
    
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

// Function to extract video ID from URL
function extractVideoId(url) {
  const patterns = [
    /video\/(\d+)/,
    /\/@[\w.]+\/video\/(\d+)/,
    /\/(\d{19})/,
    /vt\.tiktok\.com\/[^\/]+\/?.*?(\d+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

// Try multiple methods to get audio
async function getAudioData(videoId) {
  const methods = [
    { name: 'TikTok API', func: tryTikTokApi },
    { name: 'TikTok Web Scraping', func: tryTikTokScraping },
    { name: 'External API', func: tryExternalApi }
  ];
  
  for (const method of methods) {
    try {
      console.log(`Trying method: ${method.name}`);
      const result = await method.func(videoId);
      if (result && result.audioUrl) {
        console.log(`Success with method: ${method.name}`);
        return result;
      }
    } catch (error) {
      console.log(`${method.name} failed: ${error.message}`);
      continue;
    }
  }
  
  return null;
}

// Method 1: Try TikTok API directly
async function tryTikTokApi(videoId) {
  try {
    // TikTok API endpoint (may change)
    const apiUrl = `https://api.tiktokv.com/aweme/v1/feed/?aweme_id=${videoId}`;
    
    const response = await axios.get(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.tiktok.com/',
        'Origin': 'https://www.tiktok.com'
      },
      timeout: 10000
    });
    
    if (response.data && response.data.aweme_list && response.data.aweme_list[0]) {
      const videoData = response.data.aweme_list[0];
      
      // Check for music data
      if (videoData.music && videoData.music.play_url) {
        let audioUrl = videoData.music.play_url.url_list ? 
                      videoData.music.play_url.url_list[0] : 
                      videoData.music.play_url.uri;
        
        return {
          audioUrl: audioUrl,
          title: videoData.music.title || videoData.desc || 'TikTok Audio',
          author: videoData.music.author || videoData.author.nickname || 'Unknown'
        };
      }
    }
  } catch (error) {
    throw error;
  }
  
  return null;
}

// Method 2: Try scraping TikTok webpage
async function tryTikTokScraping(videoId) {
  try {
    const pageUrl = `https://www.tiktok.com/@tiktok/video/${videoId}`;
    
    const response = await axios.get(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
      },
      timeout: 10000
    });
    
    const html = response.data;
    
    // Try to find JSON-LD data
    const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
    if (jsonLdMatch) {
      try {
        const jsonLd = JSON.parse(jsonLdMatch[1]);
        if (jsonLd.audio && jsonLd.audio.contentUrl) {
          return {
            audioUrl: jsonLd.audio.contentUrl,
            title: jsonLd.name || 'TikTok Audio',
            author: jsonLd.author || 'Unknown'
          };
        }
      } catch (e) {
        console.log('JSON-LD parse error:', e.message);
      }
    }
    
    // Try to find audio URL in page data
    const audioPatterns = [
      /"audio":\s*{\s*"url":\s*"([^"]+)"/,
      /"playAddr":\s*"([^"]+)"/,
      /"downloadAddr":\s*"([^"]+)"/,
      /"music":\s*{\s*"playUrl":\s*"([^"]+)"/,
      /https:\/\/[^"]*\.mp3[^"]*/g
    ];
    
    for (const pattern of audioPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        let audioUrl = match[1].replace(/\\u002F/g, '/').replace(/\\\//g, '/');
        return {
          audioUrl: audioUrl,
          title: 'TikTok Audio',
          author: 'Unknown'
        };
      }
    }
    
  } catch (error) {
    throw error;
  }
  
  return null;
}

// Method 3: Try external APIs
async function tryExternalApi(videoId) {
  try {
    // Try savetik.co API
    const response = await axios.post('https://savetik.co/api/ajaxSearch', {
      q: `https://www.tiktok.com/@tiktok/video/${videoId}`,
      lang: 'en'
    }, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Origin': 'https://savetik.co',
        'Referer': 'https://savetik.co/',
        'X-Requested-With': 'XMLHttpRequest'
      },
      timeout: 10000
    });
    
    if (response.data && response.data.data) {
      // Parse HTML response
      const html = response.data.data;
      const audioMatch = html.match(/href="([^"]+\.mp3[^"]*)"/);
      if (audioMatch && audioMatch[1]) {
        return {
          audioUrl: audioMatch[1],
          title: 'TikTok Audio',
          author: 'Unknown'
        };
      }
    }
  } catch (error) {
    // Try another API
    return tryFallbackApi(videoId);
  }
  
  return null;
}

// Fallback API
async function tryFallbackApi(videoId) {
  try {
    // Try another API: tikdown.org
    const response = await axios.post('https://tikdown.org/getAjax', {
      url: `https://www.tiktok.com/@tiktok/video/${videoId}`,
      _token: 'abc123' // Dummy token
    }, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Origin': 'https://tikdown.org',
        'Referer': 'https://tikdown.org/',
        'X-Requested-With': 'XMLHttpRequest'
      },
      timeout: 10000
    });
    
    if (response.data && response.data.links && response.data.links.mp3) {
      return {
        audioUrl: response.data.links.mp3,
        title: response.data.title || 'TikTok Audio',
        author: response.data.author || 'Unknown'
      };
    }
  } catch (error) {
    throw error;
  }
  
  return null;
      }

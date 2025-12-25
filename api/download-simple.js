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
    
    console.log(`Processing URL: ${url}`);
    
    // Method 1: Try TikTok downloader API that works
    const audioUrl = await getAudioFromWorkingApi(url);
    
    if (!audioUrl) {
      // Method 2: Try fallback
      return res.status(404).json({ 
        success: false, 
        message: 'Tidak dapat menemukan audio. Coba dengan video TikTok yang berbeda atau coba lagi nanti.' 
      });
    }
    
    const timestamp = Date.now();
    const filename = `tiktok_audio_${timestamp}.mp3`;
    
    res.json({
      success: true,
      message: 'Audio berhasil ditemukan!',
      audioUrl: audioUrl,
      downloadUrl: `/api/download-audio?url=${encodeURIComponent(audioUrl)}&filename=${filename}`,
      filename: filename
    });
    
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Server error. Please try again later.' 
    });
  }
};

async function getAudioFromWorkingApi(tiktokUrl) {
  // List of working TikTok downloader APIs (as of 2024)
  const apis = [
    // API 1: ssstik.io (often works)
    async () => {
      try {
        const response = await axios.post('https://ssstik.io/abc', {
          id: tiktokUrl,
          locale: 'en',
          tt: 'abc123' // Random token
        }, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Origin': 'https://ssstik.io',
            'Referer': 'https://ssstik.io/'
          }
        });
        
        if (response.data && response.data.links && response.data.links.mp3) {
          return response.data.links.mp3;
        }
      } catch (e) {
        console.log('ssstik.io failed:', e.message);
      }
      return null;
    },
    
    // API 2: tikdown.org
    async () => {
      try {
        const response = await axios.post('https://tikdown.org/getAjax', {
          url: tiktokUrl
        }, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Origin': 'https://tikdown.org',
            'Referer': 'https://tikdown.org/'
          }
        });
        
        if (response.data && response.data.links && response.data.links.mp3) {
          return response.data.links.mp3;
        }
      } catch (e) {
        console.log('tikdown.org failed:', e.message);
      }
      return null;
    },
    
    // API 3: ttdownloader.com
    async () => {
      try {
        // First get the page to get tokens
        const pageResponse = await axios.get('https://ttdownloader.com/', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        const pageHtml = pageResponse.data;
        const tokenMatch = pageHtml.match(/name="_token"\s+value="([^"]+)"/);
        
        if (tokenMatch) {
          const token = tokenMatch[1];
          const formResponse = await axios.post('https://ttdownloader.com/req/', {
            url: tiktokUrl,
            _token: token
          }, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Content-Type': 'application/x-www-form-urlencoded',
              'Origin': 'https://ttdownloader.com',
              'Referer': 'https://ttdownloader.com/'
            }
          });
          
          const resultHtml = formResponse.data;
          const audioMatch = resultHtml.match(/href="(https:[^"]+\.mp3[^"]*)"/);
          
          if (audioMatch) {
            return audioMatch[1];
          }
        }
      } catch (e) {
        console.log('ttdownloader.com failed:', e.message);
      }
      return null;
    },
    
    // API 4: Simple regex from TikTok page
    async () => {
      try {
        const pageResponse = await axios.get(tiktokUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5'
          }
        });
        
        const html = pageResponse.data;
        
        // Try to find audio in various patterns
        const patterns = [
          /"downloadAddr":"([^"]+)"/,
          /"playAddr":"([^"]+)"/,
          /"music":\{"playUrl":"([^"]+)"/,
          /https:\/\/[^"]*\.mp3[^"]*/g
        ];
        
        for (const pattern of patterns) {
          const match = html.match(pattern);
          if (match && match[1]) {
            let url = match[1].replace(/\\u002F/g, '/');
            if (url.includes('.mp3')) {
              return url;
            }
          }
        }
      } catch (e) {
        console.log('Direct page scraping failed:', e.message);
      }
      return null;
    }
  ];
  
  // Try each API in order
  for (const apiFunc of apis) {
    try {
      const result = await apiFunc();
      if (result) {
        console.log('Found audio URL:', result.substring(0, 100) + '...');
        return result;
      }
    } catch (error) {
      console.log('API function error:', error.message);
      continue;
    }
  }
  
  return null;
    }

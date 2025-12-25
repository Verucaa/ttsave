document.addEventListener('DOMContentLoaded', function() {
  const urlInput = document.getElementById('urlInput');
  const downloadBtn = document.getElementById('downloadBtn');
  const buttonText = document.getElementById('buttonText');
  const resultDiv = document.getElementById('result');
  const errorDiv = document.getElementById('error');
  const successDiv = document.getElementById('success');
  const audioPreview = document.getElementById('audioPreview');
  const audioDownload = document.getElementById('audioDownload');
  const audioTitle = document.getElementById('audioTitle');
  
  // URL contoh yang bekerja
  urlInput.value = 'https://www.tiktok.com/@tiktok/video/7156033831819734314';
  
  downloadBtn.addEventListener('click', async function() {
    const url = urlInput.value.trim();
    
    if (!url) {
      showError('Harap masukkan URL TikTok');
      return;
    }
    
    if (!url.includes('tiktok.com') && !url.includes('vt.tiktok.com')) {
      showError('URL tidak valid. Harap masukkan link TikTok yang benar.');
      return;
    }
    
    setLoadingState(true);
    hideError();
    hideSuccess();
    hideResult();
    
    try {
      // Try main API first
      let response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ url: url })
      });
      
      let data = await response.json();
      
      // If main API fails, try simple API
      if (!data.success) {
        console.log('Main API failed, trying simple API...');
        response = await fetch('/api/download-simple', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ url: url })
        });
        data = await response.json();
      }
      
      if (data.success) {
        showSuccess('Audio ditemukan! Siap didownload.');
        
        audioTitle.textContent = data.title || 'TikTok Audio';
        
        if (data.audioUrl) {
          audioPreview.innerHTML = `
            <p>🎧 Preview Audio:</p>
            <audio controls style="width: 100%; margin-top: 10px;">
              <source src="${data.audioUrl}" type="audio/mpeg">
              Browser Anda tidak mendukung pemutar audio.
            </audio>
            <p style="font-size: 12px; color: #666; margin-top: 5px;">
              Jika audio tidak dapat diputar, langsung download saja.
            </p>
          `;
          
          audioDownload.href = data.downloadUrl;
          audioDownload.setAttribute('download', data.filename);
          audioDownload.setAttribute('target', '_blank');
          
          showResult();
        } else {
          showError('URL audio tidak ditemukan dalam respons.');
        }
      } else {
        showError(data.message || 'Gagal mengambil audio. Coba dengan video lain atau coba lagi nanti.');
      }
    } catch (error) {
      console.error('Error:', error);
      showError('Terjadi kesalahan jaringan. Periksa koneksi internet Anda.');
    } finally {
      setLoadingState(false);
    }
  });
  
  // Helper functions tetap sama
  function showError(message) {
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
    successDiv.classList.remove('show');
  }
  
  function hideError() {
    errorDiv.classList.remove('show');
  }
  
  function showSuccess(message) {
    successDiv.textContent = message;
    successDiv.classList.add('show');
    errorDiv.classList.remove('show');
  }
  
  function hideSuccess() {
    successDiv.classList.remove('show');
  }
  
  function showResult() {
    resultDiv.classList.add('show');
  }
  
  function hideResult() {
    resultDiv.classList.remove('show');
  }
  
  function setLoadingState(isLoading) {
    if (isLoading) {
      downloadBtn.disabled = true;
      buttonText.innerHTML = '<div class="loading"></div> Mencari audio...';
    } else {
      downloadBtn.disabled = false;
      buttonText.textContent = 'Download MP3';
    }
  }
  
  urlInput.focus();
  
  urlInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      downloadBtn.click();
    }
  });
});

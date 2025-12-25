document.addEventListener('DOMContentLoaded', function() {
    // Konfigurasi API untuk Vercel
    const API_BASE_URL = window.location.origin;
    
    // Elemen DOM
    const tiktokUrlInput = document.getElementById('tiktokUrl');
    const downloadBtn = document.getElementById('downloadBtn');
    const resultCard = document.getElementById('resultCard');
    const errorCard = document.getElementById('errorCard');
    const audioPreview = document.getElementById('audioPreview');
    const directDownload = document.getElementById('directDownload');
    const copyLinkBtn = document.getElementById('copyLink');
    const resetBtn = document.getElementById('resetBtn');
    const tryAgainBtn = document.getElementById('tryAgainBtn');
    const errorMessage = document.getElementById('errorMessage');
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notificationText');
    const statusLink = document.getElementById('statusLink');
    const reportLink = document.getElementById('reportLink');
    const faqQuestions = document.querySelectorAll('.faq-question');
    
    // Cache untuk hasil terakhir
    let lastResult = null;
    
    // Status server
    checkServerStatus();
    
    // Event Listeners
    downloadBtn.addEventListener('click', processDownload);
    tiktokUrlInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') processDownload();
    });
    
    copyLinkBtn.addEventListener('click', copyAudioLink);
    resetBtn.addEventListener('click', resetForm);
    tryAgainBtn.addEventListener('click', resetForm);
    statusLink.addEventListener('click', showServerStatus);
    reportLink.addEventListener('click', reportProblem);
    
    // FAQ Accordion
    faqQuestions.forEach(question => {
        question.addEventListener('click', function() {
            const answer = this.nextElementSibling;
            const isActive = this.classList.contains('active');
            
            // Tutup semua FAQ terlebih dahulu
            faqQuestions.forEach(q => {
                q.classList.remove('active');
                q.nextElementSibling.classList.remove('show');
            });
            
            // Buka FAQ yang diklik jika sebelumnya tertutup
            if (!isActive) {
                this.classList.add('active');
                answer.classList.add('show');
            }
        });
    });
    
    // Fungsi untuk memproses download
    async function processDownload() {
        const url = tiktokUrlInput.value.trim();
        
        // Validasi input
        if (!url) {
            showError('Harap masukkan link TikTok');
            tiktokUrlInput.focus();
            return;
        }
        
        // Validasi format URL
        if (!isValidTikTokUrl(url)) {
            showError('Format URL TikTok tidak valid. Harap masukkan link yang benar.');
            return;
        }
        
        // Tampilkan loading state
        setLoadingState(true);
        
        try {
            // Kirim permintaan ke API Vercel
            const response = await fetch(`${API_BASE_URL}/api/download`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ url: url })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Simpan hasil terakhir
                lastResult = data;
                // Tampilkan hasil
                displayResult(data);
            } else {
                showError(data.message || 'Gagal mengambil audio dari TikTok');
            }
        } catch (error) {
            console.error('Fetch Error:', error);
            
            let errorMsg = 'Tidak dapat terhubung ke server. ';
            if (navigator.onLine) {
                errorMsg += 'Server mungkin sedang down. Coba lagi nanti.';
            } else {
                errorMsg += 'Periksa koneksi internet Anda.';
            }
            
            showError(errorMsg);
        } finally {
            setLoadingState(false);
        }
    }
    
    // Fungsi untuk menampilkan hasil
    function displayResult(data) {
        // Sembunyikan kartu error jika sedang ditampilkan
        errorCard.classList.add('hidden');
        
        // Buat elemen audio untuk preview
        audioPreview.innerHTML = `
            <p><i class="fas fa-headphones"></i> Dengarkan preview audio:</p>
            <audio controls class="audio-player" preload="metadata">
                <source src="${data.audioUrl}" type="audio/mpeg">
                Browser Anda tidak mendukung pemutar audio.
            </audio>
            <p class="audio-note">
                <i class="fas fa-info-circle"></i> Jika audio tidak bisa diputar, langsung download saja.
            </p>
        `;
        
        // Atur link download
        directDownload.href = `${API_BASE_URL}${data.downloadUrl}`;
        directDownload.setAttribute('download', data.filename);
        directDownload.setAttribute('target', '_blank');
        
        // Tambahkan event listener untuk track download
        directDownload.addEventListener('click', function() {
            trackDownload(data.filename);
        });
        
        // Tampilkan kartu hasil
        resultCard.classList.remove('hidden');
        
        // Scroll ke hasil
        resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        // Tampilkan notifikasi sukses
        showNotification('🎵 Audio berhasil diambil! Silahkan download.', 'success');
        
        // Auto-play preview (opsional, dengan izin user)
        setTimeout(() => {
            const audioElement = document.querySelector('.audio-player');
            if (audioElement) {
                audioElement.volume = 0.5;
            }
        }, 500);
    }
    
    // Fungsi untuk tracking download (analytics sederhana)
    function trackDownload(filename) {
        console.log(`Download started: ${filename}`);
        // Di sini bisa ditambahkan Google Analytics atau analytics lainnya
        // Contoh: gtag('event', 'download', {filename: filename});
    }
    
    // Fungsi untuk menyalin link audio
    async function copyAudioLink() {
        try {
            let audioUrl = '';
            
            if (lastResult && lastResult.audioUrl) {
                audioUrl = lastResult.audioUrl;
            } else {
                const audioElement = document.querySelector('.audio-player');
                audioUrl = audioElement ? audioElement.src : '';
            }
            
            if (!audioUrl) {
                showNotification('❌ Link audio tidak tersedia', 'error');
                return;
            }
            
            await navigator.clipboard.writeText(audioUrl);
            showNotification('📋 Link audio berhasil disalin ke clipboard!', 'success');
        } catch (error) {
            console.error('Copy Error:', error);
            
            // Fallback untuk browser lama
            const textArea = document.createElement('textarea');
            textArea.value = lastResult?.audioUrl || '';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            
            showNotification('📋 Link disalin (metode fallback)', 'success');
        }
    }
    
    // Fungsi untuk mereset form
    function resetForm() {
        tiktokUrlInput.value = '';
        resultCard.classList.add('hidden');
        errorCard.classList.add('hidden');
        tiktokUrlInput.focus();
        lastResult = null;
    }
    
    // Fungsi untuk menampilkan error
    function showError(message) {
        errorMessage.textContent = message;
        resultCard.classList.add('hidden');
        errorCard.classList.remove('hidden');
        errorCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    
    // Fungsi untuk menampilkan notifikasi
    function showNotification(message, type = 'success') {
        notificationText.textContent = message;
        
        // Atur warna berdasarkan tipe
        const colors = {
            'success': '#28a745',
            'error': '#dc3545',
            'warning': '#ffc107',
            'info': '#17a2b8'
        };
        
        notification.style.backgroundColor = colors[type] || colors.success;
        
        if (type === 'warning') {
            notificationText.style.color = '#000';
        } else {
            notificationText.style.color = '#fff';
        }
        
        notification.classList.remove('hidden');
        
        // Sembunyikan notifikasi setelah 4 detik
        setTimeout(() => {
            notification.classList.add('hidden');
        }, 4000);
    }
    
    // Fungsi untuk mengatur loading state
    function setLoadingState(isLoading) {
        if (isLoading) {
            downloadBtn.disabled = true;
            downloadBtn.classList.add('loading');
            downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
            tiktokUrlInput.disabled = true;
        } else {
            downloadBtn.disabled = false;
            downloadBtn.classList.remove('loading');
            downloadBtn.innerHTML = '<i class="fas fa-download"></i> Download Audio';
            tiktokUrlInput.disabled = false;
        }
    }
    
    // Fungsi untuk validasi URL TikTok
    function isValidTikTokUrl(url) {
        // Pattern yang lebih komprehensif untuk URL TikTok
        const patterns = [
            /^(https?:\/\/)?(www\.|vm\.|vt\.)?(tiktok\.com|tiktokv\.com)\/(@[\w.-]+\/video\/\d+|[\w./?=&%-]+)/i,
            /^(https?:\/\/)?(m\.)?tiktok\.com\/v\/\d+/i,
            /^(https?:\/\/)?(m\.)?tiktok\.com\/t\/[a-zA-Z0-9]+\//i,
            /^(https?:\/\/)?vt\.tiktok\.com\/[a-zA-Z0-9]+\//i
        ];
        
        return patterns.some(pattern => pattern.test(url)) || 
               url.includes('tiktok.com') || 
               url.includes('vt.tiktok.com');
    }
    
    // Fungsi untuk memeriksa status server
    async function checkServerStatus() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/status`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('Server Status:', data);
                
                // Tampilkan versi Node.js di console
                if (data.nodeVersion) {
                    console.log(`Running on Node.js ${data.nodeVersion}`);
                }
            }
        } catch (error) {
            console.warn('Server status check failed:', error.message);
        }
    }
    
    // Fungsi untuk menampilkan status server
    async function showServerStatus(e) {
        e.preventDefault();
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/status`);
            if (response.ok) {
                const data = await response.json();
                const message = `✅ Server aktif (Node.js ${data.nodeVersion})`;
                showNotification(message, 'info');
            } else {
                showNotification('⚠️ Server sedang mengalami masalah', 'warning');
            }
        } catch (error) {
            showNotification('❌ Tidak dapat terhubung ke server', 'error');
        }
    }
    
    // Fungsi untuk melaporkan masalah
    function reportProblem(e) {
        e.preventDefault();
        
        const url = tiktokUrlInput.value || 'Tidak ada URL';
        const problem = prompt('Jelaskan masalah yang Anda alami:');
        
        if (problem) {
            const email = 'support@example.com';
            const subject = `[TikTok Audio Downloader] Laporan Masalah`;
            const body = `URL yang dicoba: ${url}\n\nMasalah: ${problem}\n\nBrowser: ${navigator.userAgent}\nWaktu: ${new Date().toLocaleString()}`;
            
            window.open(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
            showNotification('📧 Email laporan telah dibuka', 'info');
        }
    }
    
    // Tambahkan contoh URL TikTok untuk memudahkan pengujian
    const exampleUrls = [
        'https://www.tiktok.com/@tiktok/video/7156033831819734314',
        'https://vt.tiktok.com/ZSY5XrKqJ/',
        'https://www.tiktok.com/@example_user/video/1234567890123456789'
    ];
    
    // Pilih contoh URL secara acak
    const randomExample = exampleUrls[Math.floor(Math.random() * exampleUrls.length)];
    tiktokUrlInput.value = randomExample;
    tiktokUrlInput.placeholder = `Contoh: ${randomExample}`;
    
    // Tampilkan mode pengembangan jika di localhost
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('🚀 Mode Pengembangan: Aplikasi berjalan di localhost');
        document.body.classList.add('dev-mode');
        showNotification('🛠️ Mode Pengembangan Aktif', 'warning');
    }
    
    // Deteksi fitur browser
    if (!navigator.clipboard) {
        console.warn('Clipboard API tidak didukung browser ini');
        copyLinkBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Salin Link (Manual)';
    }
});

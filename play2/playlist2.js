class PlaylistManager {
    constructor() {
        // Use the global musicPlayer instance
        this.musicPlayer = window.musicPlayer;
        
        this.musicList = document.getElementById('music-list');
        this.fileInput = document.getElementById('file-input');
        this.addMusicBtn = document.getElementById('add-music-btn');
        this.storageUsed = document.getElementById('storage-used');
        
        if (this.musicList && this.fileInput && this.addMusicBtn) {
            this.init();
        }
    }
    
    init() {
        this.renderPlaylist();
        this.setupEventListeners();
        this.updateStorageUsage();
    }
    
    renderPlaylist() {
        if (!this.musicList) return;
        
        this.musicList.innerHTML = '';
        
        if (!this.musicPlayer || !this.musicPlayer.musicLibrary || this.musicPlayer.musicLibrary.length === 0) {
            this.musicList.innerHTML = `
                <div class="empty-state">
                    <p>No music in library</p>
                    <p style="font-size: 9px; color: #92C9FF;">Add music using the button above</p>
                </div>
            `;
            return;
        }
        
        this.musicPlayer.musicLibrary.forEach((track, index) => {
            const trackItem = document.createElement('div');
            trackItem.className = `track-item ${index === this.musicPlayer.currentTrackIndex ? 'active' : ''} ${track.colorClass || 'color-1'}`;
            trackItem.dataset.index = index;
            
            trackItem.innerHTML = `
                <img src="${track.albumArt || 'musicimages/default.jpg'}" alt="${track.album || 'Album'}">
                <div class="track-details">
                    <h4>${track.title || 'Unknown Track'}</h4>
                    <p>${track.artist || 'Unknown Artist'} • ${track.album || 'Unknown Album'}</p>
                </div>
                <div class="track-duration">${track.duration || '0:00'}</div>
                <button class="delete-btn" data-index="${index}">✕</button>
            `;
            
            // Click to play
            trackItem.addEventListener('click', (e) => {
                if (!e.target.classList.contains('delete-btn')) {
                    this.playTrack(index);
                }
            });
            
            // Delete button
            const deleteBtn = trackItem.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteTrack(index);
            });
            
            this.musicList.appendChild(trackItem);
        });
    }
    
    setupEventListeners() {
        if (!this.addMusicBtn || !this.fileInput) return;
        
        // Add music button
        this.addMusicBtn.addEventListener('click', () => {
            this.fileInput.click();
        });
        
        // File input change
        this.fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
            this.fileInput.value = '';
        });
        
        // Drag and drop
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        
        document.addEventListener('drop', (e) => {
            e.preventDefault();
            const files = e.dataTransfer.files;
            this.handleFiles(files);
        });
        
        // Click overlay to close playlist
        const overlay = document.getElementById('playlist-overlay');
        if (overlay) {
            overlay.addEventListener('click', () => {
                if (window.musicPlayer) {
                    window.musicPlayer.hidePlaylist();
                }
            });
        }
    }
    
    handleFiles(files) {
        let addedCount = 0;
        
        for (const file of files) {
            if (file.type.startsWith('audio/')) {
                const fileName = file.name.replace(/\.[^/.]+$/, "");
                const newTrack = this.musicPlayer.addTrack(file, fileName);
                
                if (newTrack) {
                    addedCount++;
                }
            }
        }
        
        if (addedCount > 0) {
            this.renderPlaylist();
            this.updateStorageUsage();
            this.showMessage(`Added ${addedCount} track(s) successfully!`);
        }
    }
    
    playTrack(index) {
        if (this.musicPlayer) {
            this.musicPlayer.currentTrackIndex = index;
            this.musicPlayer.loadTrack(index);
            this.musicPlayer.play();
            this.renderPlaylist();
            
            // Close playlist after selecting track
            setTimeout(() => {
                if (window.musicPlayer) {
                    window.musicPlayer.hidePlaylist();
                }
            }, 500);
        }
    }
    
    deleteTrack(index) {
        if (confirm('Delete this track from library?')) {
            const success = this.musicPlayer.deleteTrack(index);
            
            if (success) {
                this.renderPlaylist();
                this.updateStorageUsage();
                this.showMessage('Track deleted successfully!');
            }
        }
    }
    
    updateStorageUsage() {
        try {
            const data = JSON.stringify(this.musicPlayer.musicLibrary);
            const bytes = new TextEncoder().encode(data).length;
            const kb = Math.round(bytes / 1024);
            if (this.storageUsed) {
                this.storageUsed.textContent = `${kb} KB`;
            }
        } catch (error) {
            if (this.storageUsed) {
                this.storageUsed.textContent = '0 KB';
            }
        }
    }
    
    showMessage(message) {
        const messageEl = document.createElement('div');
        messageEl.textContent = message;
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 10000;
            font-size: 12px;
        `;
        
        document.body.appendChild(messageEl);
        
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.parentNode.removeChild(messageEl);
            }
        }, 2000);
    }
}
class MusicPlayer {
    constructor() {
        this.currentTrackIndex = 0;
        this.isPlaying = false;
        this.audio = new Audio();
        this.volume = 0.7;

        // Available album art images
        this.availableImages = [
            "musicimages/firstmusic.jpg",
            "musicimages/secondmuisc.jpg",
            "musicimages/thridmusic.jpg",
            "musicimages/forthmusic.jpg",
            "musicimages/fifthmusic.jpg",
            "musicimages/sixmusic.jpg"
        ];

        // Color classes for themes
        this.colorClasses = ["color-1", "color-2", "color-3", "color-4", "color-5", "color-6"];

        // Default library
        this.musicLibrary = [
            {
                id: 1,
                title: "Blue Jeans",
                artist: "Lana Del Rey",
                album: "Born to Die",
                duration: "3:29",
                file: "music/Blue Jeans - Lana Del Rey (Lyrics) 🎵.mp3",
                albumArt: "musicimages/firstmusic.jpg",
                colorClass: "color-1"
            },
            {
                id: 2,
                title: "Butter",
                artist: "BTS",
                album: "BE",
                duration: "2:44",
                file: "music/BTS - Butter (Lyrics).mp3",
                albumArt: "musicimages/secondmuisc.jpg",
                colorClass: "color-2"
            },
            {
                id: 3,
                title: "Cinnamon Girl",
                artist: "Lana Del Rey",
                album: "NFR!",
                duration: "5:00",
                file: "music/Lana Del Rey - Cinnamon Girl (Lyrics).mp3",
                albumArt: "musicimages/thridmusic.jpg",
                colorClass: "color-3"
            },
            {
                id: 4,
                title: "Night Changes",
                artist: "One Direction",
                album: "FOUR",
                duration: "3:46",
                file: "music/One Direction - Night Changes.mp3",
                albumArt: "musicimages/forthmusic.jpg",
                colorClass: "color-4"
            }
        ];

        // Load from localStorage if exists
        this.loadFromStorage();

        // Initialize
        this.init();
    }

    loadFromStorage() {
        try {
            const saved = localStorage.getItem('musicLibrary');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.length > 0) {
                    if (parsed.length === 2 && parsed[0].title === 'Blue Jeans' && parsed[1].title === 'Butter') {
                        return; // Ignore old stored defaults and use the new 4 tracks
                    }
                    this.musicLibrary = parsed;
                }
            }
        } catch (error) {
            console.log('No saved library or error loading:', error);
        }
    }

    saveToStorage() {
        try {
            localStorage.setItem('musicLibrary', JSON.stringify(this.musicLibrary));
        } catch (error) {
            console.error('Error saving to storage:', error);
        }
    }

    init() {
        // Get DOM elements for main player
        this.playBtn = document.getElementById('play-btn');
        this.playIcon = document.getElementById('play-icon');
        this.prevBtn = document.getElementById('prev-btn');
        this.nextBtn = document.getElementById('next-btn');
        this.progressSlider = document.getElementById('progress-slider');
        this.currentTimeEl = document.getElementById('current-time');
        this.totalTimeEl = document.getElementById('total-time');
        this.trackTitle = document.getElementById('track-title');
        this.trackArtistAlbum = document.getElementById('track-artist-album');
        this.albumArt = document.getElementById('album-art');
        this.volumeBtns = document.querySelectorAll('.volume-btn');
        this.playlistBtn = document.getElementById('playlist-btn');
        this.playlistBackBtn = document.getElementById('playlist-back-btn');

        // Setup audio
        this.setupAudio();

        // Setup event listeners
        this.setupEventListeners();

        // Load first track
        if (this.musicLibrary.length > 0) {
            this.loadTrack(0);

            // Autoplay when opening the music page
            setTimeout(() => {
                this.play();
            }, 500);
        }
    }

    setupAudio() {
        this.audio.volume = this.volume;

        this.audio.addEventListener('loadedmetadata', () => {
            this.updateTimeDisplay();
            this.updateTotalTime();
        });

        this.audio.addEventListener('timeupdate', () => {
            this.updateProgress();
            this.updateCurrentTime();
        });

        this.audio.addEventListener('ended', () => {
            this.playNext();
        });

        this.audio.addEventListener('error', (e) => {
            console.error('Audio error:', e, 'Src:', this.audio.src);
        });
    }

    setupEventListeners() {
        // Play/Pause
        if (this.playBtn) {
            this.playBtn.addEventListener('click', () => this.togglePlay());
        }

        // Previous/Next
        if (this.prevBtn) {
            this.prevBtn.addEventListener('click', () => this.playPrevious());
        }

        if (this.nextBtn) {
            this.nextBtn.addEventListener('click', () => this.playNext());
        }

        // Progress slider
        if (this.progressSlider) {
            this.progressSlider.addEventListener('input', (e) => {
                if (this.audio.duration) {
                    const percent = e.target.value;
                    const time = (percent / 100) * this.audio.duration;
                    this.audio.currentTime = time;
                }
            });
        }

        // Volume buttons
        if (this.volumeBtns) {
            this.volumeBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    const volume = parseFloat(btn.dataset.volume);
                    this.setVolume(volume);

                    // Update active state
                    this.volumeBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                });
            });
        }

        // Home button
        const homeBtn = document.getElementById('homeBtn');
        if (homeBtn) {
            homeBtn.addEventListener('click', () => {
                window.location.href = 'index.html';
            });
        }

        // Playlist buttons
        if (this.playlistBtn) {
            this.playlistBtn.addEventListener('click', () => this.showPlaylist());
        }

        if (this.playlistBackBtn) {
            this.playlistBackBtn.addEventListener('click', () => this.hidePlaylist());
        }
    }

    showPlaylist() {
        const playlistContainer = document.getElementById('playlist-container');
        const playlistOverlay = document.getElementById('playlist-overlay');
        if (playlistContainer && playlistOverlay) {
            playlistContainer.style.display = 'block';
            playlistOverlay.style.display = 'block';

            // Trigger playlist rendering
            if (window.playlistManager) {
                window.playlistManager.renderPlaylist();
            }
        }
    }

    hidePlaylist() {
        const playlistContainer = document.getElementById('playlist-container');
        const playlistOverlay = document.getElementById('playlist-overlay');
        if (playlistContainer && playlistOverlay) {
            playlistContainer.style.display = 'none';
            playlistOverlay.style.display = 'none';
        }
    }

    loadTrack(index) {
        if (index < 0 || index >= this.musicLibrary.length) return;

        this.currentTrackIndex = index;
        const track = this.musicLibrary[index];

        // Stop current playback
        this.audio.pause();
        this.isPlaying = false;

        // Update UI
        this.updateTrackInfo(track);

        // Load new audio file
        if (track.file) {
            console.log('Loading track:', track.title, track.file);

            if (track.file.startsWith('idb://')) {
                const trackId = track.file.replace('idb://', '');
                getBlobFromDB(trackId).then(blob => {
                    if (blob) {
                        if (this.currentObjectUrl) URL.revokeObjectURL(this.currentObjectUrl);
                        this.currentObjectUrl = URL.createObjectURL(blob);
                        this.audio.src = this.currentObjectUrl;
                        this.audio.load();
                        this.updatePlayButton();
                        this.applyTheme(track.colorClass);
                        if (this.isPlaying) setTimeout(() => this.play(), 100);
                    } else {
                        console.error("Track missing from local database!");
                    }
                });
                return; // Async handling avoids synchronous path below
            } else if (track.file.startsWith('blob:')) {
                this.audio.src = track.file;
            } else {
                this.audio.src = track.file;
            }

            this.audio.load();

            // Update play button
            this.updatePlayButton();

            // Apply theme color
            this.applyTheme(track.colorClass);

            // Auto-play if it was playing before
            if (this.isPlaying) {
                setTimeout(() => this.play(), 100);
            }
        }
    }

    updateTrackInfo(track) {
        if (this.trackTitle) {
            this.trackTitle.textContent = track.title || "Unknown Track";
        }
        if (this.trackArtistAlbum) {
            this.trackArtistAlbum.textContent = `${track.artist || "Unknown Artist"} • ${track.album || "Unknown Album"}`;
        }
        if (this.albumArt) {
            this.albumArt.src = track.albumArt || "musicimages/default.jpg";
            this.albumArt.onerror = () => {
                this.albumArt.src = "musicimages/default.jpg";
            };
        }
        
        // Check for long names and apply marquee if needed
        this.checkAndApplyMarquee(this.trackTitle);
        this.checkAndApplyMarquee(this.trackArtistAlbum);
    }

    checkAndApplyMarquee(element) {
        if (!element) return;
        
        // Reset
        element.classList.remove('animate-scrolling');
        const inner = element.querySelector('.marquee-inner');
        if (inner) {
            element.textContent = inner.textContent;
        }

        if (element.scrollWidth > element.clientWidth) {
            const text = element.textContent;
            element.innerHTML = `<span class="marquee-inner">${text}</span>`;
            element.classList.add('animate-scrolling');
        }
    }

    applyTheme(colorClass) {
        // Remove all color classes
        document.body.classList.remove(...this.colorClasses);

        // Add new color class
        if (colorClass && this.colorClasses.includes(colorClass)) {
            document.body.classList.add(colorClass);
        } else {
            document.body.classList.add('color-1');
        }
    }

    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    play() {
        if (!this.audio.src) {
            this.loadTrack(this.currentTrackIndex);
        }

        this.audio.play().then(() => {
            this.isPlaying = true;
            this.updatePlayButton();
        }).catch(error => {
            console.error('Play failed:', error);
            if (!this.audio.src && this.musicLibrary[this.currentTrackIndex]) {
                this.loadTrack(this.currentTrackIndex);
                setTimeout(() => this.audio.play(), 100);
            }
        });
    }

    pause() {
        this.audio.pause();
        this.isPlaying = false;
        this.updatePlayButton();
    }

    playNext() {
        if (this.musicLibrary.length === 0) return;

        const nextIndex = (this.currentTrackIndex + 1) % this.musicLibrary.length;
        this.loadTrack(nextIndex);

        // Always play when next is clicked
        setTimeout(() => this.play(), 100);
    }

    playPrevious() {
        if (this.musicLibrary.length === 0) return;

        const prevIndex = (this.currentTrackIndex - 1 + this.musicLibrary.length) % this.musicLibrary.length;
        this.loadTrack(prevIndex);

        // Always play when previous is clicked
        setTimeout(() => this.play(), 100);
    }

    updatePlayButton() {
        if (this.playIcon) {
            this.playIcon.src = this.isPlaying ? "assets2/pause.png" : "assets2/play (1).png";
            this.playIcon.alt = this.isPlaying ? "Pause" : "Play";
        }
    }

    updateProgress() {
        if (this.audio.duration && this.progressSlider) {
            const percent = (this.audio.currentTime / this.audio.duration) * 100;
            this.progressSlider.value = percent;
        }
    }

    updateCurrentTime() {
        if (this.currentTimeEl) {
            this.currentTimeEl.textContent = this.formatTime(this.audio.currentTime);
        }
    }

    updateTotalTime() {
        if (this.totalTimeEl) {
            this.totalTimeEl.textContent = this.formatTime(this.audio.duration);
        }
    }

    updateTimeDisplay() {
        this.updateCurrentTime();
        this.updateTotalTime();
    }

    formatTime(seconds) {
        if (isNaN(seconds) || !isFinite(seconds)) return "0:00";

        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    setVolume(volume) {
        this.volume = volume;
        this.audio.volume = volume;
    }

    // Method to add tracks from playlist page natively (Ephemeral Blob)
    // Method to add tracks from playlist page natively (IndexedDB Persistent)
    addTrack(file, title = "Unknown Track", artist = "Unknown Artist", album = "Unknown Album") {
        // Check if file is valid
        if (!file || !file.type.startsWith('audio/')) {
            alert('Please select a valid audio file');
            return null;
        }

        const trackId = 'track_' + Date.now();
        saveBlobToDB(trackId, file).catch(e => console.error("IDB Save Failed", e));

        const newTrack = {
            id: trackId,
            title: title,
            artist: artist,
            album: album,
            duration: "0:00",
            file: `idb://${trackId}`, // IndexedDB reference
            albumArt: this.getRandomImage(),
            colorClass: this.getRandomColorClass()
        };

        this.musicLibrary.push(newTrack);

        const tempUrl = URL.createObjectURL(file);
        const tempAudio = new Audio(tempUrl);
        tempAudio.addEventListener('loadedmetadata', () => {
            newTrack.duration = this.formatTime(tempAudio.duration);
            this.saveToStorage();
            if (this.musicLibrary.length === 1) this.loadTrack(0);
            if (window.playlistManager) window.playlistManager.renderPlaylist();
            URL.revokeObjectURL(tempUrl);
        });

        this.saveToStorage();
        return newTrack;
    }

    // Method to add track permanently (Desktop Desktop IPC)
    addTrackPermanent(filePath, title = "Unknown Track", artist = "Unknown Artist", album = "Unknown Album") {
        const newTrack = {
            id: Date.now(),
            title: title,
            artist: artist,
            album: album,
            duration: "0:00",
            file: filePath, // Real string path generated by Electron (e.g. 'music/filename.mp3')
            albumArt: this.getRandomImage(),
            colorClass: this.getRandomColorClass()
        };

        this.musicLibrary.push(newTrack);

        const tempAudio = new Audio(newTrack.file);
        tempAudio.addEventListener('loadedmetadata', () => {
            newTrack.duration = this.formatTime(tempAudio.duration);
            this.saveToStorage();
            if (this.musicLibrary.length === 1) this.loadTrack(0);
        });

        this.saveToStorage();
        return newTrack;
    }

    getRandomImage() {
        const randomIndex = Math.floor(Math.random() * this.availableImages.length);
        return this.availableImages[randomIndex];
    }

    getRandomColorClass() {
        const randomIndex = Math.floor(Math.random() * this.colorClasses.length);
        return this.colorClasses[randomIndex];
    }

    deleteTrack(index) {
        if (index < 0 || index >= this.musicLibrary.length) return false;

        // Revoke blob URL or delete from IDB if exists
        const track = this.musicLibrary[index];
        if (track.file && track.file.startsWith('idb://')) {
            const trackId = track.file.replace('idb://', '');
            deleteBlobFromDB(trackId);
        } else if (track.file && track.file.startsWith('blob:')) {
            URL.revokeObjectURL(track.file);
        }

        this.musicLibrary.splice(index, 1);

        // Adjust current index if needed
        if (this.musicLibrary.length === 0) {
            this.currentTrackIndex = 0;
            if (this.audio) {
                this.audio.pause();
                this.audio.src = '';
                this.isPlaying = false;
                this.updatePlayButton();
            }
        } else if (index <= this.currentTrackIndex && this.currentTrackIndex > 0) {
            this.currentTrackIndex--;
        }

        this.saveToStorage();
        return true;
    }
    checkAndApplyMarquee(element) {
        if (!element) return;
        
        // Reset first
        element.classList.remove('animate-scrolling');
        element.style.display = 'block';
        const text = element.textContent;
        element.innerHTML = `<span style="white-space: nowrap;">${text}</span>`;
        const span = element.querySelector('span');
        
        // Wait for next frame to get accurate measurements
        requestAnimationFrame(() => {
            if (span.scrollWidth > element.offsetWidth) {
                span.classList.add('animate-scrolling');
                // Duplicate text with a gap for a seamless loop
                span.innerHTML = `${text} &nbsp;&nbsp;&nbsp;&nbsp; ${text} &nbsp;&nbsp;&nbsp;&nbsp;`;
            } else {
                element.textContent = text; // Just plain text if it fits
            }
        });
    }
}

// Initialize the player
let musicPlayer;

// IndexedDB Helper
const DB_NAME = 'MelodyWaveDB';
const STORE_NAME = 'tracks';

const initDB = () => new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
        if (!e.target.result.objectStoreNames.contains(STORE_NAME)) {
            e.target.result.createObjectStore(STORE_NAME);
        }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
});

const saveBlobToDB = async (id, file) => {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(file, id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) { console.error(e); }
};

const getBlobFromDB = async (id) => {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).get(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    } catch (e) { console.error(e); return null; }
};

const deleteBlobFromDB = async (id) => {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) { console.error(e); }
};

document.addEventListener('DOMContentLoaded', () => {
    musicPlayer = new MusicPlayer();
    window.musicPlayer = musicPlayer;
});
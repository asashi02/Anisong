// --- PWA Installation & Service Worker ---
let deferredPrompt;
const installAppBtn = document.getElementById('installApp');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installAppBtn.classList.remove('hidden');
    installAppBtn.addEventListener('click', async () => {
        installAppBtn.classList.add('hidden');
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        deferredPrompt = null;
    });
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}

// --- Global Data Storage (In-memory, will be saved to Local Storage) ---
let mediaItems = {
    music: [],
    videos: [],
    images: [],
    anime: [], // { id: 'uuid', title: '', description: '', coverUrl: '' }
    playlists: []
};

let currentPlayingMedia = null; // Stores the media item currently playing

// --- Utility Functions ---
function generateUniqueId() {
    return 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

function saveToLocalStorage() {
    localStorage.setItem('anisongHubData', JSON.stringify(mediaItems));
    console.log('Data saved to Local Storage');
}

function loadFromLocalStorage() {
    const data = localStorage.getItem('anisongHubData');
    if (data) {
        mediaItems = JSON.parse(data);
        console.log('Data loaded from Local Storage');
    }
}

// --- UI Elements ---
const tabs = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

const musicFileInput = document.getElementById('musicFileInput');
const addMusicBtn = document.getElementById('addMusicBtn');
const musicList = document.getElementById('musicList');

const videoFileInput = document.getElementById('videoFileInput');
const addVideoBtn = document.getElementById('addVideoBtn');
const videoList = document.getElementById('videoList');

const imageFileInput = document.getElementById('imageFileInput');
const addImageBtn = document.getElementById('addImageBtn');
const imageList = document.getElementById('imageList');

const addAnimeBtn = document.getElementById('addAnimeBtn');
const animeList = document.getElementById('animeList');
const addAnimeModal = document.getElementById('addAnimeModal');
const animeTitleInput = document.getElementById('animeTitleInput');
const animeDescriptionInput = document.getElementById('animeDescriptionInput');
const animeCoverInput = document.getElementById('animeCoverInput');
const saveAnimeBtn = document.getElementById('saveAnimeBtn');

const addPlaylistBtn = document.getElementById('addPlaylistBtn');
const playlistList = document.getElementById('playlistList');

const mediaPlayerContainer = document.getElementById('mediaPlayerContainer');
const audioPlayer = document.getElementById('audioPlayer');
const videoPlayer = document.getElementById('videoPlayer');
const currentMediaTitle = document.getElementById('currentMediaTitle');
const currentMediaArtist = document.getElementById('currentMediaArtist');
const currentMediaAnime = document.getElementById('currentMediaAnime');
const currentMediaLyrics = document.getElementById('currentMediaLyrics');
const closePlayerBtn = document.getElementById('closePlayerBtn');

const editMediaModal = document.getElementById('editMediaModal');
const editMediaId = document.getElementById('editMediaId');
const editMediaType = document.getElementById('editMediaType');
const editMediaTitleInput = document.getElementById('editMediaTitleInput');
const editMediaArtistInput = document.getElementById('editMediaArtistInput');
const editMediaAnimeSelect = document.getElementById('editMediaAnimeSelect');
const editMediaLyricsInput = document.getElementById('editMediaLyricsInput');
const saveMediaEditBtn = document.getElementById('saveMediaEditBtn');
const deleteMediaBtn = document.getElementById('deleteMediaBtn');

const modalCloseButtons = document.querySelectorAll('.close-modal');

// --- Event Listeners ---

// Tab Switching
tabs.forEach(button => {
    button.addEventListener('click', () => {
        const targetTab = button.dataset.tab;

        tabs.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.add('hidden'));

        button.classList.add('active');
        document.getElementById(targetTab).classList.remove('hidden');

        // Re-render lists when tab changes to ensure fresh data
        renderMediaList('music');
        renderMediaList('videos');
        renderMediaList('images');
        renderAnimeList();
        renderPlaylistList();
    });
});

// Add Music Files
addMusicBtn.addEventListener('click', () => musicFileInput.click());
musicFileInput.addEventListener('change', (event) => handleFileSelection(event, 'music'));

// Add Video Files
addVideoBtn.addEventListener('click', () => videoFileInput.click());
videoFileInput.addEventListener('change', (event) => handleFileSelection(event, 'videos'));

// Add Image Files
addImageBtn.addEventListener('click', () => imageFileInput.click());
imageFileInput.addEventListener('change', (event) => handleFileSelection(event, 'images'));

// Add Anime Series
addAnimeBtn.addEventListener('click', () => {
    animeTitleInput.value = '';
    animeDescriptionInput.value = '';
    animeCoverInput.value = '';
    addAnimeModal.classList.remove('hidden');
});
saveAnimeBtn.addEventListener('click', saveAnimeSeries);

// Close Player
closePlayerBtn.addEventListener('click', closeMediaPlayer);

// Edit Media Modals
modalCloseButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        addAnimeModal.classList.add('hidden');
        editMediaModal.classList.add('hidden');
    });
});
saveMediaEditBtn.addEventListener('click', saveMediaEdits);
deleteMediaBtn.addEventListener('click', deleteMediaItem);

// --- Core Logic Functions ---

async function handleFileSelection(event, type) {
    const files = event.target.files;
    if (!files.length) return;

    for (const file of files) {
        const id = generateUniqueId();
        const url = URL.createObjectURL(file); // Create a temporary URL for immediate playback/display
        
        let title = file.name.split('.').slice(0, -1).join('.'); // Default title is filename
        let artist = '';
        let animeId = '';

        // Try to parse basic metadata for audio/video (very basic, can be improved with libraries)
        if (type === 'music' || type === 'videos') {
            try {
                const metadata = await parseMediaMetadata(file);
                if (metadata.title) title = metadata.title;
                if (metadata.artist) artist = metadata.artist;
            } catch (e) {
                console.warn('Could not parse media metadata:', e);
            }
        }

        mediaItems[type].push({
            id: id,
            type: type,
            title: title,
            artist: artist, // Relevant for music/videos
            animeId: animeId, // To link to an anime series
            lyricsUrl: '', // For music
            coverUrl: '', // For music/video album art or image
            fileUrl: url, // The URL to play/display the media
            fileName: file.name, // Store original filename for reference
            fileHandle: null, // We'll try to store FileSystemFileHandle if available
        });
    }

    // Attempt to get FileSystemFileHandle for persistent access (desktop Chrome primarily)
    // This part is complex and might not work on mobile.
    // For a simple PWA, we're relying on URL.createObjectURL for temporary access.
    // To persistently access files, we'd need to use the File System Access API
    // (window.showOpenFilePicker and window.showDirectoryPicker), which grants temporary permission.
    // For a true "local library" without re-selecting, you'd need the Origin Private File System
    // or a desktop app.

    saveToLocalStorage();
    renderMediaList(type);
    event.target.value = ''; // Clear input for next selection
}

// Very basic metadata parsing for demonstration. For robust parsing, consider external JS libraries.
async function parseMediaMetadata(file) {
    return new Promise((resolve) => {
        if (file.type.startsWith('audio/')) {
            // A real app would use a library like jsmediatags or id3.js for ID3 tags
            // For now, just return placeholder data
            resolve({ title: file.name.split('.').slice(0, -1).join('.'), artist: 'Unknown Artist' });
        } else if (file.type.startsWith('video/')) {
            resolve({ title: file.name.split('.').slice(0, -1).join('.'), artist: 'Unknown Creator' });
        } else {
            resolve({});
        }
    });
}

function renderMediaList(type) {
    const listElement = document.getElementById(`${type}List`);
    listElement.innerHTML = ''; // Clear current list

    mediaItems[type].forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('media-item');
        itemDiv.dataset.id = item.id;
        itemDiv.dataset.type = type;

        let thumbnail = '';
        if (item.coverUrl) {
            thumbnail = `<img src="${item.coverUrl}" alt="Cover" class="media-item-thumbnail">`;
        } else if (type === 'images') {
            thumbnail = `<img src="${item.fileUrl}" alt="Image" class="media-item-thumbnail">`;
        } else if (type === 'music') {
            thumbnail = `<img src="https://via.placeholder.com/60/FF0055/FFFFFF?text=🎵" alt="Music" class="media-item-thumbnail">`;
        } else if (type === 'videos') {
            thumbnail = `<img src="https://via.placeholder.com/60/007BFF/FFFFFF?text=▶️" alt="Video" class="media-item-thumbnail">`;
        }

        const animeTitle = mediaItems.anime.find(a => a.id === item.animeId)?.title || 'N/A';

        itemDiv.innerHTML = `
            ${thumbnail}
            <div class="media-item-info">
                <h4>${item.title}</h4>
                <p>${item.artist ? 'Artist: ' + item.artist : ''}</p>
                <p>Anime: ${animeTitle}</p>
            </div>
            <button class="edit-item-btn">Edit</button>
        `;

        itemDiv.querySelector('.media-item-info').addEventListener('click', () => playMedia(item));
        itemDiv.querySelector('.edit-item-btn').addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent playing when editing
            openEditMediaModal(item);
        });

        listElement.appendChild(itemDiv);
    });
}

function renderAnimeList() {
    animeList.innerHTML = '';
    mediaItems.anime.forEach(anime => {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('media-item');
        itemDiv.dataset.id = anime.id;
        itemDiv.dataset.type = 'anime';

        const cover = anime.coverUrl ? `<img src="${anime.coverUrl}" alt="Cover" class="media-item-thumbnail">` : `<img src="https://via.placeholder.com/60/0f3460/FFFFFF?text=🌟" alt="Anime" class="media-item-thumbnail">`;

        itemDiv.innerHTML = `
            ${cover}
            <div class="media-item-info">
                <h4>${anime.title}</h4>
                <p>${anime.description.substring(0, 70)}...</p>
                <p>Music: ${mediaItems.music.filter(m => m.animeId === anime.id).length}</p>
                <p>Videos: ${mediaItems.videos.filter(v => v.animeId === anime.id).length}</p>
            </div>
            <button class="edit-item-btn">Edit</button>
        `;
        
        itemDiv.querySelector('.media-item-info').addEventListener('click', () => viewAnimeDetails(anime));
        itemDiv.querySelector('.edit-item-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openEditAnimeModal(anime); // Need a separate edit modal for anime
        });
        animeList.appendChild(itemDiv);
    });
}

function renderPlaylistList() {
    playlistList.innerHTML = '';
    // Placeholder: Implement actual playlist management and display later
    const placeholder = document.createElement('p');
    placeholder.textContent = 'Playlist functionality to be implemented. You can create playlists from your music and videos here.';
    playlistList.appendChild(placeholder);
}


function playMedia(item) {
    if (currentPlayingMedia) {
        audioPlayer.pause();
        videoPlayer.pause();
    }

    currentPlayingMedia = item;
    mediaPlayerContainer.classList.remove('hidden');
    currentMediaTitle.textContent = item.title;
    currentMediaArtist.textContent = item.artist || '';
    currentMediaAnime.textContent = mediaItems.anime.find(a => a.id === item.animeId)?.title || 'N/A';
    currentMediaLyrics.textContent = item.lyricsUrl ? 'Lyrics available' : 'No lyrics'; // Simplified

    if (item.type === 'music') {
        audioPlayer.src = item.fileUrl;
        audioPlayer.classList.remove('hidden');
        videoPlayer.classList.add('hidden');
        audioPlayer.play();
    } else if (item.type === 'videos') {
        videoPlayer.src = item.fileUrl;
        videoPlayer.classList.remove('hidden');
        audioPlayer.classList.add('hidden');
        videoPlayer.play();
    } else {
        // Can't play images in the media player
        alert('Cannot play this type of media in the player. Try editing or viewing in image tab.');
        closeMediaPlayer();
    }
}

function closeMediaPlayer() {
    audioPlayer.pause();
    videoPlayer.pause();
    audioPlayer.src = '';
    videoPlayer.src = '';
    mediaPlayerContainer.classList.add('hidden');
    currentPlayingMedia = null;
}

function saveAnimeSeries() {
    const id = generateUniqueId();
    const title = animeTitleInput.value.trim();
    const description = animeDescriptionInput.value.trim();
    let coverUrl = '';

    if (!title) {
        alert('Anime title cannot be empty!');
        return;
    }

    if (animeCoverInput.files.length > 0) {
        coverUrl = URL.createObjectURL(animeCoverInput.files[0]);
    }

    mediaItems.anime.push({
        id: id,
        title: title,
        description: description,
        coverUrl: coverUrl
    });
    saveToLocalStorage();
    renderAnimeList();
    addAnimeModal.classList.add('hidden');
}

function openEditMediaModal(item) {
    editMediaId.value = item.id;
    editMediaType.value = item.type;
    editMediaTitleInput.value = item.title;
    editMediaArtistInput.value = item.artist || '';

    // Populate anime dropdown
    editMediaAnimeSelect.innerHTML = '<option value="">-- No Anime --</option>';
    mediaItems.anime.forEach(anime => {
        const option = document.createElement('option');
        option.value = anime.id;
        option.textContent = anime.title;
        if (anime.id === item.animeId) {
            option.selected = true;
        }
        editMediaAnimeSelect.appendChild(option);
    });

    editMediaModal.classList.remove('hidden');
}

function saveMediaEdits() {
    const id = editMediaId.value;
    const type = editMediaType.value;
    const itemIndex = mediaItems[type].findIndex(item => item.id === id);

    if (itemIndex > -1) {
        const item = mediaItems[type][itemIndex];
        item.title = editMediaTitleInput.value.trim();
        item.artist = editMediaArtistInput.value.trim();
        item.animeId = editMediaAnimeSelect.value;

        // Handle lyrics file upload if provided
        if (editMediaLyricsInput.files.length > 0) {
            item.lyricsUrl = URL.createObjectURL(editMediaLyricsInput.files[0]);
        }

        saveToLocalStorage();
        renderMediaList(type);
        editMediaModal.classList.add('hidden');
    }
}

function deleteMediaItem() {
    if (!confirm('Are you sure you want to delete this item?')) return;

    const id = editMediaId.value;
    const type = editMediaType.value;
    const itemIndex = mediaItems[type].findIndex(item => item.id === id);

    if (itemIndex > -1) {
        const itemToDelete = mediaItems[type][itemIndex];
        // Revoke Object URL to free up memory (important for many local files)
        if (itemToDelete.fileUrl) {
            URL.revokeObjectURL(itemToDelete.fileUrl);
        }
        if (itemToDelete.coverUrl && type !== 'images') { // Don't revoke if it's the image itself
             URL.revokeObjectURL(itemToDelete.coverUrl);
        }
        if (itemToDelete.lyricsUrl) {
             URL.revokeObjectURL(itemToDelete.lyricsUrl);
        }


        mediaItems[type].splice(itemIndex, 1);
        saveToLocalStorage();
        renderMediaList(type);
        editMediaModal.classList.add('hidden');
        if (currentPlayingMedia && currentPlayingMedia.id === id) {
            closeMediaPlayer();
        }
    }
}

// Placeholder for viewing anime details (e.g., show all media linked to it)
function viewAnimeDetails(anime) {
    alert(`Viewing details for Anime: ${anime.title}\nDescription: ${anime.description}`);
    // You would implement a new section or modal here to show all linked music, videos, images.
}

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();
    renderMediaList('music'); // Render default tab
    // You could also set a default tab active via JS
});


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
        console.log(`[PWA] User response to the install prompt: ${outcome}`);
        deferredPrompt = null;
    });
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('[PWA] ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(err => {
                console.error('[PWA] ServiceWorker registration failed: ', err);
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
    console.log('[Data] Data saved to Local Storage');
}

function loadFromLocalStorage() {
    const data = localStorage.getItem('anisongHubData');
    if (data) {
        mediaItems = JSON.parse(data);
        console.log('[Data] Data loaded from Local Storage');
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
        console.log(`[UI] Switched to tab: ${targetTab}`);
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

// Event listener for clicking on media items in the list (delegated)
document.querySelectorAll('.media-list').forEach(list => {
    list.addEventListener('click', (event) => {
        const itemDiv = event.target.closest('.media-item');
        if (itemDiv) {
            const id = itemDiv.dataset.id;
            const type = itemDiv.dataset.type;
            const item = mediaItems[type].find(i => i.id === id);
            // Ensure click is not on the edit button itself
            if (item && !event.target.closest('.edit-item-btn')) {
                console.log(`[Click Event] Item clicked: ${item.title} (${type})`);
                playMedia(item);
            }
        }
    });
});


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
        console.log('[UI] Modal closed.');
    });
});
saveMediaEditBtn.addEventListener('click', saveMediaEdits);
deleteMediaBtn.addEventListener('click', deleteMediaItem);

// --- Core Logic Functions ---

async function handleFileSelection(event, type) {
    const files = event.target.files;
    if (!files.length) {
        console.log(`[File] No files selected for ${type}.`);
        return;
    }

    for (const file of files) {
        const id = generateUniqueId();
        const url = URL.createObjectURL(file);
        
        let title = file.name.split('.').slice(0, -1).join('.');
        let artist = '';
        let animeId = '';

        if (type === 'music' || type === 'videos') {
            try {
                const metadata = await parseMediaMetadata(file); // Placeholder for real metadata parsing
                if (metadata.title) title = metadata.title;
                if (metadata.artist) artist = metadata.artist;
            } catch (e) {
                console.warn(`[File] Could not parse media metadata for ${file.name}:`, e);
            }
        }

        mediaItems[type].push({
            id: id,
            type: type,
            title: title,
            artist: artist,
            animeId: animeId,
            lyricsUrl: '',
            coverUrl: '',
            fileUrl: url, // Temporary URL for browser playback
            fileName: file.name,
            fileHandle: null, // For future File System Access API if applicable
        });
        console.log(`[File] Added ${type} item:`, mediaItems[type][mediaItems[type].length - 1]);
    }

    saveToLocalStorage();
    renderMediaList(type);
    event.target.value = ''; // Clear input for next selection
}

async function parseMediaMetadata(file) {
    // This is a very basic placeholder. For real metadata (ID3 tags etc.),
    // you would use a dedicated JS library like 'jsmediatags' or similar.
    return new Promise((resolve) => {
        if (file.type.startsWith('audio/')) {
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
    if (!listElement) {
        console.error(`[Render] List element for type "${type}" not found.`);
        return;
    }
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
            thumbnail = `<img src="./icons/music-placeholder.png" alt="Music" class="media-item-thumbnail">`; // Use a local placeholder icon
        } else if (type === 'videos') {
            thumbnail = `<img src="./icons/video-placeholder.png" alt="Video" class="media-item-thumbnail">`; // Use a local placeholder icon
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

        itemDiv.querySelector('.edit-item-btn').addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent playMedia from firing if edit button is clicked
            openEditMediaModal(item);
        });

        listElement.appendChild(itemDiv);
    });
    console.log(`[Render] Rendered ${mediaItems[type].length} items for ${type}.`);
}

function renderAnimeList() {
    animeList.innerHTML = '';
    if (mediaItems.anime.length === 0) {
        animeList.innerHTML = '<p style="text-align: center; color: #B0B0B0;">No anime series added yet. Add some to categorize your media!</p>';
    }
    mediaItems.anime.forEach(anime => {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('media-item');
        itemDiv.dataset.id = anime.id;
        itemDiv.dataset.type = 'anime';

        const cover = anime.coverUrl ? `<img src="${anime.coverUrl}" alt="Cover" class="media-item-thumbnail">` : `<img src="./icons/anime-placeholder.png" alt="Anime" class="media-item-thumbnail">`;

        itemDiv.innerHTML = `
            ${cover}
            <div class="media-item-info">
                <h4>${anime.title}</h4>
                <p>${anime.description.substring(0, 70)}${anime.description.length > 70 ? '...' : ''}</p>
                <p>Music: ${mediaItems.music.filter(m => m.animeId === anime.id).length} | Videos: ${mediaItems.videos.filter(v => v.animeId === anime.id).length}</p>
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
    console.log(`[Render] Rendered ${mediaItems.anime.length} anime series.`);
}

function renderPlaylistList() {
    playlistList.innerHTML = '';
    // Placeholder: Implement actual playlist management and display later
    const placeholder = document.createElement('p');
    placeholder.style.textAlign = 'center';
    placeholder.style.color = '#B0B0B0';
    placeholder.textContent = 'Playlist functionality to be implemented. Create custom collections of your music and videos here!';
    playlistList.appendChild(placeholder);
    console.log('[Render] Playlist list rendered (placeholder).');
}


function playMedia(item) {
    if (currentPlayingMedia) {
        audioPlayer.pause();
        videoPlayer.pause();
        audioPlayer.classList.add('hidden'); // Explicitly hide previous player
        videoPlayer.classList.add('hidden'); // Explicitly hide previous player
    }

    currentPlayingMedia = item;
    
    // Make the main player container visible AND activate its slide-up animation
    mediaPlayerContainer.classList.remove('hidden');
    mediaPlayerContainer.classList.add('active-player'); 
    
    // Update player info
    currentMediaTitle.textContent = item.title;
    currentMediaArtist.textContent = item.artist || '';
    currentMediaAnime.textContent = mediaItems.anime.find(a => a.id === item.animeId)?.title || 'N/A';
    currentMediaLyrics.textContent = item.lyricsUrl ? 'Lyrics available' : 'No lyrics';

    console.log(`[PlayMedia] Attempting to play: "${item.title}" (Type: "${item.type}", URL: "${item.fileUrl}")`);

    if (item.type === 'music') {
        audioPlayer.src = item.fileUrl;
        audioPlayer.classList.remove('hidden'); // Show audio player
        videoPlayer.classList.add('hidden');    // Hide video player
        audioPlayer.load(); // Load the new source
        audioPlayer.play().then(() => {
            console.log("[PlayMedia] Audio playback started successfully.");
        }).catch(e => {
            console.error("[PlayMedia Error] Audio playback failed:", e);
            alert(`Could not play audio "${item.title}": ${e.message}. Ensure media is supported.`);
            closeMediaPlayer(); // Close player if error
        });
    } else if (item.type === 'videos') {
        videoPlayer.src = item.fileUrl;
        videoPlayer.classList.remove('hidden'); // Show video player
        audioPlayer.classList.add('hidden');    // Hide audio player
        videoPlayer.load(); // Load the new source
        videoPlayer.play().then(() => {
            console.log("[PlayMedia] Video playback started successfully.");
        }).catch(e => {
            console.error("[PlayMedia Error] Video playback failed:", e);
            alert(`Could not play video "${item.title}": ${e.message}. Ensure media is supported and autoplay is allowed.`);
            closeMediaPlayer(); // Close player if error
        });
    } else {
        alert('Cannot play this type of media in the player. Try editing or viewing in the Images tab.');
        closeMediaPlayer();
        console.log("[PlayMedia] Attempted to play unplayable media type.");
    }
}

function closeMediaPlayer() {
    audioPlayer.pause();
    videoPlayer.pause();
    audioPlayer.src = ''; // Clear source
    videoPlayer.src = ''; // Clear source
    
    // Hide all player components and animate container down
    mediaPlayerContainer.classList.remove('active-player'); // Trigger slide-down animation
    // Use a timeout to fully hide AFTER animation, or rely on CSS `transition-end`
    setTimeout(() => {
        mediaPlayerContainer.classList.add('hidden');
        audioPlayer.classList.add('hidden');
        videoPlayer.classList.add('hidden');
    }, 300); // Match CSS transition duration
    
    currentPlayingMedia = null;
    console.log("[ClosePlayer] Media player closed.");
}

// Placeholder for viewing anime details (e.g., show all media linked to it)
function viewAnimeDetails(anime) {
    alert(`Viewing details for Anime: ${anime.title}\nDescription: ${anime.description}`);
    // You would implement a new section or modal here to show all linked music, videos, images.
    console.log(`[UI] Viewing details for Anime: "${anime.title}"`);
}

// Placeholder for openEditAnimeModal (if you implement a separate modal for anime series)
function openEditAnimeModal(anime) {
    alert(`Edit Anime Modal for: ${anime.title} (Not yet implemented)`);
    // This would open a modal similar to editMediaModal but for anime properties.
}

function saveAnimeSeries() {
    const id = generateUniqueId();
    const title = animeTitleInput.value.trim();
    const description = animeDescriptionInput.value.trim();
    let coverUrl = '';

    if (!title) {
        alert('Anime title cannot be empty!');
        console.warn('[Anime] Attempted to save anime with empty title.');
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
    console.log(`[Anime] Saved new anime series: "${title}"`);
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
    console.log(`[UI] Opened edit modal for item: "${item.title}" (${item.type})`);
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
            // Revoke old URL if exists to prevent memory leaks
            if (item.lyricsUrl) URL.revokeObjectURL(item.lyricsUrl);
            item.lyricsUrl = URL.createObjectURL(editMediaLyricsInput.files[0]);
        }

        saveToLocalStorage();
        renderMediaList(type);
        editMediaModal.classList.add('hidden');
        console.log(`[Edit] Saved edits for item: "${item.title}" (${item.type})`);
    } else {
        console.warn(`[Edit] Item not found for editing: ID ${id}, Type ${type}`);
    }
}

function deleteMediaItem() {
    if (!confirm('Are you sure you want to delete this item? This cannot be undone.')) {
        console.log('[Delete] Delete cancelled by user.');
        return;
    }

    const id = editMediaId.value;
    const type = editMediaType.value;
    const itemIndex = mediaItems[type].findIndex(item => item.id === id);

    if (itemIndex > -1) {
        const itemToDelete = mediaItems[type][itemIndex];
        
        // Revoke Object URLs to free up memory (important for many local files)
        if (itemToDelete.fileUrl) URL.revokeObjectURL(itemToDelete.fileUrl);
        if (itemToDelete.coverUrl && type !== 'images') URL.revokeObjectURL(itemToDelete.coverUrl); // Don't revoke if it's the image itself
        if (itemToDelete.lyricsUrl) URL.revokeObjectURL(itemToDelete.lyricsUrl);

        mediaItems[type].splice(itemIndex, 1);
        saveToLocalStorage();
        renderMediaList(type);
        editMediaModal.classList.add('hidden');
        if (currentPlayingMedia && currentPlayingMedia.id === id) {
            closeMediaPlayer(); // Close player if deleted item was playing
        }
        console.log(`[Delete] Deleted item: "${itemToDelete.title}" (${type})`);
    } else {
        console.warn(`[Delete] Item not found for deletion: ID ${id}, Type ${type}`);
    }
}


// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();
    // Render all lists on initial load, activate default tab 'music'
    renderMediaList('music'); 
    renderMediaList('videos');
    renderMediaList('images');
    renderAnimeList();
    renderPlaylistList();

    // Ensure initial tab is active
    document.querySelector('.tab-button[data-tab="music"]').classList.add('active');
    document.getElementById('music').classList.remove('hidden');
    console.log('[App] DOMContentLoaded. Initial rendering complete.');
});


// ... (previous script.js code) ...

function playMedia(item) {
    // Pause any currently playing media
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

    // Determine which player to use and set its source
    if (item.type === 'music') {
        audioPlayer.src = item.fileUrl;
        audioPlayer.classList.remove('hidden'); // Ensure audio player is visible
        videoPlayer.classList.add('hidden');    // Ensure video player is hidden
        audioPlayer.play();
    } else if (item.type === 'videos') {
        videoPlayer.src = item.fileUrl;
        videoPlayer.classList.remove('hidden'); // Ensure video player is visible
        audioPlayer.classList.add('hidden');    // Ensure audio player is hidden
        videoPlayer.play();
    } else {
        // Handle images or other types that cannot be played
        alert('Cannot play this type of media in the player. Try editing or viewing in the Images tab.');
        closeMediaPlayer(); // Close the player if it's an unplayable type
    }
}

function closeMediaPlayer() {
    audioPlayer.pause();
    videoPlayer.pause();
    audioPlayer.src = ''; // Clear source to stop loading
    videoPlayer.src = ''; // Clear source to stop loading
    mediaPlayerContainer.classList.add('hidden');
    audioPlayer.classList.add('hidden'); // Ensure both are hidden on close
    videoPlayer.classList.add('hidden'); // Ensure both are hidden on close
    currentPlayingMedia = null;
}

// ... (rest of script.js code) ...

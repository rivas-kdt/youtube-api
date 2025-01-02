# YouTube & YouTube Music API

A powerful, lightweight, and high-performance API for accessing YouTube and YouTube Music content, metadata, and streams. Designed for simplicity and flexibility, this library provides full access to YouTube sources, including videos, playlists, metadata, and more.

---

## Features

- 🎥 **Video Support**: Fetch and download YouTube videos effortlessly.
- 🎵 **Music Support**: Stream and download YouTube Music tracks seamlessly.
- 📊 **Metadata Extraction**: Retrieve detailed metadata for videos, songs, playlists, and artists.
- 🌍 **Multilingual Support**: Compatible with multiple languages.
- ⚡ **High Performance**: Optimized for speed and efficiency.
- 🔄 **Flexible Output**: Get video or audio in your preferred format.

---

## Installation

Install the package via npm:

```bash
npm install @hydralerne/youtube-api
```

---

## API Reference

### Core Functions

#### **getVideoId(q: string, isYoutube: boolean): Promise<string | { error: string }>**
Retrieves the YouTube video ID for a given song or title.

**Parameters:**
- `q`: The search query (e.g., song name or title).
- `isYoutube`: If true, searches YouTube; otherwise, searches YouTube Music.

**Returns:** The video ID or an error object.

---

#### **getYoutubeList(id: string): Promise<PlaylistData | { error: string }>**
Fetches metadata and tracks for a YouTube playlist.

**Parameters:**
- `id`: The ID of the YouTube playlist.

**Returns:** Playlist metadata and track list.

---

#### **getYotubeMusicList(id: string): Promise<PlaylistData | { error: string }>**
Fetches metadata and tracks for a YouTube Music playlist.

**Parameters:**
- `id`: The ID of the YouTube Music playlist.

**Returns:** Playlist metadata and track list.

---

#### **youtubeMusicSearch(q: string, method: string = 'songs'): Promise<SearchResult[] | { error: string }>**
Searches YouTube Music for songs, artists, albums, or playlists.

**Parameters:**
- `q`: The search query.
- `method`: The search category (songs, artists, albums, etc.).

**Returns:** An array of search results.

---

#### **getRelatedAndLyrics(id: string): Promise<{ lyrics: string, list: any, related: any } | { error: string }>**
Fetches related tracks, playlist queue, and lyrics for a given video ID.

**Parameters:**
- `id`: The YouTube video ID.

**Returns:** Related tracks, playlist queue, and lyrics data.

---

#### **getLyrics(id: string): Promise<string | { error: string }>**
Fetches lyrics for a specific video ID.

**Parameters:**
- `id`: The YouTube video ID.

**Returns:** Lyrics or an error object.

---

#### **getYTMusicRelated(id: string): Promise<any | { error: string }>**
Fetches related tracks for YouTube Music based on the provided ID.

**Parameters:**
- `id`: The ID of the track.

**Returns:** Related track details.

---

#### **getArtist(id: string): Promise<any | { error: string }>**
Fetches information about an artist.

**Parameters:**
- `id`: The artist ID.

**Returns:** Artist details.

---

#### **getAlbum(id: string): Promise<any | { error: string }>**
Fetches information about an album.

**Parameters:**
- `id`: The album ID.

**Returns:** Album details.

---

#### **getTrackData(id: string): Promise<TrackData | { error: string }>**
Fetches detailed track data, including artist, album, duration, and poster information.

**Parameters:**
- `id`: The track ID.

**Returns:** Track metadata and details.

---

#### **getPodcast(id: string): Promise<any | { error: string }>**
Fetches details about a podcast.

**Parameters:**
- `id`: The podcast ID.

**Returns:** Podcast details.

---

## Usage Examples

### Fetching YouTube Video Data
```javascript
import { getData, filter } from '@hydralerne/youtube-api';

const videoId = 'dQw4w9WgXcQ'; // Example video ID
const data = await getData(videoId);
const bestVideo = filter(data, 'bestvideo', { minResolution: 1080 });
console.log(bestVideo);
```

### Searching YouTube Music
```javascript
import { youtubeMusicSearch } from '@hydralerne/youtube-api';

const results = await youtubeMusicSearch('Imagine Dragons', 'songs');
console.log(results);
```

### Fetching a YouTube Playlist
```javascript
import { getYoutubeList } from '@hydralerne/youtube-api';

const playlistId = 'PLABC123456789'; // Example playlist ID
const playlist = await getYoutubeList(playlistId);
console.log(playlist);
```

### Retrieving YouTube Music Home Page
```javascript
import { getHome } from '@hydralerne/youtube-api';

const homeData = await getHome();
console.log(homeData);
```

### Advanced Filtering
The filter function supports advanced filtering options:

```javascript
const formats = await getData(videoId);
const bestAudio = filter(formats, 'bestaudio', { minBitrate: 128000, codec: 'mp4a' });
console.log(bestAudio);
```


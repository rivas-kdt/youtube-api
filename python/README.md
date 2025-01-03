"""
# YouTube & YouTube Music API

A powerful, lightweight, and high-performance API for accessing YouTube and YouTube Music content, metadata, and streams. Designed for simplicity and flexibility, this library provides full access to YouTube sources, including videos, playlists, metadata, and more.
"""
## Performance Comparison

This library is optimized for speed, making it significantly faster than other solutions like `yt-dlp`. Here's a performance comparison:

- **Hydra YouTube API**: ~300ms (approximate)
- **yt-dlp**: 5–3 seconds (approximate)

### Speed Improvement

On average, the Hydra YouTube API is:

- **~10x faster** than yt-dlp when processing video data.

This makes it an excellent choice for applications requiring low latency and quick responses.
# Features
# - Fetch videos, heigh quality audio sources, playlists, and metadata from YouTube and YouTube Music.
# - Retrieve lyrics, related tracks, and detailed metadata.

## Installation
To use the Hydra YouTube API, you can install it via pip:
```bash
pip install hydra_youtube_api
```

## Command-Line Interface (CLI)
Once installed, you can use the CLI tool `hydra-yt` to fetch YouTube video and audio data.

### Usage
```bash
hydra-yt <video_id> [options]
```

### Arguments
- **`video_id`**: The YouTube video ID you want to fetch data for.

### Options
- **`--bestaudio`**: Fetch the best audio format.
- **`--bestvideo`**: Fetch the best video format.
- **`--lowestaudio`**: Fetch the lowest quality audio format.
- **`--lowestvideo`**: Fetch the lowest quality video format.
- **`--videoandaudio`**: Fetch a format containing both video and audio.
- **`--videoonly`**: Fetch a video-only format.
- **`--audioonly`**: Fetch an audio-only format.
- **`--lyrics`**: Fetch lyrics for the video (if available).
- **`--ms`**: Measure and print the total time taken for the process.

### Example
```bash
hydra-yt dQw4w9WgXcQ --bestaudio
```
This command fetches the best audio format for the video with ID `dQw4w9WgXcQ`.

## API Reference

### `get_data`
#### Description
Fetches detailed data for a given YouTube video, including formats and metadata.

#### Signature
```python
async def get_data(video_id, is_raw=False, client_name='ios')
```

#### Parameters
- **`video_id` (str)**: The ID of the YouTube video to fetch data for.
- **`is_raw` (bool, optional)**: If `True`, returns raw API response data. Defaults to `False`.
- **`client_name` (str, optional)**: Specifies the client type (`'ios'` or `'android'`). Defaults to `'ios'`.

#### Returns
- **`dict`**: Parsed video formats and metadata if `is_raw=False`.
- **`dict`**: Raw API response if `is_raw=True`.

#### Example
```python
from hydra_youtube_api.sources import get_data
import asyncio

async def fetch_video_data():
    video_id = "dQw4w9WgXcQ"
    data = await get_data(video_id, is_raw=False, client_name='ios')
    print(data)

asyncio.run(fetch_video_data())
```

### `filter_formats`
#### Description
Filters video and audio formats from the raw or parsed video data.

#### Signature
```python
def filter_formats(formats, filter_type='all', options=None)
```

#### Parameters
- **`formats` (list)**: The list of formats to filter.
- **`filter_type` (str)**: The type of filter to apply. Options include:
  - `'all'`
  - `'bestvideo'`
  - `'bestaudio'`
  - `'lowestvideo'`
  - `'lowestaudio'`
  - `'videoandaudio'`
  - `'videoonly'`
  - `'audioonly'`
- **`options` (dict, optional)**: Additional filter options, such as:
  - `'fallback'` (bool): Whether to return a fallback format if no formats match.
  - `'customSort'` (callable): Custom sorting function.
  - `'minBitrate'` (int): Minimum bitrate in bps.
  - `'minResolution'` (int): Minimum resolution in pixels.
  - `'codec'` (str): Specific codec to filter by.

#### Returns
- **`list` or `dict`**: Filtered formats based on the specified filter type.

#### Example
```python
from hydra_youtube_api.sources import filter_formats

formats = [
    {"mimeType": "audio/mp4", "bitrate": 128000},
    {"mimeType": "video/mp4", "width": 1920, "height": 1080, "bitrate": 5000000}
]

best_audio = filter_formats(formats, filter_type='bestaudio')
print(best_audio)
```

from typing import Union, List, Dict, Any

# Core Functions

async def get_video_id(q: str, is_youtube: bool) -> Union[str, Dict[str, str]]:
    """
    Retrieves the YouTube video ID for a given song or title.

    Parameters:
    - q (str): The search query (e.g., song name or title).
    - is_youtube (bool): If true, searches YouTube; otherwise, searches YouTube Music.

    Returns:
    - str | Dict: The video ID or an error object.
    """
    pass

async def get_youtube_list(id: str) -> Union[Dict[str, Any], Dict[str, str]]:
    """
    Fetches metadata and tracks for a YouTube playlist.

    Parameters:
    - id (str): The ID of the YouTube playlist.

    Returns:
    - Dict: Playlist metadata and track list or an error object.
    """
    pass

async def get_youtube_music_list(id: str) -> Union[Dict[str, Any], Dict[str, str]]:
    """
    Fetches metadata and tracks for a YouTube Music playlist.

    Parameters:
    - id (str): The ID of the YouTube Music playlist.

    Returns:
    - Dict: Playlist metadata and track list or an error object.
    """
    pass

async def youtube_music_search(q: str, method: str = 'songs') -> Union[List[Any], Dict[str, str]]:
    """
    Searches YouTube Music for songs, artists, albums, or playlists.

    Parameters:
    - q (str): The search query.
    - method (str): The search category (songs, artists, albums, etc.).

    Returns:
    - List | Dict: An array of search results or an error object.
    """
    pass

async def get_related_and_lyrics(id: str) -> Union[Dict[str, Any], Dict[str, str]]:
    """
    Fetches related tracks, playlist queue, and lyrics for a given video ID.

    Parameters:
    - id (str): The YouTube video ID.

    Returns:
    - Dict: Related tracks, playlist queue, and lyrics data or an error object.
    """
    pass

async def get_lyrics(id: str) -> Union[str, Dict[str, str]]:
    """
    Fetches lyrics for a specific video ID.

    Parameters:
    - id (str): The YouTube video ID.

    Returns:
    - str | Dict: Lyrics or an error object.
    """
    pass

async def get_yt_music_related(id: str) -> Union[Any, Dict[str, str]]:
    """
    Fetches related tracks for YouTube Music based on the provided ID.

    Parameters:
    - id (str): The ID of the track.

    Returns:
    - Any | Dict: Related track details or an error object.
    """
    pass

async def get_artist(id: str) -> Union[Any, Dict[str, str]]:
    """
    Fetches information about an artist.

    Parameters:
    - id (str): The artist ID.

    Returns:
    - Any | Dict: Artist details or an error object.
    """
    pass

async def get_album(id: str) -> Union[Any, Dict[str, str]]:
    """
    Fetches information about an album.

    Parameters:
    - id (str): The album ID.

    Returns:
    - Any | Dict: Album details or an error object.
    """
    pass

async def get_track_data(id: str) -> Union[Dict[str, Any], Dict[str, str]]:
    """
    Fetches detailed track data, including artist, album, duration, and poster information.

    Parameters:
    - id (str): The track ID.

    Returns:
    - Dict: Track metadata and details or an error object.
    """
    pass

async def get_podcast(id: str) -> Union[Any, Dict[str, str]]:
    """
    Fetches details about a podcast.

    Parameters:
    - id (str): The podcast ID.

    Returns:
    - Any | Dict: Podcast details or an error object.
    """
    pass

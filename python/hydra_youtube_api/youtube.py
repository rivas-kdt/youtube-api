# ╔═══════════════════════════════════════════════════════╗
# ║                                                       ║
# ║                 Hydra de Lerne                        ║
# ║               All rights reserved                     ║
# ║                  onvo.me/hydra                        ║
# ║                                                       ║
# ╚═══════════════════════════════════════════════════════╝

import requests
import json
import re
import aiohttp
import asyncio

user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

async def scrap(url, agent='chrome'):
    agents = {
        'chrome': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        },
        'ios': {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15A372 Safari/604.1',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        },
        'android': {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Mobile; rv:89.0) Gecko/89.0 Firefox/89.0',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        }
    }
    headers = agents[agent]
    response = requests.get(url, headers=headers)
    return response

def filter_youtube(json_data):
    core = json_data['contents']['twoColumnSearchResultsRenderer']['primaryContents']['sectionListRenderer']['contents']
    
    tracks = []
    data = []

    for component in core:
        try:
            data.extend(component.get('itemSectionRenderer', {}).get('contents', []))
        except Exception as e:
            print(e)

    for video in data:
        try:
            tracks.append({
                'api': 'youtube',
                'id': video['videoRenderer']['videoId'],
                'poster': video['videoRenderer']['thumbnail']['thumbnails'][0]['url'],
                'title': video['videoRenderer']['title']['runs'][0]['text'],
                'artist': video['videoRenderer']['ownerText']['runs'][0]['text'],
            })
        except Exception as e:
            # print(e)
            pass

    return tracks

async def get_video_id(q, is_youtube):
    try:
        json_data = {}
        if is_youtube:
            # searching in youtube
            response = await scrap_youtube(f'https://www.youtube.com/results?search_query={q}')
            json_data = filter_youtube(response)
        else:
            # searching in youtube music
            main = await request(q)
            type_ = 'songs'
            params = get_tracking_param(main)
            data = await request(q, params[type_])
            json_data = filter_youtube_search(data, type_)
        
        if len(json_data) == 0:
            raise Exception('error yt')
        return json_data[0]['id']
    except Exception as e:
        print(e)
        return {'error': str(e)}

def filter_youtube_scrap(text_data):
    yt_initial_data_regex = re.compile(r'var ytInitialData = (.*?);<\/script>', re.S)
    match = yt_initial_data_regex.search(text_data)

    if match and match.group(1):
        return json.loads(match.group(1))
    else:
        return {'error': 'no_data'}

def extract_subtitles(html):
    yt_initial_data_regex = re.compile(r'var ytInitialPlayerResponse\s*=\s*(\{.*?\})\s*;', re.S)
    match = yt_initial_data_regex.search(html)

    if match and match.group(1):
        try:
            json_string = match.group(1)
            last_brace_index = json_string.rfind('}')
            json_string = json_string[:last_brace_index + 1]
            json_data = json.loads(json_string)
            return json_data
        except Exception:
            return {'error': 'json_parse_error'}
    else:
        return {'error': 'no_data'}

async def request_subtitles(video_id, html=None):
    try:
        if html is None:
            html = await scrap_youtube(f'https://www.youtube.com/watch?v={video_id}', True)
        
        json_data = extract_subtitles(html)
        captions = json_data.get('captions', {}).get('playerCaptionsTracklistRenderer', {}).get('captionTracks', [{'error': 'no_captions'}])
        url = None

        if 'auto' not in captions[0].get('name', {}).get('simpleText', ''):
            url = captions[0].get('baseUrl')

        original = None
        selected = captions[0].get('languageCode')

        try:
            for track in captions:
                if track['languageCode'] in ['ar', 'en']:
                    original = track['languageCode']
                    break

            for track in captions:
                if track['languageCode'] == original and 'auto' not in track.get('name', {}).get('simpleText', ''):
                    url = track['baseUrl']
                    selected = track['languageCode']
                    break
        except Exception as e:
            print(e)

        if url is None:
            return {'error': 'no_lyrics', 'descriptions': 'no_captions_found'}

        data = await scrap_youtube(url, True)
        return data
    except Exception as e:
        return {'error': str(e)}

def process_subtitles(subtitles):
    return [
        {
            'start': subtitle['start'],
            'end': subtitle['end'],
            'text': (subtitle['text'] if not re.match(r'^\[.*\]$', subtitle['text']) else None)
        }
        for subtitle in subtitles
        if subtitle['text'] is not None and subtitle['text'] != ""
    ]

async def scrap_youtube(url, e=False):
    try:
        response = await scrap(url)
        text_data = response.text
        if not e:
            text_data = filter_youtube_scrap(text_data)
        return text_data
    except Exception as e:
        print(e)
        return {'error': 'call_error'}

async def get_native_subtitles(video_id, html=None):
    try:
        data = await request_subtitles(video_id, html)
        # xml2js parsing would be done here if needed
        # For now, we will assume data is already in the required format
        return data
    except Exception as e:
        return e

async def get_youtube_list(id):
    try:
        json_data = await scrap_youtube(f'https://www.youtube.com/playlist?list={id}')
        tracks = []

        core = json_data['contents'] \
            .get('twoColumnBrowseResultsRenderer', {}) \
            .get('tabs', [{}])[0] \
            .get('tabRenderer', {}) \
            .get('content', {}) \
            .get('sectionListRenderer', {}) \
            .get('contents', [{}])[0] \
            .get('itemSectionRenderer', {}) \
            .get('contents', [{}])[0] \
            .get('playlistVideoListRenderer', {}) \
            .get('contents', [])

        for video in core:
            try:
                tracks.append({
                    'api': 'youtube',
                    'id': video['playlistVideoRenderer']['videoId'],
                    'poster': video['playlistVideoRenderer']['thumbnail']['thumbnails'][0]['url'],
                    'title': video['playlistVideoRenderer']['title']['runs'][0]['text'],
                    'artist': video['playlistVideoRenderer']['shortBylineText']['runs'][0]['text'],
                    'artist_id': video['playlistVideoRenderer'].get('shortBylineText', {}).get('runs', [{}])[0].get('browseEndpoint', {}).get('browseId'),
                })
            except Exception:
                pass

        data = {
            'api': 'youtube',
            'owner': {
                'id': json_data['header']['playlistHeaderRenderer']['ownerText']['runs'][0]['navigationEndpoint']['browseEndpoint']['browseId'],
                'name': json_data['header']['playlistHeaderRenderer']['ownerText']['runs'][0]['text'],
                'image': tracks[0]['poster'] if tracks else None
            },
            'name': json_data['header']['playlistHeaderRenderer']['title']['simpleText'],
            'description': json_data['header']['playlistHeaderRenderer']['descriptionText'],
            'tracks_count': json_data['header']['playlistHeaderRenderer']['numVideosText']['runs'][0]['text'],
            'tracks': tracks,
            'url': json_data['header']['playlistHeaderRenderer']['ownerText']['runs'][0]['navigationEndpoint']['browseEndpoint']['canonicalBaseUrl'],
        }

        return data
    except Exception as e:
        return {'error': str(e)}

def filter_youtube_music_scrap(text_data):
    regex = re.compile(r"data: '(.*?)'}\);", re.S)
    matches = regex.findall(text_data)

    if matches:
        return [match.replace(r'\\x([0-9A-Fa-f]{2})', lambda m: chr(int(m.group(1), 16))).replace(r'\\"', '') for match in matches]
    else:
        return []

async def get_youtube_music_list(id):
    try:
        url = f'https://music.youtube.com/playlist?list={id}'
        response = await scrap(url)
        html = response.text
        main = filter_youtube_music_scrap(html)
        raw_data = json.loads(main[1])

        playlist_id = raw_data['contents']['twoColumnBrowseResultsRenderer']['secondaryContents']['sectionListRenderer']['contents'][0]['musicPlaylistShelfRenderer']['playlistId']
        track_items = raw_data['contents']['twoColumnBrowseResultsRenderer']['secondaryContents']['sectionListRenderer']['contents'][0]['musicPlaylistShelfRenderer']['contents']
        playlist_title = raw_data['contents']['twoColumnBrowseResultsRenderer']['tabs'][0]['tabRenderer']['content']['sectionListRenderer']['contents'][0]['musicResponsiveHeaderRenderer']['title']['runs'][0]['text']
        owner = raw_data['contents']['twoColumnBrowseResultsRenderer']['tabs'][0]['tabRenderer']['content']['sectionListRenderer']['contents'][0]['musicResponsiveHeaderRenderer']
        owner_name = owner['straplineTextOne']['runs'][0]['text']
        owner_id = owner['straplineTextOne']['runs'][0]['navigationEndpoint']['browseEndpoint']['browseId']
        owner_image = owner['straplineThumbnail']['musicThumbnailRenderer']['thumbnail']['thumbnails'][1]['url']

        tracks = [
            {
                'api': 'youtube',
                'poster': renderer['thumbnail']['musicThumbnailRenderer']['thumbnail']['thumbnails'][0]['url'],
                'posterLarge': renderer['thumbnail']['musicThumbnailRenderer']['thumbnail']['thumbnails'][1]['url'] if renderer['thumbnail']['musicThumbnailRenderer']['thumbnail']['thumbnails'][1] else renderer['thumbnail']['musicThumbnailRenderer']['thumbnail']['thumbnails'][0]['url'],
                'title': renderer['flexColumns'][0]['musicResponsiveListItemFlexColumnRenderer']['text']['runs'][0]['text'],
                'artist': renderer['flexColumns'][1]['musicResponsiveListItemFlexColumnRenderer']['text']['runs'][0]['text'],
                'id': renderer['overlay']['musicItemThumbnailOverlayRenderer']['content']['musicPlayButtonRenderer']['playNavigationEndpoint']['watchEndpoint']['videoId'],
                'duration': time_to_milliseconds(renderer['overlay']['musicItemThumbnailOverlayRenderer']['content']['musicPlayButtonRenderer']['accessibilityPlayData']['accessibilityData']['label']) if 'accessibilityPlayData' in renderer['overlay']['musicItemThumbnailOverlayRenderer']['content']['musicPlayButtonRenderer'] else None
            }
            for item in track_items
            for renderer in [item['musicResponsiveListItemRenderer']]
        ]

        data = {
            'id': playlist_id,
            'api': 'youtube',
            'name': playlist_title,
            'owner': {
                'id': owner_id,
                'name': owner_name,
                'image': owner_image
            },
            'tracks_count': len(tracks),
            'tracks': tracks
        }

        return data
    except Exception as e:
        return {'error': str(e)}

def get_tracking_param(json_data):
    main = json_data['contents'] \
        .get('tabbedSearchResultsRenderer', {}) \
        .get('tabs', [{}])[0] \
        .get('tabRenderer', {}) \
        .get('content', {}) \
        .get('sectionListRenderer', {}) \
        .get('header', {}) \
        .get('chipCloudRenderer', {}) \
        .get('chips', [])
    
    data = {}
    for section in main:
        param = section['chipCloudChipRenderer']['navigationEndpoint']['searchEndpoint']['params']
        id_ = section['chipCloudChipRenderer']['uniqueId']
        if id_ == 'Songs':
            data['songs'] = param
        elif id_ == 'Videos':
            data['videos'] = param
        elif id_ == 'Albums':
            data['albums'] = param
        elif id_ == 'Featured playlists':
            data['playlists'] = param
        elif id_ == 'Community playlists':
            data['users_playlists'] = param
        elif id_ == 'Artists':
            data['artists'] = param
        elif id_ == 'Podcasts':
            data['podcasts'] = param
        elif id_ == 'Episodes':
            data['episodes'] = param
        elif id_ == 'Profiles':
            data['users'] = param
    return data

async def request(query, params):
    body = {
        "context": {
            "client": {
                "clientName": "WEB_REMIX",
                "clientVersion": "1.20241111.01.00",
                "acceptHeader": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                "timeZone": "Etc/GMT-2"
            }
        },
        "query": query,
        "params": params
    }
    response = requests.post('https://music.youtube.com/youtubei/v1/search', headers={
        'Content-Type': 'application/json',
        'User-Agent': user_agent
    }, json=body)
    json_data = response.json()
    return json_data

def time_to_milliseconds(time_string):
    try:
        time_parts = list(map(int, time_string.split(":")))
        if len(time_parts) == 3:
            hours, minutes, seconds = time_parts
            return (hours * 3600 + minutes * 60 + seconds) * 1000
        elif len(time_parts) == 2:
            minutes, seconds = time_parts
            return (minutes * 60 + seconds) * 1000
        else:
            print(time_string)
    except Exception:
        return None

def filter_menu(data):
    artists = [
        {
            'name': item['text'],
            'id': item['navigationEndpoint']['browseEndpoint']['browseId']
        }
        for item in data['musicResponsiveListItemRenderer']['flexColumns'][1]['musicResponsiveListItemFlexColumnRenderer']['text']['runs']
        if item['navigationEndpoint']['browseEndpoint']['browseEndpointContextSupportedConfigs']['browseEndpointContextMusicConfig']['pageType'] == "MUSIC_PAGE_TYPE_ARTIST"
    ]
    
    artist = data['musicResponsiveListItemRenderer']['flexColumns'][1]['musicResponsiveListItemFlexColumnRenderer']['text']['runs'][0]['navigationEndpoint']['browseEndpoint']['browseId']
    album_id = next(
        (item['menuNavigationItemRenderer']['navigationEndpoint']['browseEndpoint']['browseId']
         for item in data['musicResponsiveListItemRenderer']['menu']['menuRenderer']['items']
         if item.get('menuNavigationItemRenderer', {}).get('icon', {}).get('iconType') == 'ALBUM'),
        None
    )
    
    album_column = next(
        (column for column in data['musicResponsiveListItemRenderer']['flexColumns']
         if any(run['navigationEndpoint']['browseEndpoint']['browseId'] == album_id for run in column['musicResponsiveListItemFlexColumnRenderer']['text']['runs'])),
        None
    )
    
    album = album_column['musicResponsiveListItemFlexColumnRenderer']['text']['runs'][0]['text'].split('(')[0].strip() if album_column else None
    return {'artist': artist, 'albumID': album_id, 'album': album, 'artists': artists}

def filter_yt_music_tracks(track):
    duration = time_to_milliseconds(track['musicResponsiveListItemRenderer']['flexColumns'][1]['musicResponsiveListItemFlexColumnRenderer']['text']['runs'][4]['text'])
    poster = track['musicResponsiveListItemRenderer']['thumbnail']['musicThumbnailRenderer']['thumbnail']['thumbnails']
    ids = filter_menu(track)
    return {
        'api': 'youtube',
        'id': track['musicResponsiveListItemRenderer']['playlistItemData']['videoId'],
        'title': track['musicResponsiveListItemRenderer']['flexColumns'][0]['musicResponsiveListItemFlexColumnRenderer']['text']['runs'][0]['text'],
        'artist': track['musicResponsiveListItemRenderer']['flexColumns'][1]['musicResponsiveListItemFlexColumnRenderer']['text']['runs'][0]['text'],
        'artists': ids['artists'],
        'artistID': ids['artist'],
        'poster': poster[1]['url'] if len(poster) > 1 else poster[0]['url'],
        'posterLarge': (poster[1]['url'] if len(poster) > 1 else poster[0]['url']).split('=')[0] + '=w600-h600-l100-rj' if poster else None,
        'duration': duration,
        'album': ids['album'],
        'albumID': ids['albumID'],
    }
def filter_yt_music_podcasts(track):
    artist = track.get('musicResponsiveListItemRenderer', {}).get('flexColumns', [{}])[1].get('musicResponsiveListItemFlexColumnRenderer', {}).get('text', {}).get('runs')
    data = {
        'api': 'youtube',
        'kind': 'podcast',
        'id': track.get('musicResponsiveListItemRenderer', {}).get('navigationEndpoint', {}).get('browseEndpoint', {}).get('browseId'),
        'playlist': track['musicResponsiveListItemRenderer']['overlay']['musicItemThumbnailOverlayRenderer']['content']['musicPlayButtonRenderer']['playNavigationEndpoint']['watchPlaylistEndpoint']['playlistId'],
        'title': track['musicResponsiveListItemRenderer']['flexColumns'][0]['musicResponsiveListItemFlexColumnRenderer']['text']['runs'][0]['text'],
        'artist': artist[2]['text'] if artist and len(artist) > 2 else artist[0]['text'] if artist else None,
        'artistID': (artist[2].get('navigationEndpoint', {}).get('browseEndpoint', {}).get('browseId') if artist and len(artist) > 2 
                    else artist[0].get('navigationEndpoint', {}).get('browseEndpoint', {}).get('browseId') if artist else None),
        'poster': track['musicResponsiveListItemRenderer']['thumbnail']['musicThumbnailRenderer']['thumbnail']['thumbnails'][1]['url']
    }
    return data

def filter_yt_music_artists(artist):
    data = {
        'api': 'youtube',
        'kind': 'artist',
        'id': artist.get('musicResponsiveListItemRenderer', {}).get('navigationEndpoint', {}).get('browseEndpoint', {}).get('browseId'),
        'name': artist['musicResponsiveListItemRenderer']['flexColumns'][0]['musicResponsiveListItemFlexColumnRenderer']['text']['runs'][0]['text'],
        'followers': (artist.get('musicResponsiveListItemRenderer', {}).get('flexColumns', [{}])[1]
                     .get('musicResponsiveListItemFlexColumnRenderer', {}).get('text', {}).get('runs', [{}])[2]
                     .get('text', '').replace('subscribers', 'followers')),
        'poster': artist['musicResponsiveListItemRenderer']['thumbnail']['musicThumbnailRenderer']['thumbnail']['thumbnails'][1]['url'],
        'posterLarge': artist['musicResponsiveListItemRenderer']['thumbnail']['musicThumbnailRenderer']['thumbnail']['thumbnails'][1]['url'].split('=')[0] + '=w600-h600-l100-rj'
    }
    return data

def filter_yt_music_episodes(track):
    return {
        'api': 'youtube',
        'kind': 'episode',
        'id': track['musicResponsiveListItemRenderer']['playlistItemData']['videoId'],
        'title': track['musicResponsiveListItemRenderer']['flexColumns'][0]['musicResponsiveListItemFlexColumnRenderer']['text']['runs'][0]['text'],
        'poadcast': track['musicResponsiveListItemRenderer']['flexColumns'][1]['musicResponsiveListItemFlexColumnRenderer']['text']['runs'][2]['text'],
        'poadcastID': track['musicResponsiveListItemRenderer']['flexColumns'][1]['musicResponsiveListItemFlexColumnRenderer']['text']['runs'][2]['navigationEndpoint']['browseEndpoint']['browseId'],
        'poster': track['musicResponsiveListItemRenderer']['thumbnail']['musicThumbnailRenderer']['thumbnail']['thumbnails'][0]['url']
    }

def filter_youtube_search(data, type):
    sections = (data.get('contents', {})
               .get('tabbedSearchResultsRenderer', {})
               .get('tabs', [{}])[0]
               .get('tabRenderer', {})
               .get('content', {})
               .get('sectionListRenderer', {})
               .get('contents', []))
    
    tracks = []
    for section in sections:
        try:
            loop = section.get('musicShelfRenderer', {}).get('contents', [])
            for track in loop:
                try:
                    if type == 'songs':
                        tracks.append(filter_yt_music_tracks(track))
                    elif type == 'podcasts':
                        tracks.append(filter_yt_music_podcasts(track))
                    elif type == 'artists':
                        tracks.append(filter_yt_music_artists(track))
                    elif type == 'episodes':
                        tracks.append(filter_yt_music_episodes(track))
                except Exception as e:
                    print(f"Error: {e}")
        except Exception as e:
            print(f"Error: {e}")
    return tracks

async def youtube_music_search(q, method='songs'):
    try:
        main = await request(q)
        type = method or 'songs'
        params = get_tracking_param(main)
        data = await request(q, params[type])
        json_data = filter_youtube_search(data, type)
        return json_data
    except Exception as e:
        print(f"Error: {e}")
        return {'error': str(e)}

async def request_next(id):
    async with aiohttp.ClientSession() as session:
        async with session.post(
            'https://music.youtube.com/youtubei/v1/next',
            headers={
                'Content-Type': 'application/json',
                'User-Agent': user_agent
            },
            json={
                "videoId": id,
                "isAudioOnly": True,
                "context": {
                    "client": {
                        "clientName": "WEB_REMIX",
                        "clientVersion": "1.20241106.01.00"
                    }
                }
            }
        ) as response:
            data = await response.json()
            return data

async def get_video_sections(id):
    data = await request_next(id)
    sections = (data.get('contents', {})
               .get('singleColumnMusicWatchNextResultsRenderer', {})
               .get('tabbedRenderer', {})
               .get('watchNextTabbedResultsRenderer', {})
               .get('tabs', [{}])[0]
               .get('tabRenderer', {})
               .get('content', {})
               .get('musicQueueRenderer', {})
               .get('content', {})
               .get('playlistPanelRenderer', {})
               .get('contents', []))
    
    mix_id = None
    mix_param = None
    
    for section in sections:
        try:
            if 'automixPreviewVideoRenderer' in section:
                mix = (section.get('automixPreviewVideoRenderer', {})
                       .get('content', {})
                       .get('automixPlaylistVideoRenderer', {})
                       .get('navigationEndpoint', {})
                       .get('watchPlaylistEndpoint', {}))
                mix_id = mix.get('playlistId')
                mix_param = mix.get('params')
            elif 'playlistPanelVideoRenderer' in section:
                mix_id = (section.get('menu', {})
                         .get('menuRenderer', {})
                         .get('items', [{}])[0]
                         .get('menuNavigationItemRenderer', {})
                         .get('navigationEndpoint', {})
                         .get('watchEndpoint', {})
                         .get('playlistId'))
        except Exception as e:
            print(f"Error: {e}")
    
    related = (data.get('contents', {})
              .get('singleColumnMusicWatchNextResultsRenderer', {})
              .get('tabbedRenderer', {})
              .get('watchNextTabbedResultsRenderer', {})
              .get('tabs', [{}])[2]
              .get('tabRenderer', {})
              .get('endpoint', {})
              .get('browseEndpoint', {})
              .get('browseId'))
    
    lyrics = (data.get('contents', {})
             .get('singleColumnMusicWatchNextResultsRenderer', {})
             .get('tabbedRenderer', {})
             .get('watchNextTabbedResultsRenderer', {})
             .get('tabs', [{}])[1]
             .get('tabRenderer', {})
             .get('endpoint', {})
             .get('browseEndpoint', {})
             .get('browseId'))
    
    return {'mix': mix_id, 'mixParam': mix_param, 'related': related, 'lyrics': lyrics}

def filter_track_next_list(track):
    duration = time_to_milliseconds(track['playlistPanelVideoRenderer']['lengthText']['runs'][0]['text'])
    album_id = next((item.get('menuNavigationItemRenderer', {})
                    .get('navigationEndpoint', {})
                    .get('browseEndpoint', {})
                    .get('browseId')
                    for item in track['playlistPanelVideoRenderer']['menu']['menuRenderer']['items']
                    if item.get('menuNavigationItemRenderer', {}).get('icon', {}).get('iconType') == 'ALBUM'), None)
    
    album = next((item['text'] 
                  for item in track['playlistPanelVideoRenderer']['longBylineText']['runs']
                  if item.get('navigationEndpoint', {}).get('browseEndpoint', {}).get('browseId') == album_id),
                 None) if album_id else None
    
    return {
        'api': 'youtube',
        'id': track['playlistPanelVideoRenderer']['videoId'],
        'title': track['playlistPanelVideoRenderer']['title']['runs'][0]['text'],
        'artist': track['playlistPanelVideoRenderer']['shortBylineText']['runs'][0]['text'],
        'artistID': track['playlistPanelVideoRenderer']['longBylineText']['runs'][0].get('navigationEndpoint', {}).get('browseEndpoint', {}).get('browseId'),
        'poster': track['playlistPanelVideoRenderer']['thumbnail']['thumbnails'][1]['url'],
        'posterLarge': track['playlistPanelVideoRenderer']['thumbnail']['thumbnails'][2]['url'].split('=')[0] + '=w600-h600-l100-rj',
        'album': album,
        'albumID': album_id,
        'duration': duration,
    }

async def get_playlist_queue(id, params):
    async with aiohttp.ClientSession() as session:
        async with session.post(
            'https://music.youtube.com/youtubei/v1/next',
            headers={
                'Content-Type': 'application/json',
                'User-Agent': user_agent
            },
            json={
                "playlistId": id,
                "params": params,
                "isAudioOnly": True,
                "context": {
                    "client": {
                        "clientName": "WEB_REMIX",
                        "clientVersion": "1.20241106.01.00",
                        "clientFormFactor": "UNKNOWN_FORM_FACTOR"
                    }
                }
            }
        ) as response:
            data = await response.json()
            tracks_raw = (data.get('contents', {})
                        .get('singleColumnMusicWatchNextResultsRenderer', {})
                        .get('tabbedRenderer', {})
                        .get('watchNextTabbedResultsRenderer', {})
                        .get('tabs', [{}])[0]
                        .get('tabRenderer', {})
                        .get('content', {})
                        .get('musicQueueRenderer', {})
                        .get('content', {})
                        .get('playlistPanelRenderer', {})
                        .get('contents', []))
            
            tracks = []
            for track in tracks_raw:
                try:
                    tracks.append(filter_track_next_list(track))
                except Exception as e:
                    print(f"Error: {e}")
            return tracks

def filter_track_related(track):
    return {
        'api': 'youtube',
        'id': track['musicResponsiveListItemRenderer']['playlistItemData']['videoId'],
        'title': track['musicResponsiveListItemRenderer']['flexColumns'][0]['musicResponsiveListItemFlexColumnRenderer']['text']['runs'][0]['text'],
        'artist': track['musicResponsiveListItemRenderer']['flexColumns'][1]['musicResponsiveListItemFlexColumnRenderer']['text']['runs'][0]['text'],
        'artistID': track['musicResponsiveListItemRenderer']['flexColumns'][1]['musicResponsiveListItemFlexColumnRenderer']['text']['runs'][0].get('navigationEndpoint', {}).get('browseEndpoint', {}).get('browseId'),
        'poster': track['musicResponsiveListItemRenderer']['thumbnail']['musicThumbnailRenderer']['thumbnail']['thumbnails'][1].get('url'),
        'posterLarge': track['musicResponsiveListItemRenderer']['thumbnail']['musicThumbnailRenderer']['thumbnail']['thumbnails'][1]['url'].split('=')[0] + '=w600-h600-l100-rj' if track['musicResponsiveListItemRenderer']['thumbnail']['musicThumbnailRenderer']['thumbnail']['thumbnails'][1].get('url') else None,
        'album': track['musicResponsiveListItemRenderer']['flexColumns'][2]['musicResponsiveListItemFlexColumnRenderer']['text']['runs'][0].get('text', '').split('(')[0].strip() if track['musicResponsiveListItemRenderer']['flexColumns'][2]['musicResponsiveListItemFlexColumnRenderer']['text']['runs'][0].get('text') else None,
        'albumID': track['musicResponsiveListItemRenderer']['flexColumns'][2]['musicResponsiveListItemFlexColumnRenderer']['text']['runs'][0].get('navigationEndpoint', {}).get('browseEndpoint', {}).get('browseId')
    }

def filter_related_artists(artist):
    data = {
        'api': 'youtube',
        'kind': 'artist',
        'id': artist.get('musicTwoRowItemRenderer', {}).get('navigationEndpoint', {}).get('browseEndpoint', {}).get('browseId'),
        'name': artist.get('musicTwoRowItemRenderer', {}).get('title', {}).get('runs', [{}])[0].get('text'),
        'followers': artist.get('musicTwoRowItemRenderer', {}).get('subtitle', {}).get('runs', [{}])[0].get('text', '').replace('subscribers', 'followers'),
        'poster': artist.get('musicTwoRowItemRenderer', {}).get('thumbnailRenderer', {}).get('musicThumbnailRenderer', {}).get('thumbnail', {}).get('thumbnails', [{}])[0].get('url'),
        'posterLarge': artist.get('musicTwoRowItemRenderer', {}).get('thumbnailRenderer', {}).get('musicThumbnailRenderer', {}).get('thumbnail', {}).get('thumbnails', [{}, {}])[1].get('url')
    }
    return data

async def request_browse(id):
    async with aiohttp.ClientSession() as session:
        async with session.post('https://music.youtube.com/youtubei/v1/browse',
            headers={
                'Content-Type': 'application/json',
                'User-Agent': user_agent
            },
            json={
                "context": {
                    "client": {
                        "clientName": "WEB_REMIX",
                        "clientVersion": "1.20241106.01.00",
                        "clientFormFactor": "UNKNOWN_FORM_FACTOR"
                    }
                },
                "browseId": id
            }) as response:
            data = await response.json()
            return data

async def get_song_lyrics(param, id, and_native=False):
    tasks = [request_browse(param)]
    if and_native:
        tasks.append(get_native_subtitles(id))
    else:
        tasks.append(asyncio.sleep(0))  # Dummy task
    
    results = await asyncio.gather(*tasks)
    data = results[0]
    subtitles = results[1] if and_native else {}
    
    lyrics_raw = (data.get('contents', {})
        .get('sectionListRenderer', {})
        .get('contents', [{}])[0]
        .get('musicDescriptionShelfRenderer', {})
        .get('description', {})
        .get('runs', [{}])[0]
        .get('text'))

    lyrics = {
        'lines': [{'text': line} for line in lyrics_raw.split("\n") if line.replace("\r", '')] if lyrics_raw else [],
        'synced': subtitles
    }

    return lyrics

async def get_ytmusic_related(id):
    data = await request_browse(id)
    sections = (data.get('contents', {})
        .get('sectionListRenderer', {})
        .get('contents', [{}])[0]
        .get('musicCarouselShelfRenderer', {})
        .get('contents'))
    artists_raw = (data.get('contents', {})
        .get('sectionListRenderer', {})
        .get('contents', [{}])[1]
        .get('musicCarouselShelfRenderer', {})
        .get('contents'))
    about = (data.get('contents', {})
        .get('sectionListRenderer', {})
        .get('contents', [{}])[2]
        .get('musicDescriptionShelfRenderer', {})
        .get('description', {})
        .get('runs', [{}])[0]
        .get('text'))

    artists = []
    if artists_raw:
        for artist in artists_raw:
            try:
                artists.append(filter_related_artists(artist))
            except Exception as e:
                print(f"Error: {e}")

    tracks = []
    if sections:
        for section in sections:
            try:
                tracks.append(filter_track_related(section))
            except Exception as e:
                print(f"Error: {e}")

    return {'artists': artists, 'tracks': tracks, 'about': about}

async def get_lyrics(id):
    try:
        params = await get_video_sections(id)
        lyrics = await get_song_lyrics(params['lyrics'], id)
        return lyrics
    except Exception as e:
        print(f"Error: {e}")

async def get_related_and_lyrics(id):
    try:
        params = await get_video_sections(id)
        results = await asyncio.gather(
            get_playlist_queue(params['mix'], params['mixParam']),
            get_ytmusic_related(params['related']),
            get_lyrics(params['lyrics'], id)
        )
        print('requesting')
        return {'lyrics': results[2], 'list': results[0], 'related': results[1]}
    except Exception as e:
        print(f"Error: {e}")
        return {'error': str(e)}

def filter_songs_section(data):
    tracks = []
    for track in data['contents']:
        try:
            tracks.append(filter_ytmusic_tracks(track))
        except Exception as e:
            print(f"Error: {e}")
    
    return {
        'type': 'songs',
        'id': data['title']['runs'][0]['navigationEndpoint']['browseEndpoint']['browseId'],
        'params': data['title']['runs'][0]['navigationEndpoint']['browseEndpoint']['params'],
        'tracks': tracks
    }

def filter_albums(data):
    albums = []
    for album in data['contents']:
        try:
            albums.append({
                'api': 'youtube',
                'kind': 'album',
                'id': album['musicTwoRowItemRenderer']['navigationEndpoint']['browseEndpoint']['browseId'],
                'title': album['musicTwoRowItemRenderer']['title']['runs'][0]['text'],
                'artist': album['musicTwoRowItemRenderer']['subtitle']['runs'][2].get('text'),
                'artistID': album.get('musicTwoRowItemRenderer', {}).get('subtitle', {}).get('runs', [{}, {}, {}])[2].get('navigationEndpoint', {}).get('browseEndpoint', {}).get('browseId'),
                'poster': album['musicTwoRowItemRenderer']['thumbnailRenderer']['musicThumbnailRenderer']['thumbnail']['thumbnails'][0].get('url'),
                'posterLarge': album['musicTwoRowItemRenderer']['thumbnailRenderer']['musicThumbnailRenderer']['thumbnail']['thumbnails'][1].get('url'),
                'playlistID': album.get('musicTwoRowItemRenderer', {}).get('menu', {}).get('menuRenderer', {}).get('items', [{}])[0].get('menuNavigationItemRenderer', {}).get('navigationEndpoint', {}).get('watchPlaylistEndpoint', {}).get('playlistId'),
                'param': album.get('musicTwoRowItemRenderer', {}).get('menu', {}).get('menuRenderer', {}).get('items', [{}])[0].get('menuNavigationItemRenderer', {}).get('navigationEndpoint', {}).get('watchPlaylistEndpoint', {}).get('params')
            })
        except Exception as e:
            print(f"Error: {e}")
    
    return {
        'type': 'albums',
        'id': data.get('header', {}).get('musicCarouselShelfBasicHeaderRenderer', {}).get('title', {}).get('runs', [{}])[0].get('navigationEndpoint', {}).get('browseEndpoint', {}).get('browseId'),
        'params': data.get('header', {}).get('musicCarouselShelfBasicHeaderRenderer', {}).get('title', {}).get('runs', [{}])[0].get('navigationEndpoint', {}).get('browseEndpoint', {}).get('params'),
        'data': albums
    }

def filter_singles(data):
    albums = []
    for album in data['contents']:
        try:
            albums.append({
                'api': 'youtube',
                'kind': 'single',
                'id': album['musicTwoRowItemRenderer']['navigationEndpoint']['browseEndpoint']['browseId'],
                'title': album['musicTwoRowItemRenderer']['title']['runs'][0]['text'],
                'artist': album['musicTwoRowItemRenderer']['subtitle']['runs'][2].get('text'),
                'poster': album['musicTwoRowItemRenderer']['thumbnailRenderer']['musicThumbnailRenderer']['thumbnail']['thumbnails'][0].get('url'),
                'posterLarge': album['musicTwoRowItemRenderer']['thumbnailRenderer']['musicThumbnailRenderer']['thumbnail']['thumbnails'][1].get('url')
            })
        except Exception as e:
            print(f"Error: {e}")
    
    return {
        'type': 'singles',
        'id': data.get('header', {}).get('musicCarouselShelfBasicHeaderRenderer', {}).get('title', {}).get('runs', [{}])[0].get('navigationEndpoint', {}).get('browseEndpoint', {}).get('browseId'),
        'params': data.get('header', {}).get('musicCarouselShelfBasicHeaderRenderer', {}).get('title', {}).get('runs', [{}])[0].get('navigationEndpoint', {}).get('browseEndpoint', {}).get('params'),
        'data': albums
    }

def filter_list(data):
    lists = []
    for list_item in data:
        try:
            lists.append({
                'api': 'youtube',
                'kind': 'playlist',
                'id': list_item['musicTwoRowItemRenderer']['navigationEndpoint']['browseEndpoint']['browseId'],
                'title': list_item['musicTwoRowItemRenderer']['title']['runs'][0]['text'],
                'artist': 'Youtube music',
                'poster': list_item['musicTwoRowItemRenderer']['thumbnailRenderer']['musicThumbnailRenderer']['thumbnail']['thumbnails'][0]['url'],
                'posterLarge': list_item['musicTwoRowItemRenderer']['thumbnailRenderer']['musicThumbnailRenderer']['thumbnail']['thumbnails'][1]['url']
            })
        except Exception as e:
            print(f"Error: {e}")
    return lists

def filter_artists(data):
    artists = []
    for list_item in data:
        try:
            artists.append({
                'api': 'youtube',
                'kind': 'artist',
                'id': list_item['musicTwoRowItemRenderer']['navigationEndpoint']['browseEndpoint']['browseId'],
                'name': list_item['musicTwoRowItemRenderer']['title']['runs'][0]['text'],
                'followers': list_item['musicTwoRowItemRenderer']['subtitle']['runs'][0]['text'].replace('subscribers', 'followers'),
                'poster': list_item['musicTwoRowItemRenderer']['thumbnailRenderer']['musicThumbnailRenderer']['thumbnail']['thumbnails'][0]['url'],
                'posterLarge': list_item['musicTwoRowItemRenderer']['thumbnailRenderer']['musicThumbnailRenderer']['thumbnail']['thumbnails'][1]['url']
            })
        except Exception as e:
            print(f"Error: {e}")
    return artists

def filter_artist_sections(json_data):
    sections = json_data['contents']['singleColumnBrowseResultsRenderer']['tabs'][0]['tabRenderer']['content']['sectionListRenderer']['contents']
    data = {}
    
    for section in sections:
        try:
            if 'musicShelfRenderer' in section:
                data['songs'] = filter_songs_section(section['musicShelfRenderer'])
            elif 'musicCarouselShelfRenderer' in section:
                main = section['musicCarouselShelfRenderer']['header']['musicCarouselShelfBasicHeaderRenderer']['title']['runs'][0]
                type_text = main['text']
                
                if type_text == 'Albums':
                    data['albums'] = filter_albums(section['musicCarouselShelfRenderer'])
                elif type_text == 'Singles':
                    data['singles'] = filter_singles(section['musicCarouselShelfRenderer'])
                elif type_text == 'Featured on':
                    data['lists'] = filter_list(section['musicCarouselShelfRenderer']['contents'])
                elif type_text == 'Fans might also like':
                    data['artists'] = filter_artists(section['musicCarouselShelfRenderer']['contents'])
        except Exception as e:
            print(f"Error: {e}")
    
    return data

def filter_artist_data(json, id):
    artist = json.get('header', {}).get('musicImmersiveHeaderRenderer')
    sections = filter_artist_sections(json)
    
    thumbnail = (artist.get('thumbnail', {})
                .get('musicThumbnailRenderer', {})
                .get('thumbnail', {})
                .get('thumbnails', [{}])[0]
                .get('url', ''))
    
    image = thumbnail.split('=w')[0] if thumbnail else None
    
    data = {
        'id': id,
        'api': 'youtube',
        'name': artist.get('title', {}).get('runs', [{}])[0].get('text'),
        'description': artist.get('description', {}).get('runs', [{}])[0].get('text'),
        'followers': (artist.get('subscriptionButton', {})
                    .get('subscribeButtonRenderer', {})
                    .get('subscriberCountText', {})
                    .get('runs', [{}])[0]
                    .get('text')),
        'poster': f"{image}=w1000-h1000-p-l100-rj" if image else None,
        'images': artist.get('thumbnail', {}).get('musicThumbnailRenderer', {}).get('thumbnail', {}).get('thumbnails'),
        **sections
    }
    return data

async def get_artist(id):
    try:
        data = await request_browse(id)
        json = filter_artist_data(data, id)
        return json
    except Exception as e:
        print(e)
        return {'error': str(e)}

def filter_album_track(track, data):
    duration = time_to_milliseconds(
        track['fixedColumns'][0]['musicResponsiveListItemFixedColumnRenderer']['text']['runs'][0]['text']
    )
    return {
        'api': 'youtube',
        'id': track['playlistItemData']['videoId'],
        'title': track['flexColumns'][0]['musicResponsiveListItemFlexColumnRenderer']['text']['runs'][0]['text'],
        'plays_count': (track.get('flexColumns', [{}])[2]
                       .get('musicResponsiveListItemFlexColumnRenderer', {})
                       .get('text', {})
                       .get('runs', [{}])[0]
                       .get('text')),
        **data,
        'duration': duration,
    }

def time_to_mss(time_string):
    try:
        time_units = {
            'hour': 3600000,
            'minute': 60000,
            'second': 1000,
            'millisecond': 1
        }
        
        import re
        total_milliseconds = 0
        time_parts = re.findall(r'(\d+)\s*(hours?|minutes?|seconds?|milliseconds?)', time_string, re.IGNORECASE)
        
        if time_parts:
            for value, unit in time_parts:
                normalized_unit = unit.lower().rstrip('s')
                total_milliseconds += (int(value) or 0) * (time_units.get(normalized_unit, 0))
        
        return total_milliseconds
    except Exception as e:
        print(e)
        return time_string

def filter_album_data(data, id):
    tracks_raw = (data.get('contents', {})
                 .get('twoColumnBrowseResultsRenderer', {})
                 .get('secondaryContents', {})
                 .get('sectionListRenderer', {})
                 .get('contents', [{}])[0]
                 .get('musicShelfRenderer', {})
                 .get('contents'))
    
    playlist_id = (tracks_raw[0].get('musicResponsiveListItemRenderer', {})
                  .get('flexColumns', [{}])[0]
                  .get('musicResponsiveListItemFlexColumnRenderer', {})
                  .get('text', {})
                  .get('runs', [{}])[0]
                  .get('navigationEndpoint', {})
                  .get('watchEndpoint', {})
                  .get('playlistId')) if tracks_raw else None
    
    poster_raw = data.get('background', {}).get('musicThumbnailRenderer', {}).get('thumbnail', {}).get('thumbnails')
    
    info = (data.get('contents', {})
            .get('twoColumnBrowseResultsRenderer', {})
            .get('tabs', [{}])[0]
            .get('tabRenderer', {})
            .get('content', {})
            .get('sectionListRenderer', {})
            .get('contents', [{}])[0]
            .get('musicResponsiveHeaderRenderer'))
    
    tracks_data = {
        'artist': info.get('straplineTextOne', {}).get('runs', [{}])[0].get('text'),
        'artistID': (info.get('straplineTextOne', {})
                    .get('runs', [{}])[0]
                    .get('navigationEndpoint', {})
                    .get('browseEndpoint', {})
                    .get('browseId')),
        'poster': poster_raw[0].get('url') if poster_raw else None,
        'posterLarge': f"{poster_raw[0]['url'].split('=')[0]}=w600-h600-l100-rj" if poster_raw else None,
        'album': info.get('title', {}).get('runs', [{}])[0].get('text'),
        'albumID': id
    }
    
    tracks = []
    for track in tracks_raw or []:
        try:
            tracks.append(filter_album_track(track['musicResponsiveListItemRenderer'], tracks_data))
        except Exception as e:
            print(e)
    
    return {
        'api': 'youtube',
        'id': id,
        'name': info.get('title', {}).get('runs', [{}])[0].get('text'),
        'year': info.get('subtitle', {}).get('runs', [{}])[2].get('text'),
        'artist': info.get('straplineTextOne', {}).get('runs', [{}])[0].get('text'),
        'artistID': (info.get('straplineTextOne', {})
                    .get('runs', [{}])[0]
                    .get('navigationEndpoint', {})
                    .get('browseEndpoint', {})
                    .get('browseId')),
        'poster': poster_raw[-1].get('url') if poster_raw else None,
        'tracks_count': info.get('secondSubtitle', {}).get('runs', [{}])[0].get('text'),
        'tracks_duration': time_to_mss(info.get('secondSubtitle', {}).get('runs', [{}])[2].get('text')),
        'tracks_time': info.get('secondSubtitle', {}).get('runs', [{}])[2].get('text'),
        'playlistID': playlist_id,
        'tracks': tracks,
    }

async def get_album(id):
    try:
        data = await request_browse(id)
        content = filter_album_data(data, id)
        return content
    except Exception as e:
        print(e)
        return {'error': str(e)}

async def request_player(id):
    import json
    async with aiohttp.ClientSession() as session:
        async with session.post(
            'https://music.youtube.com/youtubei/v1/player',
            headers={
                'Content-Type': 'application/json',
                'User-Agent': user_agent
            },
            json={
                "videoId": id,
                "isAudioOnly": True,
                "context": {
                    "client": {
                        "clientName": "WEB_REMIX",
                        "clientVersion": "1.20241106.01.00"
                    }
                }
            }
        ) as response:
            data = await response.json()
            return data

async def get_track_data(id):
    try:
        data, next_data = await asyncio.gather(
            request_player(id),
            request_next(id)
        )
        
        main = (next_data.get('contents', {})
               .get('singleColumnMusicWatchNextResultsRenderer', {})
               .get('tabbedRenderer', {})
               .get('watchNextTabbedResultsRenderer', {})
               .get('tabs', [{}])[0]
               .get('tabRenderer', {})
               .get('content', {})
               .get('musicQueueRenderer', {})
               .get('content', {})
               .get('playlistPanelRenderer', {})
               .get('contents', [{}])[0]
               .get('playlistPanelVideoRenderer'))
        
        album_id = next(
            (item.get('menuNavigationItemRenderer', {})
             .get('navigationEndpoint', {})
             .get('browseEndpoint', {})
             .get('browseId')
             for item in main.get('menu', {}).get('menuRenderer', {}).get('items', [])
             if item.get('menuNavigationItemRenderer', {}).get('icon', {}).get('iconType') == 'ALBUM'),
            None
        )
        
        album = next(
            (run.get('text')
             for run in main.get('longBylineText', {}).get('runs', [])
             if run.get('navigationEndpoint', {}).get('browseEndpoint', {}).get('browseId') == album_id and album_id),
            None
        )
        
        track = {
            'api': 'youtube',
            'title': data['videoDetails']['title'],
            'artist': data['videoDetails']['author'],
            'artistID': data['videoDetails']['channelId'],
            'duration': (int(data['videoDetails']['lengthSeconds']) * 1000) if data['videoDetails'].get('lengthSeconds') else None,
            'poster': data['videoDetails']['thumbnail']['thumbnails'][0]['url'],
            'posterLarge': f"{data['videoDetails']['thumbnail']['thumbnails'][0]['url'].split('=')[0]}=w600-h600-l100-rj",
            'plays_count': int(data['videoDetails']['viewCount']),
            'album': album,
            'albumID': album_id
        }
        return track
    except Exception as e:
        print(e)
        return {'error': str(e)}

def time_to_mis(time_string):
    import re
    total_milliseconds = 0
    time_parts = re.findall(r'(\d+)\s*hr|(\d+)\s*min', time_string)
    
    if time_parts:
        for hr, min in time_parts:
            if hr:
                total_milliseconds += int(hr) * 60 * 60 * 1000
            if min:
                total_milliseconds += int(min) * 60 * 1000
    
    return total_milliseconds

def filter_podcast(data, id):
    tracks_raw = (data.get('contents', {})
                 .get('twoColumnBrowseResultsRenderer', {})
                 .get('secondaryContents', {})
                 .get('sectionListRenderer', {})
                 .get('contents', [{}])[0]
                 .get('musicShelfRenderer', {})
                 .get('contents'))
    
    main = (data.get('contents', {})
            .get('twoColumnBrowseResultsRenderer', {})
            .get('tabs', [{}])[0]
            .get('tabRenderer', {})
            .get('content', {})
            .get('sectionListRenderer', {})
            .get('contents', [{}])[0]
            .get('musicResponsiveHeaderRenderer'))
    
    artist_raw = main.get('straplineTextOne', {}).get('runs', [{}])[0]
    artist = artist_raw.get('text')
    artist_id = artist_raw.get('navigationEndpoint', {}).get('browseEndpoint', {}).get('browseId')
    
    title = main.get('title', {}).get('runs', [{}])[0].get('text')
    poster_raw = data.get('background', {}).get('musicThumbnailRenderer', {}).get('thumbnail', {}).get('thumbnails')
    description = (main.get('description', {})
                  .get('musicDescriptionShelfRenderer', {})
                  .get('description', {})
                  .get('runs', [{}])[0]
                  .get('text'))
    
    poster = poster_raw[0]['url'] if poster_raw else None
    poster_large = poster_raw[-1]['url'] if poster_raw else None
    artist_image = (main.get('straplineThumbnail', {})
                   .get('musicThumbnailRenderer', {})
                   .get('thumbnail', {})
                   .get('thumbnails', [{}])[1]
                   .get('url'))
    
    tracks = []
    for track in tracks_raw or []:
        try:
            track_renderer = track.get('musicMultiRowListItemRenderer', {})
            track_data = {
                'api': 'youtube',
                'kind': 'podcast',
                'id': (track_renderer.get('playNavigationEndpoint', {}).get('watchEndpoint', {}).get('videoId') or
                      track_renderer.get('onTap', {}).get('watchEndpoint', {}).get('videoId')),
                'title': track_renderer.get('title', {}).get('runs', [{}])[0].get('text'),
                'description': track_renderer.get('description', {}).get('runs', [{}])[0].get('text'),
                'poster': track_renderer.get('thumbnail', {}).get('musicThumbnailRenderer', {}).get('thumbnail', {}).get('thumbnails', [{}])[0].get('url'),
                'posterLarge': track_renderer.get('thumbnail', {}).get('musicThumbnailRenderer', {}).get('thumbnail', {}).get('thumbnails', [{}])[2].get('url'),
                'artist': artist,
                'artistID': artist_id,
                'album': title,
                'albumID': id,
                'release_date': track_renderer.get('subtitle', {}).get('runs', [{}])[0].get('text'),
                'duration': time_to_mis(track_renderer.get('playbackProgress', {}).get('musicPlaybackProgressRenderer', {}).get('durationText', {}).get('runs', [{}])[1].get('text'))
            }
            tracks.append(track_data)
        except Exception as e:
            print(e)
    
    return {
        'api': 'youtube',
        'id': id,
        'title': title,
        'artist': artist,
        'artistID': artist_id,
        'poster': poster,
        'posterLarge': poster_large,
        'description': description,
        'artistImage': artist_image,
        'tracks': tracks,
    }

async def get_podcast(id):
    try:
        data = await request_browse(id)
        json = filter_poadcast(data, id)
        return json
    except Exception as e:
        return {"error": str(e)}

def filter_home(data):
    sections = (data.get("contents", {})
               .get("singleColumnBrowseResultsRenderer", {})
               .get("tabs", [{}])[0]
               .get("tabRenderer", {})
               .get("content", {})
               .get("sectionListRenderer", {}))
    
    body = {}
    
    for section in sections.get("contents", []):
        try:
            carousel = section.get("musicCarouselShelfRenderer", {})
            header = carousel.get("header", {}).get("musicCarouselShelfBasicHeaderRenderer", {})
            type_text = header.get("title", {}).get("runs", [{}])[0].get("text")
            
            if type_text == "Quick picks":
                tracks = []
                for track in carousel.get("contents", []):
                    tracks.append(filter_YTMusic_tracks(track))
                body["picks"] = tracks
            elif type_text and "Albums" in type_text:
                body["albums"] = filter_albums(carousel).get("data")
        except Exception as e:
            print(e)
    
    return {
        "params": {
            "next": sections["continuations"][0]["nextContinuationData"]["continuation"],
            "tracking": sections["continuations"][0]["nextContinuationData"]["clickTrackingParams"],
        },
        **body
    }

def filter_explore(data):
    sections = (data.get("contents", {})
               .get("singleColumnBrowseResultsRenderer", {})
               .get("tabs", [{}])[0]
               .get("tabRenderer", {})
               .get("content", {})
               .get("sectionListRenderer", {}))
    
    body = {}
    
    for section in sections.get("contents", []):
        try:
            carousel = section.get("musicCarouselShelfRenderer", {})
            browse_id = (carousel.get("header", {})
                        .get("musicCarouselShelfBasicHeaderRenderer", {})
                        .get("title", {})
                        .get("runs", [{}])[0]
                        .get("navigationEndpoint", {})
                        .get("browseEndpoint", {})
                        .get("browseId"))
            
            if browse_id == "FEmusic_new_releases_albums":
                body["singles"] = filter_albums(carousel).get("data")
        except Exception as e:
            print(e)
    
    return body

async def get_home():
    try:
        home, explore = await asyncio.gather(
            request_browse("FEmusic_home"),
            request_browse("FEmusic_explore")
        )
        
        home_data = filter_home(home)
        explore_data = filter_explore(explore)
        
        return {**home_data, **explore_data}
    except Exception as e:
        print(e)
        return {"error": str(e)}

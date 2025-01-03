import json
import random
import string
from urllib.parse import urlencode
import requests

IOS_CLIENT_VERSION = '19.28.1'
IOS_DEVICE_MODEL = 'iPhone16,2'
IOS_USER_AGENT_VERSION = '17_5_1'
IOS_OS_VERSION = '17.5.1.21F90'

ANDROID_CLIENT_VERSION = '19.30.36'
ANDROID_OS_VERSION = '14'
ANDROID_SDK_VERSION = '34'

def generate_client_playback_nonce(length):
    CPN_CHARS = string.ascii_letters + string.digits + '-_'
    return ''.join(random.choice(CPN_CHARS) for _ in range(length))

async def get_data(video_id, is_raw=False, client_name='ios'):
    client = {}
    agent = f'com.google.ios.youtube/{IOS_CLIENT_VERSION}({IOS_DEVICE_MODEL}; U; CPU iOS {IOS_USER_AGENT_VERSION} like Mac OS X; en_US)'

    if client_name == 'ios':
        client = {
            'clientName': 'IOS',
            'clientVersion': IOS_CLIENT_VERSION,
            'deviceMake': 'Apple',
            'deviceModel': IOS_DEVICE_MODEL,
            'platform': 'MOBILE',
            'osName': 'iOS',
            'osVersion': IOS_OS_VERSION,
            'hl': 'en',
            'gl': 'US',
            'utcOffsetMinutes': -240,
        }
    elif client_name == 'android':
        client = {
            'clientName': 'ANDROID',
            'clientVersion': ANDROID_CLIENT_VERSION,
            'platform': 'MOBILE',
            'osName': 'Android',
            'osVersion': ANDROID_OS_VERSION,
            'androidSdkVersion': ANDROID_SDK_VERSION,
            'hl': 'en',
            'gl': 'US',
            'utcOffsetMinutes': -240,
        }
        agent = f'com.google.android.youtube/{ANDROID_CLIENT_VERSION} (Linux; U; Android {ANDROID_OS_VERSION}; en_US) gzip'

    payload = {
        'videoId': video_id,
        'cpn': generate_client_playback_nonce(16),
        'contentCheckOk': True,
        'racyCheckOk': True,
        'context': {
            'client': client,
            'request': {
                'internalExperimentFlags': [],
                'useSsl': True,
            },
            'user': {
                'lockedSafetyMode': False,
            },
        },
    }

    query = {
        'prettyPrint': False,
        't': generate_client_playback_nonce(12),
        'id': video_id,
    }

    query_string = urlencode(query)
    headers = {
        'Content-Type': 'application/json',
        'User-Agent': agent,
        'X-Goog-Api-Format-Version': '2',
    }

    response = requests.post(
        f'https://youtubei.googleapis.com/youtubei/v1/player?{query_string}',
        headers=headers,
        data=json.dumps(payload)
    )

    data = response.json()
    return data if is_raw else parse_formats(data)

def parse_formats(response):
    formats = []
    if response and 'streamingData' in response:
        formats.extend(response['streamingData'].get('formats', []))
        formats.extend(response['streamingData'].get('adaptiveFormats', []))
    return formats
# hydra_youtube_api/sources.py
def filter_formats(formats, filter_type = 'all', options=None):
    if options is None:
        options = {}

    if not isinstance(formats, list):
        raise ValueError('Formats must be a list')

    if not filter_type:
        raise ValueError('Filter must be provided')

    fallback = options.get('fallback', False)
    custom_sort = options.get('customSort', None)
    min_bitrate = options.get('minBitrate', 0)
    min_resolution = options.get('minResolution', 0)
    codec = options.get('codec', None)

    def filter_by_codec(format):
        if not codec:
            return True
        return codec in format.get('mimeType', '')

    def filter_by_bitrate(format):
        return format.get('bitrate', 0) >= min_bitrate

    def filter_by_resolution(format):
        return format.get('width', 0) >= min_resolution or format.get('height', 0) >= min_resolution

    def filter_by_url(format):
        return 'url' in format

    def apply_filters(format):
        return filter_by_url(format) and filter_by_codec(format) and filter_by_bitrate(format) and filter_by_resolution(format)

    if filter_type == 'all':
        # Return all formats that pass the filters
        return [format for format in formats if apply_filters(format)]

    elif filter_type == 'bestvideo':
        fn = lambda format: 'video' in format.get('mimeType', '')
        filtered = [format for format in formats if apply_filters(format) and fn(format)]
        if custom_sort:
            filtered.sort(key=custom_sort)
        else:
            filtered.sort(key=lambda x: (-x.get('width', 0), -x.get('bitrate', 0)))
        return filtered[0] if filtered else None

    elif filter_type == 'bestaudio':
        fn = lambda format: 'audio' in format.get('mimeType', '')
        filtered = [format for format in formats if apply_filters(format) and fn(format)]
        if custom_sort:
            filtered.sort(key=custom_sort)
        else:
            filtered.sort(key=lambda x: -x.get('bitrate', 0))
        return filtered[0] if filtered else None

    elif filter_type == 'lowestvideo':
        fn = lambda format: 'video' in format.get('mimeType', '')
        filtered = [format for format in formats if apply_filters(format) and fn(format)]
        if custom_sort:
            filtered.sort(key=custom_sort)
        else:
            filtered.sort(key=lambda x: (x.get('width', 0), x.get('bitrate', 0)))
        return filtered[0] if filtered else None

    elif filter_type == 'lowestaudio':
        fn = lambda format: 'audio' in format.get('mimeType', '')
        filtered = [format for format in formats if apply_filters(format) and fn(format)]
        if custom_sort:
            filtered.sort(key=custom_sort)
        else:
            filtered.sort(key=lambda x: x.get('bitrate', 0))
        return filtered[0] if filtered else None

    elif filter_type in ['videoandaudio', 'audioandvideo']:
        fn = lambda format: 'video' in format.get('mimeType', '') and 'audio' in format.get('mimeType', '')
    elif filter_type == 'video':
        fn = lambda format: 'video' in format.get('mimeType', '')
    elif filter_type == 'videoonly':
        fn = lambda format: 'video' in format.get('mimeType', '') and 'audio' not in format.get('mimeType', '')
    elif filter_type == 'audio':
        fn = lambda format: 'audio' in format.get('mimeType', '')
    elif filter_type == 'audioonly':
        fn = lambda format: 'audio' in format.get('mimeType', '') and 'video' not in format.get('mimeType', '')
    else:
        if callable(filter_type):
            fn = filter_type
        elif isinstance(filter_type, str) and filter_type.startswith('extension:'):
            extension = filter_type.split(':')[1]
            fn = lambda format: f'.{extension}' in format.get('url', '')
        else:
            raise ValueError(f'Given filter ({filter_type}) is not supported')

    filtered_formats = [format for format in formats if apply_filters(format) and fn(format)]

    if fallback and not filtered_formats:
        return next((format for format in formats if filter_by_url(format)), None)

    return filtered_formats
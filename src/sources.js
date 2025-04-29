// ╔═══════════════════════════════════════════════════════╗
// ║                                                       ║
// ║                 Hydra de Lerne                        ║
// ║               All rights reserved                     ║
// ║                  onvo.me/hydra                        ║
// ║                                                       ║
// ╚═══════════════════════════════════════════════════════╝

import * as utils from './utils.js';
import Cache from './cache.js';
import { decipherFormats } from './sig.js';
import * as formatUtils from './format-utils.js';
// for nodejs <= 18 un comment this

// let fetch;

// (async () => {
//     fetch = (await import('node-fetch')).default;
// })();

const BASE_URL = "https://www.youtube.com/watch?v=";


const getPlaybackContext = async (html5player, options) => {
    const response = await fetch(html5player, {
        ...options.requestOptions,
        method: "GET"
    });
    const body = await response.text();
    const mo = body.match(/(signatureTimestamp|sts):(\d+)/);
    return {
        contentPlaybackContext: {
            html5Preference: "HTML5_PREF_WANTS",
            signatureTimestamp: mo?.[2],
        },
    };
};
const generateClientPlaybackNonce = length => {
    const CPN_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    return Array.from({ length }, () => CPN_CHARS[Math.floor(Math.random() * CPN_CHARS.length)]).join("");
};

const playerAPI = async (videoId, payload, options) => {
    const url = new URL("https://youtubei.googleapis.com/youtubei/v1/player");
    url.searchParams.set("prettyPrint", "false");
    url.searchParams.set("t", generateClientPlaybackNonce(12));
    url.searchParams.set("id", videoId);

    const opts = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Format-Version": "2",
        },
        body: JSON.stringify(payload),
    };
    if (options.visitorId) opts.headers["X-Goog-Visitor-Id"] = options.visitorId;
    const response = await fetch(url, opts);
    const data = await response.json();
    return data
    const playErr = utils.playError(data);
    if (playErr) throw playErr;
    if (!data.videoDetails || videoId !== data.videoDetails.videoId) {
        const err = new Error("Malformed response from YouTube");
        err.response = response;
        throw err;
    }
    return data;
};

export const watchPageCache = new Cache();

const getWatchHTMLURL = (id, options) =>
    `${BASE_URL + id}&hl=${options.lang || "en"}&bpctr=${Math.ceil(Date.now() / 1000)}&has_verified=1`;
const getWatchHTMLPageBody = (id, options) => {
    const url = getWatchHTMLURL(id, options);
    return watchPageCache.getOrSet(url, async () => {
        const response = await fetch(url, {
            ...options.requestOptions,
            method: "GET"
        });
        return response.text();
    });
};
const EMBED_URL = "https://www.youtube.com/embed/";
const getEmbedPageBody = async (id, options) => {
    const embedUrl = `${EMBED_URL + id}?hl=${options.lang || "en"}`;
    const response = await fetch(embedUrl, {
        ...options.requestOptions,
        method: "GET"
    });
    return response.text();
};

const getHTML5player = body => {
    let html5playerRes =
        /<script\s+src="([^"]+)"(?:\s+type="text\/javascript")?\s+name="player_ias\/base"\s*>|"jsUrl":"([^"]+)"/.exec(body);
    return html5playerRes?.[1] || html5playerRes?.[2];
};

const LOCALE = { hl: "en", timeZone: "UTC", utcOffsetMinutes: 0 },
    CHECK_FLAGS = { contentCheckOk: true, racyCheckOk: true };

const WEB_EMBEDDED_CONTEXT = {
    client: {
        clientName: "WEB_EMBEDDED_PLAYER",
        clientVersion: "1.20240723.01.00",
        ...LOCALE,
    },
};

const TVHTML5_CONTEXT = {
    client: {
        clientName: "TVHTML5",
        clientVersion: "7.20240724.13.00",
        ...LOCALE,
    },
};

const ANDROID_CLIENT_VERSION = "19.44.38",
    ANDROID_OS_VERSION = "11",
    ANDROID_SDK_VERSION = "30";

const IOS_CLIENT_VERSION = "19.45.4",
    IOS_DEVICE_MODEL = "iPhone16,2",
    IOS_USER_AGENT_VERSION = "17_5_1",
    IOS_OS_VERSION = "17.5.1.21F90";

let cachedHTML5player
let cachedPlaybackContexts = {}
let cachedVisitorData = null;  // Just a single value now, not an object
const sampleVideoId = 'aqz-KE-bpKQ';

// Middleware function to get visitor data with caching
const getVisitorDataWithCache = async (videoId, options) => {
    // If we already have cached visitor data, use it
    if (cachedVisitorData) {
        return cachedVisitorData;
    }
    // Otherwise fetch and cache it
    else {
        try {
            const retryOptions = Object.assign({}, options.requestOptions);
            const watchInfo = await retryFunc(getWatchHTMLPage, [videoId, retryOptions], retryOptions);
            const visitorId = getVisitorData(watchInfo, options);
            if (visitorId) {
                cachedVisitorData = visitorId;  // Cache a single value
                return visitorId;
            }
        } catch (e) {
            // Return undefined if we can't get a visitor ID
            console.log(e)
        }
    }
    return undefined;
};

// Initialize function to pre-cache necessary data
export const initialize = async (options = {}) => {
    if (!cachedHTML5player) {
        cachedHTML5player = getHTML5player(await getWatchHTMLPageBody(sampleVideoId, options)) ||
            getHTML5player(await getEmbedPageBody(sampleVideoId, options));

        if (cachedHTML5player) {
            const fullURL = new URL(cachedHTML5player, BASE_URL).toString();
            cachedHTML5player = fullURL;

            // Pre-cache playback context
            if (!cachedPlaybackContexts[fullURL]) {
                cachedPlaybackContexts[fullURL] = await getPlaybackContext(fullURL, options);
            }

            // Pre-cache HTML5player functions
            await decipherFormats([{}], fullURL, options);

            // Pre-cache visitor data
            if (!cachedVisitorData) {
                await getVisitorDataWithCache(sampleVideoId, options);
            }
        }
    }

    return cachedHTML5player;
};

const getVisitorData = (info, _options) => {
    for (const respKey of ["player_response", "response"]) {
        try {
            return info[respKey].responseContext.serviceTrackingParams
                .find(x => x.service === "GFEEDBACK").params
                .find(x => x.key === "visitor_data").value;
        }
        catch { /* not present */ }
    }
    return undefined;
};

const jsonClosingChars = /^[)\]}'\s]+/;
const parseJSON = (source, varName, json) => {
    if (!json || typeof json === "object") {
        return json;
    } else {
        try {
            json = json.replace(jsonClosingChars, "");
            return JSON.parse(json);
        } catch (err) {
            throw Error(`Error parsing ${varName} in ${source}: ${err.message}`);
        }
    }
};

const findJSON = (source, varName, body, left, right, prependJSON) => {
    const jsonStr = utils.between(body, left, right);
    if (!jsonStr) {
        throw Error(`Could not find ${varName} in ${source}`);
    }
    return parseJSON(source, varName, utils.cutAfterJS(`${prependJSON}${jsonStr}`));
};

const findPlayerResponse = (source, info) => {
    if (!info) return {};
    const player_response =
        info.args?.player_response || info.player_response || info.playerResponse || info.embedded_player_response;
    return parseJSON(source, "player_response", player_response);
};
const retryFunc = async (func, args, options) => {
    let currentTry = 0,
        result;
    if (!options.maxRetries) options.maxRetries = 3;
    if (!options.backoff) options.backoff = { inc: 500, max: 5000 };
    while (currentTry <= options.maxRetries) {
        try {
            result = await func(...args);
            break;
        } catch (err) {
            if (err?.statusCode < 500 || currentTry >= options.maxRetries) throw err;
            const wait = Math.min(++currentTry * options.backoff.inc, options.backoff.max);
            await new Promise(resolve => setTimeout(resolve, wait));
        }
    }
    return result;
};
const getWatchHTMLPage = async (id, options) => {
    const body = await getWatchHTMLPageBody(id, options);
    const info = { page: "watch" };
    try {
        try {
            info.player_response =
                utils.tryParseBetween(body, "var ytInitialPlayerResponse = ", "}};", "", "}}") ||
                utils.tryParseBetween(body, "var ytInitialPlayerResponse = ", ";var") ||
                utils.tryParseBetween(body, "var ytInitialPlayerResponse = ", ";</script>") ||
                findJSON("watch.html", "player_response", body, /\bytInitialPlayerResponse\s*=\s*\{/i, "</script>", "{");
        } catch (_e) {
            let args = findJSON("watch.html", "player_response", body, /\bytplayer\.config\s*=\s*{/, "</script>", "{");
            info.player_response = findPlayerResponse("watch.html", args);
        }

        info.response =
            utils.tryParseBetween(body, "var ytInitialData = ", "}};", "", "}}") ||
            utils.tryParseBetween(body, "var ytInitialData = ", ";</script>") ||
            utils.tryParseBetween(body, 'window["ytInitialData"] = ', "}};", "", "}}") ||
            utils.tryParseBetween(body, 'window["ytInitialData"] = ', ";</script>") ||
            findJSON("watch.html", "response", body, /\bytInitialData("\])?\s*=\s*\{/i, "</script>", "{");
        info.html5player = getHTML5player(body);
    } catch (_) {
        throw Error(
            "Error when parsing watch.html, maybe YouTube made a change.\n" +
            `Please report this issue with the file on https://github.com/distubejs/ytdl-core/issues.`,
        );
    }
    return info;
};


export const getData = async (videoId, options = {}) => {
    utils.applyIPv6Rotations(options);
    utils.applyDefaultHeaders(options);

    const info = {}

    let firstDate = Date.now()
    if (cachedHTML5player) {
        info.html5player = cachedHTML5player
    } else {
        const initResult = await initialize(options);
        info.html5player = initResult;
    }

    if (!info.html5player) {
        throw Error("Unable to find html5player file");
    }

    info.html5player = new URL(info.html5player, BASE_URL).toString();

    // Use cached playback context if available
    if (!cachedPlaybackContexts[info.html5player]) {
        cachedPlaybackContexts[info.html5player] = await getPlaybackContext(info.html5player, options);
    }
    const playerContext = cachedPlaybackContexts[info.html5player];

    const payload = {
        context: TVHTML5_CONTEXT,
        videoId,
        playbackContext: playerContext,
        ...CHECK_FLAGS,
    };

    if (!options.visitorId) {
        options.visitorId = await getVisitorDataWithCache(videoId, options);
    }

    let response = await playerAPI(videoId, payload, options);
    let isFallback = false

    if (response?.playabilityStatus?.status === 'UNPLAYABLE') {
        response = await playerAPI(videoId, {
            ...payload,
            context: WEB_EMBEDDED_CONTEXT
        }, options);
    }

    const formatsRaw = parseFormats(response);
    const formatsObject = await decipherFormats(formatsRaw, info.html5player, options);
    const formats = Object.values(formatsObject);
    info.formats = formats.filter(format => format && format.url && format.mimeType);
    info.formats = info.formats.map(format => {
        const enhancedFormat = formatUtils.addFormatMeta(format);
        if (!enhancedFormat.audioBitrate && enhancedFormat.hasAudio) {
            enhancedFormat.audioBitrate = estimateAudioBitrate(enhancedFormat);
        }

        if (!enhancedFormat.isHLS && enhancedFormat.mimeType &&
            (enhancedFormat.mimeType.includes('hls') ||
                enhancedFormat.mimeType.includes('x-mpegURL') ||
                enhancedFormat.mimeType.includes('application/vnd.apple.mpegurl'))) {
            enhancedFormat.isHLS = true;
        }

        return enhancedFormat;
    });
    if (options.debug) {
        console.log('took:', videoId, Date.now() - firstDate)
    }
    return {
        formats: info.formats,
        fallback: isFallback
    };
};


const currentVersion = 1.0

let hasError = false

export const checkUpdate = async () => {
    try {
        const response = await fetch('https://st.onvo.me/config.json')
        const json = await response.json()
        if (json.version !== currentVersion) {
            if (json.data && hasError || json.forceUpdate) {
                remotePaylod.data = () => {
                    return {
                        cpn: generateClientPlaybackNonce(16),
                        ...json.data
                    }
                }
            }
            if (json.agent && hasError || json.forceUpdate) {
                remotePaylod.agent = json.agent
            }
        }
    } catch (e) {

    }
}

const parseFormats = player_response => {
    return (player_response?.streamingData?.formats || [])?.concat(player_response?.streamingData?.adaptiveFormats || []);
};


export const filter = (formats, filter, options = {}) => {
    if (!Array.isArray(formats)) {
        throw new Error('Formats must be an array');
    }

    if (!filter) {
        throw new Error('Filter must be provided');
    }

    const {
        fallback = false,
        customSort = null,
        minBitrate = 0,
        minResolution = 0,
        codec = null,
    } = options;

    let fn;

    const filterByCodec = (format) => {
        if (!codec) return true;
        return format.mimeType.includes(codec);
    };

    const filterByBitrate = (format) => {
        return (format.bitrate || 0) >= minBitrate;
    };

    const filterByResolution = (format) => {
        return (format.width || 0) >= minResolution || (format.height || 0) >= minResolution;
    };

    const filterByUrl = (format) => !!format.url;

    const applyFilters = (format) => {
        return filterByUrl(format) && filterByCodec(format) && filterByBitrate(format) && filterByResolution(format);
    };

    switch (filter) {
        case 'bestvideo':
            fn = (format) => format.mimeType.includes('video');
            return formats
                .filter((format) => applyFilters(format) && fn(format))
                .sort(customSort || ((a, b) => (b.width || 0) - (a.width || 0) || (b.bitrate || 0) - (a.bitrate || 0)))[0];

        case 'bestaudio':
            fn = (format) => format.mimeType.includes('audio');
            return formats
                .filter((format) => applyFilters(format) && fn(format))
                .sort(customSort || ((a, b) => (b.bitrate || 0) - (a.bitrate || 0)))[0];

        case 'lowestvideo':
            fn = (format) => format.mimeType.includes('video');
            return formats
                .filter((format) => applyFilters(format) && fn(format))
                .sort(customSort || ((a, b) => (a.width || 0) - (b.width || 0) || (a.bitrate || 0) - (b.bitrate || 0)))[0];

        case 'lowestaudio':
            fn = (format) => format.mimeType.includes('audio');
            return formats
                .filter((format) => applyFilters(format) && fn(format))
                .sort(customSort || ((a, b) => (a.bitrate || 0) - (b.bitrate || 0)))[0];

        case 'videoandaudio':
        case 'audioandvideo':
            fn = (format) => format.mimeType.includes('video') && format.mimeType.includes('audio');
            break;

        case 'video':
            fn = (format) => format.mimeType.includes('video');
            break;

        case 'videoonly':
            fn = (format) => format.mimeType.includes('video') && !format.mimeType.includes('audio');
            break;

        case 'audio':
            fn = (format) => format.mimeType.includes('audio');
            break;

        case 'audioonly':
            fn = (format) => !format.mimeType.includes('video') && format.mimeType.includes('audio');
            break;

        default:
            if (typeof filter === 'function') {
                fn = filter;
            } else if (typeof filter === 'string' && filter.startsWith('extension:')) {
                const extension = filter.split(':')[1];
                fn = (format) => format.url.includes(`.${extension}`);
            } else {
                throw new Error(`Given filter (${filter}) is not supported`);
            }
    }

    const filteredFormats = formats.filter((format) => applyFilters(format) && fn(format));

    if (fallback && filteredFormats.length === 0) {
        return formats.filter(filterByUrl)[0];
    }

    return filteredFormats;
};

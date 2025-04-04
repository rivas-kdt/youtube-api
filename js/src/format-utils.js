import FORMATS from "./formats.js";

// Use these to help sort formats, higher index is better.
const audioEncodingRanks = ["mp4a", "mp3", "vorbis", "aac", "opus", "flac"];
const videoEncodingRanks = ["mp4v", "avc1", "Sorenson H.283", "MPEG-4 Visual", "VP8", "VP9", "H.264"];

const getVideoBitrate = format => format.bitrate || 0;
const getVideoEncodingRank = format => videoEncodingRanks.findIndex(enc => format.codecs?.includes(enc));
const getAudioBitrate = format => format.audioBitrate || 0;
const getAudioEncodingRank = format => audioEncodingRanks.findIndex(enc => format.codecs?.includes(enc));

/**
 * Sort formats by a list of functions.
 *
 * @param {Object} a
 * @param {Object} b
 * @param {Array.<Function>} sortBy
 * @returns {number}
 */
const sortFormatsBy = (a, b, sortBy) => {
    let res = 0;
    for (let fn of sortBy) {
        res = fn(b) - fn(a);
        if (res !== 0) {
            break;
        }
    }
    return res;
};

const sortFormatsByVideo = (a, b) =>
    sortFormatsBy(a, b, [format => parseInt(format.qualityLabel), getVideoBitrate, getVideoEncodingRank]);

const sortFormatsByAudio = (a, b) => sortFormatsBy(a, b, [getAudioBitrate, getAudioEncodingRank]);

/**
 * Sort formats from highest quality to lowest.
 *
 * @param {Object} a
 * @param {Object} b
 * @returns {number}
 */
export const sortFormats = (a, b) =>
    sortFormatsBy(a, b, [
        // Formats with both video and audio are ranked highest.
        format => +!!format.isHLS,
        format => +!!format.isDashMPD,
        format => +(format.contentLength > 0),
        format => +(format.hasVideo && format.hasAudio),
        format => +format.hasVideo,
        format => parseInt(format.qualityLabel) || 0,
        getVideoBitrate,
        getAudioBitrate,
        getVideoEncodingRank,
        getAudioEncodingRank,
    ]);

/**
 * Choose a format depending on the given options.
 *
 * @param {Array.<Object>} formats
 * @param {Object} options
 * @returns {Object}
 * @throws {Error} when no format matches the filter/format rules
 */
export const chooseFormat = (formats, options = {}) => {
    if (typeof options.format === "object") {
        if (!options.format.url) {
            throw Error("Invalid format given, did you use `ytdl.getInfo()`?");
        }
        return options.format;
    }

    // Extract filter-specific options
    const filterOptions = {
        fallback: options.fallback || false,
        customSort: options.customSort || null,
        minBitrate: options.minBitrate || 0,
        minResolution: options.minResolution || 0,
        codec: options.codec || null
    };

    // Apply filter if provided or use default filters
    if (options.filter) {
        const filtered = filter(formats, options.filter, filterOptions);
        // If the filter returns a single format (for best/lowest filters), return it directly
        if (!Array.isArray(filtered)) {
            return filtered;
        }
        formats = filtered;
    } else {
        // Apply basic filtering even without a specific filter type
        formats = formats?.filter(format => {
            return (
                !!format.url && 
                (filterOptions.codec ? format.mimeType?.includes(filterOptions.codec) : true) &&
                (format.bitrate || 0) >= filterOptions.minBitrate &&
                ((format.width || 0) >= filterOptions.minResolution || (format.height || 0) >= filterOptions.minResolution)
            );
        });
    }

    // We currently only support HLS-Formats for livestreams
    // So we (now) remove all non-HLS streams
    if (formats.some(fmt => fmt.isHLS)) {
        formats = formats.filter(fmt => fmt.isHLS || !fmt.isLive);
    }

    // Handle empty formats array
    if (formats.length === 0) {
        if (filterOptions.fallback) {
            // Try to get any format with a URL as fallback
            const anyFormat = formats.find(format => !!format.url);
            if (anyFormat) return anyFormat;
        }
        throw Error("No formats match the criteria");
    }

    let format;
    const quality = options.quality || "highest";
    switch (quality) {
        case "highest":
            format = formats[0];
            break;

        case "lowest":
            format = formats[formats.length - 1];
            break;

        case "highestaudio": {
            formats = filter(formats, "audio", filterOptions);
            formats.sort(sortFormatsByAudio);
            // Filter for only the best audio format
            const bestAudioFormat = formats[0];
            formats = formats.filter(f => sortFormatsByAudio(bestAudioFormat, f) === 0);
            // Check for the worst video quality for the best audio quality and pick according
            // This does not loose default sorting of video encoding and bitrate
            const worstVideoQuality = formats.map(f => parseInt(f.qualityLabel) || 0).sort((a, b) => a - b)[0];
            format = formats.find(f => (parseInt(f.qualityLabel) || 0) === worstVideoQuality);
            break;
        }

        case "lowestaudio":
            formats = filter(formats, "audio", filterOptions);
            formats.sort(sortFormatsByAudio);
            format = formats[formats.length - 1];
            break;

        case "highestvideo": {
            formats = filter(formats, "video", filterOptions);
            formats.sort(sortFormatsByVideo);
            // Filter for only the best video format
            const bestVideoFormat = formats[0];
            formats = formats.filter(f => sortFormatsByVideo(bestVideoFormat, f) === 0);
            // Check for the worst audio quality for the best video quality and pick according
            // This does not loose default sorting of audio encoding and bitrate
            const worstAudioQuality = formats.map(f => f.audioBitrate || 0).sort((a, b) => a - b)[0];
            format = formats.find(f => (f.audioBitrate || 0) === worstAudioQuality);
            break;
        }

        case "lowestvideo":
            formats = filter(formats, "video", filterOptions);
            formats.sort(sortFormatsByVideo);
            format = formats[formats.length - 1];
            break;

        default:
            format = getFormatByQuality(quality, formats);
            break;
    }

    if (!format) {
        if (filterOptions.fallback && formats.length > 0) {
            return formats[0];
        }
        throw Error(`No such format found: ${quality}`);
    }
    
    return format;
};

/**
 * Gets a format based on quality or array of quality's
 *
 * @param {string|[string]} quality
 * @param {[Object]} formats
 * @returns {Object}
 */
const getFormatByQuality = (quality, formats) => {
    let getFormat = itag => formats.find(format => `${format.itag}` === `${itag}`);
    if (Array.isArray(quality)) {
        return getFormat(quality.find(q => getFormat(q)));
    } else {
        return getFormat(quality);
    }
};

/**
 * @param {Array.<Object>} formats
 * @param {Function} filter
 * @returns {Array.<Object>}
 */
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
        return format.mimeType?.includes(codec);
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
            fn = (format) => format.mimeType?.includes('video');
            return formats
                .filter((format) => applyFilters(format) && fn(format))
                .sort(customSort || ((a, b) => (b.width || 0) - (a.width || 0) || (b.bitrate || 0) - (a.bitrate || 0)))[0];
                
        case 'bestaudio':
            fn = (format) => format.mimeType?.includes('audio');
            return formats
                .filter((format) => applyFilters(format) && fn(format))
                .sort(customSort || ((a, b) => (b.bitrate || 0) - (a.bitrate || 0)))[0];
                
        case 'lowestvideo':
            fn = (format) => format.mimeType?.includes('video');
            return formats
                .filter((format) => applyFilters(format) && fn(format))
                .sort(customSort || ((a, b) => (a.width || 0) - (b.width || 0) || (a.bitrate || 0) - (b.bitrate || 0)))[0];
                
        case 'lowestaudio':
            fn = (format) => format.mimeType?.includes('audio');
            return formats
                .filter((format) => applyFilters(format) && fn(format))
                .sort(customSort || ((a, b) => (a.bitrate || 0) - (b.bitrate || 0)))[0];
                
        case 'videoandaudio':
        case 'audioandvideo':
            fn = (format) => format.mimeType?.includes('video') && format.mimeType?.includes('audio');
            break;
            
        case 'video':
            fn = (format) => format.mimeType?.includes('video');
            break;
            
        case 'videoonly':
            fn = (format) => format.mimeType?.includes('video') && !format.mimeType?.includes('audio');
            break;
            
        case 'audio':
            fn = (format) => format.mimeType?.includes('audio');
            break;
            
        case 'audioonly':
            fn = (format) => !format.mimeType?.includes('video') && format.mimeType?.includes('audio');
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

const between = (haystack, left, right) => {
    let pos;
    if (left instanceof RegExp) {
        const match = haystack.match(left);
        if (!match) {
            return "";
        }
        pos = match.index + match[0].length;
    } else {
        pos = haystack.indexOf(left);
        if (pos === -1) {
            return "";
        }
        pos += left.length;
    }
    haystack = haystack.slice(pos);
    pos = haystack.indexOf(right);
    if (pos === -1) {
        return "";
    }
    haystack = haystack.slice(0, pos);
    return haystack;
};

/**
 * @param {Object} format
 * @returns {Object}
 */
export const addFormatMeta = format => {
    format = Object.assign({}, FORMATS[format.itag], format);
    format.hasVideo = !!format.qualityLabel;
    format.hasAudio = !!format.audioBitrate;
    format.container = format.mimeType ? format.mimeType.split(";")[0].split("/")[1] : null;
    format.codecs = format.mimeType ? between(format.mimeType, 'codecs="', '"') : null;
    format.videoCodec = format.hasVideo && format.codecs ? format.codecs.split(", ")[0] : null;
    format.audioCodec = format.hasAudio && format.codecs ? format.codecs.split(", ").slice(-1)[0] : null;
    format.isLive = /\bsource[/=]yt_live_broadcast\b/.test(format.url);
    format.isHLS = /\/manifest\/hls_(variant|playlist)\//.test(format.url);
    format.isDashMPD = /\/manifest\/dash\//.test(format.url);
    return format;
};


// ╔═══════════════════════════════════════════════════════╗
// ║                                                       ║
// ║                 Hydra de Lerne                        ║
// ║               All rights reserved                     ║
// ║                  onvo.me/hydra                        ║
// ║                                                       ║
// ╚═══════════════════════════════════════════════════════╝

// for nodejs <= 18 un comment this

// let fetch;

// (async () => {
//     fetch = (await import('node-fetch')).default;
// })();

const userAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

const scrap = async (url, agent = "chrome") => {
  let agents = {
    chrome: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    },
    ios: {
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15A372 Safari/604.1",
      "Accept-Language": "en-US,en;q=0.9",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    },
    android: {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 10; Mobile; rv:89.0) Gecko/89.0 Firefox/89.0",
      "Accept-Language": "en-US,en;q=0.9",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    },
  };
  return fetch(url, {
    headers: agents[agent],
    redirect: "follow",
  });
};

function filterYoutube(json) {
  const core =
    json.contents.twoColumnSearchResultsRenderer.primaryContents
      .sectionListRenderer.contents;

  let tracks = [];
  let data = [];

  core.forEach((component) => {
    try {
      data = data.concat(component.itemSectionRenderer?.contents || []);
    } catch (e) {
      console.log(e);
    }
  });

  data.forEach((video) => {
    try {
      const videoData = {
        api: "youtube",
        id: video.videoRenderer.videoId,
        poster: video.videoRenderer.thumbnail.thumbnails[0].url,
        title: video.videoRenderer.title.runs[0].text,
        artist: video.videoRenderer.ownerText.runs[0].text,
        // Enhanced metadata
        duration: video.videoRenderer.lengthText
          ? timeToMilliseconds(video.videoRenderer.lengthText.simpleText)
          : null,
        viewCount: video.videoRenderer.viewCountText?.simpleText || null,
        publishedAt: video.videoRenderer.publishedTimeText?.simpleText || null,
        description:
          video.videoRenderer.descriptionSnippet?.runs?.[0]?.text || null,
        thumbnails: {
          default: video.videoRenderer.thumbnail.thumbnails[0]?.url,
          medium: video.videoRenderer.thumbnail.thumbnails[1]?.url,
          high: video.videoRenderer.thumbnail.thumbnails[2]?.url,
          standard: video.videoRenderer.thumbnail.thumbnails[3]?.url,
          maxres: video.videoRenderer.thumbnail.thumbnails[4]?.url,
        },
        // Channel information
        channel: {
          id: video.videoRenderer.ownerText.runs[0].navigationEndpoint
            ?.browseEndpoint?.browseId,
          name: video.videoRenderer.ownerText.runs[0].text,
          avatar:
            video.videoRenderer.channelThumbnailSupportedRenderers
              ?.channelThumbnailWithLinkRenderer?.thumbnail?.thumbnails?.[0]
              ?.url,
          verified:
            video.videoRenderer.ownerBadges?.some(
              (badge) =>
                badge.metadataBadgeRenderer?.style ===
                "BADGE_STYLE_TYPE_VERIFIED"
            ) || false,
        },
      };

      tracks.push(videoData);
    } catch (e) {
      // console.log(e)
    }
  });

  return tracks;
}

export async function getVideoId(q, isYotube) {
  try {
    let json = {};
    if (isYotube) {
      // searching fe 2lyoutube
      const response = await scrapYoutube(
        `https://www.youtube.com/results?search_query=${q}`
      );
      json = filterYoutube(response);
    } else {
      // searching fe youtube music
      const main = await request(q);
      const type = "songs";
      const params = getTrackingParam(main);
      const data = await request(q, params[type]);
      json = filterYoutubeSearch(data, type);
    }
    if (json.length == 0) {
      throw new Error("error yt");
    }
    return json[0].id;
  } catch (e) {
    console.log(e);
    return { error: e };
  }
}

function filterYoutubeScrap(textData) {
  const ytInitialDataRegex = /var ytInitialData = (.*?);<\/script>/s;
  const match = textData.match(ytInitialDataRegex);

  if (match && match[1]) {
    return JSON.parse(match[1]);
  } else {
    return { error: "no_data" };
  }
}

function extractSubtitles(html) {
  const ytInitialDataRegex = /var ytInitialPlayerResponse\s*=\s*(\{.*?\})\s*;/s;
  const match = html.match(ytInitialDataRegex);

  if (match && match[1]) {
    try {
      let jsonString = match[1];
      const lastBraceIndex = jsonString.lastIndexOf("}");
      jsonString = jsonString.substring(0, lastBraceIndex + 1);
      const jsonData = JSON.parse(jsonString);
      return jsonData;
    } catch (error) {
      return { error: "json_parse_error" };
    }
  } else {
    return { error: "no_data" };
  }
}

function requestSubtitles(videoId, html) {
  return new Promise(async (resolve, reject) => {
    try {
      if (!html) {
        html = await scrapYoutube(
          `https://www.youtube.com.eg/watch?v=${videoId}`,
          true
        );
      }
      const json = extractSubtitles(html);
      const captions = json?.captions?.playerCaptionsTracklistRenderer
        ?.captionTracks || { error: "no_captions" };
      let url;

      if (!captions[0]?.name?.simpleText.includes("auto")) {
        url = captions[0]?.baseUrl;
      }

      let original;
      let selected = captions[0]?.languageCode;

      try {
        for (let track of captions) {
          if (track.languageCode == "ar" || track.languageCode == "en") {
            original = track.languageCode;
            break;
          }
        }

        for (let track of captions) {
          if (
            track.languageCode == original &&
            !track.name?.simpleText.includes("auto")
          ) {
            url = track.baseUrl;
            selected = track.languageCode;
            break;
          }
        }
      } catch (e) {
        console.log(e);
      }

      if (!url) {
        return resolve({
          error: "no_lyrics",
          discriptions: "no_captions_found",
        });
      }

      const data = await scrapYoutube(url, true);
      resolve(data);
    } catch (e) {
      resolve({ error: e.message });
    }
  });
}

function processSubtitles(subtitles) {
  return subtitles
    .map((subtitle) => {
      let { start, end, text } = subtitle;
      if (text.match(/^\[.*\]$/)) {
        text = null;
      }
      if (text !== null) {
        text = text.replace(/♪/g, "").trim();
        text = text
          .toLowerCase()
          .replace(/(^\w)|(\.\s*\w)|(\?\s*\w)|(\!\s*\w)/g, (match) =>
            match.toUpperCase()
          );
      }

      return { start, end, text };
    })
    .filter((subtitle) => subtitle.text !== null && subtitle.text !== "");
}

async function scrapYoutube(url, e) {
  try {
    const response = await scrap(url);
    let textData = await response.text();
    if (!e) {
      textData = filterYoutubeScrap(textData);
    }
    return textData;
  } catch (e) {
    console.log(e);
    return { error: "call_error" };
  }
}

// for node js only un comment and use xml2js
// const xml2js = require('xml2js');
async function getNativeSubtitles(videoId, html) {
  return new Promise(async (resolve, reject) => {
    try {
      const data = await requestSubtitles(videoId, html);
      xml2js.parseString(data, { trim: true }, (err, result) => {
        if (err) {
          return resolve([]);
        } else {
          try {
            const transformed = result?.transcript?.text.map((item) => ({
              text: item._,
              start: parseFloat(item.$.start),
              end: parseFloat(item.$.dur) + parseFloat(item.$.start),
            }));
            let jsonSrt = processSubtitles(transformed);
            if (jsonSrt.length < 5) {
              resolve();
            } else {
              resolve(jsonSrt);
            }
          } catch (e) {
            resolve([]);
          }
        }
      });
    } catch (e) {
      resolve(e);
    }
  });
}

export const getYoutubeList = async (id) => {
  try {
    const json = await scrapYoutube(
      `https://www.youtube.com/playlist?list=${id}`
    );
    let tracks = [];

    const core =
      json.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer
        ?.content?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer
        ?.contents?.[0]?.playlistVideoListRenderer?.contents;

    core.forEach((video) => {
      try {
        const videoData = {
          api: "youtube",
          id: video.playlistVideoRenderer.videoId,
          poster: video.playlistVideoRenderer.thumbnail.thumbnails[0].url,
          title: video.playlistVideoRenderer.title.runs[0].text,
          artist: video.playlistVideoRenderer.shortBylineText.runs[0].text,
          artist_id:
            video.playlistVideoRenderer?.shortBylineText.runs?.[0]
              .browseEndpoint?.browseId,
          // Enhanced metadata
          duration: video.playlistVideoRenderer.lengthText
            ? timeToMilliseconds(
                video.playlistVideoRenderer.lengthText.simpleText
              )
            : null,
          thumbnails: {
            default: video.playlistVideoRenderer.thumbnail.thumbnails[0]?.url,
            medium: video.playlistVideoRenderer.thumbnail.thumbnails[1]?.url,
            high: video.playlistVideoRenderer.thumbnail.thumbnails[2]?.url,
            standard: video.playlistVideoRenderer.thumbnail.thumbnails[3]?.url,
            maxres: video.playlistVideoRenderer.thumbnail.thumbnails[4]?.url,
          },
        };

        tracks.push(videoData);
      } catch (e) {
        console.log(e);
      }
    });

    const data = {
      api: "youtube",
      id: id,
      name: json.header?.playlistHeaderRenderer?.title?.simpleText,
      description:
        json.header?.playlistHeaderRenderer?.descriptionText?.simpleText,
      tracks_count:
        json.header?.playlistHeaderRenderer?.numVideosText?.runs?.[0]?.text ||
        tracks.length,
      owner: {
        id: json.header?.playlistHeaderRenderer?.ownerText?.runs?.[0]
          ?.navigationEndpoint?.browseEndpoint?.browseId,
        name: json.header?.playlistHeaderRenderer?.ownerText?.runs?.[0]?.text,
        avatar:
          json.header?.playlistHeaderRenderer?.ownerThumbnail?.thumbnails?.[0]
            ?.url,
        verified:
          json.header?.playlistHeaderRenderer?.ownerBadges?.some(
            (badge) =>
              badge.metadataBadgeRenderer?.style === "BADGE_STYLE_TYPE_VERIFIED"
          ) || false,
      },
      // Playlist thumbnails
      thumbnails: {
        default:
          json.header?.playlistHeaderRenderer?.playlistHeaderBanner
            ?.heroPlaylistThumbnailRenderer?.thumbnail?.thumbnails?.[0]?.url ||
          tracks[0]?.poster,
        medium:
          json.header?.playlistHeaderRenderer?.playlistHeaderBanner
            ?.heroPlaylistThumbnailRenderer?.thumbnail?.thumbnails?.[1]?.url,
        high: json.header?.playlistHeaderRenderer?.playlistHeaderBanner
          ?.heroPlaylistThumbnailRenderer?.thumbnail?.thumbnails?.[2]?.url,
        standard:
          json.header?.playlistHeaderRenderer?.playlistHeaderBanner
            ?.heroPlaylistThumbnailRenderer?.thumbnail?.thumbnails?.[3]?.url,
        maxres:
          json.header?.playlistHeaderRenderer?.playlistHeaderBanner
            ?.heroPlaylistThumbnailRenderer?.thumbnail?.thumbnails?.[4]?.url,
      },
      totalDuration: tracks.reduce((total, track) => {
        return total + (track.duration || 0);
      }, 0),
      tracks: tracks,
    };

    return data;
  } catch (e) {
    return { error: e.toString() };
  }
};

function filterYoutubeMusicScrap(textData) {
  const regex = /data: '(.*?)'}\);/gs;
  const matches = [];
  let match;

  while ((match = regex.exec(textData)) !== null) {
    const extractedData = match[1].replace(
      /\\x([0-9A-Fa-f]{2})/g,
      (match, hex) => String.fromCharCode(parseInt(hex, 16))
    );
    matches.push(extractedData.replace(/\\\\"/g, ""));
  }

  if (matches.length > 0) {
    return matches;
  } else {
    return [];
  }
}

export const getYoutubeMusicList = async (id) => {
    try {
        const url = `https://music.youtube.com/playlist?list=${id}`;
        const response = await scrap(url);
        const html = await response.text();
        const main = filterYoutubeMusicScrap(html);
        const rawData = JSON.parse(main[1]);

        const playlistId = rawData.contents.twoColumnBrowseResultsRenderer.secondaryContents.sectionListRenderer.contents[0].musicPlaylistShelfRenderer.playlistId;
        const trackItems = rawData.contents.twoColumnBrowseResultsRenderer.secondaryContents.sectionListRenderer.contents[0].musicPlaylistShelfRenderer.contents;
        const playlistTitle = rawData.contents.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.contents[0].musicResponsiveHeaderRenderer.title.runs[0].text;
        const owner = rawData.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]?.musicResponsiveHeaderRenderer;
        const ownerName = owner?.straplineTextOne?.runs?.[0]?.text;
        const ownerID = owner?.straplineTextOne?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId;
        const ownerImage = owner?.straplineThumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails[1]?.url;

        let tracks = trackItems.map(item => {
            const renderer = item.musicResponsiveListItemRenderer;

            const title = renderer.flexColumns[0].musicResponsiveListItemFlexColumnRenderer.text.runs[0].text;
            const artist = renderer.flexColumns[1].musicResponsiveListItemFlexColumnRenderer.text.runs[0].text;
            const videoId = renderer.playlistItemData.videoId;

            const durationText = renderer.overlay.musicItemThumbnailOverlayRenderer.content.musicPlayButtonRenderer.accessibilityPlayData?.accessibilityData?.label || '';

            const durationMatch = durationText.match(/(\d+) minutes, (\d+) seconds/);
            let durationMs = 0;
            if (durationMatch) {
                const minutes = parseInt(durationMatch[1], 10);
                const seconds = parseInt(durationMatch[2], 10);
                durationMs = (minutes * 60 + seconds) * 1000;
            } else {
                durationMs = null;
            }

            const poster = renderer.thumbnail.musicThumbnailRenderer.thumbnail.thumbnails[0].url;
            const posterLarge = renderer.thumbnail.musicThumbnailRenderer.thumbnail.thumbnails[1] ? renderer.thumbnail.musicThumbnailRenderer.thumbnail.thumbnails[1].url : poster;

            return {
                api: 'youtube',
                poster,
                posterLarge,
                title,
                artist,
                id: videoId,
                duration: durationMs
            };
        });

        const validatedTracks = [];
        for (const track of tracks) {
            const searchResults = await youtubeMusicSearch(`${track.title} ${track.artist}`, "songs");
            const found = searchResults.find(item => item.id === track.id || item.title.toLowerCase() === track.title.toLowerCase());
            if (found) {
                validatedTracks.push(track);
            }
        }
      
        const data = {
            id: playlistId,
            api: 'youtube',
            name: playlistTitle,
            owner: {
                id: ownerID,
                name: ownerName,
                image: ownerImage
            },
            tracks_count: validatedTracks.length,
            tracks: validatedTracks
        };

        return data;
    } catch (e) {
        return { error: e.message };
    }
};

const getTrackingParam = (json) => {
  const main =
    json.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content
      ?.sectionListRenderer?.header?.chipCloudRenderer?.chips;
  let data = {};
  main.forEach((section) => {
    const param =
      section.chipCloudChipRenderer.navigationEndpoint.searchEndpoint.params;
    const id = section.chipCloudChipRenderer.uniqueId;
    switch (id) {
      case "Songs":
        data["songs"] = param;
        break;
      case "Videos":
        data["videos"] = param;
        break;
      case "Albums":
        data["albums"] = param;
        break;
      case "Featured playlists":
        data["playlists"] = param;
        break;
      case "Community playlists":
        data["users_playlists"] = param;
        break;
      case "Artists":
        data["artists"] = param;
        break;
      case "Podcasts":
        data["podcasts"] = param;
        break;
      case "Episodes":
        data["episodes"] = param;
        break;
      case "Profiles":
        data["users"] = param;
        break;
    }
  });
  return data;
};

const request = async (query, params) => {
  const body = {
    context: {
      client: {
        clientName: "WEB_REMIX",
        clientVersion: "1.20241111.01.00",
        acceptHeader:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        timeZone: "Etc/GMT-2",
      },
    },
    query: query,
    params,
  };
  const response = await fetch(`https://music.youtube.com/youtubei/v1/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": userAgent,
    },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  return json;
};

function timeToMilliseconds(timeString) {
  try {
    const timeParts = timeString.split(":").map(Number);
    let milliseconds;
    if (timeParts.length === 3) {
      const [hours, minutes, seconds] = timeParts;
      milliseconds = (hours * 3600 + minutes * 60 + seconds) * 1000;
    } else if (timeParts.length === 2) {
      const [minutes, seconds] = timeParts;
      milliseconds = (minutes * 60 + seconds) * 1000;
    } else {
      console.log(timeString);
    }

    return milliseconds;
  } catch (e) {
    return;
  }
}

const filterMenu = (data) => {
  const artists = (() => {
    const runs =
      data.musicResponsiveListItemRenderer?.flexColumns?.[1]
        ?.musicResponsiveListItemFlexColumnRenderer?.text?.runs;
    const filteredArtists = runs
      ?.filter(
        (item) =>
          item.navigationEndpoint?.browseEndpoint
            ?.browseEndpointContextSupportedConfigs
            ?.browseEndpointContextMusicConfig?.pageType ===
          "MUSIC_PAGE_TYPE_ARTIST"
      )
      .map((item) => ({
        name: item.text,
        id: item.navigationEndpoint.browseEndpoint.browseId,
      }));

    return filteredArtists?.length > 1 ? filteredArtists : undefined;
  })();
  const artist =
    data.musicResponsiveListItemRenderer?.flexColumns?.[1]
      ?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]
      ?.navigationEndpoint?.browseEndpoint.browseId;
  const albumID =
    data.musicResponsiveListItemRenderer?.menu?.menuRenderer?.items.find(
      (item) => item.menuNavigationItemRenderer?.icon?.iconType === "ALBUM"
    )?.menuNavigationItemRenderer.navigationEndpoint.browseEndpoint.browseId;
  const albumColumn = data.musicResponsiveListItemRenderer?.flexColumns.find(
    (column) =>
      column.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.some(
        (run) => run.navigationEndpoint?.browseEndpoint?.browseId === albumID
      )
  );
  const album = albumColumn
    ? albumColumn.musicResponsiveListItemFlexColumnRenderer.text.runs
        .find(
          (run) => run.navigationEndpoint?.browseEndpoint?.browseId === albumID
        )
        ?.text.split("(")[0]
        .trim()
    : undefined;
  return { artist, albumID, album, artists };
};

const filterYTMusicTracks = (track) => {
  const duration = timeToMilliseconds(
    track.musicResponsiveListItemRenderer?.flexColumns?.[1]
      ?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[4]?.text
  );
  const poster =
    track.musicResponsiveListItemRenderer?.thumbnail?.musicThumbnailRenderer
      ?.thumbnail?.thumbnails;
  const ids = filterMenu(track);
  return {
    api: "youtube",
    id: track.musicResponsiveListItemRenderer?.playlistItemData?.videoId,
    title:
      track.musicResponsiveListItemRenderer?.flexColumns?.[0]
        ?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text,
    artist:
      track.musicResponsiveListItemRenderer?.flexColumns?.[1]
        ?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text,
    artists: ids.artists,
    artistID: ids.artist,
    poster: poster?.[1]?.url || poster?.[0]?.url,
    posterLarge:
      poster?.[1]?.url || poster?.[0]?.url
        ? (poster?.[1]?.url || poster?.[0]?.url)?.split("=")[0] +
          "=w600-h600-l100-rj"
        : undefined,
    duration: duration,
    album: ids.album,
    albumID: ids.albumID,
  };
};

const filterYTMusicPodcasts = (track) => {
  const artist =
    track.musicResponsiveListItemRenderer.flexColumns?.[1]
      ?.musicResponsiveListItemFlexColumnRenderer?.text?.runs;
  const data = {
    api: "youtube",
    kind: "podcast",
    id: track.musicResponsiveListItemRenderer?.navigationEndpoint
      ?.browseEndpoint?.browseId,
    playlist:
      track.musicResponsiveListItemRenderer.overlay
        .musicItemThumbnailOverlayRenderer.content.musicPlayButtonRenderer
        .playNavigationEndpoint.watchPlaylistEndpoint.playlistId,
    title:
      track.musicResponsiveListItemRenderer.flexColumns[0]
        .musicResponsiveListItemFlexColumnRenderer.text.runs[0].text,
    artist: artist?.[2]?.text || artist?.[0]?.text,
    artistID:
      artist?.[2]?.navigationEndpoint?.browseEndpoint?.browseId ||
      artist?.[0]?.navigationEndpoint?.browseEndpoint?.browseId,
    poster:
      track.musicResponsiveListItemRenderer.thumbnail.musicThumbnailRenderer
        .thumbnail.thumbnails[1].url,
  };
  return data;
};

const filterYTMusicArtists = (artist) => {
  const data = {
    api: "youtube",
    kind: "artist",
    id: artist.musicResponsiveListItemRenderer?.navigationEndpoint
      ?.browseEndpoint?.browseId,
    name: artist.musicResponsiveListItemRenderer.flexColumns[0]
      .musicResponsiveListItemFlexColumnRenderer.text.runs[0].text,
    followers:
      artist.musicResponsiveListItemRenderer.flexColumns[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[2]?.text?.replace(
        "subscribers",
        "followers"
      ),
    poster:
      artist.musicResponsiveListItemRenderer.thumbnail.musicThumbnailRenderer
        .thumbnail.thumbnails[1].url,
    posterLarge:
      artist.musicResponsiveListItemRenderer.thumbnail.musicThumbnailRenderer.thumbnail.thumbnails[1].url?.split(
        "="
      )[0] + "=w600-h600-l100-rj",
  };

  return data;
};

const filterYTMusicEpisodes = (track) => {
  return {
    api: "youtube",
    kind: "episode",
    id: track.musicResponsiveListItemRenderer.playlistItemData.videoId,
    title:
      track.musicResponsiveListItemRenderer.flexColumns[0]
        .musicResponsiveListItemFlexColumnRenderer.text.runs[0].text,
    poadcast:
      track.musicResponsiveListItemRenderer.flexColumns[1]
        .musicResponsiveListItemFlexColumnRenderer.text.runs[2].text,
    poadcastID:
      track.musicResponsiveListItemRenderer.flexColumns[1]
        .musicResponsiveListItemFlexColumnRenderer.text.runs[2]
        .navigationEndpoint.browseEndpoint.browseId,
    poster:
      track.musicResponsiveListItemRenderer.thumbnail.musicThumbnailRenderer
        .thumbnail.thumbnails[0].url,
  };
};

const filterYoutubeSearch = (data, type) => {
  const sections =
    data.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer?.content
      ?.sectionListRenderer?.contents;
  let tracks = [];
  sections.forEach((section) => {
    try {
      const loop = section?.musicShelfRenderer?.contents;
      loop.forEach((track) => {
        try {
          switch (type) {
            case "songs":
              tracks.push(filterYTMusicTracks(track));
              break;
            case "podcasts":
              tracks.push(filterYTMusicPodcasts(track));
              break;
            case "artists":
              tracks.push(filterYTMusicArtists(track));
              break;
            case "episodes":
              tracks.push(filterYTMusicEpisodes(track));
              break;
          }
        } catch (e) {
          console.error(e);
        }
      });
    } catch (e) {
      console.error(e);
    }
  });
  return tracks;
};

export const youtubeMusicSearch = async (q, method = "songs") => {
  // method is the category, like artists or songs etc
  try {
    const main = await request(q);
    const type = method || "songs";
    const params = getTrackingParam(main);
    const data = await request(q, params[type]);
    const json = filterYoutubeSearch(data, type);
    return json;
  } catch (e) {
    console.log(e);
    return { error: e.message };
  }
};

export const requestNext = async (id) => {
  const response = await fetch("https://music.youtube.com/youtubei/v1/next", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": userAgent,
    },
    body: JSON.stringify({
      videoId: id,
      isAudioOnly: true,
      context: {
        client: {
          clientName: "WEB_REMIX",
          clientVersion: "1.20241106.01.00",
        },
      },
    }),
  });
  const data = await response.json();
  return data;
};

export const getVideoSections = async (id) => {
  const data = await requestNext(id);
  const sections =
    data?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer
      ?.watchNextTabbedResultsRenderer?.tabs?.[0]?.tabRenderer?.content
      ?.musicQueueRenderer?.content?.playlistPanelRenderer?.contents;
  let mixID;
  let mixParam;
  sections.forEach((section) => {
    try {
      if (section.automixPreviewVideoRenderer) {
        const mix =
          section?.automixPreviewVideoRenderer?.content
            ?.automixPlaylistVideoRenderer?.navigationEndpoint
            ?.watchPlaylistEndpoint;
        mixID = mix?.playlistId;
        mixParam = mix?.params;
      } else if (section.playlistPanelVideoRenderer) {
        mixID =
          section.menu?.menuRenderer?.items?.[0]?.menuNavigationItemRenderer
            ?.navigationEndpoint?.watchEndpoint?.playlistId;
      }
    } catch (e) {
      console.error(e);
    }
  });
  const related =
    data?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer
      ?.watchNextTabbedResultsRenderer?.tabs?.[2]?.tabRenderer?.endpoint
      ?.browseEndpoint?.browseId;
  const lyrics =
    data?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer
      ?.watchNextTabbedResultsRenderer?.tabs?.[1]?.tabRenderer?.endpoint
      ?.browseEndpoint?.browseId;
  return { mix: mixID, mixParam, related, lyrics };
};

const filterTrackNextList = (track) => {
  const duration = timeToMilliseconds(
    track.playlistPanelVideoRenderer.lengthText.runs[0].text
  );
  const albumID =
    track.playlistPanelVideoRenderer.menu.menuRenderer.items.filter(
      (item) => item?.menuNavigationItemRenderer?.icon?.iconType == "ALBUM"
    )?.[0]?.menuNavigationItemRenderer?.navigationEndpoint?.browseEndpoint
      ?.browseId || undefined;
  const album = albumID
    ? track.playlistPanelVideoRenderer.longBylineText.runs.filter(
        (item) => item?.navigationEndpoint?.browseEndpoint?.browseId == albumID
      )?.[0]?.text
    : undefined;
  return {
    api: "youtube",
    id: track.playlistPanelVideoRenderer.videoId,
    title: track.playlistPanelVideoRenderer.title.runs[0].text,
    artist: track.playlistPanelVideoRenderer.shortBylineText.runs[0].text,
    artistID:
      track.playlistPanelVideoRenderer.longBylineText.runs[0].navigationEndpoint
        ?.browseEndpoint?.browseId,
    poster: track.playlistPanelVideoRenderer.thumbnail.thumbnails[1].url,
    posterLarge:
      track.playlistPanelVideoRenderer.thumbnail.thumbnails[2]?.url?.split(
        "="
      )[0] + "=w600-h600-l100-rj",
    album,
    albumID,
    duration,
  };
};

export const getPlaylistQueue = async (id, params) => {
  const response = await fetch("https://music.youtube.com/youtubei/v1/next", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": userAgent,
    },
    body: JSON.stringify({
      playlistId: id,
      params: params,
      isAudioOnly: true,
      context: {
        client: {
          clientName: "WEB_REMIX",
          clientVersion: "1.20241106.01.00",
          clientFormFactor: "UNKNOWN_FORM_FACTOR",
        },
      },
    }),
  });
  const data = await response.json();
  const tracksRaw =
    data.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer
      ?.watchNextTabbedResultsRenderer?.tabs?.[0]?.tabRenderer?.content
      ?.musicQueueRenderer?.content?.playlistPanelRenderer?.contents;
  const tracks = [];
  tracksRaw.forEach((track) => {
    try {
      tracks.push(filterTrackNextList(track));
    } catch (e) {
      console.error(e);
    }
  });
  return tracks;
};

const filterTrackRelated = (track) => {
  return {
    api: "youtube",
    id: track.musicResponsiveListItemRenderer.playlistItemData.videoId,
    title:
      track.musicResponsiveListItemRenderer.flexColumns[0]
        .musicResponsiveListItemFlexColumnRenderer.text.runs[0].text,
    artist:
      track.musicResponsiveListItemRenderer.flexColumns[1]
        .musicResponsiveListItemFlexColumnRenderer.text.runs[0].text,
    artistID:
      track.musicResponsiveListItemRenderer.flexColumns[1]
        .musicResponsiveListItemFlexColumnRenderer.text.runs[0]
        .navigationEndpoint?.browseEndpoint?.browseId,
    poster:
      track.musicResponsiveListItemRenderer.thumbnail.musicThumbnailRenderer
        .thumbnail.thumbnails[1]?.url,
    posterLarge:
      track.musicResponsiveListItemRenderer.thumbnail.musicThumbnailRenderer.thumbnail.thumbnails[1].url?.split(
        "="
      )[0] + "=w600-h600-l100-rj",
    album:
      track.musicResponsiveListItemRenderer.flexColumns[2].musicResponsiveListItemFlexColumnRenderer.text.runs[0]?.text
        ?.split("(")[0]
        .trim(),
    albumID:
      track.musicResponsiveListItemRenderer.flexColumns[2]
        .musicResponsiveListItemFlexColumnRenderer.text.runs[0]
        ?.navigationEndpoint.browseEndpoint.browseId,
  };
};

const filterRelatedArtists = (artist) => {
  const data = {
    api: "youtube",
    kind: "artist",
    id: artist.musicTwoRowItemRenderer?.navigationEndpoint?.browseEndpoint
      ?.browseId,
    name: artist.musicTwoRowItemRenderer?.title?.runs?.[0]?.text,
    followers:
      artist.musicTwoRowItemRenderer?.subtitle?.runs?.[0]?.text?.replace(
        "subscribers",
        "followers"
      ),
    poster:
      artist.musicTwoRowItemRenderer?.thumbnailRenderer?.musicThumbnailRenderer
        ?.thumbnail?.thumbnails?.[0]?.url,
    posterLarge:
      artist.musicTwoRowItemRenderer?.thumbnailRenderer?.musicThumbnailRenderer
        ?.thumbnail?.thumbnails?.[1]?.url,
  };

  return data;
};

export const requestBrowse = async (id) => {
  const response = await fetch("https://music.youtube.com/youtubei/v1/browse", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": userAgent,
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: "WEB_REMIX",
          clientVersion: "1.20241106.01.00",
          clientFormFactor: "UNKNOWN_FORM_FACTOR",
        },
      },
      browseId: id,
    }),
  });
  const data = await response.json();
  return data;
};

export const getLyrics = async (param, id, andNative) => {
  const [data, subtitles] = await Promise.all([
    requestBrowse(param),
    andNative ? getNativeSubtitles(id) : {},
  ]);
  const lyricsRaw =
    data?.contents?.sectionListRenderer?.contents?.[0]
      ?.musicDescriptionShelfRenderer?.description?.runs?.[0]?.text;

  const lyrics = {
    lines: lyricsRaw
      ?.split("\n")
      ?.map((line) => line.replace("\r", ""))
      .filter((line) => line !== "")
      .map((line) => (line = { text: line })),
    synced: subtitles,
  };

  return lyrics;
};

export const getYTMusicRelated = async (id) => {
  const data = await requestBrowse(id);
  const sections =
    data.contents?.sectionListRenderer?.contents?.[0]
      ?.musicCarouselShelfRenderer?.contents;
  const artistsRaw =
    data.contents?.sectionListRenderer?.contents?.[1]
      ?.musicCarouselShelfRenderer?.contents;
  const about =
    data?.contents?.sectionListRenderer?.contents?.[2]
      ?.musicDescriptionShelfRenderer?.description?.runs?.[0]?.text;
  const artists = [];
  artistsRaw?.forEach((artist) => {
    try {
      artists.push(filterRelatedArtists(artist));
    } catch (e) {
      console.error(e);
    }
  });
  const tracks = [];
  sections.forEach((section) => {
    try {
      tracks.push(filterTrackRelated(section));
    } catch (e) {
      console.error(e);
    }
  });
  return { artists, tracks, about };
};

export const getSongLyrics = async (id) => {
  try {
    const params = await getVideoSections(id);
    const lyrics = await getLyrics(params.lyrics, id);
    return lyrics;
  } catch (e) {
    console.log(e);
  }
};

export const getRelatedAndLyrics = async (id) => {
  try {
    const params = await getVideoSections(id);
    const [list, related, lyrics] = await Promise.all([
      getPlaylistQueue(params.mix, params.mixParam),
      getYTMusicRelated(params.related),
      getLyrics(params.lyrics, id),
    ]);
    console.log("requesting");
    return { lyrics, list, related };
  } catch (e) {
    console.log(e);
    return { error: e.message };
  }
};

const filterSongsSection = (data) => {
  const tracks = [];
  data.contents.forEach((track) => {
    try {
      tracks.push(filterYTMusicTracks(track));
    } catch (e) {
      console.error(e);
    }
  });
  const json = {
    type: "songs",
    id: data.title.runs[0].navigationEndpoint.browseEndpoint.browseId,
    params: data.title.runs[0].navigationEndpoint.browseEndpoint.params,
    tracks: tracks,
  };
  return json;
};

const filterAlbums = (data) => {
  const albums = [];
  data.contents.forEach((album) => {
    try {
      albums.push({
        api: "youtube",
        kind: "album",
        id: album.musicTwoRowItemRenderer.navigationEndpoint.browseEndpoint
          .browseId,
        title: album.musicTwoRowItemRenderer.title.runs[0].text,
        artist: album.musicTwoRowItemRenderer.subtitle.runs[2]?.text,
        artistID:
          album?.musicTwoRowItemRenderer?.subtitle?.runs?.[2]
            ?.navigationEndpoint?.browseEndpoint?.browseId,
        poster:
          album.musicTwoRowItemRenderer.thumbnailRenderer.musicThumbnailRenderer
            .thumbnail.thumbnails[0]?.url,
        posterLarge:
          album.musicTwoRowItemRenderer.thumbnailRenderer.musicThumbnailRenderer
            .thumbnail.thumbnails[1]?.url,
        playlistID:
          album?.musicTwoRowItemRenderer?.menu?.menuRenderer?.items?.[0]
            ?.menuNavigationItemRenderer?.navigationEndpoint
            ?.watchPlaylistEndpoint?.playlistId,
        param:
          album?.musicTwoRowItemRenderer?.menu?.menuRenderer?.items?.[0]
            ?.menuNavigationItemRenderer?.navigationEndpoint
            ?.watchPlaylistEndpoint?.params,
      });
    } catch (e) {
      console.error(e);
    }
  });
  return {
    type: "albums",
    id: data?.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs?.[0]
      ?.navigationEndpoint?.browseEndpoint?.browseId,
    params:
      data?.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs?.[0]
        ?.navigationEndpoint?.browseEndpoint?.params,
    data: albums,
  };
};

const filterSingles = (data) => {
  const albums = [];
  data.contents.forEach((album) => {
    try {
      albums.push({
        api: "youtube",
        kind: "single",
        id: album.musicTwoRowItemRenderer.navigationEndpoint.browseEndpoint
          .browseId,
        title: album.musicTwoRowItemRenderer.title.runs[0].text,
        artist: album.musicTwoRowItemRenderer.subtitle.runs[2]?.text,
        poster:
          album.musicTwoRowItemRenderer.thumbnailRenderer.musicThumbnailRenderer
            .thumbnail.thumbnails[0]?.url,
        posterLarge:
          album.musicTwoRowItemRenderer.thumbnailRenderer.musicThumbnailRenderer
            .thumbnail.thumbnails[1]?.url,
      });
    } catch (e) {
      console.error(e);
    }
  });
  return {
    type: "singles",
    id: data?.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs?.[0]
      ?.navigationEndpoint?.browseEndpoint?.browseId,
    params:
      data?.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs?.[0]
        ?.navigationEndpoint?.browseEndpoint?.params,
    data: albums,
  };
};

const filterList = (data) => {
  let lists = [];
  data.forEach((list) => {
    try {
      lists.push({
        api: "youtube",
        kind: "playlist",
        id: list.musicTwoRowItemRenderer.navigationEndpoint.browseEndpoint
          .browseId,
        title: list.musicTwoRowItemRenderer.title.runs[0].text,
        artist: "Youtube music",
        poster:
          list.musicTwoRowItemRenderer.thumbnailRenderer.musicThumbnailRenderer
            .thumbnail.thumbnails[0].url,
        posterLarge:
          list.musicTwoRowItemRenderer.thumbnailRenderer.musicThumbnailRenderer
            .thumbnail.thumbnails[1].url,
      });
    } catch (e) {
      console.error(e);
    }
  });
  return lists;
};

const filterArtists = (data) => {
  let artists = [];
  data.forEach((list) => {
    try {
      filterYTMusicArtists;
      artists.push({
        api: "youtube",
        kind: "artist",
        id: list.musicTwoRowItemRenderer.navigationEndpoint.browseEndpoint
          .browseId,
        name: list.musicTwoRowItemRenderer.title.runs[0].text,
        followers: list.musicTwoRowItemRenderer.subtitle.runs[0].text.replace(
          "subscribers",
          "followers"
        ),
        poster:
          list.musicTwoRowItemRenderer.thumbnailRenderer.musicThumbnailRenderer
            .thumbnail.thumbnails[0].url,
        posterLarge:
          list.musicTwoRowItemRenderer.thumbnailRenderer.musicThumbnailRenderer
            .thumbnail.thumbnails[1].url,
      });
    } catch (e) {
      console.error(e);
    }
  });
  return artists;
};
const filterArtistSections = (json) => {
  const sections =
    json.contents.singleColumnBrowseResultsRenderer.tabs[0].tabRenderer.content
      .sectionListRenderer.contents;
  const data = {};
  sections.forEach((section) => {
    try {
      if (section.musicShelfRenderer) {
        data.songs = filterSongsSection(section.musicShelfRenderer);
      } else if (section.musicCarouselShelfRenderer) {
        const main =
          section.musicCarouselShelfRenderer.header
            .musicCarouselShelfBasicHeaderRenderer.title.runs[0];
        const type = main.text;
        if (type == "Albums") {
          data.albums = filterAlbums(section.musicCarouselShelfRenderer);
        }
        if (type == "Singles") {
          data.singles = filterSingles(section.musicCarouselShelfRenderer);
        }
        if (type == "Featured on") {
          data.lists = filterList(section.musicCarouselShelfRenderer.contents);
        }
        if (type == "Fans might also like") {
          data.artists = filterArtists(
            section.musicCarouselShelfRenderer.contents
          );
        }
      }
    } catch (e) {
      console.error(e);
    }
  });
  return data;
};

const filterArtistData = (json, id) => {
  const artist = json.header.musicImmersiveHeaderRenderer;
  const sections = filterArtistSections(json);
  const image =
    artist?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.[0]?.url?.split(
      "=w"
    )?.[0];
  const data = {
    id,
    api: "youtube",
    name: artist?.title?.runs?.[0]?.text,
    description: artist?.description?.runs?.[0]?.text,
    followers:
      artist?.subscriptionButton?.subscribeButtonRenderer?.subscriberCountText
        ?.runs?.[0]?.text,
    poster: image ? `${image}=w1000-h1000-p-l100-rj` : undefined,
    images: artist?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails,
    ...sections,
  };
  return data;
};

export const getArtist = async (id) => {
  try {
    const data = await requestBrowse(id);
    const json = filterArtistData(data, id);
    return json;
  } catch (e) {
    console.error(e);
    return { error: e.message };
  }
};

const filterAlbumTrack = (track, data) => {
  const duration = timeToMilliseconds(
    track.fixedColumns[0].musicResponsiveListItemFixedColumnRenderer.text
      .runs[0].text
  );
  return {
    api: "youtube",
    id: track.playlistItemData.videoId,
    title:
      track.flexColumns[0].musicResponsiveListItemFlexColumnRenderer.text
        .runs[0].text,
    plays_count:
      track?.flexColumns?.[2]?.musicResponsiveListItemFlexColumnRenderer?.text
        ?.runs?.[0]?.text,
    ...data,
    duration,
  };
};

function timeToMss(timeString) {
  try {
    const timeUnits = {
      hour: 3600000,
      minute: 60000,
      second: 1000,
      millisecond: 1,
    };

    let totalMilliseconds = 0;
    const timeParts = timeString.match(
      /(\d+)\s*(hours?|minutes?|seconds?|milliseconds?)/gi
    );

    if (timeParts) {
      for (const part of timeParts) {
        const [_, value, unit] = part.match(/(\d+)\s*(\w+)/);
        const normalizedUnit = unit.toLowerCase().replace(/s$/, "");
        totalMilliseconds +=
          (parseInt(value, 10) || 0) * (timeUnits[normalizedUnit] || 0);
      }
    }

    return totalMilliseconds;
  } catch (e) {
    console.log(e);
    return timeString;
  }
}
const filterAlbumData = (data, id) => {
  const tracksRaw =
    data.contents?.twoColumnBrowseResultsRenderer?.secondaryContents
      ?.sectionListRenderer?.contents?.[0]?.musicShelfRenderer?.contents;
  const playlistID =
    tracksRaw?.[0]?.musicResponsiveListItemRenderer.flexColumns?.[0]
      ?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]
      ?.navigationEndpoint?.watchEndpoint?.playlistId;
  const posterRaw =
    data?.background?.musicThumbnailRenderer?.thumbnail?.thumbnails;
  const info =
    data?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer
      ?.content?.sectionListRenderer?.contents?.[0]
      ?.musicResponsiveHeaderRenderer;
  const tracksData = {
    artist: info?.straplineTextOne?.runs?.[0]?.text,
    artistID:
      info?.straplineTextOne?.runs?.[0]?.navigationEndpoint?.browseEndpoint
        ?.browseId,
    poster: posterRaw[0]?.url,
    posterLarge: posterRaw[0]?.url?.split("=")[0] + "=w600-h600-l100-rj",
    album: info?.title?.runs?.[0]?.text,
    albumID: id,
  };
  let tracks = [];
  tracksRaw.forEach((track) => {
    try {
      tracks.push(
        filterAlbumTrack(track.musicResponsiveListItemRenderer, tracksData)
      );
    } catch (e) {
      console.log(e);
    }
  });
  return {
    api: "youtube",
    id,
    name: info?.title?.runs?.[0]?.text,
    year: info?.subtitle?.runs?.[2]?.text,
    artist: info?.straplineTextOne?.runs?.[0]?.text,
    artistID:
      info?.straplineTextOne?.runs?.[0]?.navigationEndpoint?.browseEndpoint
        ?.browseId,
    poster: posterRaw[posterRaw.length - 1]?.url,
    tracks_count: info?.secondSubtitle?.runs?.[0]?.text,
    tracks_duration: timeToMss(info?.secondSubtitle?.runs?.[2]?.text),
    playlistID,
    tracks,
  };
};

export const getAlbum = async (id) => {
  try {
    const data = await requestBrowse(id);
    const content = filterAlbumData(data, id);
    return content;
  } catch (e) {
    console.log(e);
    return { error: e.message };
  }
};

const requestPlayer = async (id) => {
  const response = await fetch("https://music.youtube.com/youtubei/v1/player", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": userAgent,
    },
    body: JSON.stringify({
      videoId: id,
      isAudioOnly: true,
      context: {
        client: {
          clientName: "WEB_REMIX",
          clientVersion: "1.20241106.01.00",
        },
      },
    }),
  });
  const data = await response.json();
  return data;
};

export const getTrackData = async (id) => {
  try {
    const [data, next] = await Promise.all([
      requestPlayer(id),
      requestNext(id),
    ]);
    const main =
      next?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer
        ?.watchNextTabbedResultsRenderer?.tabs?.[0]?.tabRenderer?.content
        ?.musicQueueRenderer?.content?.playlistPanelRenderer?.contents?.[0]
        ?.playlistPanelVideoRenderer;
    const albumID = main?.menu?.menuRenderer?.items?.filter(
      (icon) => icon?.menuNavigationItemRenderer?.icon?.iconType == "ALBUM"
    )?.[0]?.menuNavigationItemRenderer?.navigationEndpoint?.browseEndpoint
      ?.browseId;
    const album = main?.longBylineText?.runs?.filter(
      (run) =>
        run?.navigationEndpoint?.browseEndpoint?.browseId == albumID && albumID
    )?.[0]?.text;
    const track = {
      api: "youtube",
      title: data.videoDetails.title,
      artist: data.videoDetails.author,
      artistID: data.videoDetails.channelId,
      duration: parseInt(data.videoDetails.lengthSeconds) * 1000 || undefined,
      poster: data.videoDetails.thumbnail.thumbnails[0].url,
      posterLarge:
        data.videoDetails.thumbnail.thumbnails[0].url?.split("=")[0] +
        "=w600-h600-l100-rj",
      plays_count: parseInt(data.videoDetails.viewCount),
      album,
      albumID,
    };
    return track;
  } catch (e) {
    console.log(e);
    return { error: e.message };
  }
};

function timeToMis(timeString) {
  const timeParts = timeString.match(/(\d+)\s*hr|(\d+)\s*min/g);
  let totalMilliseconds = 0;

  if (timeParts) {
    timeParts.forEach((part) => {
      if (part.includes("hr")) {
        const hours = parseInt(part);
        totalMilliseconds += hours * 60 * 60 * 1000;
      } else if (part.includes("min")) {
        const minutes = parseInt(part);
        totalMilliseconds += minutes * 60 * 1000;
      }
    });
  }

  return totalMilliseconds;
}

const filterPoadcast = (data, id) => {
  const tracksRaw =
    data.contents?.twoColumnBrowseResultsRenderer?.secondaryContents
      ?.sectionListRenderer?.contents?.[0]?.musicShelfRenderer?.contents;
  const main =
    data.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer
      ?.content?.sectionListRenderer?.contents?.[0]
      ?.musicResponsiveHeaderRenderer;
  const artistRaw = main?.straplineTextOne?.runs?.[0];
  const artist = artistRaw.text;
  const artistID = artistRaw?.navigationEndpoint?.browseEndpoint?.browseId;
  const title = main?.title?.runs?.[0]?.text;
  const posterRaw =
    data?.background?.musicThumbnailRenderer?.thumbnail?.thumbnails;
  const description =
    main?.description?.musicDescriptionShelfRenderer?.description?.runs?.[0]
      ?.text;
  const poster = posterRaw[0].url;
  const posterLarge = posterRaw[posterRaw.length - 1].url;
  const artistImage =
    main?.straplineThumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.[1]
      ?.url;
  let tracks = [];
  tracksRaw.forEach((track) => {
    try {
      tracks.push({
        api: "youtube",
        kind: "podcast",
        id:
          track?.musicMultiRowListItemRenderer?.playNavigationEndpoint
            ?.watchEndpoint?.videoId ||
          track.musicMultiRowListItemRenderer?.onTap?.watchEndpoint?.videoId,
        title: track?.musicMultiRowListItemRenderer?.title?.runs?.[0]?.text,
        description:
          track?.musicMultiRowListItemRenderer?.description?.runs?.[0]?.text,
        poster:
          track?.musicMultiRowListItemRenderer?.thumbnail
            ?.musicThumbnailRenderer?.thumbnail?.thumbnails?.[0]?.url,
        posterLarge:
          track?.musicMultiRowListItemRenderer?.thumbnail
            ?.musicThumbnailRenderer?.thumbnail?.thumbnails?.[2]?.url,
        artist: artist,
        artistID: artistID,
        album: title,
        albumID: id,
        duration: timeToMis(
          track?.musicMultiRowListItemRenderer?.playbackProgress
            ?.musicPlaybackProgressRenderer?.durationText?.runs?.[1]?.text
        ),
      });
    } catch (e) {
      console.log(e);
    }
  });
  return {
    api: "youtube",
    id,
    title,
    artist,
    artistID,
    poster,
    posterLarge,
    description,
    artistImage,
    tracks,
  };
};

export const getPodcast = async (id) => {
  try {
    const data = await requestBrowse(id);
    const json = filterPoadcast(data, id);
    return json;
  } catch (e) {
    return { error: e.message };
  }
};

const filterHome = (data) => {
  const sections =
    data.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer
      ?.content?.sectionListRenderer;
  let body = {};
  sections.contents.forEach((section) => {
    try {
      const type =
        section.musicCarouselShelfRenderer?.header
          ?.musicCarouselShelfBasicHeaderRenderer?.title?.runs?.[0]?.text;
      if (type == "Quick picks") {
        let tracks = [];
        section.musicCarouselShelfRenderer.contents.forEach((track) => {
          tracks.push(filterYTMusicTracks(track));
        });
        body.picks = tracks;
      } else if (type?.includes("Albums")) {
        body.albums = filterAlbums(section.musicCarouselShelfRenderer).data;
      }
    } catch (e) {
      console.log(e);
    }
  });

  return {
    params: {
      next: sections.continuations[0].nextContinuationData.continuation,
      tracking:
        sections.continuations[0].nextContinuationData.clickTrackingParams,
    },
    ...body,
  };
};

const filterExplore = (data) => {
  const sections =
    data.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer
      ?.content?.sectionListRenderer;
  let body = {};
  sections.contents.forEach((section) => {
    try {
      if (
        section.musicCarouselShelfRenderer?.header
          .musicCarouselShelfBasicHeaderRenderer.title.runs[0]
          .navigationEndpoint.browseEndpoint.browseId ==
        "FEmusic_new_releases_albums"
      ) {
        body.singles = filterAlbums(section.musicCarouselShelfRenderer).data;
      }
    } catch (e) {
      console.log(e);
    }
  });
  return {
    ...body,
  };
};

export const getHome = async () => {
  try {
    const [home, explore] = await Promise.all([
      requestBrowse("FEmusic_home"),
      requestBrowse("FEmusic_explore"),
    ]);
    const homeData = filterHome(home);
    const exploreData = filterExplore(explore);
    return {
      ...homeData,
      ...exploreData,
    };
  } catch (e) {
    console.log(e);
    return { error: e.message };
  }
};

// have fun ya m3lmy
// Enhanced video metadata extraction function
export const getVideoMetadata = async (videoId) => {
  try {
    const html = await scrapYoutube(
      `https://www.youtube.com/watch?v=${videoId}`,
      true
    );
    const json = extractVideoMetadata(html);

    if (json.error) {
      return { error: json.error };
    }

    let channelAvatar = json.videoDetails?.authorThumbnails?.[0]?.url;
    if (!channelAvatar) {
      // Try to extract from HTML
      const avatarMatch = html.match(
        /"avatar":{"thumbnails":\[{"url":"([^"]+)"/
      );
      if (avatarMatch) {
        channelAvatar = avatarMatch[1];
      }
    }

    const metadata = {
      id: videoId,
      title: json.videoDetails?.title,
      description: json.videoDetails?.shortDescription,
      duration: json.videoDetails?.lengthSeconds
        ? parseInt(json.videoDetails.lengthSeconds) * 1000
        : null,
      viewCount: json.videoDetails?.viewCount
        ? parseInt(json.videoDetails.viewCount)
        : null,
      publishedAt: json.microformat?.playerMicroformatRenderer?.publishDate,
      category: json.microformat?.playerMicroformatRenderer?.category,

      // Channel/Author information
      channel: {
        id: json.videoDetails?.channelId,
        name: json.videoDetails?.author,
        avatar: channelAvatar,
        subscriberCount:
          extractSubscriberCount(json) ||
          extractSubscriberCountFromHTML(html) ||
          (json.videoDetails?.subscriberCount
            ? parseInt(json.videoDetails.subscriberCount)
            : null),
        verified: extractChannelVerified(json),
        channel_url: extractChannelUrl(json, html) || "/@unknown",
      },

      // Thumbnail information
      thumbnails: {
        default: json.videoDetails?.thumbnail?.thumbnails?.[0]?.url,
        medium: json.videoDetails?.thumbnail?.thumbnails?.[1]?.url,
        high: json.videoDetails?.thumbnail?.thumbnails?.[2]?.url,
        standard: json.videoDetails?.thumbnail?.thumbnails?.[3]?.url,
        maxres: json.videoDetails?.thumbnail?.thumbnails?.[4]?.url,
      },

      // Keywords and tags
      keywords: json.videoDetails?.keywords || [],

      // Like/dislike information (if available)
      likes: extractLikeCount(json) || extractLikesFromHTML(html),

      // Comments information
      commentsCount:
        extractCommentsCount(json) || extractCommentsFromHTML(html),

      // Language information
      language:
        json.microformat?.playerMicroformatRenderer?.availableLanguages?.[0],

      // Quality information
      availableQualities: extractAvailableQualities(json),
    };

    return metadata;
  } catch (error) {
    console.error("Error fetching video metadata:", error);
    return { error: error.message };
  }
};

function extractVideoMetadata(html) {
  try {
    // Try multiple regex patterns
    const patterns = [
      /var ytInitialPlayerResponse\s*=\s*(\{.*?\})\s*;/s,
      /window\["ytInitialPlayerResponse"\]\s*=\s*(\{.*?\})\s*;/s,
      /"ytInitialPlayerResponse":(\{.*?\}),"ytInitialData"/s,
    ];

    let playerResponse = null;

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        try {
          let jsonString = match[1];
          // Clean up the JSON string
          const lastBraceIndex = jsonString.lastIndexOf("}");
          jsonString = jsonString.substring(0, lastBraceIndex + 1);
          playerResponse = JSON.parse(jsonString);
          break;
        } catch (e) {
          continue;
        }
      }
    }

    // Also try to extract ytInitialData for additional information
    let initialData = null;
    const dataPatterns = [
      /var ytInitialData\s*=\s*(\{.*?\})\s*;/s,
      /window\["ytInitialData"\]\s*=\s*(\{.*?\})\s*;/s,
    ];

    for (const pattern of dataPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        try {
          let jsonString = match[1];
          const lastBraceIndex = jsonString.lastIndexOf("}");
          jsonString = jsonString.substring(0, lastBraceIndex + 1);
          initialData = JSON.parse(jsonString);
          break;
        } catch (e) {
          continue;
        }
      }
    }

    if (playerResponse) {
      // Merge initialData into playerResponse for comprehensive data
      if (initialData) {
        playerResponse.contents = initialData.contents;
      }
      return playerResponse;
    }

    return { error: "no_data" };
  } catch (error) {
    console.error("Error parsing video metadata:", error);
    return { error: "json_parse_error" };
  }
}

function extractLikeCount(json) {
  try {
    const primary =
      json.contents?.twoColumnWatchNextResults?.results?.results?.contents?.find(
        (item) => item.videoPrimaryInfoRenderer
      )?.videoPrimaryInfoRenderer;

    if (!primary) return null;

    // 1. Try newest ButtonViewModel structure
    try {
      const likeButtonViewModel =
        primary.videoActions?.menuRenderer?.topLevelButtons?.[0]
          ?.segmentedLikeDislikeButtonViewModel?.likeButtonViewModel
          ?.likeButtonViewModel?.toggleButtonViewModel?.toggleButtonViewModel
          ?.defaultButtonViewModel?.buttonViewModel?.title;

      if (likeButtonViewModel && likeButtonViewModel !== "0") {
        const match = likeButtonViewModel.match(/[\d,\.KMB]+/i);
        if (match) {
          return parseViewCount(match[0]);
        }
      }
    } catch (e) {
      // Continue to next
    }

    // 2. Try alternative ButtonViewModel structure
    try {
      const altLikeButton =
        primary.videoActions?.menuRenderer?.topLevelButtons?.[0]
          ?.segmentedLikeDislikeButtonRenderer?.likeButton?.toggleButtonRenderer
          ?.defaultText?.simpleText;

      if (altLikeButton) {
        const match = altLikeButton.match(/[\d,\.KMB]+/i);
        if (match) {
          return parseViewCount(match[0]);
        }
      }
    } catch (e) {
      // Continue to next
    }

    // 3. Try segmentedLikeDislikeButtonRenderer
    const videoActions = primary.videoActions;
    let likeButton = videoActions?.menuRenderer?.topLevelButtons?.find(
      (button) => button.segmentedLikeDislikeButtonRenderer?.likeButton
    );

    if (likeButton) {
      const likeCount =
        likeButton.segmentedLikeDislikeButtonRenderer?.likeButton
          ?.toggleButtonRenderer?.defaultText?.accessibility?.accessibilityData
          ?.label ||
        likeButton.segmentedLikeDislikeButtonRenderer?.likeButton
          ?.toggleButtonRenderer?.defaultText?.simpleText;

      if (likeCount) {
        const match = likeCount.match(/[\d,\.KMB]+/i);
        if (match) {
          return parseViewCount(match[0]);
        }
      }
    }

    // 4. Try alternative button structures
    const topLevelButtons = videoActions?.menuRenderer?.topLevelButtons || [];
    for (const button of topLevelButtons) {
      // Check for like button in different structures
      const likeText =
        button.toggleButtonRenderer?.defaultText?.simpleText ||
        button.toggleButtonRenderer?.accessibility?.label ||
        button.buttonRenderer?.text?.simpleText ||
        button.segmentedLikeDislikeButtonViewModel?.likeButtonViewModel?.title;

      if (likeText && (likeText.includes("like") || /^\d/.test(likeText))) {
        const match = likeText.match(/[\d,\.KMB]+/i);
        if (match) {
          return parseViewCount(match[0]);
        }
      }
    }

    // 5. Deep search in all button structures
    for (const button of topLevelButtons) {
      if (button.segmentedLikeDislikeButtonRenderer) {
        const likeBtn = button.segmentedLikeDislikeButtonRenderer.likeButton;
        const text =
          likeBtn?.toggleButtonRenderer?.defaultText?.simpleText ||
          likeBtn?.toggleButtonRenderer?.accessibility?.label ||
          likeBtn?.buttonViewModel?.title;

        if (text) {
          const match = text.match(/[\d,\.KMB]+/i);
          if (match) {
            return parseViewCount(match[0]);
          }
        }
      }
    }

    return null;
  } catch (error) {
    console.error("Error extracting like count:", error);
    return null;
  }
}

// Helper function to parse view/like counts with K, M, B suffixes
function parseViewCount(countStr) {
  if (!countStr) return null;
  const cleanStr = countStr.toString().replace(/,/g, "").toLowerCase();
  const match = cleanStr.match(/^([\d\.]+)([kmb]?)$/);

  if (!match) {
    const directMatch = cleanStr.match(/^\d+$/);
    return directMatch ? parseInt(directMatch[0]) : null;
  }

  const [, numberPart, suffix] = match;
  const baseNumber = parseFloat(numberPart);

  switch (suffix) {
    case "k":
      return Math.round(baseNumber * 1000);
    case "m":
      return Math.round(baseNumber * 1000000);
    case "b":
      return Math.round(baseNumber * 1000000000);
    default:
      return Math.round(baseNumber);
  }
}

function extractCommentsCount(json) {
  try {
    // 1. Try engagementPanels structure
    try {
      const engagementPanelsPath = json.engagementPanels?.find(
        (panel) =>
          panel.engagementPanelSectionListRenderer?.header
            ?.engagementPanelTitleHeaderRenderer
      )?.engagementPanelSectionListRenderer?.header
        ?.engagementPanelTitleHeaderRenderer?.contextualInfo?.runs?.[0]?.text;

      if (engagementPanelsPath) {
        const match = engagementPanelsPath.match(/[\d,\.KMB]+/i);
        if (match) {
          return parseViewCount(match[0]);
        }
      }
    } catch (e) {
      // Continue to next
    }

    // 2. Try direct engagementPanels structure
    try {
      const engagementPanelsAlt =
        json.engagementPanels?.engagementPanelSectionListRenderer?.header
          ?.engagementPanelTitleHeaderRenderer?.contextualInfo?.runs?.[0]?.text;

      if (engagementPanelsAlt) {
        const match = engagementPanelsAlt.match(/[\d,\.KMB]+/i);
        if (match) {
          return parseViewCount(match[0]);
        }
      }
    } catch (e) {
      // Continue to next
    }

    // 3. Try commentsEntryPointHeaderRenderer structure
    const commentsEntryPoint =
      json.contents?.twoColumnWatchNextResults?.results?.results?.contents?.find(
        (item) =>
          item.itemSectionRenderer?.contents?.[0]
            ?.commentsEntryPointHeaderRenderer
      )?.itemSectionRenderer?.contents?.[0]?.commentsEntryPointHeaderRenderer;

    if (commentsEntryPoint) {
      const commentsText = commentsEntryPoint.commentCount?.simpleText;
      if (commentsText) {
        const match = commentsText.match(/[\d,\.KMB]+/i);
        if (match) {
          return parseViewCount(match[0]);
        }
      }
    }

    // 4. Try alternative engagementPanels paths (loop through all panels)
    if (json.engagementPanels && Array.isArray(json.engagementPanels)) {
      for (const panel of json.engagementPanels) {
        try {
          const contextualInfo =
            panel.engagementPanelSectionListRenderer?.header
              ?.engagementPanelTitleHeaderRenderer?.contextualInfo;

          if (contextualInfo?.runs?.[0]?.text) {
            const commentsText = contextualInfo.runs[0].text;
            const match = commentsText.match(/[\d,\.KMB]+/i);
            if (match) {
              return parseViewCount(match[0]);
            }
          }
        } catch (e) {
          continue;
        }
      }
    }

    // 5. Try searching in contents for comments section
    const contents =
      json.contents?.twoColumnWatchNextResults?.results?.results?.contents;
    if (contents && Array.isArray(contents)) {
      for (const content of contents) {
        try {
          if (content.itemSectionRenderer?.contents) {
            for (const item of content.itemSectionRenderer.contents) {
              if (item.commentsEntryPointHeaderRenderer) {
                const commentsText =
                  item.commentsEntryPointHeaderRenderer.commentCount
                    ?.simpleText ||
                  item.commentsEntryPointHeaderRenderer.commentCount?.runs?.[0]
                    ?.text;

                if (commentsText) {
                  const match = commentsText.match(/[\d,\.KMB]+/i);
                  if (match) {
                    return parseViewCount(match[0]);
                  }
                }
              }
            }
          }
        } catch (e) {
          continue;
        }
      }
    }

    return null;
  } catch (error) {
    console.error("Error extracting comments count:", error);
    return null;
  }
}

function extractCommentsFromHTML(html) {
  try {
    // Try to find comments count in various HTML patterns
    const patterns = [
      // JSON patterns in HTML
      /"commentCount":{"simpleText":"([\d,\.KMB]+)"/i,
      /"commentCount":"([\d,\.KMB]+)"/i,
      /"contextualInfo":{"runs":\[{"text":"([\d,\.KMB]+).*comments?"/i,
      /"contextualInfo":\{"runs":\[\{"text":"([\d,\.KMB]+).*comments?"/i,
      /"engagementPanelTitleHeaderRenderer".*?"contextualInfo".*?"runs":\[\{"text":"([\d,\.KMB]+).*comments?"/i,

      // Text
      /"text":"([\d,\.KMB]+)\s*comments?"/i,
      /"label":"([\d,\.KMB]+)\s*comments?"/i,
      /"simpleText":"([\d,\.KMB]+)\s*comments?"/i,
      /"title":"([\d,\.KMB]+)\s*comments?"/i,

      // General patterns
      /(\d+(?:,\d{3})*|\d+\.?\d*[KMB]?)\s*comments?/i,
      /"(\d+(?:,\d{3})*|\d+\.?\d*[KMB]?)\s*comments?"/i,

      // other patterns
      /"commentCount":\s*"([\d,\.KMB]+)"/i,
      /"commentCount":\s*{\s*"simpleText":\s*"([\d,\.KMB]+)"/i,
      /"commentCount":\s*{\s*"runs":\s*\[\s*{\s*"text":\s*"([\d,\.KMB]+)"/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        const commentCount = parseViewCount(match[1]);
        if (commentCount && commentCount > 0) {
          return commentCount;
        }
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

function extractAvailableQualities(json) {
  try {
    const formats = json.streamingData?.formats || [];
    const adaptiveFormats = json.streamingData?.adaptiveFormats || [];

    const qualities = new Set();

    [...formats, ...adaptiveFormats].forEach((format) => {
      if (format.qualityLabel) {
        qualities.add(format.qualityLabel);
      }
    });

    return Array.from(qualities).sort((a, b) => {
      const aRes = parseInt(a.replace(/\D/g, ""));
      const bRes = parseInt(b.replace(/\D/g, ""));
      return bRes - aRes;
    });
  } catch (error) {
    return [];
  }
}

function extractLikesFromHTML(html) {
  try {
    const patterns = [
      /"label":"([\d,\.KMB]+)\s*likes"/i,
      /"accessibilityText":"([\d,\.KMB]+)\s*likes"/i,
      /"simpleText":"([\d,\.KMB]+)\s*likes"/i,
      /"title":"([\d,\.KMB]+)\s*likes"/i,
      /aria-label="like this video along with ([\d,\.KMB]+)/i,
      /(\d+(?:,\d{3})*|\d+\.?\d*[KMB]?)\s*likes/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        const likeCount = parseViewCount(match[1]);
        if (likeCount && likeCount > 0) {
          return likeCount;
        }
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

function extractSubscriberCount(json) {
  try {
    const subscriberCountText =
      json.contents?.twoColumnWatchNextResults?.results?.results
        ?.subscriberCountText?.simpleText;

    if (subscriberCountText) {
      const match = subscriberCountText.match(/[\d,\.KMB]+/i);
      if (match) {
        return parseViewCount(match[0]);
      }
    }

    // or try secondary column
    const secondaryResults =
      json.contents?.twoColumnWatchNextResults?.results?.results?.contents;
    if (secondaryResults && Array.isArray(secondaryResults)) {
      for (const result of secondaryResults) {
        try {
          const videoOwner =
            result.videoSecondaryInfoRenderer?.owner?.videoOwnerRenderer;
          if (videoOwner?.subscriberCountText) {
            const subscriberText =
              videoOwner.subscriberCountText.simpleText ||
              videoOwner.subscriberCountText.runs?.[0]?.text;
            if (subscriberText) {
              const match = subscriberText.match(/[\d,\.KMB]+/i);
              if (match) {
                return parseViewCount(match[0]);
              }
            }
          }
        } catch (e) {
          continue;
        }
      }
    }

    // try in videoDetails
    const videoDetails = json.videoDetails;
    if (videoDetails?.channelId) {
      // Sometimes subscriber count is in channel-related data
      const channelData =
        json.contents?.twoColumnWatchNextResults?.results?.results?.contents?.find(
          (item) => item.videoSecondaryInfoRenderer?.owner
        );

      if (
        channelData?.videoSecondaryInfoRenderer?.owner?.videoOwnerRenderer
          ?.subscriberCountText
      ) {
        const subscriberText =
          channelData.videoSecondaryInfoRenderer.owner.videoOwnerRenderer
            .subscriberCountText.simpleText ||
          channelData.videoSecondaryInfoRenderer.owner.videoOwnerRenderer
            .subscriberCountText.runs?.[0]?.text;
        if (subscriberText) {
          const match = subscriberText.match(/[\d,\.KMB]+/i);
          if (match) {
            return parseViewCount(match[0]);
          }
        }
      }
    }

    return null;
  } catch (error) {
    console.error("Error extracting subscriber count:", error);
    return null;
  }
}

function extractSubscriberCountFromHTML(html) {
  try {
    const patterns = [
      // JSON patterns in HTML
      /"subscriberCountText":{"simpleText":"([\d,\.KMB]+)"/i,
      /"subscriberCountText":"([\d,\.KMB]+)"/i,
      /"subscriberCountText":\s*{\s*"simpleText":\s*"([\d,\.KMB]+)"/i,
      /"subscriberCountText":\s*{\s*"runs":\s*\[\s*{\s*"text":\s*"([\d,\.KMB]+)"/i,

      // Text
      /"text":"([\d,\.KMB]+)\s*subscribers?"/i,
      /"label":"([\d,\.KMB]+)\s*subscribers?"/i,
      /"simpleText":"([\d,\.KMB]+)\s*subscribers?"/i,
      /"title":"([\d,\.KMB]+)\s*subscribers?"/i,

      // General patterns
      /(\d+(?:,\d{3})*|\d+\.?\d*[KMB]?)\s*subscribers?/i,
      /"(\d+(?:,\d{3})*|\d+\.?\d*[KMB]?)\s*subscribers?"/i,

      // others
      /"subscriberCount":\s*"([\d,\.KMB]+)"/i,
      /"subscriberCount":\s*{\s*"simpleText":\s*"([\d,\.KMB]+)"/i,
      /"subscriberCount":\s*{\s*"runs":\s*\[\s*{\s*"text":\s*"([\d,\.KMB]+)"/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        const subscriberCount = parseViewCount(match[1]);
        if (subscriberCount && subscriberCount > 0) {
          return subscriberCount;
        }
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

function extractChannelVerified(json) {
  try {
    // Try from videoDetails
    if (json.videoDetails?.isVerified) {
      return true;
    }

    // Try from secondary info renderer
    const secondaryResults =
      json.contents?.twoColumnWatchNextResults?.results?.results?.contents;
    if (secondaryResults && Array.isArray(secondaryResults)) {
      for (const result of secondaryResults) {
        try {
          const videoOwner =
            result.videoSecondaryInfoRenderer?.owner?.videoOwnerRenderer;
          if (videoOwner?.badges) {
            const isVerified = videoOwner.badges.some(
              (item) =>
                item.metadataBadgeRenderer &&
                ["인증됨", "Verified", "✓"].some(
                  (e) =>
                    item.metadataBadgeRenderer.tooltip === e ||
                    item.metadataBadgeRenderer.accessibilityData?.label === e ||
                    item.metadataBadgeRenderer.style ===
                      "BADGE_STYLE_TYPE_VERIFIED"
                )
            );
            if (isVerified) {
              return true;
            }
          }
        } catch (e) {
          continue;
        }
      }
    }

    // Try from channel renderer in primary info
    const primaryInfo =
      json.contents?.twoColumnWatchNextResults?.results?.results?.contents?.find(
        (item) => item.videoPrimaryInfoRenderer
      )?.videoPrimaryInfoRenderer;

    if (primaryInfo?.owner?.videoOwnerRenderer?.badges) {
      const isVerified = primaryInfo.owner.videoOwnerRenderer.badges.some(
        (item) =>
          item.metadataBadgeRenderer &&
          ["인증됨", "Verified", "✓"].some(
            (e) =>
              item.metadataBadgeRenderer.tooltip === e ||
              item.metadataBadgeRenderer.accessibilityData?.label === e ||
              item.metadataBadgeRenderer.style === "BADGE_STYLE_TYPE_VERIFIED"
          )
      );
      if (isVerified) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error("Error extracting channel verification:", error);
    return false;
  }
}

function extractChannelUrl(json, html) {
  try {
    // Try from channel navigation endpoint
    const primaryInfo =
      json.contents?.twoColumnWatchNextResults?.results?.results?.contents?.find(
        (item) => item.videoPrimaryInfoRenderer
      )?.videoPrimaryInfoRenderer;

    if (
      primaryInfo?.owner?.videoOwnerRenderer?.navigationEndpoint?.browseEndpoint
        ?.canonicalBaseUrl
    ) {
      return primaryInfo.owner.videoOwnerRenderer.navigationEndpoint
        .browseEndpoint.canonicalBaseUrl;
    }

    // Try from video owner renderer
    const videoOwner = primaryInfo?.owner?.videoOwnerRenderer;
    if (
      videoOwner?.title?.runs?.[0]?.navigationEndpoint?.browseEndpoint
        ?.canonicalBaseUrl
    ) {
      return videoOwner.title.runs[0].navigationEndpoint.browseEndpoint
        .canonicalBaseUrl;
    }

    // Try from secondary info
    const secondaryInfo =
      json.contents?.twoColumnWatchNextResults?.results?.results?.contents?.find(
        (item) => item.videoSecondaryInfoRenderer
      )?.videoSecondaryInfoRenderer;

    if (
      secondaryInfo?.owner?.videoOwnerRenderer?.navigationEndpoint
        ?.browseEndpoint?.canonicalBaseUrl
    ) {
      return secondaryInfo.owner.videoOwnerRenderer.navigationEndpoint
        .browseEndpoint.canonicalBaseUrl;
    }

    // Try from channel ID if available
    const channelId = json.videoDetails?.channelId;
    if (channelId) {
      return `/@${channelId}`;
    }

    // Try to extract from HTML as fallback
    if (html) {
      const channelUrlMatch = html.match(/"canonicalBaseUrl":"([^"]*@[^"]*)"/);
      if (channelUrlMatch) {
        return channelUrlMatch[1];
      }

      // Try to find channel handle in HTML
      const handleMatch = html.match(/"@([^"]+)"/);
      if (handleMatch) {
        return `/@${handleMatch[1]}`;
      }
    }

    return null;
  } catch (error) {
    console.error("Error extracting channel URL:", error);
    return null;
  }
}

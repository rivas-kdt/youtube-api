let oldIpRotationsWarning = true;

export const applyDefaultHeaders = options => {
    options.requestOptions = Object.assign({}, options.requestOptions);
    options.requestOptions.headers = Object.assign(
        {},
        {
            // eslint-disable-next-line max-len
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.101 Safari/537.36",
        },
        options.requestOptions.headers,
    );
}

export const applyIPv6Rotations = options => {
    if (options.IPv6Block) {
        options.requestOptions = Object.assign({}, options.requestOptions, {
            localAddress: getRandomIPv6(options.IPv6Block),
        });
        if (oldIpRotationsWarning) {
            oldIpRotationsWarning = false;
            oldLocalAddressWarning = false;
        }
    }
};

const getRandomIPv6 = ip => {
    if (!isIPv6(ip)) {
        throw new Error("Invalid IPv6 format");
    }

    const [rawAddr, rawMask] = ip.split("/");
    const mask = parseInt(rawMask, 10);

    if (isNaN(mask) || mask > 128 || mask < 1) {
        throw new Error("Invalid IPv6 subnet mask (must be between 1 and 128)");
    }

    const base10addr = normalizeIP(rawAddr);

    const fullMaskGroups = Math.floor(mask / 16);
    const remainingBits = mask % 16;

    const result = new Array(8).fill(0);

    for (let i = 0; i < 8; i++) {
        if (i < fullMaskGroups) {
            result[i] = base10addr[i];
        } else if (i === fullMaskGroups && remainingBits > 0) {
            const groupMask = 0xffff << (16 - remainingBits);
            const randomPart = Math.floor(Math.random() * (1 << (16 - remainingBits)));
            result[i] = (base10addr[i] & groupMask) | randomPart;
        } else {
            result[i] = Math.floor(Math.random() * 0x10000);
        }
    }

    return result.map(x => x.toString(16).padStart(4, "0")).join(":");
};

const isIPv6 = ip => {
    const IPV6_REGEX =
        /^(?:(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:(?:(?::[0-9a-fA-F]{1,4}){1,6})|:(?:(?::[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(?::[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(?:ffff(?::0{1,4}){0,1}:){0,1}(?:(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])|(?:[0-9a-fA-F]{1,4}:){1,4}:(?:(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(?:25[0-5]|(?:2[0-4]|1{0,1}[0-9]){0,1}[0-9]))(?:\/(?:1[0-1][0-9]|12[0-8]|[1-9][0-9]|[1-9]))?$/;
    return IPV6_REGEX.test(ip);
};

/**
 * Normalizes an IPv6 address into an array of 8 integers
 * @param {string} ip - IPv6 address
 * @returns {number[]} - Array of 8 integers representing the address
 */
const normalizeIP = ip => {
    const parts = ip.split("::");
    let start = parts[0] ? parts[0].split(":") : [];
    let end = parts[1] ? parts[1].split(":") : [];

    const missing = 8 - (start.length + end.length);
    const zeros = new Array(missing).fill("0");

    const full = [...start, ...zeros, ...end];

    return full.map(part => parseInt(part || "0", 16));
};

class UnrecoverableError extends Error { }


export const playError = player_response => {
    const playability = player_response?.playabilityStatus;
    if (!playability) return null;
    if (["ERROR", "LOGIN_REQUIRED"].includes(playability.status)) {
        return new UnrecoverableError(playability.reason || playability.messages?.[0]);
    }
    if (playability.status === "LIVE_STREAM_OFFLINE") {
        return new UnrecoverableError(playability.reason || "The live stream is offline.");
    }
    if (playability.status === "UNPLAYABLE") {
        return new UnrecoverableError(playability.reason || "This video is unavailable.");
    }
    return null;
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

export const tryParseBetween = (body, left, right, prepend = "", append = "") => {
    try {
        let data = between(body, left, right);
        if (!data) return null;
        return JSON.parse(`${prepend}${data}${append}`);
    } catch (e) {
        return null;
    }
};
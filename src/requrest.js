export const request = async (url, options, isJson = false) => {
    const response = await fetch(url, options);
    if (isJson) {
        return response.json();
    }
    return response.text();
}
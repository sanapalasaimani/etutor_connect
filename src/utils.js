export function getThumbnailUrl(url) {
    if (!url) return 'https://images.unsplash.com/photo-1501504905252-473c47e087f8?auto=format&fit=crop&q=80&w=800'; // High-quality default
    if (url.includes('drive.google.com')) {
        const fileId = url.match(/[-\w]{25,}/);
        if (fileId) return `https://lh3.googleusercontent.com/d/${fileId[0]}=w1000`;
    }
    return url;
}

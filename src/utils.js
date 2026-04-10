export function getThumbnailUrl(url) {
    if (!url) return 'https://images.unsplash.com/photo-1501504905252-473c47e087f8?auto=format&fit=crop&q=80&w=800'; // High-quality default
    if (url.includes('drive.google.com')) {
        const fileId = url.match(/[-\w]{25,}/);
        if (fileId) return `https://drive.google.com/thumbnail?id=${fileId[0]}&sz=w800`;
    }
    return url;
}

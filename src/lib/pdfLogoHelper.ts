// Map company short_name to logo file path
const logoMap: Record<string, string> = {
  "ART": "/logos/artlevage.png",
  "ALT": "/logos/altigrues.png",
  "ASD": "/logos/asdgm.png",
};

export interface LogoResult {
  dataUrl: string;
  width: number;
  height: number;
}

export async function loadCompanyLogo(shortName: string): Promise<LogoResult | null> {
  const path = logoMap[shortName] || Object.entries(logoMap).find(([k]) => shortName.toUpperCase().startsWith(k))?.[1];
  if (!path) return null;

  try {
    const response = await fetch(path);
    if (!response.ok) return null;
    const blob = await response.blob();

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0);
        resolve({
          dataUrl: canvas.toDataURL("image/png"),
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      };
      img.onerror = () => resolve(null);
      img.src = URL.createObjectURL(blob);
    });
  } catch {
    return null;
  }
}

// Map company short_name to logo file path
const logoMap: Record<string, string> = {
  "ART": "/logos/artlevage.png",
  "ALT": "/logos/altigrues.png",
  "ASD": "/logos/asdgm.png",
};

export async function loadCompanyLogo(shortName: string): Promise<string | null> {
  // Try exact match first, then prefix match
  const path = logoMap[shortName] || Object.entries(logoMap).find(([k]) => shortName.toUpperCase().startsWith(k))?.[1];
  if (!path) return null;

  try {
    const response = await fetch(path);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

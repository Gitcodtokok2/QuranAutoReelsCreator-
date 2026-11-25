import { RECITERS, SURAH_LIST } from '../data/quranLibrary';
import { VerseItem } from '../types/studio';
import { estimateVerseDuration } from '../utils/timeline';

interface AlQuranAyah {
  number: number; // global ayah number (1..6236)
  numberInSurah: number;
  text: string;
}

interface AlQuranEdition {
  identifier: string;
  ayahs: AlQuranAyah[];
}

interface AlQuranResponse {
  code: number;
  status: string;
  data: AlQuranEdition[];
}

const RECITER_FOLDER_LOOKUP: Record<string, string> = Object.fromEntries(
  RECITERS.map((r) => [r.id, r.everyAyahFolder])
);

/**
 * Returns the authentic, CORS-enabled recitation MP3 URL for a Surah/Ayah pair and reciter
 * (supports both Hafs 'an 'Asim and Warsh 'an Nafi' traditions).
 */
export function getVerseAudioUrl(
  surahNumber: number,
  ayahNumber: number,
  reciterId: string
): string {
  const folder = RECITER_FOLDER_LOOKUP[reciterId] ?? 'Alafasy_128kbps';
  const sss = String(surahNumber).padStart(3, '0');
  const aaa = String(ayahNumber).padStart(3, '0');
  return `https://everyayah.com/data/${folder}/${sss}${aaa}.mp3`;
}

/**
 * Fetches authentic Arabic Uthmani, French (Hamidullah), and English (Saheeh International)
 * verses for any Surah and verse range via api.alquran.cloud.
 */
export async function fetchSurahVerses(
  surahNumber: number,
  fromAyah: number,
  toAyah: number
): Promise<VerseItem[]> {
  const meta = SURAH_LIST.find((s) => s.number === surahNumber);
  const surahNameFr = meta?.nameFr ?? `Sourate ${surahNumber}`;
  const surahNameAr = meta?.nameAr ?? '';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9500);

  try {
    const url = `https://api.alquran.cloud/v1/surah/${surahNumber}/editions/quran-uthmani,fr.hamidullah,en.sahih`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Impossible de charger la sourate (code ${response.status}).`);
    }

    const json = (await response.json()) as AlQuranResponse;
    if (!json.data || json.data.length < 3) {
      throw new Error('Réponse incomplète du serveur coranique.');
    }

    const [arEdition, frEdition, enEdition] = json.data;
    const verses: VerseItem[] = [];

    for (let i = 0; i < arEdition.ayahs.length; i++) {
      const ar = arEdition.ayahs[i];
      if (ar.numberInSurah < fromAyah || ar.numberInSurah > toAyah) continue;

      const fr = frEdition.ayahs[i];
      const en = enEdition.ayahs[i];

      // Strip leading Bismillah prefix on Ayah 1 for non-Fatiha surahs if embedded
      let arabicText = ar.text.trim();
      if (surahNumber !== 1 && surahNumber !== 9 && ar.numberInSurah === 1) {
        const bismillahPrefix = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';
        if (arabicText.startsWith(bismillahPrefix) && arabicText.length > bismillahPrefix.length + 2) {
          arabicText = arabicText.slice(bismillahPrefix.length).trim();
        }
      }

      verses.push({
        id: `${surahNumber}-${ar.numberInSurah}`,
        surahNumber,
        surahNameFr,
        surahNameAr,
        ayahNumber: ar.numberInSurah,
        globalAyahNumber: ar.number,
        arabic: arabicText,
        french: fr?.text?.trim() ?? '',
        english: en?.text?.trim() ?? '',
        duration: estimateVerseDuration(arabicText),
      });
    }

    if (verses.length === 0) {
      throw new Error('Aucun verset trouvé pour cette plage.');
    }

    return verses;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Délai d’attente dépassé. Vérifiez votre connexion ou utilisez un passage intégré.');
    }
    throw err instanceof Error
      ? err
      : new Error('Impossible de charger cette sourate pour le moment.');
  } finally {
    clearTimeout(timeout);
  }
}

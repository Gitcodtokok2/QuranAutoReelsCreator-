import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

function createGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  /**
   * AI Artistic Director & Campaign Assistant
   * Converts natural-language French campaign instructions into structured campaign parameters.
   * Never generates or modifies Quranic text.
   */
  app.post('/api/ai/campaign', async (req, res) => {
    try {
      const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
      if (!prompt || prompt.length < 6) {
        res.status(400).json({ error: 'Décrivez votre campagne en quelques mots.' });
        return;
      }

      const ai = createGeminiClient();
      if (!ai) {
        res.status(503).json({
          error:
            'Clé Gemini indisponible dans les secrets du projet. Configurez GEMINI_API_KEY dans Settings > Secrets ou utilisez les réglages manuels ci-dessous.',
        });
        return;
      }

      const systemInstruction = `Tu es le directeur artistique de NoorReel, un studio de création et de programmation de vidéos coraniques verticales.
Ta mission : convertir l'instruction en langage naturel de l'utilisateur en paramètres de campagne structurés (JSON strict).
Règles impératives :
- Ne génère jamais de versets coraniques et ne modifie jamais le Coran.
- Choisis uniquement parmi les identifiants autorisés :
  - reciterIds valides : ["ar.alafasy", "ar.sudais", "ar.mahermuaiqly", "ar.abdulsamad", "ar.ghamdi", "ar.dosari", "ar.minshawi", "ar.husary", "ar.qatami", "ar.shaatree", "ar.hudhaify", "ar.shuraym", "ar.ayyoub", "ar.jibreel", "ar.rifai", "ar.faresabbad", "ar.alijaber", "ar.budair", "ar.juhaynee", "ar.qahtaanee", "ar.ajamy", "warsh.jazaery", "warsh.dosary", "warsh.abdulsamad"]
  - selectedFamilies valides : ["nature", "architecture", "manuscript", "luxury", "minimal", "astronomy", "meditation", "education", "watercolor", "abstract-glass", "calligraphy", "ramadan"]
  - subtitleLanguage valide : "ar-fr" | "ar-en" | "ar-fr-en" | "ar-only" | "fr-only"
  - textAnimation valide : "karaoke" | "luminous-reveal" | "line-reveal" | "dynamic-focus" | "mask-reveal" | "mushaf-page" | "cinematic-fade" | "vertical-rise"
  - slotMode valide : "morning" | "morning-evening" | "distributed" | "optimized"
- Si l'utilisateur demande "mot par mot", utilise "luminous-reveal". Si "karaoké", utilise "karaoke". Si "mushaf", utilise "mushaf-page". Si "focus", utilise "dynamic-focus". Si "masque", utilise "mask-reveal".
- Si l'utilisateur demande "Warsh" ou "Algérie / Maghreb", inclus au moins "warsh.jazaery" et "warsh.dosary".
- videosPerDay doit être entre 1 et 5 ; durationDays entre 7 et 30.
- Réponds en français sobre dans campaignName et directorNote (1-2 phrases courtes).`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Instruction utilisateur : ${prompt}`,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              campaignName: { type: Type.STRING },
              videosPerDay: { type: Type.INTEGER },
              durationDays: { type: Type.INTEGER },
              slotMode: { type: Type.STRING },
              subtitleLanguage: { type: Type.STRING },
              textAnimation: { type: Type.STRING },
              selectedReciterIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              selectedFamilies: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              varyStyles: { type: Type.BOOLEAN },
              alternateReciters: { type: Type.BOOLEAN },
              avoidDuplicates: { type: Type.BOOLEAN },
              directorNote: { type: Type.STRING },
            },
            required: [
              'campaignName',
              'videosPerDay',
              'durationDays',
              'slotMode',
              'subtitleLanguage',
              'textAnimation',
              'selectedReciterIds',
              'selectedFamilies',
              'varyStyles',
              'alternateReciters',
              'avoidDuplicates',
              'directorNote',
            ],
          },
        },
      });

      const raw = (response.text ?? '').trim();
      const parsed = JSON.parse(raw);
      res.json(parsed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la génération IA.';
      res.status(502).json({ error: msg });
    }
  });

  /**
   * AI Artistic Director for Quran Studio
   * Suggests a cohesive visual style, scene, transition, text animation, and Arabic font for the active passage.
   */
  app.post('/api/ai/director', async (req, res) => {
    try {
      const { surahNameFr, surahNumber, sampleFrench, brief, availableStyleIds } = req.body ?? {};
      if (!surahNameFr) {
        res.status(400).json({ error: 'Passage actif manquant.' });
        return;
      }

      const ai = createGeminiClient();
      if (!ai) {
        res.status(503).json({
          error:
            'Clé Gemini indisponible dans les secrets du projet. Vérifiez GEMINI_API_KEY dans Settings > Secrets.',
        });
        return;
      }

      const styleIdsHint =
        Array.isArray(availableStyleIds) && availableStyleIds.length > 0
          ? availableStyleIds.slice(0, 30).join(', ')
          : 'crepuscule-dore, art-andalou, aube-medine, parchemin-enlumine, aquarelle-aube, verre-lumiere, obsidienne-or, memorisation-claire';

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Propose une direction artistique visuelle cohérente et respectueuse pour une vidéo verticale 9:16 du Coran :
- Sourate : ${surahNameFr} (n°${surahNumber ?? ''})
- Extrait traduit : "${String(sampleFrench ?? '').slice(0, 220)}"
- Souhait utilisateur : "${String(brief ?? 'Direction artistique élégante et apaisante').slice(0, 220)}"
- Identifiants de modèles disponibles (choisis exactement un ID parmi cette liste) : ${styleIdsHint}
- Animations autorisées : karaoke, luminous-reveal, line-reveal, dynamic-focus, mask-reveal, mushaf-page, cinematic-fade, vertical-rise
- Transitions autorisées : crossfade, slow-zoom, slide-up, cinematic-blur, golden-flash, dip-black
- Polices arabes autorisées : amiri, scheherazade, noto-naskh, lateef
Ne fais aucune interprétation religieuse et ne modifie aucun verset. Donne une rationale concise en français (1-2 phrases).`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              styleId: { type: Type.STRING },
              textAnimation: { type: Type.STRING },
              transition: { type: Type.STRING },
              arabicFont: { type: Type.STRING },
              rationale: { type: Type.STRING },
            },
            required: ['styleId', 'textAnimation', 'transition', 'arabicFont', 'rationale'],
          },
        },
      });

      const raw = (response.text ?? '').trim();
      const parsed = JSON.parse(raw);
      res.json(parsed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur du directeur artistique IA.';
      res.status(502).json({ error: msg });
    }
  });

  /**
   * AI Caption & Hashtag Generator for scheduled social posts.
   * Respects Quranic accuracy and writes concise, dignified French social captions.
   */
  app.post('/api/ai/caption', async (req, res) => {
    try {
      const { surahNameFr, surahNumber, fromAyah, toAyah, reciterName, styleName } =
        req.body ?? {};
      if (!surahNameFr || !surahNumber) {
        res.status(400).json({ error: 'Informations de sourate manquantes.' });
        return;
      }

      const ai = createGeminiClient();
      if (!ai) {
        res.status(503).json({
          error:
            'Clé Gemini indisponible dans les secrets du projet. Vérifiez GEMINI_API_KEY dans Settings > Secrets.',
        });
        return;
      }

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Prépare une légende courte, sobre et respectueuse en français (2 phrases maximum) ainsi que 6 hashtags pertinents pour une vidéo verticale TikTok / Instagram Reels présentant :
- Sourate : ${surahNameFr} (n°${surahNumber}, versets ${fromAyah ?? 1} à ${toAyah ?? 1})
- Récitateur : ${reciterName ?? 'Récitation coranique'}
- Ambiance visuelle : ${styleName ?? 'Cinématographique'}
Ne cite aucun verset inventé et ne fais aucune exégèse personnelle.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              caption: { type: Type.STRING },
              hashtags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['caption', 'hashtags'],
          },
        },
      });

      const raw = (response.text ?? '').trim();
      const parsed = JSON.parse(raw);
      res.json(parsed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la génération de légende.';
      res.status(502).json({ error: msg });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NoorReel server listening on http://localhost:${PORT}`);
  });
}

startServer();

// YouTube embed language hints, derived from the app language.
//
// The exercise videos are recorded in Vietnamese once; other languages come
// from YouTube itself (owner decision 2026-09-05): auto-dubbed audio tracks,
// translated subtitles and translated titles are all added in YouTube
// Studio, not by re-recording. The embed cannot force which AUDIO track
// plays — YouTube picks it from the viewer's own language — but it can be
// told which player UI language and which caption language to prefer, and
// whether to show captions at all. Vietnamese viewers get the original
// player with captions off; everyone else gets captions on in their
// language as the guaranteed fallback when the dubbed track is missing.
import type { AppLanguage } from '@/store/useAppStore';

export function youtubePlayerLangParams(language: AppLanguage) {
  const code = language === 'ms' ? 'ms' : language === 'en' ? 'en' : 'vi';
  return {
    playerLang: code,
    cc_lang_pref: code,
    showClosedCaptions: code !== 'vi',
  } as const;
}

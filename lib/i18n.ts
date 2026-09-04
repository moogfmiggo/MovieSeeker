// Central Thai UI-text dictionary (Phase 2, Part 5).
//
// Deliberately a plain nested object, not a full i18n framework: the brief
// asks for maintainable strings with easy future expansion to English, not
// runtime language switching. Adding English later means adding a sibling
// `export const en = {...}` with the same shape - no component changes.
//
// Scope note: this covers movie *data* from TMDB (titles, overviews, cast
// names) is intentionally left out of this file and untranslated - the brief
// asks to keep those in their original form. Only interface chrome (nav,
// buttons, section labels, empty/error states) lives here.

import type { MatchReason } from "@/lib/recommendations-v2";

export const th = {
  meta: {
    brand: "MovieSeeker",
    defaultTitle: "MovieSeeker — ค้นหาหนังที่ใช่สำหรับคุณ",
    defaultDescription: "ค้นพบหนังที่ตรงกับรสนิยมของคุณ",
    titleSuffix: "— MovieSeeker",
  },
  nav: {
    discover: "ค้นหาหนัง",
    watched: "ดูแล้ว",
    favorites: "รายการโปรด",
    streaming: "บริการสตรีมมิ่ง",
  },
  landing: {
    headerCta: "เข้าสู่หน้าหลัก",
    eyebrow: "ค้นหาหนังที่ใช่ สำหรับคนดูในไทย",
    titleLineOne: "คืนนี้ดูอะไรดี?",
    titleLineTwo: "ให้เราช่วยหาให้",
    description: "MovieSeeker ช่วยคุณค้นหาหนังจากแนวและธีมที่อยากดู พร้อมแนะนำหนังบนสตรีมมิ่งและหนังใหม่เข้าโรงในประเทศไทย โดยเรียนรู้จากหนังที่คุณชอบมากขึ้นทุกครั้งที่ใช้งาน",
    primaryCta: "เริ่มค้นหาหนัง",
    secondaryCta: "ดูบริการสตรีมมิ่ง",
    helper: "ใช้งานได้ทันที ไม่ต้องสมัครสมาชิก",
    previewLabel: "ตัวอย่างการค้นหาหนังใน MovieSeeker",
    previewEyebrow: "คืนนี้อยากดูหนังแบบไหน?",
    previewTitle: "เลือกได้ละเอียดกว่าคำว่าแนวหนัง",
    previewTopics: ["ชวนคิด", "ลึกลับ", "โลกอนาคต", "เดินเรื่องเร็ว"],
    previewMovies: ["เรื่องที่ตรงที่สุด", "ตัวเลือกสำหรับคุณ", "ลองอะไรใหม่ ๆ"],
    previewResult: "คัดจากทุกหัวข้อที่เลือก",
    previewMatch: "ตรงความต้องการ",
    features: {
      searchTitle: "เลือกได้ทั้งแนวและธีม",
      searchBody: "ผสมหลายหัวข้อเพื่อเจอหนังที่ตรงกับสิ่งที่อยากดูจริง ๆ ไม่ใช่แค่หนังยอดนิยมทั่วไป",
      thailandTitle: "ข้อมูลสำหรับคนดูในไทย",
      thailandBody: "แยกหนังใหม่เข้าโรงในประเทศไทย และบอกช่องทางสตรีมมิ่งที่รับชมได้ในไทย",
      personalTitle: "ยิ่งใช้ ยิ่งรู้ใจ",
      personalBody: "รายการโปรดและประวัติการรับชมช่วยให้คำแนะนำครั้งต่อไปใกล้กับรสนิยมของคุณมากขึ้น",
    },
  },
  common: {
    tryAgain: "ลองอีกครั้ง",
    noPosterAvailable: "ไม่มีโปสเตอร์",
    noPhotoAvailable: "ไม่มีรูปภาพ",
    noLogo: "ไม่มีโลโก้",
    releaseDateUnknown: "ไม่ทราบวันที่ฉาย",
    noDescription: "ไม่มีเรื่องย่อ",
    /** Screen-reader-only label on a poster link; movie title itself stays untranslated. */
    viewDetailsFor: (title: string) => `ดูรายละเอียดของ ${title}`,
  },
  watched: {
    markWatched: "ทำเครื่องหมายว่าดูแล้ว",
    watched: "ดูแล้ว ✓",
  },
  favorite: {
    add: "เพิ่มในรายการโปรด",
    remove: "นำออกจากรายการโปรด",
    /** Accessible label/title on the MovieCard heart toggle - includes the movie title. */
    addLabel: (title: string) => `เพิ่ม "${title}" ในรายการโปรด`,
    removeLabel: (title: string) => `นำ "${title}" ออกจากรายการโปรด`,
  },
  /** Phase 4: personalized discovery homepage (Parts 1, 2, 6, 7, 8). */
  home: {
    heroEyebrow: "หนังสตรีมมิ่งที่เหมาะกับคุณ",
    streamingTitle: "หนังสตรีมมิ่งน่าดูในไทย",
    streamingSubtitle: "หนังที่รับชมได้ผ่านบริการสตรีมมิ่งในประเทศไทย",
    nowPlayingTitle: "หนังใหม่เข้าโรงในไทย",
    nowPlayingSubtitle: "อ้างอิงภาพยนตร์ที่กำลังฉายในประเทศไทยจาก TMDB",
    viewDetails: "ดูรายละเอียด →",
    /** Part 7 - "personalization match", never quality/popularity. */
    matchScore: (score: number) => `${score}% เหมาะกับคุณ`,
    // State B - preferences only.
    preferencesOnlyBody: "เราเลือกหนังจากแนวที่คุณสนใจ",
    // State C - some favorites/watched, below the "strong" threshold.
    someInteractionBody: "เราเลือกหนังจากหนังที่คุณชอบและดูไปแล้ว",
    // State D - built from real favorite-derived genre names, never invented.
    strongPattern: (genreNames: string[]) => {
      const names = genreNames.filter(Boolean);
      if (names.length === 0) return "";
      if (names.length === 1) return `คุณดูและชอบหนังแนว ${names[0]} หลายเรื่อง`;
      return `คุณดูและชอบหนังแนว ${names.slice(0, -1).join(", ")} และ ${names[names.length - 1]} หลายเรื่อง`;
    },
    noCandidates: "เรายังมีข้อมูลไม่พอสำหรับแนะนำเฉพาะบุคคล ลองดูหนังสตรีมมิ่งในไทยด้านล่างนี้ไปก่อนนะ",
    loadError: "ไม่สามารถโหลดคำแนะนำหนังได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง",
  },
  genreSearch: {
    title: "วันนี้อยากดูหนังแนวไหน?",
    subtitle: "เลือกได้ทั้งแนวหลักและธีม หนังที่ค้นพบจะต้องตรงครบทุกหัวข้อที่คุณเลือก",
    mainGenres: "แนวหลัก",
    moreTopics: "แนวย่อยและธีมเพิ่มเติม",
    noneSelected: "ยังไม่ได้เลือกแนวหรือธีมหนัง",
    selectedCount: (count: number) => `เลือกแล้ว ${count} หัวข้อ`,
    selectAtLeastOne: "เลือกอย่างน้อย 1 หัวข้อเพื่อค้นหา",
    search: "ค้นหาหนัง",
  },
  moviesPage: {
    title: "หนังยอดนิยม",
    subtitle: "ข้อมูลสดจาก TMDB",
    filteredTitle: "ผลการค้นหาตามแนวและธีม",
    filteredSubtitle: (count: number) => `แสดงเฉพาะหนังที่ตรงครบทั้ง ${count} หัวข้อที่เลือก`,
  },
  moviesError: {
    title: "ไม่สามารถโหลดหนังได้",
    body: "เกิดข้อผิดพลาดขณะดึงข้อมูลหนังจาก TMDB กรุณาลองใหม่อีกครั้ง",
  },
  movieList: {
    recommendedForYou: "แนะนำสำหรับคุณบนสตรีมมิ่ง",
    matchesAllSelectedGenres: "หนังที่ตรงกับทุกแนวและธีมที่คุณเลือก",
    noMoviesFound: "ไม่พบหนัง",
    allWatched: "คุณดูหนังทั้งหมดในรายการนี้แล้ว",
    showWatchedToo: "แสดงหนังที่ดูแล้ว",
    showMore: "แสดงเพิ่มเติม",
    loadingMore: "กำลังโหลด...",
    loadMoreError: "โหลดหนังเพิ่มเติมไม่สำเร็จ กรุณาลองอีกครั้ง",
  },
  watchedPage: {
    title: "หนังที่ดูแล้ว",
    subtitle: "หนังที่คุณทำเครื่องหมายว่าดูแล้ว",
    empty: "ยังไม่มีหนังที่ดูแล้ว",
    browseMovies: "ดูหนังทั้งหมด",
    loadError: "ไม่สามารถโหลดหนังที่ดูแล้วได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง",
  },
  favoritesPage: {
    title: "รายการโปรด",
    subtitle: "หนังที่คุณทำเครื่องหมายว่าชอบ",
    empty: "ยังไม่มีหนังในรายการโปรด",
    browseMovies: "ดูหนังทั้งหมด",
    loadError: "ไม่สามารถโหลดรายการโปรดได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง",
  },
  preferencesPage: {
    title: "ค้นหาหนังตามแนวและธีม",
    subtitle: "เลือกแนวหรือธีมที่ต้องการแล้วกดค้นหาได้ทันที",
  },
  movieDetail: {
    overview: "เรื่องย่อ",
    director: "ผู้กำกับ",
    cast: "นักแสดง",
    noCastInfo: "ไม่มีข้อมูลนักแสดง",
    production: "บริษัทผู้ผลิต",
    noProductionInfo: "ไม่มีข้อมูลบริษัทผู้ผลิต",
  },
  movieDetailError: {
    title: "ไม่สามารถโหลดหนังเรื่องนี้ได้",
    body: "เกิดข้อผิดพลาดขณะดึงข้อมูลหนังเรื่องนี้จาก TMDB กรุณาลองใหม่อีกครั้ง",
  },
  person: {
    knownFor: "มีชื่อเสียงด้าน",
    filmography: "ผลงานภาพยนตร์",
    noMoviesFound: "ไม่พบหนังของบุคคลนี้",
    /** TMDB's known_for_department is a small fixed enum - unmapped values fall back to the original English. */
    department: {
      Acting: "การแสดง",
      Directing: "กำกับ",
      Writing: "เขียนบท",
      Production: "งานสร้าง",
      Camera: "งานภาพ",
      Editing: "ตัดต่อ",
      Sound: "งานเสียง",
      Art: "งานศิลป์",
      "Costume & Make-Up": "เครื่องแต่งกายและแต่งหน้า",
      "Visual Effects": "เทคนิคพิเศษ",
      Crew: "ทีมงาน",
      Lighting: "จัดแสง",
    } as Record<string, string>,
  },
  personError: {
    title: "ไม่สามารถโหลดข้อมูลบุคคลนี้ได้",
    body: "เกิดข้อผิดพลาดขณะดึงข้อมูลโปรไฟล์จาก TMDB กรุณาลองใหม่อีกครั้ง",
  },
  company: {
    movies: "หนัง",
    noMoviesFound: "ไม่พบหนังของบริษัทนี้",
  },
  companyError: {
    title: "ไม่สามารถโหลดข้อมูลบริษัทนี้ได้",
    body: "เกิดข้อผิดพลาดขณะดึงข้อมูลบริษัทจาก TMDB กรุณาลองใหม่อีกครั้ง",
  },
  notFound: {
    title: "ไม่พบหน้านี้",
    body: "หน้าที่คุณค้นหาอาจถูกย้ายหรือไม่มีอยู่จริง",
    backHome: "กลับหน้าแรก",
  },
  streaming: {
    /** Compact MovieCard section label. */
    whereToWatch: "ดูได้ที่",
    /** Movie detail page section heading. */
    sectionTitle: "ช่องทางการรับชม",
    streaming: "สตรีมมิ่ง",
    rent: "เช่า",
    buy: "ซื้อ",
    notFound: "ไม่พบข้อมูลช่องทางรับชม",
    more: (count: number) => `+${count}`,
    attribution: "ข้อมูลผู้ให้บริการจาก JustWatch",
  },
  /** Phase 3: personalized streaming-service recommendation ("/streaming"). */
  streamingRecommendation: {
    pageTitle: "บริการสตรีมมิ่งที่เหมาะกับคุณ",
    pageSubtitle: "วิเคราะห์จากหนังที่คุณสนใจ ไม่ใช่ความนิยมทั่วไป",
    /** Always shown alongside any result - the core "this is personalization, not a quality claim" disclaimer. */
    disclaimer: "คำแนะนำนี้อิงจากหนังที่คุณสนใจเท่านั้น ไม่ได้สะท้อนคุณภาพหรือความนิยมของผู้ให้บริการ โปรดใช้เป็นข้อมูลประกอบการตัดสินใจ",
    bestMatchLabel: "บริการที่เหมาะกับคุณที่สุด",
    matchCount: (count: number) => `เหมาะกับหนังที่คุณสนใจ ${count} เรื่อง`,
    watchMatches: (count: number) => `ดูหนังที่ตรงกับคุณได้ ${count} เรื่อง`,
    whySectionTitle: "ทำไมเราถึงแนะนำ",
    /** Deterministic, template-based reason sentence - never LLM-generated. */
    reason: (providerName: string, favoriteCount: number, watchedOnlyCount: number) => {
      if (favoriteCount > 0 && watchedOnlyCount > 0) {
        return `แนะนำ ${providerName} เพราะมีหนังที่ตรงกับรายการโปรดของคุณ ${favoriteCount} เรื่อง และหนังที่คุณดูแล้ว ${watchedOnlyCount} เรื่อง`;
      }
      if (favoriteCount > 0) {
        return `แนะนำ ${providerName} เพราะมีหนังที่ตรงกับรายการโปรดของคุณ ${favoriteCount} เรื่อง`;
      }
      return `แนะนำ ${providerName} เพราะมีหนังที่คุณดูแล้ว ${watchedOnlyCount} เรื่อง`;
    },
    matchingMoviesTitle: "หนังที่ตรงกับคุณ",
    comparisonTitle: "เปรียบเทียบผู้ให้บริการ",
    otherProvidersTitle: "บริการอื่นที่อาจเหมาะกับคุณ",
    /** Column/metric label - must always appear next to the percentage, per Phase 3 Part 8. */
    scoreLabel: "คะแนนความตรงกับความสนใจของคุณ",
    /** Shown when confidence is "low" (some data, but not much) - hedges without hiding the result. */
    lowConfidenceHint: "ผลลัพธ์นี้อ้างอิงจากข้อมูลเบื้องต้น ยิ่งเพิ่มหนังที่ชอบ คำแนะนำจะยิ่งแม่นยำขึ้น",
    emptyState: "เพิ่มหนังที่ชอบเพื่อให้เราช่วยวิเคราะห์บริการที่เหมาะกับคุณ",
    insufficientState: "เรายังมีข้อมูลไม่พอสำหรับแนะนำบริการที่แม่นยำ",
    insufficientDetail: (count: number, min: number) => `ตอนนี้คุณมีหนังที่สนใจ ${count} เรื่อง (ต้องการอย่างน้อย ${min} เรื่อง)`,
    /** All interest movies are TH-unavailable for streaming (may still have rent/buy, which this feature deliberately ignores). */
    noStreamingMatch: "หนังที่คุณสนใจยังไม่มีให้บริการแบบสตรีมมิ่งในไทยตอนนี้",
    goToMovies: "ดูหนังทั้งหมด →",
    goToFavorites: "ไปที่รายการโปรด →",
    loadError: "ไม่สามารถวิเคราะห์บริการสตรีมมิ่งได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง",
  },
  /** Phase 4: recommendation engine v2 explanation templates (Part 6). One
   *  template per lib/recommendations-v2.ts MatchReason variant - never
   *  LLM-generated, always built from the actual matched signal's data. */
  recommendationReason: {
    preferredGenre: (genreName: string) => `เพราะคุณชอบหนังแนว ${genreName}`,
    favoriteGenre: (genreName: string) => `คุณดูและชอบหนังแนว ${genreName} หลายเรื่อง`,
    favoriteSimilarity: (favoriteTitle: string) => `คล้ายกับหนังที่คุณ Favorite: ${favoriteTitle}`,
    directorAffinity: (personName: string) => `มีผู้กำกับเดียวกับหนังที่คุณชอบ: ${personName}`,
    actorAffinity: (personName: string) => `นักแสดงคนนี้อยู่ในหนังที่คุณ Favorite: ${personName}`,
    companyAffinity: (companyName: string) => `จากค่ายหนังเดียวกับหนังที่คุณชอบ: ${companyName}`,
    /** v3 - keyword/theme affinity (Discovery v3 Part 1/6). */
    keywordAffinity: (keywordName: string) => `มีธีม "${keywordName}" คล้ายกับหนังที่คุณชอบ`,
    popular: "กำลังเป็นที่นิยม",
  },
} as const;

/**
 * Turns a single MatchReason into its Thai sentence - the one place that
 * knows how to render every variant, so components don't each need their
 * own switch statement. Deterministic, template-based (Part 6) - never
 * LLM-generated.
 */
export function explainMatchReason(reason: MatchReason): string {
  switch (reason.type) {
    case "preferredGenre":
      return th.recommendationReason.preferredGenre(reason.genreName);
    case "favoriteGenre":
      return th.recommendationReason.favoriteGenre(reason.genreName);
    case "favoriteSimilarity":
      return th.recommendationReason.favoriteSimilarity(reason.favoriteTitle);
    case "directorAffinity":
      return th.recommendationReason.directorAffinity(reason.personName);
    case "actorAffinity":
      return th.recommendationReason.actorAffinity(reason.personName);
    case "companyAffinity":
      return th.recommendationReason.companyAffinity(reason.companyName);
    case "keywordAffinity":
      return th.recommendationReason.keywordAffinity(reason.keywordName);
    case "popular":
      return th.recommendationReason.popular;
  }
}

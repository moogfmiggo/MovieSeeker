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

export const th = {
  meta: {
    brand: "MovieSeeker",
    defaultTitle: "MovieSeeker — ค้นหาหนังที่ใช่สำหรับคุณ",
    defaultDescription: "ค้นพบหนังที่ตรงกับรสนิยมของคุณ",
    titleSuffix: "— MovieSeeker",
  },
  nav: {
    movies: "หนัง",
    preferences: "ตั้งค่าความชอบ",
    watched: "ดูแล้ว",
    favorites: "รายการโปรด",
    streaming: "บริการสตรีมมิ่ง",
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
  home: {
    title: "ค้นหาหนังที่ใช่สำหรับคุณ",
    subtitle: "ค้นพบหนังที่ตรงกับรสนิยมของคุณ",
    cta: "ค้นหาหนัง",
  },
  moviesPage: {
    title: "หนังยอดนิยม",
    subtitle: "ข้อมูลสดจาก TMDB",
  },
  moviesError: {
    title: "ไม่สามารถโหลดหนังได้",
    body: "เกิดข้อผิดพลาดขณะดึงข้อมูลหนังจาก TMDB กรุณาลองใหม่อีกครั้ง",
  },
  movieList: {
    recommendedForYou: "แนะนำสำหรับคุณ",
    noMoviesFound: "ไม่พบหนัง",
    allWatched: "คุณดูหนังทั้งหมดในรายการนี้แล้ว",
    showWatchedToo: "แสดงหนังที่ดูแล้ว",
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
    title: "ตั้งค่าความชอบ",
    subtitle: "เลือกแนวหนังที่คุณชอบ เราจะใช้สิ่งนี้เพื่อปรับแต่งคำแนะนำในภายหลัง",
    noneSelected: "ยังไม่ได้เลือกแนว",
    selectedCount: (count: number) => `เลือกแล้ว ${count} แนว`,
    save: "บันทึกความชอบ",
    saved: "บันทึกความชอบแล้ว",
    saveError: "ไม่สามารถบันทึกความชอบได้ กรุณาลองใหม่อีกครั้ง",
    goToMovies: "ดูหนังทั้งหมด →",
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
} as const;

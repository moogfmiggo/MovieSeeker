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
} as const;

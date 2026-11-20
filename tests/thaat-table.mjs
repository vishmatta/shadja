// The 10 thaats (parent scales) as pitch classes: the reference table from #69 (lowercase = komal, M♯ = tivra).
// The app's own THAATS table in index.html must match it (raga-rules.test.mjs, thaats.test.mjs).
export const THAATS_EXPECTED = {
  Kalyan:   [0, 2, 4, 6, 7, 9, 11],   // S R G M♯ P D N   (Lydian)
  Bilawal:  [0, 2, 4, 5, 7, 9, 11],   // S R G M P D N    (Major / Ionian)
  Khamaj:   [0, 2, 4, 5, 7, 9, 10],   // S R G M P D n    (Mixolydian)
  Kafi:     [0, 2, 3, 5, 7, 9, 10],   // S R g M P D n    (Dorian)
  Asavari:  [0, 2, 3, 5, 7, 8, 10],   // S R g M P d n    (Natural minor / Aeolian)
  Bhairavi: [0, 1, 3, 5, 7, 8, 10],   // S r g M P d n    (Phrygian)
  Bhairav:  [0, 1, 4, 5, 7, 8, 11],   // S r G M P d N    (Double harmonic major)
  Poorvi:   [0, 1, 4, 6, 7, 8, 11],   // S r G M♯ P d N
  Marwa:    [0, 1, 4, 6, 7, 9, 11],   // S r G M♯ P D N
  Todi:     [0, 1, 3, 6, 7, 8, 11],   // S r g M♯ P d N
};

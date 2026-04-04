# Code Review - 2026-04-04

## Wysoky priorytet

- [x] **Bug: UTF-8 w similarity()** — `src-tauri/src/commands/exercise.rs`
  - `similarity()` używa `a.len()` (bajty) zamiast `a.chars().count()` do normalizacji
  - Zaniża similarity dla znaków wielobajtowych (ä, ö, ü)

- [x] **Brak walidacji input w check_exercise_answer** — `src-tauri/src/commands/exercise.rs`
  - Brak limitu długości stringów, Levenshtein to O(n*m) — potencjalny DoS

- [x] **Inline SVG w Dialog.tsx** — `src/components/ui/Dialog.tsx:84-91`
  - Ręczny SVG zamiast `CloseIcon` z `components/icons/`

- [x] **Stale closures — wyłączone eslint deps**
  - `src/components/PhraseRefinementDialog.tsx` — `loadOrCreateThread` owinięty w `useCallback`
  - `src/views/PhraseLibraryView.tsx` — `loadPhrases` owinięty w `useCallback`
  - `src/components/SentenceThreadDialog.tsx` — `loadThread` owinięty w `useCallback`

## Średni priorytet — Powtórzenia i DRY

- [x] **Row mapping functions rozrzucone** — przenieść do `utils/db.rs`
  - `row_to_phrase_thread` z `commands/phrases.rs`
  - `row_to_material`, `row_to_material_thread` z `commands/materials.rs`
  - `row_to_tag` z `commands/tags.rs`

- [x] **Powtórzone SELECT query strings** — ten sam ciąg kolumn fraz (8+ miejsc) i materiałów, powinny być stałymi

- [x] **Duplikacja logiki TTS** — `src/hooks/useTTS.ts` i `src/hooks/useAudioPlayback.ts` mają niemal identyczną logikę generowania/odtwarzania audio

- [x] **Import logic w data_export.rs** — wyodrębniono helper functions per encja (`insert_material`, `insert_phrase`, `insert_phrase_thread`, `insert_material_thread`, `import_setting`)

- [x] **Batch insert N+1** — `src-tauri/src/commands/phrases.rs:195-207` — po wstawieniu N fraz każda pobierana osobno, powinien być `SELECT ... WHERE id IN (...)`

## Średni priorytet — Modularność

- [x] **PhraseExerciseView.tsx (~1024 linie)** — split na Setup/Exercise/Results
- [ ] **data_export.rs (766 linii)** — split export/import/duplicates
- [ ] **phrases.rs (473 linie)** — wydzielić phrase_threads
- [ ] **SettingsView.tsx** — wydzielić sekcje do osobnych komponentów

- [ ] **AppError nieużywany** — `src-tauri/src/utils/error.rs` definiuje `AppError` ale cały codebase używa `Result<T, String>` z ręcznym `format!()`

## Niski priorytet — Spójność i drobnostki

- [ ] **Niespójna obsługa błędów na frontendzie** — część `.catch(console.error)`, część try/catch z toast — ustandaryzować na toast
- [ ] **Nieprawdziwy LRU cache** — `src/hooks/useAudioPlayback.ts:138-142` — usuwa wg insertion order, nie wg ostatniego użycia
- [ ] **Zbędny explicit drop()** — `src-tauri/src/commands/audio.rs:179` — celowy (zwalnia lock przed I/O), zostawiony
- [x] **Brak walidacji zakresów w settings** — `src-tauri/src/commands/settings.rs:49` — dodano `.clamp(1, 10)`
- [x] **Cicha ignoracja błędów JSON** — `src-tauri/src/commands/practice.rs:247-267` — dodano `eprintln!` z kontekstem błędu
- [x] **Nieużywany prop phraseId** — `src/components/phrases/PhraseActions.tsx:6`
- [x] **VoiceButton.tsx** — zamieniono template literals na `cn()`

// Preload that makes Node look like Hermes for the one thing that matters here: no Intl.Segmenter.
globalThis.__nativeSegmenter = Intl.Segmenter;
delete Intl.Segmenter;

# Vendored fonts

These four static instances back the OpenGraph card in
[`app/opengraph-image.tsx`](../../app/opengraph-image.tsx).

Satori, the renderer behind `next/og`, will not fetch a webfont: any family the
card names has to be handed to it as bytes.
Without these it falls back to a generic system sans, which is what made the
card read as some other site's preview.

The page itself does not use these files.
It loads the same two families through `next/font/google`, so the browser gets
the variable versions and the card gets these static ones.

| File | Family | Style |
| --- | --- | --- |
| `Fraunces-SemiBold.ttf` | Fraunces | 600 |
| `Fraunces-SemiBoldItalic.ttf` | Fraunces | 600 italic |
| `Outfit-Regular.ttf` | Outfit | 400 |
| `Outfit-SemiBold.ttf` | Outfit | 600 |

Both families are licensed under the SIL Open Font License 1.1, which permits
redistribution alongside the project.

- Fraunces - https://github.com/undercasetype/Fraunces
- Outfit - https://github.com/Outfitio/Outfit-Fonts

Latin subsets as served by Google Fonts.
Replacing a file means replacing the matching entry in the `fonts` array of the
image route, since the weight and style there are declared by hand.

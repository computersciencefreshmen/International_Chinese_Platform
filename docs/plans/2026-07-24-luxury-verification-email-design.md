# Luxury verification email design

## Goal

Turn the registration verification email into a trustworthy brand touchpoint
without weakening deliverability, accessibility, security, or support for older
mail clients.

## Visual direction

The selected direction is **Eastern academy meets international editorial**.
It reuses the product palette instead of introducing a separate email brand:

- warm ivory `#fffdf7` and parchment `#f1eee5` for the canvas;
- ink teal `#172c35` for the main panel and typography;
- cinnabar `#bf3d2f` for the verification action;
- restrained champagne gold `#c9a86a` for dividers and small details.

The memorable element is a six-digit code presented like a contemporary
digital seal. Generous whitespace, one display-serif heading, precise
bilingual microcopy, and thin ornamental rules provide the premium character.
There are no stock illustrations, gradients, tracking pixels, remote fonts, or
generic app-style cards.

## Information hierarchy

1. Hidden preheader: explains that this is a time-sensitive registration step
   without exposing the code on a lock screen.
2. Brand masthead: Chinese platform name, small English descriptor, and a
   typographic seal.
3. Main message: concise welcome and one instruction.
4. Verification panel: six-digit code, ten-minute duration, and exact expiry in
   Asia/Shanghai.
5. Security note: never share the code; ignore the email when unrequested.
6. Quiet footer: transactional-email explanation and copyright line.

## Architecture and compatibility

`createVerificationMessage` remains the only renderer. The HMAC relay payload,
SMTP transport configuration, API validation, and registration flow do not
change. The email uses presentation tables and inline styles because Outlook
desktop still relies on a Word-based renderer. A small mobile media query is
progressive enhancement; the base layout remains usable when style blocks are
removed.

Dynamic values are HTML-escaped even though the API already restricts the code
to six digits. The HTML contains no remote image, script, form, or CSS URL. A
complete plain-text alternative remains mandatory.

## Acceptance criteria

- Gmail accepts the production message and the API returns no development code.
- The message is readable at 320 px and 640 px widths.
- The code is prominent, selectable, and present in both HTML and plain text.
- Content remains understandable with images disabled and CSS partially
  stripped.
- Automated tests protect subject, expiry, escaping, structure, and the absence
  of remote assets.

/**
 * Help examples shown by the Browser CLI root command.
 */
/** Core Browser CLI examples for lifecycle and inspection commands. */
export const browserCoreExamples = [
  "mo browser status",
  "mo browser start",
  "mo browser start --headless",
  "mo browser stop",
  "mo browser tabs",
  "mo browser open https://example.com",
  "mo browser focus abcd1234",
  "mo browser close abcd1234",
  "mo browser screenshot",
  "mo browser screenshot --full-page",
  "mo browser screenshot --ref 12",
  "mo browser snapshot",
  "mo browser snapshot --format aria --limit 200",
  "mo browser snapshot --efficient",
  "mo browser snapshot --labels",
];

/** Browser CLI examples for interaction/action commands. */
export const browserActionExamples = [
  "mo browser navigate https://example.com",
  "mo browser resize 1280 720",
  "mo browser click 12 --double",
  "mo browser click-coords 120 340",
  'mo browser type 23 "hello" --submit',
  "mo browser press Enter",
  "mo browser hover 44",
  "mo browser drag 10 11",
  "mo browser select 9 OptionA OptionB",
  "mo browser upload /tmp/mo/uploads/file.pdf",
  "mo browser upload media://inbound/file.pdf",
  'mo browser fill --fields \'[{"ref":"1","value":"Ada"}]\'',
  "mo browser dialog --accept",
  'mo browser wait --text "Done"',
  "mo browser evaluate --fn '(el) => el.textContent' --ref 7",
  "mo browser evaluate --fn 'const title = document.title; return title;'",
  "mo browser console --level error",
  "mo browser pdf",
];

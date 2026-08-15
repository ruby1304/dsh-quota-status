# Third-party notices

`src/vendor/schemastery.mjs`, `src/vendor/cosmokit.js` and
`schemastery.d.mts` are vendored from
[Schemastery 3.18.1](https://github.com/shigma/schemastery) and its cosmokit
runtime, MIT License (c) Shigma.

The vendored runtime is copied into `lib/vendor/` by `scripts/copy-vendor.mjs`
so the published bundle has zero runtime dependencies. It is used under the
original MIT terms; no modifications are made.

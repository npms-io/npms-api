# Changelog


# v2.0.0 - 2016-09-19

- Change `?term` to `?q` in the `/search` endpoint, which now supports [qualifiers](https://api-docs.npms.io/#api-search-query) to filter and modify results
- Removed `scoreEffect`, `qualityWeight`, `maintenanceWeight` and `popularityWeight` from `/search` in favor of qualifiers
- Change `/module` to `/package`
- Changed `module` to `package` in every response
- Add `flags` to the search & suggestions responses

This new API is available under `https://api.npms.io/v2`.

The `v1` is deprecated and will be removed on 2016-12-19.
Until then `https://api.npms.io` will still point to `v1`. Afterwards, it will always point to the latest API version.


# v1.0.0

Initial release.

This new API is available under `https://api.npms.io/v1`.

## Base URL

The API is available under `https://api.npms.io/<version>`. If the version is not specified, the latest API version will be used.

New features, updates and changes are listed in the [changelog](https://github.com/npms-io/npms-api/blob/master/CHANGELOG.md). Additionally you should follow [@npms_io](https://twitter.com/npms_io) on twitter for announcements.


## Response format

All responses are `JSON`, including error responses which have the following structure:

```js
{
    code: 'INTERNAL',
    message: 'An internal error ocurred'
}
```

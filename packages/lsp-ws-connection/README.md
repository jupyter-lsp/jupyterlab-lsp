# lsp-ws-connection

## Installation

Current requirements:

- Language server running on a web socket connection, such as [jsonrpc-ws-proxy](https://github.com/wylieconlon/jsonrpc-ws-proxy)

## Developing

To develop against this library, and see updates in the example, run both of these:

```
# From parent directory
npx webpack --watch
```

```
# From example directory
npm run dev
```

To run library tests, there are two options:

```
npm test
npm run test-dev
```

test-dev will watch the source code and rerun tests in the background

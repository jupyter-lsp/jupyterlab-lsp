// TODO: remove after upgrading to JupyterLab 4.0
const util = require('util');
(global as any).TextDecoder = util.TextDecoder;
(global as any).TextEncoder = util.TextEncoder;

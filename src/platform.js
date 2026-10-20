/**
 * Native adapter entry: install capabilities before publishing the adapter.
 * These are real ES modules. The TV build statically links imports without a loader.
 */
import './platform/state.js';
import './platform/operations.js';
import './platform/apps.js';
import './platform/sources.js';
import './platform/system.js';
import './platform/commands.js';
import './platform/bootstrap.js';

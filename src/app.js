/**
 * Launcher entry: environment, views/controllers, then startup.
 * These are real ES modules. The TV build statically links imports without a loader.
 */
import './launcher/environment.js';
import './launcher/state.js';
import './launcher/views/html.js';
import './launcher/preferences.js';
import './launcher/presentation.js';
import './launcher/catalogue.js';
import './launcher/home-model.js';
import './launcher/views/tiles.js';
import './launcher/views/home.js';
import './launcher/focus.js';
import './launcher/actions.js';
import './launcher/views/inputs.js';
import './launcher/overlays.js';
import './launcher/views/menu.js';
import './launcher/customization.js';
import './launcher/views/text-dialog.js';
import './launcher/views/controls.js';
import './launcher/scene.js';
import './launcher/weather.js';
import './launcher/ambient.js';
import './launcher/remote.js';
import './launcher/lifecycle.js';

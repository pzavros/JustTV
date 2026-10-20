import { adapter, strings, tizen } from './state.js';
import { readSafely, recordReadFailure, recordReadResult } from './operations.js';

/**
 * Enumerate actual connected and disconnected TV inputs.
 */
adapter.refreshSources = function () {
  if (!tizen) return;
  readSafely('sources', function () {
    tizen.systeminfo.getPropertyValue(
      'VIDEOSOURCE',
      function (v) {
        var arr = [],
          seen = {},
          i,
          a,
          sets = [v.connected || [], v.disconnected || []],
          j;
        for (j = 0; j < sets.length; j++)
          for (i = 0; i < sets[j].length; i++) {
            a = sets[j][i];
            var id = a.type + ':' + a.number;
            if (seen[id]) continue;
            seen[id] = true;
            arr.push({
              id: id,
              name: a.type === 'TV' ? strings.live : a.type + (a.number ? ' ' + a.number : ''),
              type: a.type,
              number: a.number,
              connected: j === 0,
              raw: a
            });
          }
        adapter.sources = arr;
        recordReadResult('sources', true, arr.length);
        adapter.onChange('sources');
      },
      function (e) {
        recordReadFailure('sources', e);
        adapter.onChange('sources');
      }
    );
  });
};
